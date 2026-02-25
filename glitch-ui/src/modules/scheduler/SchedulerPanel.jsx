import { useEffect, useState } from 'react';
import { useStore } from '../../core/store';
import {
  RefreshCw, Plus, Trash2, PauseCircle, PlayCircle, AlertTriangle,
  ChevronDown, ChevronRight, Moon, Calendar, List,
} from 'lucide-react';
import './SchedulerPanel.css';

const TIME_PRESETS = ['5m','10m','15m','20m','30m','1h','2h','3h','6h','12h','1d'];

const CRON_PRESETS = [
  { label: 'Every 15 min',  value: '*/15 * * * *' },
  { label: 'Every hour',    value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily 9am',     value: '0 9 * * *' },
  { label: 'Daily 10pm',    value: '0 22 * * *' },
  { label: 'One-time…',     value: '__once__' },
  { label: 'Custom cron…',  value: '__custom__' },
];

function dateTimeToCron(date, time) {
  const [h, m] = time.split(':').map(Number);
  const [, mon, day] = date.split('-').map(Number);
  return `${m} ${h} ${day} ${mon} *`;
}

function timeToCron(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${m} ${h} * * *`;
}

// ── Agenda grouping ────────────────────────────────────────────────────────────

function parseNext(next) {
  if (!next) return null;
  // Handle "2026-02-26" or "2026-02-26 09:00" or ISO format
  const s = next.includes('T') ? next : next.replace(' ', 'T');
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function groupJobs(jobs) {
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd  = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);

  const groups = { today: [], week: [], later: [], disabled: [] };
  [...jobs]
    .sort((a, b) => (parseNext(a.next) || 0) - (parseNext(b.next) || 0))
    .forEach(job => {
      if (job.status === 'disabled') { groups.disabled.push(job); return; }
      const d = parseNext(job.next);
      if (!d || d <= todayEnd)     groups.today.push(job);
      else if (d <= weekEnd)       groups.week.push(job);
      else                         groups.later.push(job);
    });
  return groups;
}

function fmtNext(next) {
  const d = parseNext(next);
  if (!d) return next || '—';
  const now = new Date();
  const diffMs = d - now;
  if (diffMs < 0) return 'past';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `in ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return diffD === 1 ? 'tomorrow' : `in ${diffD}d`;
}

// ── AgendaCard ─────────────────────────────────────────────────────────────────

function AgendaCard({ job, expanded, history, connected, nameCounts, onExpand, onToggle, onDelete }) {
  const statusClass = job.status === 'ok' ? 'badge-success'
    : job.status === 'error' ? 'badge-danger'
    : 'badge-default';

  return (
    <div className={`sched-agenda-card ${job.status === 'disabled' ? 'job-disabled' : ''} ${nameCounts[job.name] > 1 ? 'job-dup' : ''}`}>
      <div className="sched-agenda-row">
        <button
          className="btn-ghost btn-xs sched-expand-btn"
          onClick={() => onExpand(job.id)}
          title="View run history"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        <div className="sched-agenda-info">
          <div className="sched-agenda-name-row">
            <span className="sched-job-name">{job.name}</span>
            {nameCounts[job.name] > 1 && <span className="badge badge-warn">DUP</span>}
            <span className={`badge ${statusClass}`}>{job.status}</span>
          </div>
          <div className="sched-agenda-meta-row">
            <span className="sched-agenda-schedule">{job.schedule}</span>
            <span className="sched-agenda-next">{fmtNext(job.next)}</span>
            {job.last && <span className="sched-agenda-last">last {job.last}</span>}
          </div>
        </div>

        <div className="sched-job-actions">
          <button
            className="btn-ghost btn-xs"
            onClick={() => onToggle(job)}
            disabled={!connected}
            title={job.status === 'disabled' ? 'Enable' : 'Disable'}
          >
            {job.status === 'disabled' ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
          </button>
          <button
            className="btn-ghost btn-xs"
            onClick={() => onDelete(job.id)}
            disabled={!connected}
            style={{ color: 'var(--danger)' }}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="sched-job-history">
          {history
            ? <pre className="sched-history-pre">{history}</pre>
            : <span className="sched-form-hint">Loading…</span>
          }
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SchedulerPanel() {
  const { cronJobs, cronLoading, loadCronJobs, connected, runCmd, modelProfiles, schedulerView, setSchedulerView } = useStore();
  const [log, setLog] = useState('');

  // Agenda vs new-job views — store-backed (survives tab switches)
  const view    = schedulerView;
  const setView = setSchedulerView;

  // Add job tabs
  const [addTab, setAddTab] = useState('reminder');

  // Reminder form
  const [remind, setRemind] = useState({ time: '20m', msg: '' });
  const [adding, setAdding] = useState(false);

  // Agent Run form
  const [agentForm, setAgentForm] = useState({
    name: '', schedule: '0 * * * *', schedulePreset: '0 * * * *', agent: 'main', message: '', model: '',
  });
  const [agentCustom, setAgentCustom] = useState(false);
  const [agentOnce, setAgentOnce] = useState(false);
  const [onceDate, setOnceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [onceTime, setOnceTime] = useState('09:00');

  // Overnight Project form
  const [overnight, setOvernight] = useState({
    goal: '', repo: '/root/repos/', model: 'workspaces', runAt: '22:00', maxTokens: '50000', name: '',
  });

  // Per-job history expand
  const [expandedJob, setExpandedJob] = useState(null);
  const [jobHistory, setJobHistory]   = useState({});

  useEffect(() => { if (connected) loadCronJobs(); }, [connected]); // eslint-disable-line

  const nameCounts = cronJobs.reduce((a, j) => { a[j.name] = (a[j.name] || 0) + 1; return a; }, {});
  const hasDups    = Object.values(nameCounts).some(n => n > 1);
  const groups     = groupJobs(cronJobs);

  // ── Reminder ───────────────────────────────────────────────────────────────
  const addReminder = async () => {
    if (!remind.msg.trim()) return;
    setAdding(true);
    const r = await runCmd(`tgremind ${remind.time} "${remind.msg.replace(/"/g, '\\"')}" 2>&1`);
    setLog(r.stdout + r.stderr);
    setRemind(v => ({ ...v, msg: '' }));
    await loadCronJobs();
    setAdding(false);
    setView('agenda');
  };

  // ── Agent Run ──────────────────────────────────────────────────────────────
  const addAgentRun = async () => {
    const { name, agent, message, model } = agentForm;
    if (!message.trim()) return;
    setAdding(true);
    const safeName = (name.trim() || `agent-run-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, '-');
    const modelFlag = model ? ` --model ${model}` : '';
    let schedule, onceFlag = '';
    if (agentOnce) {
      schedule = dateTimeToCron(onceDate, onceTime);
      onceFlag = ' --once';
    } else {
      schedule = agentForm.schedule;
    }
    const cmd = `openclaw cron add --name "${safeName}" --schedule "${schedule}"${onceFlag} --agent ${agent} --message "${message.replace(/"/g, '\\"')}"${modelFlag} 2>&1`;
    const r = await runCmd(cmd);
    setLog(r.stdout + r.stderr);
    await loadCronJobs();
    setAdding(false);
    setView('agenda');
  };

  // ── Overnight Project ──────────────────────────────────────────────────────
  const addOvernightProject = async () => {
    const { goal, repo, model, runAt, maxTokens, name } = overnight;
    if (!goal.trim()) return;
    setAdding(true);
    const cronExpr = timeToCron(runAt);
    const safeName = (name.trim() || `overnight-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, '-');
    const effectiveModel = modelProfiles?.[model] || model || '';
    const modelFlag = effectiveModel ? ` --model ${effectiveModel}` : '';
    const tokenFlag = maxTokens ? ` --max-tokens ${maxTokens}` : '';
    const fullMsg = `[Overnight Project] ${goal.trim()}${repo ? `\n\nWork in: ${repo}` : ''}`;
    const cmd = `openclaw cron add --name "${safeName}" --schedule "${cronExpr}" --once --agent main --message "${fullMsg.replace(/"/g, '\\"')}"${modelFlag}${tokenFlag} 2>&1`;
    setLog(`Command:\n${cmd}\n\nRunning…`);
    const r = await runCmd(cmd);
    setLog(`Command:\n${cmd}\n\nOutput:\n${r.stdout + r.stderr}`);
    await loadCronJobs();
    setAdding(false);
    setView('agenda');
  };

  // ── Job actions ────────────────────────────────────────────────────────────
  const deleteJob = async (id) => {
    const r = await runCmd(`openclaw cron delete --id ${id} 2>&1`);
    setLog(r.stdout + r.stderr);
    await loadCronJobs();
  };

  const toggleJob = async (job) => {
    const cmd = job.status === 'disabled'
      ? `openclaw cron enable --id ${job.id} 2>&1`
      : `openclaw cron disable --id ${job.id} 2>&1`;
    const r = await runCmd(cmd);
    setLog(r.stdout + r.stderr);
    await loadCronJobs();
  };

  const loadJobHistory = async (id) => {
    if (expandedJob === id) { setExpandedJob(null); return; }
    setExpandedJob(id);
    if (jobHistory[id]) return;
    const r = await runCmd(`openclaw cron runs --id ${id} 2>&1 | head -80`);
    setJobHistory(h => ({ ...h, [id]: r.stdout.trim() || '(no runs yet)' }));
  };

  // ── Agent run schedule ──────────────────────────────────────────────────────
  const onSchedulePreset = (val) => {
    if (val === '__once__') {
      setAgentOnce(true); setAgentCustom(false);
      setAgentForm(f => ({ ...f, schedulePreset: val }));
    } else if (val === '__custom__') {
      setAgentOnce(false); setAgentCustom(true);
      setAgentForm(f => ({ ...f, schedulePreset: val }));
    } else {
      setAgentOnce(false); setAgentCustom(false);
      setAgentForm(f => ({ ...f, schedule: val, schedulePreset: val }));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="panel-wrap">
      <div className="panel-body">

        {/* ── View header ─────────────────────────────────────────────────── */}
        <div className="sched-view-header">
          <div className="sched-view-tabs">
            <button
              className={`sched-view-tab ${view === 'agenda' ? 'active' : ''}`}
              onClick={() => setView('agenda')}
            >
              <List size={13} /> Agenda
            </button>
            <button
              className={`sched-view-tab ${view === 'new' ? 'active' : ''}`}
              onClick={() => setView('new')}
            >
              <Plus size={13} /> New Job
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {hasDups && (
              <span className="badge badge-warn">
                <AlertTriangle size={10} /> Duplicates
              </span>
            )}
            <button className="btn-ghost" onClick={loadCronJobs} disabled={cronLoading || !connected} title="Refresh">
              <RefreshCw size={12} className={cronLoading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Agenda view ─────────────────────────────────────────────────── */}
        {view === 'agenda' && (
          <>
            {cronJobs.length === 0 && (
              <div className="empty sched-empty">
                {connected ? (
                  <>No jobs yet. <button className="btn-ghost btn-xs" onClick={() => setView('new')}><Plus size={11} /> Create one</button></>
                ) : 'Connect first.'}
              </div>
            )}

            {[
              { key: 'today', label: 'Today' },
              { key: 'week',  label: 'Next 7 Days' },
              { key: 'later', label: 'Later' },
              { key: 'disabled', label: 'Disabled' },
            ].map(({ key, label }) => {
              const jobs = groups[key];
              if (!jobs?.length) return null;
              return (
                <div key={key} className="sched-group">
                  <div className="sched-group-label">
                    {label}
                    <span className="badge badge-default" style={{ marginLeft: 'var(--sp-2)' }}>{jobs.length}</span>
                  </div>
                  {jobs.map(job => (
                    <AgendaCard
                      key={job.id}
                      job={job}
                      expanded={expandedJob === job.id}
                      history={jobHistory[job.id]}
                      connected={connected}
                      nameCounts={nameCounts}
                      onExpand={loadJobHistory}
                      onToggle={toggleJob}
                      onDelete={deleteJob}
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* ── New Job form ─────────────────────────────────────────────────── */}
        {view === 'new' && (
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 0 }}>
              <div className="sched-tab-bar">
                {[
                  { id: 'reminder', label: 'Reminder' },
                  { id: 'agent',    label: 'Agent Run' },
                  { id: 'overnight', label: '🌙 Overnight Project' },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`sched-tab ${addTab === t.id ? 'sched-tab-active' : ''}`}
                    onClick={() => setAddTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reminder */}
            {addTab === 'reminder' && (
              <div className="sched-form">
                <div className="sched-remind-row">
                  <select className="input sched-time-sel" value={remind.time}
                    onChange={e => setRemind(v => ({ ...v, time: e.target.value }))}>
                    {TIME_PRESETS.map(t => <option key={t} value={t}>in {t}</option>)}
                  </select>
                  <input className="input" placeholder="Reminder message…"
                    value={remind.msg}
                    onChange={e => setRemind(v => ({ ...v, msg: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addReminder()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addReminder}
                    disabled={adding || !connected || !remind.msg.trim()}>
                    <Plus size={14} /> {adding ? '…' : 'Set'}
                  </button>
                </div>
                <p className="sched-form-hint">Creates a Telegram reminder via <code>tgremind</code>.</p>
              </div>
            )}

            {/* Agent Run */}
            {addTab === 'agent' && (
              <div className="sched-form">
                <div className="sched-field-row">
                  <label className="sched-field-label">Name</label>
                  <input className="input" placeholder="my-daily-check (optional)"
                    value={agentForm.name}
                    onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Schedule</label>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', flex: 1, flexWrap: 'wrap' }}>
                    <select className="input" value={agentForm.schedulePreset} onChange={e => onSchedulePreset(e.target.value)}>
                      {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    {agentOnce && (
                      <>
                        <input type="date" className="input" style={{ flex: 1, minWidth: 120 }}
                          value={onceDate} onChange={e => setOnceDate(e.target.value)} />
                        <input type="time" className="input" style={{ width: 90 }}
                          value={onceTime} onChange={e => setOnceTime(e.target.value)} />
                      </>
                    )}
                    {agentCustom && (
                      <input className="input" placeholder="*/5 * * * *" style={{ fontFamily: 'var(--font-mono)', flex: 1 }}
                        value={agentForm.schedule}
                        onChange={e => setAgentForm(f => ({ ...f, schedule: e.target.value }))} />
                    )}
                  </div>
                </div>
                {agentOnce && (
                  <p className="sched-form-hint" style={{ marginTop: 0 }}>
                    Runs once at {onceTime} on {onceDate} → cron: <code>{dateTimeToCron(onceDate, onceTime)}</code> with <code>--once</code>
                  </p>
                )}
                <div className="sched-field-row">
                  <label className="sched-field-label">Agent</label>
                  <input className="input" placeholder="main" value={agentForm.agent}
                    onChange={e => setAgentForm(f => ({ ...f, agent: e.target.value }))} />
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Model</label>
                  <select className="input" value={agentForm.model} onChange={e => setAgentForm(f => ({ ...f, model: e.target.value }))}>
                    <option value="">— default —</option>
                    <option value={modelProfiles?.chat}>Chat ({modelProfiles?.chat})</option>
                    <option value={modelProfiles?.workspaces}>Workspaces ({modelProfiles?.workspaces})</option>
                    <option value={modelProfiles?.autonomy}>Autonomy ({modelProfiles?.autonomy})</option>
                  </select>
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Message</label>
                  <textarea className="input sched-msg-textarea" rows={3} placeholder="Task for the agent…"
                    value={agentForm.message}
                    onChange={e => setAgentForm(f => ({ ...f, message: e.target.value }))} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={addAgentRun}
                  disabled={adding || !connected || !agentForm.message.trim()}>
                  <Plus size={14} /> {adding ? 'Adding…' : 'Add Agent Run'}
                </button>
              </div>
            )}

            {/* Overnight Project */}
            {addTab === 'overnight' && (
              <div className="sched-form">
                <div className="sched-overnight-banner">
                  <Moon size={13} />
                  Schedule a one-shot autonomous project to run tonight. Set a token cap to control spend.
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Project goal</label>
                  <textarea className="input sched-msg-textarea" rows={3}
                    placeholder="e.g. Refactor the auth module in the ROG repo to use JWT, write tests, open a draft PR."
                    value={overnight.goal}
                    onChange={e => setOvernight(v => ({ ...v, goal: e.target.value }))} />
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Repo on VPS</label>
                  <input className="input" placeholder="/root/repos/owner/repo"
                    value={overnight.repo}
                    onChange={e => setOvernight(v => ({ ...v, repo: e.target.value }))} />
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Model profile</label>
                  <select className="input" value={overnight.model} onChange={e => setOvernight(v => ({ ...v, model: e.target.value }))}>
                    <option value="autonomy">Autonomy ({modelProfiles?.autonomy})</option>
                    <option value="workspaces">Workspaces ({modelProfiles?.workspaces})</option>
                  </select>
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Run at (tonight)</label>
                  <input type="time" className="input sched-time-input" value={overnight.runAt}
                    onChange={e => setOvernight(v => ({ ...v, runAt: e.target.value }))} />
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Max tokens</label>
                  <input type="number" className="input" placeholder="50000" style={{ width: 110 }}
                    value={overnight.maxTokens}
                    onChange={e => setOvernight(v => ({ ...v, maxTokens: e.target.value }))} />
                  <span className="sched-form-hint" style={{ margin: 0 }}>
                    ≈ £{((parseInt(overnight.maxTokens)||50000)/1e6 * 3).toFixed(2)} at Opus rates
                  </span>
                </div>
                <div className="sched-field-row">
                  <label className="sched-field-label">Job name</label>
                  <input className="input" placeholder={`overnight-${Date.now()}`}
                    value={overnight.name}
                    onChange={e => setOvernight(v => ({ ...v, name: e.target.value }))} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={addOvernightProject}
                  disabled={adding || !connected || !overnight.goal.trim()}>
                  <Moon size={14} /> {adding ? 'Scheduling…' : `Schedule for ${overnight.runAt}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Output log */}
        {log && (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Output <button className="btn-ghost" onClick={() => setLog('')}>Clear</button>
            </div>
            <pre className="sched-history-pre">{log}</pre>
          </div>
        )}

      </div>
    </div>
  );
}

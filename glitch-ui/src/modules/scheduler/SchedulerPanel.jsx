import { useEffect, useState } from 'react';
import { useStore } from '../../core/store';
import { RefreshCw, Plus, Trash2, PauseCircle, AlertTriangle } from 'lucide-react';
import './SchedulerPanel.css';

const TIME_PRESETS = ['5m','10m','15m','20m','30m','1h','2h','3h','6h','12h','1d'];

export default function SchedulerPanel() {
  const { cronJobs, cronLoading, loadCronJobs, connected, runCmd } = useStore();
  const [remind, setRemind] = useState({ time: '20m', msg: '' });
  const [adding, setAdding] = useState(false);
  const [log, setLog] = useState('');

  useEffect(() => { if (connected) loadCronJobs(); }, [connected]);

  const nameCounts = cronJobs.reduce((a, j) => { a[j.name] = (a[j.name]||0)+1; return a; }, {});
  const hasDups = Object.values(nameCounts).some(n => n > 1);

  const addReminder = async () => {
    if (!remind.msg.trim()) return;
    setAdding(true);
    const res = await runCmd(`tgremind ${remind.time} "${remind.msg.replace(/"/g,'\\"')}" 2>&1`);
    setLog(res.stdout + res.stderr);
    setRemind(r => ({ ...r, msg: '' }));
    await loadCronJobs();
    setAdding(false);
  };

  const deleteJob = async (id) => {
    const res = await runCmd(`openclaw cron delete --id ${id} 2>&1`);
    setLog(res.stdout + res.stderr);
    await loadCronJobs();
  };

  const disableJob = async (id) => {
    const res = await runCmd(`openclaw cron disable --id ${id} 2>&1`);
    setLog(res.stdout + res.stderr);
    await loadCronJobs();
  };

  return (
    <div className="panel-wrap">
      <div className="panel-body">
        {/* Quick reminder */}
        <div className="card">
          <div className="card-header">Telegram Reminder</div>
          <div className="sched-remind-row">
            <select className="select sched-time-sel" value={remind.time}
              onChange={e => setRemind(r => ({ ...r, time: e.target.value }))}>
              {TIME_PRESETS.map(t => <option key={t} value={t}>in {t}</option>)}
            </select>
            <input className="input" placeholder="Reminder message…"
              value={remind.msg}
              onChange={e => setRemind(r => ({ ...r, msg: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addReminder()}
            />
            <button className="btn btn-primary btn-sm" onClick={addReminder}
              disabled={adding || !connected || !remind.msg.trim()}>
              <Plus size={14} /> {adding ? '…' : 'Set'}
            </button>
          </div>
        </div>

        {/* Cron list */}
        <div className="card sched-list-card">
          <div className="card-header sched-list-header">
            <span>
              Cron Jobs
              {cronJobs.length > 0 && <span className="badge badge-default" style={{ marginLeft: 6 }}>{cronJobs.length}</span>}
              {hasDups && <span className="badge badge-warn" style={{ marginLeft: 6 }}><AlertTriangle size={10} /> Duplicates</span>}
            </span>
            <button className="btn-ghost" onClick={loadCronJobs} disabled={cronLoading || !connected}>
              <RefreshCw size={12} className={cronLoading ? 'spin' : ''} />
              {cronLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {cronJobs.length === 0 && (
            <div className="empty">{connected ? 'No cron jobs found.' : 'Connect first.'}</div>
          )}

          <div className="sched-jobs">
            {cronJobs.map(job => (
              <div key={job.id} className={`list-row sched-job ${nameCounts[job.name] > 1 ? 'job-dup' : ''}`}>
                <div className="sched-job-main">
                  <span className="sched-job-name">{job.name}</span>
                  {nameCounts[job.name] > 1 && <span className="badge badge-warn">DUPLICATE</span>}
                  <span className="sched-job-schedule">{job.schedule}</span>
                </div>
                <div className="sched-job-meta">
                  <span className={`badge ${job.status === 'ok' ? 'badge-success' : job.status === 'error' ? 'badge-danger' : 'badge-default'}`}>
                    {job.status}
                  </span>
                  <span className="sched-job-time">next {job.next}</span>
                </div>
                <div className="sched-job-actions">
                  <button className="btn-ghost btn-xs" onClick={() => disableJob(job.id)} disabled={!connected}>
                    <PauseCircle size={13} />
                  </button>
                  <button className="btn-ghost btn-xs" onClick={() => deleteJob(job.id)} disabled={!connected}
                    style={{ color: 'var(--danger)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {log && (
          <div className="card">
            <div className="card-header" style={{ display:'flex', justifyContent:'space-between' }}>
              Output <button className="btn-ghost" onClick={() => setLog('')}>Clear</button>
            </div>
            <pre style={{ fontFamily:'var(--font-mono)', fontSize:12, whiteSpace:'pre-wrap', color:'var(--text-primary)' }}>{log}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

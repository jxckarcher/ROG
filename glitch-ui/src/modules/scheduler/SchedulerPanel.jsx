import { useEffect, useState } from 'react';
import { useStore } from '../../core/store';
import './SchedulerPanel.css';

export default function SchedulerPanel() {
  const { cronJobs, cronLoading, loadCronJobs, connected, runCmd } = useStore();
  const [remind, setRemind] = useState({ time: '20m', msg: '' });
  const [adding, setAdding] = useState(false);
  const [actionLog, setActionLog] = useState('');

  useEffect(() => { if (connected) loadCronJobs(); }, [connected]);

  const addReminder = async () => {
    if (!remind.msg.trim()) return;
    setAdding(true);
    const escaped = remind.msg.replace(/"/g, '\\"');
    const res = await runCmd(`tgremind ${remind.time} "${escaped}" 2>&1`);
    setActionLog(res.stdout + res.stderr);
    setRemind(r => ({ ...r, msg: '' }));
    await loadCronJobs();
    setAdding(false);
  };

  const deleteJob = async (id) => {
    const res = await runCmd(`openclaw cron delete --id ${id} 2>&1`);
    setActionLog(res.stdout + res.stderr);
    await loadCronJobs();
  };

  const disableJob = async (id) => {
    const res = await runCmd(`openclaw cron disable --id ${id} 2>&1`);
    setActionLog(res.stdout + res.stderr);
    await loadCronJobs();
  };

  // Detect duplicates by name
  const nameCounts = cronJobs.reduce((acc, j) => { acc[j.name] = (acc[j.name] || 0) + 1; return acc; }, {});

  return (
    <div className="panel scheduler-panel">
      <div className="panel-header">
        <h2>Scheduler</h2>
        <button className="btn btn-secondary" onClick={loadCronJobs} disabled={cronLoading || !connected}>
          {cronLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Quick reminder */}
      <div className="section-card">
        <div className="section-title">Quick Telegram Reminder</div>
        <div className="remind-row">
          <select
            className="select"
            value={remind.time}
            onChange={e => setRemind(r => ({ ...r, time: e.target.value }))}
          >
            {['5m','10m','15m','20m','30m','1h','2h','3h','6h','12h','1d'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Reminder message…"
            value={remind.msg}
            onChange={e => setRemind(r => ({ ...r, msg: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addReminder()}
          />
          <button className="btn btn-primary" onClick={addReminder} disabled={adding || !connected || !remind.msg.trim()}>
            {adding ? '…' : 'Set'}
          </button>
        </div>
      </div>

      {/* Cron job list */}
      <div className="section-card cron-list-card">
        <div className="section-title">
          Cron Jobs
          {cronJobs.length > 0 && <span className="badge">{cronJobs.length}</span>}
          {Object.values(nameCounts).some(n => n > 1) && (
            <span className="badge badge-warn">Duplicates detected</span>
          )}
        </div>
        {cronJobs.length === 0 && !cronLoading && (
          <div className="empty-state">No cron jobs. Connect and refresh.</div>
        )}
        <div className="cron-jobs">
          {cronJobs.map(job => (
            <div key={job.id} className={`cron-job ${nameCounts[job.name] > 1 ? 'job-dup' : ''}`}>
              <div className="job-info">
                <span className="job-name">{job.name}</span>
                {nameCounts[job.name] > 1 && <span className="dup-tag">DUPLICATE</span>}
                <span className="job-schedule">{job.schedule}</span>
              </div>
              <div className="job-meta">
                <span className={`job-status status-${job.status?.toLowerCase()}`}>{job.status}</span>
                <span className="job-next">next: {job.next}</span>
                <span className="job-last">last: {job.last}</span>
              </div>
              <div className="job-actions">
                <button className="btn-ghost btn-sm" onClick={() => disableJob(job.id)} disabled={!connected}>Disable</button>
                <button className="btn-ghost btn-sm btn-danger-ghost" onClick={() => deleteJob(job.id)} disabled={!connected}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {actionLog && (
        <div className="action-log">
          <pre>{actionLog}</pre>
          <button className="btn-ghost" onClick={() => setActionLog('')}>Clear</button>
        </div>
      )}
    </div>
  );
}

import { useStore } from '../../core/store';
import { useState } from 'react';
import { Moon, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import './BudgetPanel.css';

export default function BudgetPanel() {
  const {
    overnightMode, toggleOvernightMode, connected, runCmd,
    budget, setBudget, _runs,
  } = useStore();
  const [sessions, setSessions] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    const res = await runCmd('openclaw status 2>&1 | grep -A 20 "Sessions"');
    setSessions(res.stdout);
    setLoading(false);
  };

  // Current window usage (from in-memory _runs)
  const hourlyUsed = _runs?.hourly ?? 0;
  const dailyUsed  = _runs?.daily  ?? 0;

  return (
    <div className="panel-wrap">
      <div className="panel-body">

        {/* Overnight mode */}
        <div className={`card budget-overnight ${overnightMode ? 'budget-overnight-on' : ''}`}>
          <div className="budget-overnight-header">
            <div>
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Moon size={14} /> Overnight Mode
              </div>
              <p className="budget-overnight-desc">
                Blocks autonomous tasks. Only deterministic cron messages allowed. Enable before sleeping.
              </p>
            </div>
            <button
              className={`toggle-btn ${overnightMode ? 'toggle-on' : 'toggle-off'}`}
              onClick={toggleOvernightMode}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          {overnightMode && (
            <div className="budget-overnight-warn">
              <AlertTriangle size={12} /> Overnight Mode active — autonomous tasks are blocked.
            </div>
          )}
        </div>

        {/* Budget Gate */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Shield size={14} /> Budget Gate
          </div>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', margin: '0 0 var(--sp-3)' }}>
            Client-side limits. Blocks chat sends when exceeded. Resets hourly / daily.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {/* Max runs per hour */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', minWidth: 160 }}>
                Max runs / hour
              </span>
              <input
                type="number" min={1} max={200}
                className="input"
                style={{ width: 70, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                value={budget.maxRunsPerHour}
                onChange={e => setBudget({ maxRunsPerHour: Math.max(1, parseInt(e.target.value) || 1) })}
              />
              <span style={{ fontSize: 'var(--text-caption)', color: hourlyUsed >= budget.maxRunsPerHour ? 'var(--warn)' : 'var(--text-tertiary)' }}>
                {hourlyUsed} used this hour
              </span>
            </div>

            {/* Max autonomy runs per day */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', minWidth: 160 }}>
                Max autonomy runs / day
              </span>
              <input
                type="number" min={0} max={100}
                className="input"
                style={{ width: 70, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                value={budget.maxAutonomyRunsPerDay}
                onChange={e => setBudget({ maxAutonomyRunsPerDay: Math.max(0, parseInt(e.target.value) || 0) })}
              />
              <span style={{ fontSize: 'var(--text-caption)', color: dailyUsed >= budget.maxAutonomyRunsPerDay ? 'var(--warn)' : 'var(--text-tertiary)' }}>
                {dailyUsed} used today
              </span>
            </div>
          </div>
        </div>

        {/* Session usage (Layer B — polling) */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Usage &amp; Sessions (VPS)
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className="btn btn-secondary btn-sm" onClick={async () => {
                setLoading(true);
                const r = await runCmd('openclaw status --usage 2>&1 || openclaw status 2>&1');
                setSessions(r.stdout);
                setLoading(false);
              }} disabled={loading || !connected}>
                <RefreshCw size={12} className={loading ? 'spin' : ''} /> Usage
              </button>
              <button className="btn btn-secondary btn-sm" onClick={loadSessions} disabled={loading || !connected}>
                Sessions
              </button>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', margin: '0 0 var(--sp-2)' }}>
            Polls <code>openclaw status --usage</code> on VPS. Token usage in WS events not yet reliable — use this for estimates.
          </p>
          {sessions ? (
            <pre className="budget-sessions-pre">{sessions}</pre>
          ) : (
            <div className="empty">{connected ? 'Hit Usage or Sessions to load.' : 'Connect first.'}</div>
          )}
        </div>

        {/* Guardrails */}
        <div className="card">
          <div className="card-header">Guardrails</div>
          <ul className="budget-guardrail-list">
            <li>Set hard caps on <a href="https://openrouter.ai" target="_blank" rel="noreferrer">OpenRouter dashboard</a></li>
            <li>Use <code>tgremind</code> for scheduled messages, not open-ended agent tasks</li>
            <li>Review cron jobs regularly for runaway loops</li>
            <li>Use Overnight Mode when not actively monitoring</li>
          </ul>
        </div>

      </div>
    </div>
  );
}

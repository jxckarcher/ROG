import { useStore } from '../../core/store';
import { useState } from 'react';
import { Moon, AlertTriangle, RefreshCw } from 'lucide-react';
import './BudgetPanel.css';

export default function BudgetPanel() {
  const { overnightMode, toggleOvernightMode, connected, runCmd } = useStore();
  const [sessions, setSessions] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    const res = await runCmd('openclaw status 2>&1 | grep -A 20 "Sessions"');
    setSessions(res.stdout);
    setLoading(false);
  };

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

        {/* Model info */}
        <div className="card">
          <div className="card-header">Current Model</div>
          <div className="budget-model-row">
            <span className="budget-model-name">anthropic/claude-3.5-haiku</span>
            <span className="budget-model-tag">cheap · chat ok</span>
          </div>
          <p className="budget-model-note">
            Switch to a stronger model for tool/autonomy tasks. Edit <code>/root/.openclaw/openclaw.json</code>
          </p>
        </div>

        {/* Session usage */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Active Sessions
            <button className="btn btn-secondary btn-sm" onClick={loadSessions} disabled={loading || !connected}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> {loading ? 'Loading…' : 'Fetch'}
            </button>
          </div>
          {sessions ? (
            <pre className="budget-sessions-pre">{sessions}</pre>
          ) : (
            <div className="empty">{connected ? 'Hit Fetch to load session usage.' : 'Connect first.'}</div>
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

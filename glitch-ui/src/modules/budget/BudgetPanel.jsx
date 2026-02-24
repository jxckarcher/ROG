import { useStore } from '../../core/store';
import { useState } from 'react';
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
    <div className="panel budget-panel">
      <div className="panel-header">
        <h2>Budget</h2>
      </div>

      {/* Overnight mode */}
      <div className={`section-card overnight-card ${overnightMode ? 'overnight-on' : ''}`}>
        <div className="overnight-header">
          <div>
            <div className="section-title">🌙 Overnight Mode</div>
            <p className="overnight-desc">
              Blocks all autonomous and open-ended tasks. Only deterministic cron messages are allowed.
              Enable this before you sleep.
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
          <div className="overnight-warning">
            ⚠️ Overnight Mode is active. Autonomous tasks are blocked.
          </div>
        )}
      </div>

      {/* Model info */}
      <div className="section-card">
        <div className="section-title">Current Model</div>
        <div className="model-row">
          <span className="model-name">anthropic/claude-3.5-haiku</span>
          <span className="model-tag">cheap · chat ok</span>
        </div>
        <p className="model-note">
          Switch to a stronger model for tool/autonomy tasks only. Change in
          <code> /root/.openclaw/openclaw.json</code>
        </p>
      </div>

      {/* Session usage */}
      <div className="section-card">
        <div className="section-title" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          Active Sessions
          <button className="btn btn-secondary btn-sm" onClick={loadSessions} disabled={loading || !connected}>
            {loading ? 'Loading…' : 'Fetch'}
          </button>
        </div>
        {sessions ? (
          <pre className="sessions-pre">{sessions}</pre>
        ) : (
          <div className="empty-state">Hit Fetch to load session token usage.</div>
        )}
      </div>

      {/* Guardrail notes */}
      <div className="section-card card-warn">
        <div className="section-title">Guardrails</div>
        <ul className="guardrail-list">
          <li>Set hard caps on <a href="https://openrouter.ai" target="_blank" rel="noreferrer">OpenRouter dashboard</a></li>
          <li>Use <code>tgremind</code> for scheduled messages, not open-ended agent tasks</li>
          <li>Review cron jobs regularly for runaway loops</li>
          <li>Use Overnight Mode when not actively monitoring</li>
        </ul>
      </div>
    </div>
  );
}

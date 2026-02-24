import { useStore } from '../../core/store';
import './TopBar.css';

const MODULE_TITLES = {
  chat:       'Chat',
  scheduler:  'Scheduler',
  memory:     'Memory',
  budget:     'Budget',
  terminal:   'Terminal',
  connection: 'Connection',
};

export default function TopBar() {
  const { activeModule, connected, tunnelActive, overnightMode } = useStore();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{MODULE_TITLES[activeModule] || 'Glitch'}</h1>
      </div>
      <div className="topbar-right">
        {overnightMode && (
          <span className="topbar-chip chip-warn">🌙 Overnight</span>
        )}
        <StatusChip
          label="SSH"
          state={connected ? 'on' : 'off'}
          activeLabel="Connected"
          inactiveLabel="Disconnected"
        />
        <StatusChip
          label="Tunnel"
          state={tunnelActive ? 'on' : 'off'}
          activeLabel=":18789"
          inactiveLabel="Inactive"
        />
      </div>
    </header>
  );
}

function StatusChip({ label, state, activeLabel, inactiveLabel }) {
  return (
    <div className={`topbar-chip chip-${state}`}>
      <span className={`dot dot-${state}`} />
      <span className="chip-label">{label}</span>
      <span className="chip-value">{state === 'on' ? activeLabel : inactiveLabel}</span>
    </div>
  );
}

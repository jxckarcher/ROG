import { useStore } from '../../core/store';
import './TopBar.css';

const MODULE_TITLES = {
  chat:       'Chat',
  agents:     'Agents',
  scheduler:  'Scheduler',
  memory:     'Memory',
  budget:     'Budget',
  terminal:   'Terminal',
  connection: 'Connection',
  settings:   'Settings',
  github:     'GitHub',
  workspaces: 'Workspaces',
};

const MODEL_SHORT = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-haiku-4-5':          'Haiku',
  'claude-sonnet-4-5':         'Sonnet',
  'claude-sonnet-4-6':         'Sonnet',
  'claude-opus-4-6':           'Opus',
};

const PROFILE_CYCLE = ['chat', 'workspaces', 'autonomy'];
const PROFILE_LABEL = { chat: 'Chat', workspaces: 'WS', autonomy: 'Auto' };

/* eslint-disable no-undef */
const BUILD_STAMP = `${__BUILD_DATE__} ${__BUILD_TIME__}`;

export default function TopBar() {
  const { activeModule, connected, tunnelActive, overnightMode,
          activeProfile, modelProfiles, setActiveProfile } = useStore();

  const cycleProfile = () => {
    const idx = PROFILE_CYCLE.indexOf(activeProfile);
    setActiveProfile(PROFILE_CYCLE[(idx + 1) % PROFILE_CYCLE.length]);
  };

  const currentModel = modelProfiles?.[activeProfile] || '';
  const modelShort = MODEL_SHORT[currentModel] || currentModel.split('-').slice(-1)[0] || '?';
  const isAutonomy = activeProfile === 'autonomy';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{MODULE_TITLES[activeModule] || 'Glitch'}</h1>
      </div>
      <div className="topbar-right">
        {overnightMode && (
          <span className="topbar-chip chip-warn">🌙 Overnight</span>
        )}
        <button
          className={`topbar-chip topbar-model-chip ${isAutonomy ? 'chip-warn' : 'chip-model'}`}
          onClick={cycleProfile}
          title={`Profile: ${activeProfile} — Model: ${currentModel}\nClick to cycle profile (Chat → Workspaces → Autonomy)`}
        >
          <span className="chip-label">{PROFILE_LABEL[activeProfile] || activeProfile}</span>
          <span className="chip-value">{modelShort}{isAutonomy ? ' ⚠' : ''}</span>
        </button>
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
        <span className="topbar-build">{BUILD_STAMP}</span>
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

import { useStore } from '../../core/store';
import { MessageSquare, Calendar, Brain, Coins, SquareTerminal, Network, Bot, Settings, Github, Layers, Lock } from 'lucide-react';
import './Sidebar.css';

const NAV = [
  {
    section: 'Assistant',
    items: [
      { id: 'chat',       Icon: MessageSquare,  label: 'Chat' },
      { id: 'agents',     Icon: Bot,            label: 'Agents' },
      { id: 'scheduler',  Icon: Calendar,       label: 'Scheduler' },
      { id: 'memory',     Icon: Brain,          label: 'Memory' },
      { id: 'budget',     Icon: Coins,          label: 'Budget' },
      { id: 'github',     Icon: Github,         label: 'GitHub' },
      { id: 'workspaces', Icon: Layers,         label: 'Workspaces' },
    ]
  },
  {
    section: 'System',
    items: [
      { id: 'terminal',   Icon: SquareTerminal, label: 'Terminal' },
      { id: 'connection', Icon: Network,        label: 'Connection' },
      { id: 'settings',   Icon: Settings,       label: 'Settings' },
    ]
  }
];

export default function Sidebar() {
  const { activeModule, setActiveModule, connected, lock } = useStore();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-glyph">⚡</span>
        <span className="sidebar-logo-text">Glitch</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ section, items }) => (
          <div key={section} className="sidebar-group">
            <span className="sidebar-group-label">{section}</span>
            {items.map(({ id, Icon, label }) => (
              <button
                key={id}
                className={`sidebar-item ${activeModule === id ? 'active' : ''}`}
                onClick={() => setActiveModule(id)}
              >
                {activeModule === id && <span className="sidebar-item-bar" />}
                <Icon size={17} strokeWidth={1.75} />
                <span>{label}</span>
                {id === 'connection' && (
                  <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} style={{ marginLeft: 'auto' }} />
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-lock-btn" onClick={lock} title="Lock">
          <Lock size={13} />
          <span>Lock</span>
        </button>
      </div>
    </aside>
  );
}

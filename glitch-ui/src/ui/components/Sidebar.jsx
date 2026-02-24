import { useStore } from '../../core/store';
import { MessageSquare, Calendar, Brain, Coins, SquareTerminal, Network } from 'lucide-react';
import './Sidebar.css';

const NAV = [
  {
    section: 'Assistant',
    items: [
      { id: 'chat',      Icon: MessageSquare,  label: 'Chat' },
      { id: 'scheduler', Icon: Calendar,        label: 'Scheduler' },
      { id: 'memory',    Icon: Brain,           label: 'Memory' },
      { id: 'budget',    Icon: Coins,           label: 'Budget' },
    ]
  },
  {
    section: 'System',
    items: [
      { id: 'terminal',   Icon: SquareTerminal, label: 'Terminal' },
      { id: 'connection', Icon: Network,        label: 'Connection' },
    ]
  }
];

const THEMES = [
  { id: 'cyberpunk', color: '#00e5c3' },
  { id: 'midnight',  color: '#8b7cf6' },
  { id: 'matrix',    color: '#39d353' },
  { id: 'light',     color: '#0066cc' },
];

export default function Sidebar() {
  const { activeModule, setActiveModule, connected, theme, setTheme } = useStore();

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
        <div className="sidebar-theme">
          <span className="sidebar-theme-label">Theme</span>
          <div className="sidebar-theme-swatches">
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`swatch ${theme === t.id ? 'swatch-active' : ''}`}
                style={{ '--swatch-color': t.color }}
                onClick={() => setTheme(t.id)}
                title={t.id}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

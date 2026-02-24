import { useStore } from '../../core/store';
import './Sidebar.css';

const MODULES = [
  { id: 'chat',       icon: '💬', label: 'Chat' },
  { id: 'scheduler',  icon: '🗓', label: 'Scheduler' },
  { id: 'memory',     icon: '🧠', label: 'Memory' },
  { id: 'budget',     icon: '💰', label: 'Budget' },
  { id: 'terminal',   icon: '⌨️', label: 'Terminal' },
  { id: 'connection', icon: '🔗', label: 'Connection' },
];

export default function Sidebar() {
  const { activeModule, setActiveModule, connected, overnightMode } = useStore();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-glyph">⚡</span>
        <span className="sidebar-logo-name">Glitch</span>
        {overnightMode && <span className="overnight-badge">NIGHT</span>}
      </div>

      <nav className="sidebar-nav">
        {MODULES.map(m => (
          <button
            key={m.id}
            className={`sidebar-item ${activeModule === m.id ? 'active' : ''}`}
            onClick={() => setActiveModule(m.id)}
          >
            <span className="sidebar-icon">{m.icon}</span>
            <span className="sidebar-label">{m.label}</span>
            {m.id === 'connection' && (
              <span className={`conn-dot ${connected ? 'on' : 'off'}`} />
            )}
          </button>
        ))}
      </nav>

      <ThemePicker />
    </aside>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useStore();
  const themes = [
    { id: 'cyberpunk', color: '#00f5d4' },
    { id: 'midnight',  color: '#7c6af7' },
    { id: 'matrix',    color: '#00ff41' },
    { id: 'light',     color: '#6c63ff' },
  ];
  return (
    <div className="theme-picker">
      <span className="theme-label">Theme</span>
      <div className="theme-dots">
        {themes.map(t => (
          <button
            key={t.id}
            className={`theme-dot ${theme === t.id ? 'active' : ''}`}
            style={{ '--dot-color': t.color }}
            onClick={() => setTheme(t.id)}
            title={t.id}
          />
        ))}
      </div>
    </div>
  );
}

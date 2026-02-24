import { useStore } from '../../core/store';
import './StatusBar.css';

export default function StatusBar() {
  const { connected, tunnelActive, vps, overnightMode } = useStore();

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span className={`status-pill ${connected ? 'ok' : 'off'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </span>
        {tunnelActive && (
          <span className="status-pill tunnel">⇄ Tunnel :18789</span>
        )}
        <span className="status-host">{vps.user}@{vps.host}</span>
      </div>
      <div className="statusbar-right">
        {overnightMode && (
          <span className="status-pill night">🌙 Overnight Mode ON</span>
        )}
        <span className="status-version">Glitch UI v0.1</span>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '../../core/store';
import './ConnectionPanel.css';

export default function ConnectionPanel() {
  const { connected, connecting, connectionError, tunnelActive,
          connect, disconnect, startTunnel, stopTunnel, runCmd, vps } = useStore();
  const [log, setLog] = useState('');
  const [testing, setTesting] = useState(false);

  const handleConnect = async () => {
    await connect();
  };

  const handleTunnel = async () => {
    if (tunnelActive) await stopTunnel();
    else await startTunnel();
  };

  const quickCheck = async () => {
    setTesting(true);
    setLog('Running health check...\n');
    const checks = [
      { label: 'SSH',        cmd: 'echo "SSH_OK"' },
      { label: 'Gateway',    cmd: 'systemctl --user status openclaw-gateway.service --no-pager | head -4' },
      { label: 'Port 18789', cmd: "ss -lntp | grep ':18789'" },
      { label: 'Telegram',   cmd: "openclaw status 2>&1 | grep -A2 'Telegram'" },
    ];
    let out = '';
    for (const c of checks) {
      const res = await runCmd(c.cmd);
      out += `── ${c.label} ──\n${res.stdout || res.stderr}\n`;
      setLog(out);
    }
    setTesting(false);
  };

  const restartGateway = async () => {
    setLog('Restarting gateway...\n');
    const res = await runCmd('systemctl --user restart openclaw-gateway.service && sleep 1 && systemctl --user status openclaw-gateway.service --no-pager | head -6');
    setLog(res.stdout + res.stderr);
  };

  return (
    <div className="panel conn-panel">
      <div className="panel-header">
        <h2>Connection</h2>
        <span className="panel-sub">{vps.user}@{vps.host}</span>
      </div>

      <div className="conn-cards">
        {/* SSH card */}
        <div className={`conn-card ${connected ? 'card-ok' : 'card-off'}`}>
          <div className="conn-card-title">SSH</div>
          <div className={`conn-status-dot ${connected ? 'on' : 'off'}`} />
          <div className="conn-card-val">{connected ? 'Connected' : connectionError || 'Disconnected'}</div>
          <button
            className={`btn ${connected ? 'btn-danger' : 'btn-primary'}`}
            onClick={connected ? disconnect : handleConnect}
            disabled={connecting}
          >
            {connecting ? 'Connecting…' : connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        {/* Tunnel card */}
        <div className={`conn-card ${tunnelActive ? 'card-ok' : 'card-off'}`}>
          <div className="conn-card-title">SSH Tunnel</div>
          <div className={`conn-status-dot ${tunnelActive ? 'on' : 'off'}`} />
          <div className="conn-card-val">
            {tunnelActive ? `localhost:${vps.tunnelPort} active` : 'Inactive'}
          </div>
          <button className={`btn ${tunnelActive ? 'btn-warn' : 'btn-secondary'}`} onClick={handleTunnel}>
            {tunnelActive ? 'Stop Tunnel' : 'Start Tunnel'}
          </button>
        </div>

        {/* Quick actions */}
        <div className="conn-card card-neutral">
          <div className="conn-card-title">Quick Actions</div>
          <div className="conn-actions">
            <button className="btn btn-secondary" onClick={quickCheck} disabled={testing || !connected}>
              {testing ? 'Checking…' : 'Health Check'}
            </button>
            <button className="btn btn-secondary" onClick={restartGateway} disabled={!connected}>
              Restart Gateway
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => runCmd('openclaw message send --channel telegram --target 7117966167 --message "PING_FROM_GLITCH_UI"')}
              disabled={!connected}
            >
              Ping Telegram
            </button>
          </div>
        </div>
      </div>

      {log && (
        <div className="conn-log">
          <div className="conn-log-header">
            Output
            <button className="btn-ghost" onClick={() => setLog('')}>Clear</button>
          </div>
          <pre>{log}</pre>
        </div>
      )}
    </div>
  );
}

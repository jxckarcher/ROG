import { useState } from 'react';
import { useStore } from '../../core/store';
import { RefreshCw, Plug, PlugZap, Activity, Send } from 'lucide-react';
import './ConnectionPanel.css';

export default function ConnectionPanel() {
  const { connected, connecting, connectionError, tunnelActive,
          connect, disconnect, startTunnel, stopTunnel, runCmd, vps } = useStore();
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (cmd, label) => {
    setBusy(true);
    setOutput(`▸ ${label}\n`);
    const res = await runCmd(cmd);
    setOutput(`▸ ${label}\n${res.stdout}${res.stderr}`);
    setBusy(false);
  };

  const healthCheck = () => run(
    'echo "── SSH ──" && echo OK && echo "── Gateway ──" && systemctl --user status openclaw-gateway.service --no-pager | head -5 && echo "── Port ──" && ss -lntp | grep ":18789" && echo "── Telegram ──" && openclaw status 2>&1 | grep -A2 "Telegram"',
    'Health Check'
  );

  return (
    <div className="panel-wrap">
      <div className="panel-body">
        {/* SSH row */}
        <div className="card conn-row">
          <div className="conn-info">
            <div className="conn-label">
              <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} />
              SSH
            </div>
            <div className="conn-host">{vps.user}@{vps.host}</div>
            {connectionError && <div className="conn-error">{connectionError}</div>}
          </div>
          <button
            className={`btn ${connected ? 'btn-secondary' : 'btn-primary'}`}
            onClick={connected ? disconnect : connect}
            disabled={connecting}
          >
            {connecting ? <><RefreshCw size={14} className="spin" /> Connecting…</>
              : connected ? <><Plug size={14} /> Disconnect</>
              : <><PlugZap size={14} /> Connect</>}
          </button>
        </div>

        {/* Tunnel row */}
        <div className="card conn-row">
          <div className="conn-info">
            <div className="conn-label">
              <span className={`dot ${tunnelActive ? 'dot-on' : 'dot-off'}`} />
              SSH Tunnel
            </div>
            <div className="conn-host">
              {tunnelActive ? `localhost:${vps.tunnelPort} → gateway` : 'Inactive — needed for live chat'}
            </div>
          </div>
          <button
            className={`btn ${tunnelActive ? 'btn-secondary' : 'btn-secondary'}`}
            onClick={tunnelActive ? stopTunnel : startTunnel}
            disabled={!connected}
          >
            {tunnelActive ? 'Stop Tunnel' : 'Start Tunnel'}
          </button>
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-header">Quick Actions</div>
          <div className="conn-actions">
            <button className="btn btn-secondary btn-sm" onClick={healthCheck} disabled={!connected || busy}>
              <Activity size={13} /> Health Check
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={() => run('systemctl --user restart openclaw-gateway.service && sleep 1 && systemctl --user status openclaw-gateway.service --no-pager | head -6', 'Restart Gateway')}
              disabled={!connected || busy}>
              <RefreshCw size={13} /> Restart Gateway
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={() => run('openclaw message send --channel telegram --target 7117966167 --message "PING_FROM_GLITCH_UI" 2>&1', 'Ping Telegram')}
              disabled={!connected || busy}>
              <Send size={13} /> Ping Telegram
            </button>
          </div>
        </div>

        {/* Output */}
        {output && (
          <div className="card conn-output-card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              Output
              <button className="btn-ghost" onClick={() => setOutput('')}>Clear</button>
            </div>
            <pre className="conn-output">{output}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

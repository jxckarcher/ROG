import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../core/store';
import './TerminalPanel.css';

export default function TerminalPanel() {
  const { connected, runCmd, vps } = useStore();
  const [lines, setLines] = useState([
    { type: 'info', text: 'Quick terminal — run commands on the VPS.' },
    { type: 'info', text: 'For a full interactive shell, use the "Open SSH" button.' },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }); }, [lines]);

  const run = async (cmd) => {
    if (!cmd.trim()) return;
    setRunning(true);
    setHistory(h => [cmd, ...h.slice(0, 49)]);
    setHistIdx(-1);

    setLines(l => [...l, { type: 'cmd', text: `$ ${cmd}` }]);
    const res = await runCmd(cmd);
    const out = (res.stdout + res.stderr).trim();
    if (out) setLines(l => [...l, { type: res.success ? 'out' : 'err', text: out }]);
    setRunning(false);
    inputRef.current?.focus();
  };

  const submit = () => { const cmd = input.trim(); setInput(''); run(cmd); };

  const onKey = (e) => {
    if (e.key === 'Enter') { submit(); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] || '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx]);
    }
  };

  const openFullSSH = () => {
    // Launch Windows Terminal with SSH
    const { invoke } = window.__TAURI_INTERNALS__ || {};
    if (invoke) {
      invoke('ssh_run', {
        host: vps.host, user: vps.user,
        cmd: 'echo "Use the Windows Terminal session"'
      });
    }
    // Fallback: attempt to open wt
    window.open(`ssh://${vps.user}@${vps.host}`);
  };

  const quickCmds = [
    { label: 'Status',      cmd: 'openclaw status 2>&1 | head -30' },
    { label: 'Logs',        cmd: 'openclaw logs 2>&1 | head -40' },
    { label: 'Cron list',   cmd: 'openclaw cron list 2>&1' },
    { label: 'Disk',        cmd: 'df -h / && free -h' },
    { label: 'Uptime',      cmd: 'uptime && who' },
  ];

  return (
    <div className="panel terminal-panel">
      <div className="panel-header">
        <h2>Terminal</h2>
        <div className="terminal-header-actions">
          <button className="btn btn-secondary" onClick={() => setLines([])}>Clear</button>
          <button className="btn btn-secondary" onClick={openFullSSH}>Open SSH ↗</button>
        </div>
      </div>

      <div className="quick-cmds">
        {quickCmds.map(q => (
          <button key={q.label} className="quick-cmd" onClick={() => run(q.cmd)} disabled={running || !connected}>
            {q.label}
          </button>
        ))}
      </div>

      <div className="terminal-output">
        {lines.map((l, i) => (
          <div key={i} className={`term-line line-${l.type}`}>
            <pre>{l.text}</pre>
          </div>
        ))}
        {running && <div className="term-line line-info"><pre>running…</pre></div>}
        <div ref={bottomRef} />
      </div>

      <div className="terminal-input-row">
        <span className="term-prompt">{vps.user}@{vps.host} $</span>
        <input
          ref={inputRef}
          className="term-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={!connected || running}
          placeholder={connected ? '' : 'Connect first'}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

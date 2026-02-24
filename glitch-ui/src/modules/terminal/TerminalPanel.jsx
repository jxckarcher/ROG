import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../core/store';
import { X } from 'lucide-react';
import './TerminalPanel.css';

const QUICK = [
  { label: 'status',    cmd: 'openclaw status 2>&1 | head -30' },
  { label: 'logs',      cmd: 'openclaw logs 2>&1 | head -40' },
  { label: 'cron',      cmd: 'openclaw cron list 2>&1' },
  { label: 'df -h',     cmd: 'df -h / && free -h' },
  { label: 'uptime',    cmd: 'uptime && who' },
  { label: 'gw',        cmd: 'systemctl --user status openclaw-gateway.service --no-pager | head -8' },
];

export default function TerminalPanel() {
  const { connected, runCmd, vps } = useStore();
  const [lines, setLines] = useState([
    { type: 'info', text: 'Quick terminal — run commands on the VPS via SSH.' },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }); }, [lines]);

  const run = async (cmd) => {
    if (!cmd.trim() || !connected) return;
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
      setHistIdx(idx); setInput(history[idx] || '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx); setInput(idx === -1 ? '' : history[idx]);
    }
  };

  return (
    <div className="panel-wrap" style={{ display: 'flex', flexDirection: 'column' }}>

      <div className="term-quick-cmds">
        {QUICK.map(q => (
          <button key={q.label} className="term-quick-btn"
            onClick={() => run(q.cmd)} disabled={running || !connected}>
            {q.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-ghost btn-xs" onClick={() => setLines([])} disabled={lines.length === 0}>
          <X size={12} /> Clear
        </button>
      </div>

      <div className="term-output">
        {lines.map((l, i) => (
          <div key={i} className={`term-line line-${l.type}`}>
            <pre>{l.text}</pre>
          </div>
        ))}
        {running && <div className="term-line line-info"><pre>running…</pre></div>}
        <div ref={bottomRef} />
      </div>

      <div className="term-input-row">
        <span className="term-prompt">{vps.user}@{vps.host} $</span>
        <input
          ref={inputRef}
          className="term-bare-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={!connected || running}
          placeholder={connected ? '' : 'connect first…'}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

    </div>
  );
}

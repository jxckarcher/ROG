import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../core/store';
import { X, Terminal, Zap } from 'lucide-react';
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
  const { connected, runCmd, vps, sendTermChat, termMessages, termSending, clearTermMessages, terminalAiMode, setTerminalAiMode } = useStore();
  const [lines, setLines] = useState([
    { type: 'info', text: 'Quick terminal — run commands or switch to AI mode to ask Glitch in plain English.' },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  // aiMode is store-backed so it survives tab switches
  const aiMode    = terminalAiMode;
  const setAiMode = (v) => setTerminalAiMode(typeof v === 'function' ? v(terminalAiMode) : v);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }); }, [lines, termMessages]);

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

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    if (aiMode) {
      sendTermChat(cmd);
    } else {
      run(cmd);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') { submit(); return; }
    if (!aiMode) {
      if (e.key === 'ArrowUp') {
        const idx = Math.min(histIdx + 1, history.length - 1);
        setHistIdx(idx); setInput(history[idx] || '');
      }
      if (e.key === 'ArrowDown') {
        const idx = Math.max(histIdx - 1, -1);
        setHistIdx(idx); setInput(idx === -1 ? '' : history[idx]);
      }
    }
  };

  const toggleMode = () => {
    setAiMode(v => !v);
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setLines([]);
    clearTermMessages();
  };

  return (
    <div className="panel-wrap" style={{ display: 'flex', flexDirection: 'column' }}>

      <div className="term-quick-cmds">
        {/* Mode toggle */}
        <button
          className={`term-mode-btn ${aiMode ? 'term-mode-ai' : 'term-mode-shell'}`}
          onClick={toggleMode}
          title={aiMode ? 'Switch to shell mode' : 'Switch to AI mode — ask Glitch in plain English'}
        >
          {aiMode ? <><Zap size={11} /> AI</> : <><Terminal size={11} /> Shell</>}
        </button>
        <div className="term-mode-divider" />
        {/* Quick commands (shell mode only) */}
        {!aiMode && QUICK.map(q => (
          <button key={q.label} className="term-quick-btn"
            onClick={() => run(q.cmd)} disabled={running || !connected}>
            {q.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-ghost btn-xs" onClick={clearAll} disabled={lines.length === 0 && termMessages.length === 0}>
          <X size={12} /> Clear
        </button>
      </div>

      <div className="term-output" onClick={() => inputRef.current?.focus()}>
        {/* Shell output */}
        {lines.map((l, i) => (
          <div key={i} className={`term-line line-${l.type}`}>
            <pre>{l.text}</pre>
          </div>
        ))}

        {/* AI conversation (always shown when messages exist) */}
        {termMessages.length > 0 && (
          <>
            {lines.length > 0 && <div className="term-ai-divider">── AI session ──</div>}
            {termMessages.map((m, i) => (
              <div key={`tm-${i}`} className={`term-line term-ai-${m.role}`}>
                <pre>{m.role === 'user' ? `⚡ ${m.text}` : m.text}</pre>
              </div>
            ))}
          </>
        )}

        {(running || termSending) && (
          <div className="term-line line-info">
            <pre>{termSending ? '⚡ Glitch is thinking…' : 'running…'}</pre>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="term-input-row" onClick={() => inputRef.current?.focus()}>
        <span className={`term-prompt ${aiMode ? 'term-ai-prompt' : ''}`}>
          {aiMode ? '⚡' : `${vps.user}@${vps.host} $`}
        </span>
        <input
          ref={inputRef}
          className="term-bare-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={!connected || running || termSending}
          placeholder={
            !connected ? 'connect first…'
            : aiMode ? 'Ask Glitch what to do on the VPS…'
            : ''
          }
          autoComplete="off"
          spellCheck={false}
        />
      </div>

    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../core/store';
import './ChatPanel.css';

export default function ChatPanel() {
  const { connected, runCmd } = useStore();
  const [messages, setMessages] = useState([
    { role: 'system', text: 'Chat relays messages to Glitch via openclaw. Connect first.' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending || !connected) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    setMessages(m => [...m, { role: 'user', text }]);

    // Send via openclaw message
    const escaped = text.replace(/"/g, '\\"').replace(/`/g, '\\`');
    const res = await runCmd(
      `openclaw message send --channel cli --message "${escaped}" 2>&1`
    );

    const reply = res.stdout.trim() || res.stderr.trim() || '(no response)';
    setMessages(m => [...m, { role: 'glitch', text: reply }]);
    setSending(false);
    inputRef.current?.focus();
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => setMessages([
    { role: 'system', text: 'Chat cleared.' }
  ]);

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <h2>Chat</h2>
        <button className="btn-ghost" onClick={clearChat}>Clear</button>
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg msg-${m.role}`}>
            {m.role !== 'user' && (
              <span className="msg-label">{m.role === 'glitch' ? '⚡ Glitch' : 'System'}</span>
            )}
            <div className="msg-bubble">
              <pre>{m.text}</pre>
            </div>
          </div>
        ))}
        {sending && (
          <div className="chat-msg msg-glitch">
            <span className="msg-label">⚡ Glitch</span>
            <div className="msg-bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder={connected ? 'Message Glitch…' : 'Connect first to chat'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={!connected || sending}
          rows={2}
        />
        <button
          className="btn btn-primary chat-send"
          onClick={send}
          disabled={!connected || sending || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

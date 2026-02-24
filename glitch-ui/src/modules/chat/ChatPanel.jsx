import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../core/store';
import { Send, Wifi, WifiOff } from 'lucide-react';
import './ChatPanel.css';

export default function ChatPanel() {
  const { connected, wsConnected, chatMessages, chatSending, sendChat, clearChat, connectWs, tunnelActive } = useStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const send = async () => {
    const text = input.trim();
    if (!text || chatSending || !connected) return;
    setInput('');
    await sendChat(text);
    inputRef.current?.focus();
  };

  return (
    <div className="chat-panel panel-wrap">
      {!connected && <div className="chat-hint">Go to Connection and connect first.</div>}

      {connected && (
        <div className="chat-status-bar">
          {wsConnected
            ? <><Wifi size={12} /><span className="chat-status-on">Live</span></>
            : <><WifiOff size={12} /><span className="chat-status-off">SSH fallback</span>
                {tunnelActive
                  ? <button className="btn-ghost" onClick={connectWs}>Reconnect</button>
                  : <span className="chat-status-hint">Start tunnel for live mode</span>
                }
              </>
          }
          <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={clearChat}>Clear</button>
        </div>
      )}

      <div className="chat-messages">
        {chatMessages.map((m, i) => <ChatMsg key={i} msg={m} />)}
        {chatSending && (
          <div className="chat-msg msg-glitch">
            <div className="msg-av">G</div>
            <div className="msg-bubble bubble-glitch typing-dots"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-composer">
        <textarea
          ref={inputRef}
          className="input chat-input"
          placeholder={connected ? 'Message Glitch… (Enter to send)' : 'Connect first'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={!connected || chatSending}
          rows={2}
        />
        <button className="btn btn-primary chat-send" onClick={send}
          disabled={!connected || chatSending || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function ChatMsg({ msg }) {
  const ts = msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  if (msg.role === 'system') return <div className="chat-system">{msg.text}</div>;
  return (
    <div className={`chat-msg msg-${msg.role}`}>
      {msg.role === 'glitch' && <div className="msg-av">G</div>}
      <div className={`msg-bubble bubble-${msg.role}`}>
        <pre className="msg-text">{msg.text}</pre>
        <span className="msg-ts">{ts}</span>
      </div>
      {msg.role === 'user' && <div className="msg-av msg-av-user">U</div>}
    </div>
  );
}

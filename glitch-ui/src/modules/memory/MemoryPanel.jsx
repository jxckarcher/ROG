import { useEffect, useState } from 'react';
import { useStore } from '../../core/store';
import './MemoryPanel.css';

export default function MemoryPanel() {
  const { connected, loadMemory, memorySnapshot, memoryLoading, searchMemory, appendMemory, runCmd } = useStore();
  const [tab, setTab] = useState('snapshot');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState('');
  const [searching, setSearching] = useState(false);
  const [appendText, setAppendText] = useState('');
  const [appending, setAppending] = useState(false);
  const [dailyLog, setDailyLog] = useState('');

  useEffect(() => { if (connected) loadMemory(); }, [connected]);

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    const res = await searchMemory(searchQ);
    setSearchResults(res || '(no results)');
    setSearching(false);
  };

  const doAppend = async () => {
    if (!appendText.trim()) return;
    setAppending(true);
    await appendMemory(appendText);
    setAppendText('');
    setAppending(false);
    await loadMemory();
  };

  const loadTodayLog = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await runCmd(`cat /root/.openclaw/workspace/memory/${today}.md 2>/dev/null || echo "(no log for today yet)"`);
    setDailyLog(res.stdout);
  };

  useEffect(() => { if (connected && tab === 'daily') loadTodayLog(); }, [tab, connected]);

  return (
    <div className="panel memory-panel">
      <div className="panel-header">
        <h2>Memory</h2>
        <div className="tab-bar">
          {['snapshot', 'daily', 'search', 'append'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={loadMemory} disabled={memoryLoading || !connected}>
          {memoryLoading ? '…' : 'Reload'}
        </button>
      </div>

      {tab === 'snapshot' && (
        <div className="mem-content">
          <pre>{memorySnapshot || '(empty — connect and reload)'}</pre>
        </div>
      )}

      {tab === 'daily' && (
        <div className="mem-content">
          <pre>{dailyLog || '(loading…)'}</pre>
        </div>
      )}

      {tab === 'search' && (
        <div className="mem-search">
          <div className="search-row">
            <input
              className="input"
              placeholder="Search memory…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
            />
            <button className="btn btn-primary" onClick={doSearch} disabled={searching || !connected}>
              {searching ? '…' : 'Search'}
            </button>
          </div>
          <pre className="search-results">{searchResults}</pre>
        </div>
      )}

      {tab === 'append' && (
        <div className="mem-append">
          <div className="section-title">Add Memory Entry (via glitchlog)</div>
          <p className="mem-append-hint">
            Writes an append-only log entry. Format: what happened · decision · next action · blocker.
          </p>
          <textarea
            className="input mem-textarea"
            placeholder="What happened. Decision. Next action. Blocker (if any)."
            value={appendText}
            onChange={e => setAppendText(e.target.value)}
            rows={4}
          />
          <button
            className="btn btn-primary"
            onClick={doAppend}
            disabled={appending || !connected || !appendText.trim()}
          >
            {appending ? 'Writing…' : 'Append to Memory'}
          </button>
        </div>
      )}
    </div>
  );
}

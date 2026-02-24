import { useEffect, useState } from 'react';
import { useStore } from '../../core/store';
import { RefreshCw, Search, PenLine } from 'lucide-react';
import './MemoryPanel.css';

const TABS = [
  { id: 'snapshot', label: 'MEMORY.md' },
  { id: 'daily',    label: "Today's Log" },
  { id: 'search',   label: 'Search' },
  { id: 'append',   label: 'Append' },
];

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

  useEffect(() => {
    if (connected && tab === 'daily') {
      const today = new Date().toISOString().slice(0, 10);
      runCmd(`cat /root/.openclaw/workspace/memory/${today}.md 2>/dev/null || echo "(no log for today yet)"`)
        .then(r => setDailyLog(r.stdout));
    }
  }, [tab, connected]);

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    setSearchResults(await searchMemory(searchQ) || '(no results)');
    setSearching(false);
  };

  const doAppend = async () => {
    if (!appendText.trim()) return;
    setAppending(true);
    await appendMemory(appendText);
    setAppendText('');
    await loadMemory();
    setAppending(false);
  };

  return (
    <div className="panel-wrap">
      {/* Tab bar */}
      <div className="mem-tabbar">
        {TABS.map(t => (
          <button key={t.id} className={`mem-tab ${tab === t.id ? 'mem-tab-active' : ''}`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" onClick={loadMemory} disabled={memoryLoading || !connected}>
          <RefreshCw size={12} className={memoryLoading ? 'spin' : ''} />
          {memoryLoading ? 'Loading…' : 'Reload'}
        </button>
      </div>

      <div className="panel-body">
        {(tab === 'snapshot' || tab === 'daily') && (
          <div className="card mem-content-card">
            <pre className="mem-pre">{tab === 'snapshot' ? (memorySnapshot || '(empty — connect and reload)') : (dailyLog || '(loading…)')}</pre>
          </div>
        )}

        {tab === 'search' && (
          <>
            <div className="card">
              <div className="mem-search-row">
                <input className="input" placeholder="Search memory files…"
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()} />
                <button className="btn btn-primary btn-sm" onClick={doSearch} disabled={searching || !connected}>
                  <Search size={14} /> {searching ? '…' : 'Search'}
                </button>
              </div>
            </div>
            {searchResults && (
              <div className="card mem-content-card">
                <pre className="mem-pre">{searchResults}</pre>
              </div>
            )}
          </>
        )}

        {tab === 'append' && (
          <div className="card">
            <div className="card-header">Add Memory Entry</div>
            <p className="mem-append-hint">Writes via <code>glitchlog</code>. Format: what happened · decision · next action · blocker.</p>
            <textarea className="input mem-textarea" rows={4}
              placeholder="What happened. Decision. Next action. Blocker (if any)."
              value={appendText} onChange={e => setAppendText(e.target.value)} />
            <button className="btn btn-primary" style={{ marginTop: 'var(--sp-3)', alignSelf: 'flex-start' }}
              onClick={doAppend} disabled={appending || !connected || !appendText.trim()}>
              <PenLine size={14} /> {appending ? 'Writing…' : 'Append to Memory'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

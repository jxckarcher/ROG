import { useState } from 'react';
import { useStore } from '../../core/store';
import { RefreshCw } from 'lucide-react';

export default function AgentsPanel() {
  const { connected, runCmd } = useStore();
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!connected) return;
    setLoading(true);
    const res = await runCmd('openclaw agent list 2>&1');
    setOutput(res.stdout || res.stderr || '(no output)');
    setLoading(false);
  };

  return (
    <div className="panel-wrap" style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-heading)', fontWeight: 600 }}>Agents</h2>
        <button className="btn-ghost btn-xs" onClick={load} disabled={loading || !connected}>
          <RefreshCw size={12} style={{ marginRight: 4 }} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {!connected && (
        <p style={{ color: 'var(--warn)', fontSize: 'var(--text-caption)' }}>Connect to view agents.</p>
      )}
      {output && (
        <pre style={{
          flex: 1, overflowY: 'auto', background: 'var(--surface-2)',
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)',
          padding: 'var(--sp-4)', fontSize: 13, lineHeight: 1.6,
          color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
        }}>{output}</pre>
      )}
      {!output && connected && (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-caption)' }}>
          Click Refresh to list agents.
        </p>
      )}
    </div>
  );
}

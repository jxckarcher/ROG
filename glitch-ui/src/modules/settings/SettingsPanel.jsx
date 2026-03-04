import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStore } from '../../core/store';

const ACCENT_PRESETS = ['#00e5c3', '#8b7cf6', '#39d353', '#4da6ff', '#ff8c42', '#f06292'];

const SHAPES = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'sharp',   label: 'Sharp'   },
  { id: 'pill',    label: 'Pill'    },
];

const PROFILE_SLOTS = [
  { id: 'chat',       label: 'Chat',       desc: 'Fast & cheap — general conversation' },
  { id: 'workspaces', label: 'Workspaces', desc: 'Balanced — file analysis & edits' },
  { id: 'autonomy',   label: 'Autonomy',   desc: 'Powerful — overnight agent runs' },
];

// ── Model catalogue (grouped by provider) ────────────────────────────────────
const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    badge: '#d97706',
    models: [
      { id: 'anthropic/claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku — fast & cheap' },
      { id: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet — balanced' },
      { id: 'anthropic/claude-sonnet-4-5',          label: 'Claude Sonnet 4.5 — capable' },
      { id: 'anthropic/claude-opus-4-5',            label: 'Claude Opus 4.5 — powerful' },
      { id: 'anthropic/claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 — latest' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    badge: '#7c3aed',
    models: [
      { id: 'openrouter/deepseek/deepseek-chat-v3-0324',      label: 'DeepSeek v3 — fast & cheap' },
      { id: 'openrouter/qwen/qwen-2.5-coder-32b-instruct',    label: 'Qwen 2.5 Coder 32B — coding tasks' },
      { id: 'openrouter/google/gemini-2.0-flash-001',         label: 'Gemini 2.0 Flash — speed + large context' },
      { id: 'openrouter/google/gemini-2.5-pro-preview-03-25', label: 'Gemini 2.5 Pro — reasoning' },
      { id: 'openrouter/mistralai/mistral-large-latest',      label: 'Mistral Large — docs & structured output' },
      { id: 'openrouter/meta-llama/llama-3.3-70b-instruct',   label: 'Llama 3.3 70B — general purpose' },
    ],
  },
];

const ALL_MODELS_FLAT = PROVIDERS.flatMap(p => p.models);

const SECTION_LABEL = {
  margin: 0, fontSize: 11, fontWeight: 600,
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const CARD = {
  background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--r-md)', padding: 'var(--sp-4)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
};

// ── Provider badge ─────────────────────────────────────────────────────────────
function ProviderBadge({ modelId }) {
  const provider = PROVIDERS.find(p => modelId?.startsWith(p.id));
  if (!provider) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
      padding: '1px 5px', borderRadius: 4,
      background: provider.badge + '22', color: provider.badge, flexShrink: 0,
    }}>
      {provider.label.toUpperCase()}
    </span>
  );
}

// ── Grouped select ─────────────────────────────────────────────────────────────
function ModelSelect({ value, onChange, style = {} }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)} style={{ fontSize: 'var(--text-body)', ...style }}>
      {PROVIDERS.map(p => (
        <optgroup key={p.id} label={`── ${p.label}`}>
          {p.models.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </optgroup>
      ))}
      <option value="__custom__">Custom…</option>
    </select>
  );
}

// ── findModelPath ──────────────────────────────────────────────────────────────
function findModelPath(obj, depth = 0, path = []) {
  if (!obj || typeof obj !== 'object' || depth > 5) return null;
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase().includes('model') && typeof v === 'string' && v.length > 2)
      return { value: v, path: [...path, k] };
  }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && !v.startsWith('/') && !v.startsWith('.') && (
      /^(anthropic|openai|openrouter|google|meta-llama|mistral)\//i.test(v) ||
      /claude|haiku|sonnet|opus|gpt|llama|gemini|mistral/i.test(v)
    )) return { value: v, path: [...path, k] };
  }
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') {
      const found = findModelPath(v, depth + 1, [...path, k]);
      if (found) return found;
    }
  }
  return null;
}

function setNestedKey(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
}

export default function SettingsPanel() {
  const {
    themeMode, setThemeMode, accentColor, setAccentColor, themeShape, setThemeShape,
    vps, uiScale, setUiScale, connected, runCmd,
    modelProfiles, setModelProfile,
  } = useStore();
  const [modelInfo, setModelInfo] = useState({ loading: false, value: '', error: '' });
  const [modelPath, setModelPath] = useState(null);
  const [rawConfig, setRawConfig] = useState('');
  const [showRaw, setShowRaw]     = useState(false);
  const [editingModel, setEditingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel]     = useState('');
  const [saving, setSaving]               = useState(false);

  const loadModel = async () => {
    if (!connected) return;
    setModelInfo({ loading: true, value: '', error: '' });
    setRawConfig('');
    setEditingModel(false);
    const r = await runCmd('cat /root/.openclaw/openclaw.json 2>/dev/null');
    const raw = r.stdout.trim();
    if (!raw) {
      setModelInfo({ loading: false, value: '', error: 'Config file not found at /root/.openclaw/openclaw.json' });
      return;
    }
    setRawConfig(raw);
    try {
      const cfg = JSON.parse(raw);
      const result = findModelPath(cfg);
      if (result) {
        setModelInfo({ loading: false, value: result.value, error: '' });
        setModelPath(result.path);
        const known = ALL_MODELS_FLAT.find(m => m.id === result.value);
        setSelectedModel(known ? result.value : '__custom__');
        setCustomModel(result.value);
      } else {
        setModelInfo({ loading: false, value: '', error: '(model key not found — click View raw to inspect)' });
        setModelPath(null);
      }
    } catch {
      setModelInfo({ loading: false, value: '', error: 'Could not parse openclaw.json — check Terminal for errors' });
    }
  };

  const saveModel = async () => {
    if (!rawConfig) return;
    const newModel = selectedModel === '__custom__' ? customModel.trim() : selectedModel;
    if (!newModel) return;
    setSaving(true);
    try {
      const cfg = JSON.parse(rawConfig);
      const keyPath = modelPath || ['model'];
      setNestedKey(cfg, keyPath, newModel);
      const newJson = JSON.stringify(cfg, null, 2);
      const b64 = btoa(unescape(encodeURIComponent(newJson)));
      await runCmd(`python3 -c "import base64; open('/root/.openclaw/openclaw.json','wb').write(base64.b64decode('${b64}'))"`);
      setEditingModel(false);
      await loadModel();
    } catch (e) {
      setModelInfo(m => ({ ...m, error: 'Save failed: ' + e.message }));
    }
    setSaving(false);
  };

  useEffect(() => { if (connected) loadModel(); }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveModel = selectedModel === '__custom__' ? customModel : selectedModel;

  return (
    <div className="panel-wrap" style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', overflowY: 'auto' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--text-title)', fontWeight: 600 }}>Settings</h2>

      {/* ── Appearance ────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h3 style={SECTION_LABEL}>Appearance</h3>
        <div style={CARD}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Mode</span>
            <div style={{ display: 'flex', gap: 0, background: 'var(--surface-3)', borderRadius: 'var(--r-sm)', padding: 2, width: 'fit-content' }}>
              {['night', 'day', 'auto'].map(m => (
                <button key={m} onClick={() => setThemeMode(m)} style={{
                  padding: 'var(--sp-1) var(--sp-4)', border: 'none', borderRadius: 'var(--r-sm)',
                  background: themeMode === m ? 'var(--surface-1)' : 'transparent',
                  color: themeMode === m ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontWeight: themeMode === m ? 600 : 400, fontSize: 'var(--text-body)',
                  cursor: 'pointer', textTransform: 'capitalize',
                  transition: 'background var(--t-fast), color var(--t-fast)',
                }}>{m}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Accent color</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {ACCENT_PRESETS.map(hex => (
                <button key={hex} onClick={() => setAccentColor(hex)} title={hex} style={{
                  width: 22, height: 22, borderRadius: '50%', background: hex,
                  border: accentColor === hex ? '2px solid var(--text-primary)' : '2px solid transparent',
                  outline: accentColor === hex ? `2px solid ${hex}` : 'none', outlineOffset: 2,
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                }} />
              ))}
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} title="Custom color"
                style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface-3)', cursor: 'pointer', padding: 2 }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Style</span>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              {SHAPES.map(s => (
                <button key={s.id} onClick={() => setThemeShape(s.id)} style={{
                  padding: 'var(--sp-1) var(--sp-3)',
                  border: `1px solid ${themeShape === s.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  borderRadius: s.id === 'pill' ? 999 : s.id === 'sharp' ? 2 : 'var(--r-sm)',
                  background: themeShape === s.id ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: themeShape === s.id ? 'var(--accent-text)' : 'var(--text-primary)',
                  fontWeight: themeShape === s.id ? 600 : 400, fontSize: 'var(--text-body)',
                  cursor: 'pointer', transition: 'background var(--t-fast), border-color var(--t-fast)',
                }}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── UI Scale ──────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h3 style={SECTION_LABEL}>UI Scale</h3>
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', flexShrink: 0 }}>85%</span>
            <input type="range" min={0.85} max={1.3} step={0.05} value={uiScale}
              style={{ flex: 1 }} onChange={e => setUiScale(parseFloat(e.target.value))} />
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', flexShrink: 0 }}>130%</span>
            <span style={{
              minWidth: 40, textAlign: 'right', fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)', color: 'var(--text-primary)', fontWeight: 600,
            }}>{Math.round(uiScale * 100)}%</span>
            <button className="btn-ghost btn-xs" onClick={() => setUiScale(1)}>Reset</button>
          </div>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', margin: 0 }}>
            Scales text throughout the app. Persists across restarts.
          </p>
        </div>
      </section>

      {/* ── Model Profiles ────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h3 style={SECTION_LABEL}>Model Profiles</h3>
        <div style={CARD}>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', margin: '0 0 var(--sp-1)' }}>
            Route different task types to the right model. Cheaper for chat, powerful for agents.
          </p>
          {PROFILE_SLOTS.map(slot => {
            const current = modelProfiles[slot.id] || '';
            return (
              <div key={slot.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <span style={{ minWidth: 96, fontSize: 'var(--text-body)', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {slot.label}
                  </span>
                  <ModelSelect value={current} onChange={v => setModelProfile(slot.id, v)} style={{ flex: 1 }} />
                  <ProviderBadge modelId={current} />
                </div>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-tertiary)', paddingLeft: 104 }}>
                  {slot.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Active Model (VPS config) ─────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h3 style={SECTION_LABEL}>Active Model (VPS config)</h3>
        <div style={CARD}>
          {!editingModel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                {modelInfo.loading ? (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-body)', flex: 1 }}>Loading…</span>
                ) : modelInfo.error ? (
                  <span style={{ color: 'var(--warn)', fontSize: 'var(--text-caption)', flex: 1 }}>{modelInfo.error}</span>
                ) : (
                  <>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body)', color: 'var(--text-primary)', flex: 1 }}>
                      {modelInfo.value || (connected ? '—' : 'Connect first')}
                    </span>
                    <ProviderBadge modelId={modelInfo.value} />
                  </>
                )}
                <button className="btn-ghost btn-xs" onClick={loadModel} disabled={modelInfo.loading || !connected} title="Reload from VPS">
                  <RefreshCw size={11} className={modelInfo.loading ? 'spin' : ''} />
                </button>
                {modelInfo.value && (
                  <button className="btn-ghost btn-xs" onClick={() => setEditingModel(true)} disabled={!connected || !rawConfig}>
                    Edit
                  </button>
                )}
                {rawConfig && (
                  <button className="btn-ghost btn-xs" onClick={() => setShowRaw(v => !v)}>
                    {showRaw ? 'Hide raw' : 'View raw'}
                  </button>
                )}
              </div>
              {showRaw && rawConfig && (
                <pre style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)',
                  color: 'var(--text-secondary)', background: 'var(--surface-3)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)',
                  padding: 'var(--sp-3)', overflowX: 'auto', maxHeight: 240, overflowY: 'auto', margin: 0,
                }}>{rawConfig}</pre>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <ModelSelect value={selectedModel} onChange={setSelectedModel} style={{ flex: 1 }} />
                  <ProviderBadge modelId={effectiveModel} />
                </div>
                {selectedModel === '__custom__' && (
                  <input className="input" placeholder="e.g. openrouter/deepseek/deepseek-chat-v3-0324"
                    value={customModel} onChange={e => setCustomModel(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body)' }} />
                )}
                <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Will write <span style={{ fontFamily: 'var(--font-mono)' }}>{effectiveModel || '…'}</span> to openclaw.json
                  {modelPath ? ` at key path: ${modelPath.join(' → ')}` : ''}.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="btn btn-primary btn-xs" onClick={saveModel} disabled={saving || !effectiveModel}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn-ghost btn-xs" onClick={() => setEditingModel(false)} disabled={saving}>Cancel</button>
              </div>
            </>
          )}
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', margin: 0 }}>
            From <span style={{ fontFamily: 'var(--font-mono)' }}>/root/.openclaw/openclaw.json</span> — primary model for this session.
          </p>
        </div>
      </section>

      {/* ── VPS ───────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h3 style={SECTION_LABEL}>VPS</h3>
        <div style={CARD}>
          <Row label="Host" value={vps.host} />
          <Row label="User" value={vps.user} />
          <Row label="Tunnel port" value={String(vps.tunnelPort)} />
        </div>
      </section>

      {/* ── Device ────────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h3 style={SECTION_LABEL}>Device</h3>
        <div style={CARD}>
          <Row label="Device key" value="Ed25519 — stored in localStorage" />
          <Row label="Device token" value={localStorage.getItem('glitch-ui:device-token') ? 'Cached ✓' : 'None (set after WS auth)'} />
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-4)', fontSize: 'var(--text-body)' }}>
      <span style={{ color: 'var(--text-secondary)', minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

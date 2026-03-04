import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../core/store';
import { RefreshCw, Plus, Bot, Trash2, Pencil, X, Zap, Calendar, DollarSign, Cpu } from 'lucide-react';

// ── Model catalogue (must match SettingsPanel) ────────────────────────────────
const PROVIDERS = [
  {
    id: 'anthropic', label: 'Anthropic', badge: '#d97706',
    models: [
      { id: 'anthropic/claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku — fast & cheap' },
      { id: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet — balanced' },
      { id: 'anthropic/claude-sonnet-4-5',          label: 'Claude Sonnet 4.5 — capable' },
      { id: 'anthropic/claude-opus-4-5',            label: 'Claude Opus 4.5 — powerful' },
    ],
  },
  {
    id: 'openrouter', label: 'OpenRouter', badge: '#7c3aed',
    models: [
      { id: 'openrouter/deepseek/deepseek-chat-v3-0324',      label: 'DeepSeek v3 — fast & cheap' },
      { id: 'openrouter/qwen/qwen-2.5-coder-32b-instruct',    label: 'Qwen 2.5 Coder 32B — coding' },
      { id: 'openrouter/google/gemini-2.0-flash-001',         label: 'Gemini 2.0 Flash — speed + context' },
      { id: 'openrouter/google/gemini-2.5-pro-preview-03-25', label: 'Gemini 2.5 Pro — reasoning' },
      { id: 'openrouter/mistralai/mistral-large-latest',      label: 'Mistral Large — docs & structured output' },
      { id: 'openrouter/meta-llama/llama-3.3-70b-instruct',   label: 'Llama 3.3 70B — general purpose' },
    ],
  },
];

const CATEGORIES = [
  'engineering', 'product', 'marketing', 'design',
  'project-management', 'operations', 'testing', 'research', 'other',
];

const DEFAULT_MODEL = 'openrouter/deepseek/deepseek-chat-v3-0324';
const AGENTS_DIR    = '/root/.openclaw/workspace/agents';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getProviderInfo(modelId) {
  return PROVIDERS.find(p => modelId?.startsWith(p.id)) || null;
}

function ProviderBadge({ modelId, small = false }) {
  const p = getProviderInfo(modelId);
  if (!p) return null;
  return (
    <span style={{
      fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: '0.05em',
      padding: small ? '1px 4px' : '1px 6px', borderRadius: 4,
      background: p.badge + '22', color: p.badge, flexShrink: 0,
    }}>{p.label.toUpperCase()}</span>
  );
}

function ModelSelect({ value, onChange, style = {} }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}
      style={{ fontSize: 'var(--text-body)', ...style }}>
      {PROVIDERS.map(p => (
        <optgroup key={p.id} label={`── ${p.label}`}>
          {p.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

// ── Frontmatter parse / serialise ─────────────────────────────────────────────
function parseAgent(filename, content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const fm = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (k) fm[k] = v;
  });
  const slug = filename.replace(/\.md$/, '');
  return {
    slug,
    name:        fm.name        || slug,
    category:    fm.category    || 'other',
    model:       fm.model       || DEFAULT_MODEL,
    budget:      fm.budget      || '1.00',
    schedule:    fm.schedule && fm.schedule !== 'null' ? fm.schedule : '',
    description: fm.description || '',
    created:     fm.created     || '',
    body:        match[2].trim(),
  };
}

function agentToMarkdown(form) {
  const slug = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const body = form.body.trim() || `# ${form.name}\n\n${form.description}`;
  return `---
name: ${form.name}
category: ${form.category}
model: ${form.model}
budget: ${form.budget || '1.00'}
schedule: ${form.schedule || 'null'}
created: ${form.created || new Date().toISOString().split('T')[0]}
description: ${form.description}
---

${body}`;
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ label, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
      background: color + '22', color, letterSpacing: '0.04em',
    }}>{label}</span>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, onEdit, onDelete }) {
  const categoryColors = {
    engineering: '#4da6ff', product: '#f59e0b', marketing: '#ec4899',
    design: '#a78bfa', 'project-management': '#10b981', operations: '#6b7280',
    testing: '#ef4444', research: '#06b6d4', other: '#9ca3af',
  };
  const catColor = categoryColors[agent.category] || '#9ca3af';

  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--r-md)', padding: 'var(--sp-4)',
      display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
      transition: 'border-color var(--t-fast)',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-focus)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--r-sm)', flexShrink: 0,
          background: catColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={16} style={{ color: catColor }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-body)', color: 'var(--text-primary)', marginBottom: 2 }}>
            {agent.name}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
              background: catColor + '22', color: catColor,
            }}>{agent.category}</span>
            <ProviderBadge modelId={agent.model} small />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexShrink: 0 }}>
          <button className="btn-ghost btn-xs" onClick={() => onEdit(agent)} title="Edit">
            <Pencil size={11} />
          </button>
          <button className="btn-ghost btn-xs" onClick={() => onDelete(agent)} title="Delete"
            style={{ color: 'var(--danger, #ef4444)' }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p style={{ margin: 0, fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {agent.description}
        </p>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <MetaItem icon={<Cpu size={10} />} label={agent.model.split('/').pop()} />
        <MetaItem icon={<DollarSign size={10} />} label={`$${agent.budget} cap`} />
        {agent.schedule && <MetaItem icon={<Calendar size={10} />} label={agent.schedule} />}
      </div>
    </div>
  );
}

function MetaItem({ icon, label }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 3,
      fontSize: 10, color: 'var(--text-tertiary)',
    }}>
      {icon} {label}
    </span>
  );
}

// ── Create / Edit modal ───────────────────────────────────────────────────────
const BLANK_FORM = {
  name: '', category: 'engineering', model: DEFAULT_MODEL,
  budget: '1.00', schedule: '', description: '', body: '', created: '',
};

function AgentModal({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || BLANK_FORM);
  const [tab, setTab]   = useState('form'); // 'form' | 'prompt'
  const nameRef = useRef(null);

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 80);
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial?.slug;
  const canSave = form.name.trim().length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--sp-4)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
          padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Zap size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-body)', flex: 1 }}>
            {isEdit ? `Edit — ${initial.name}` : 'New Agent'}
          </span>
          <button className="btn-ghost btn-xs" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 0, padding: 'var(--sp-2) var(--sp-5) 0',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {[['form', 'Configure'], ['prompt', 'System Prompt']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: 'var(--sp-1) var(--sp-4)', border: 'none',
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              color: tab === id ? 'var(--accent)' : 'var(--text-tertiary)',
              fontWeight: tab === id ? 600 : 400, fontSize: 'var(--text-body)',
              cursor: 'pointer', marginBottom: -1,
            }}>{label}</button>
          ))}
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {tab === 'form' ? (
            <>
              {/* Name */}
              <Field label="Name *">
                <input ref={nameRef} className="input" placeholder="e.g. Frontend Developer"
                  value={form.name} onChange={e => set('name', e.target.value)}
                  style={{ fontSize: 'var(--text-body)', width: '100%' }} />
              </Field>

              {/* Description */}
              <Field label="Description">
                <textarea className="input" placeholder="What does this agent do? Describe its role and expertise."
                  value={form.description} onChange={e => set('description', e.target.value)}
                  rows={3} style={{ fontSize: 'var(--text-body)', width: '100%', resize: 'vertical' }} />
              </Field>

              {/* Category + Model */}
              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                <Field label="Category" style={{ flex: 1 }}>
                  <select className="input" value={form.category} onChange={e => set('category', e.target.value)}
                    style={{ fontSize: 'var(--text-body)', width: '100%' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Model">
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <ModelSelect value={form.model} onChange={v => set('model', v)} style={{ flex: 1 }} />
                  <ProviderBadge modelId={form.model} />
                </div>
              </Field>

              {/* Budget + Schedule */}
              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                <Field label="Budget cap (USD)" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <DollarSign size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <input className="input" type="number" min="0" step="0.25" placeholder="1.00"
                      value={form.budget} onChange={e => set('budget', e.target.value)}
                      style={{ fontSize: 'var(--text-body)', width: '100%' }} />
                  </div>
                </Field>
                <Field label="Schedule (cron or natural)" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <Calendar size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <input className="input" placeholder="e.g. 0 2 * * * or nightly"
                      value={form.schedule} onChange={e => set('schedule', e.target.value)}
                      style={{ fontSize: 'var(--text-body)', width: '100%' }} />
                  </div>
                </Field>
              </div>
            </>
          ) : (
            /* System Prompt tab */
            <Field label="System Prompt" hint="Paste or write the agent's full instructions. If blank, a default is generated from the description.">
              <textarea className="input" placeholder={`# ${form.name || 'Agent Name'}\n\nYou are a specialist in...\n`}
                value={form.body} onChange={e => set('body', e.target.value)}
                rows={16} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, width: '100%', resize: 'vertical' }} />
            </Field>
          )}
        </div>

        {/* Modal footer */}
        <div style={{
          display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end',
          padding: 'var(--sp-3) var(--sp-5)', borderTop: '1px solid var(--border-subtle)',
        }}>
          <button className="btn-ghost btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(form)}
            disabled={saving || !canSave}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', ...style }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ margin: 0, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>{hint}</p>}
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ agent, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)', padding: 'var(--sp-6)', maxWidth: 380, width: '100%',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-body)' }}>Delete "{agent.name}"?</p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>
            This removes the agent definition file. Tasks and history are unaffected.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
          <button className="btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-sm" onClick={() => onConfirm(agent)}
            style={{ background: '#ef4444', color: '#fff', border: 'none' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function AgentsPanel() {
  const { connected, runCmd } = useStore();
  const [agents,        setAgents]        = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [editTarget,    setEditTarget]    = useState(null); // null = create, object = edit
  const [saving,        setSaving]        = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [filterCat,     setFilterCat]     = useState('all');
  const [error,         setError]         = useState('');

  const loadAgents = async () => {
    if (!connected) return;
    setLoading(true);
    setError('');
    try {
      await runCmd(`mkdir -p ${AGENTS_DIR}`);
      const listRes = await runCmd(`ls ${AGENTS_DIR}/*.md 2>/dev/null`);
      const files   = listRes.stdout.trim().split('\n').filter(f => f.endsWith('.md'));
      if (!files.length || files[0] === '') { setAgents([]); setLoading(false); return; }

      const parsed = [];
      for (const file of files) {
        const res = await runCmd(`cat "${file}" 2>/dev/null`);
        const filename = file.split('/').pop();
        const agent = parseAgent(filename, res.stdout);
        if (agent) parsed.push(agent);
      }
      setAgents(parsed.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setError(e.message || 'Failed to load agents');
    }
    setLoading(false);
  };

  useEffect(() => { if (connected) loadAgents(); }, [connected]); // eslint-disable-line

  const openCreate = () => { setEditTarget(null); setShowModal(true); };
  const openEdit   = (agent) => { setEditTarget(agent); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const saveAgent = async (form) => {
    setSaving(true);
    try {
      const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const content = agentToMarkdown({ ...form, slug });
      const path    = `${AGENTS_DIR}/${slug}.md`;
      const b64     = btoa(unescape(encodeURIComponent(content)));
      await runCmd(`mkdir -p ${AGENTS_DIR} && python3 -c "import base64; open('${path}','wb').write(base64.b64decode('${b64}'))"`);
      closeModal();
      await loadAgents();
    } catch (e) {
      setError('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  const deleteAgent = async (agent) => {
    await runCmd(`rm -f "${AGENTS_DIR}/${agent.slug}.md"`);
    setDeleteTarget(null);
    await loadAgents();
  };

  const categories = ['all', ...new Set(agents.map(a => a.category))];
  const visible = filterCat === 'all' ? agents : agents.filter(a => a.category === filterCat);

  return (
    <div className="panel-wrap" style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-heading)', fontWeight: 600, flex: 1 }}>Agents</h2>
        <button className="btn-ghost btn-xs" onClick={loadAgents} disabled={loading || !connected} title="Refresh">
          <RefreshCw size={12} className={loading ? 'spin' : ''} />
        </button>
        <button className="btn btn-primary btn-sm" onClick={openCreate} disabled={!connected}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
          <Plus size={13} /> New Agent
        </button>
      </div>

      {!connected && (
        <p style={{ color: 'var(--warn)', fontSize: 'var(--text-caption)', margin: 0 }}>Connect first to manage agents.</p>
      )}
      {error && (
        <p style={{ color: 'var(--danger, #ef4444)', fontSize: 'var(--text-caption)', margin: 0 }}>{error}</p>
      )}

      {/* Category filter */}
      {agents.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{
              padding: '3px 10px', border: '1px solid',
              borderColor: filterCat === cat ? 'var(--accent)' : 'var(--border-subtle)',
              borderRadius: 99,
              background: filterCat === cat ? 'var(--accent-soft)' : 'transparent',
              color: filterCat === cat ? 'var(--accent-text)' : 'var(--text-tertiary)',
              fontSize: 11, fontWeight: filterCat === cat ? 600 : 400,
              cursor: 'pointer', transition: 'all var(--t-fast)',
              textTransform: 'capitalize',
            }}>{cat}</button>
          ))}
        </div>
      )}

      {/* Agent grid */}
      {visible.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--sp-3)' }}>
          {visible.map(agent => (
            <AgentCard key={agent.slug} agent={agent}
              onEdit={openEdit}
              onDelete={setDeleteTarget} />
          ))}
        </div>
      ) : (
        connected && !loading && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 'var(--sp-3)', color: 'var(--text-tertiary)', paddingTop: 48,
          }}>
            <Bot size={40} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: 'var(--text-body)' }}>No agents yet.</p>
            <button className="btn btn-primary btn-sm" onClick={openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
              <Plus size={13} /> Create your first agent
            </button>
          </div>
        )
      )}

      {/* Modals */}
      {showModal && (
        <AgentModal
          initial={editTarget}
          onClose={closeModal}
          onSave={saveAgent}
          saving={saving}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          agent={deleteTarget}
          onConfirm={deleteAgent}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

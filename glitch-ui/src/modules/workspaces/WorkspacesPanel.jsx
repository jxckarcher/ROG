import { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { useStore } from '../../core/store';

// Stub workers to prevent CDN fetches blocked by Tauri WebView tracking prevention
window.MonacoEnvironment = {
  getWorker: () => new Worker(
    URL.createObjectURL(new Blob([''], { type: 'application/javascript' }))
  ),
};

import {
  FolderOpen, FileText, ArrowLeft, RefreshCw, Save, GitCommit, Paperclip, GitMerge,
  FilePlus, FolderPlus, Pencil, Trash2, X,
} from 'lucide-react';
import './WorkspacesPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeFsPath(s) {
  return String(s || '').replace(/\.\./g, '').replace(/[^a-zA-Z0-9._\-/ ]/g, '');
}

function getLang(filename) {
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rs: 'rust', css: 'css', json: 'json', md: 'markdown',
    html: 'html', sh: 'shell', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    txt: 'plaintext', env: 'shell',
  };
  return map[ext] || 'plaintext';
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let b64 = '';
  for (let i = 0; i < bytes.length; i += 3000) {
    b64 += btoa(String.fromCharCode(...bytes.slice(i, i + 3000)));
  }
  return b64;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract first substantial code block from a Glitch message
function extractCodeBlock(text) {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  if (!match) return null;
  const code = match[1].trimEnd();
  return code.split('\n').length >= 5 ? code : null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkspacesPanel() {
  const {
    connected, runCmd, chatMessages, sendChat, chatSending, themeMode,
    workspacePrefill, clearWorkspacePrefill,
  } = useStore();

  const monacoTheme = themeMode === 'day' ? 'light' : 'vs-dark';

  // Explorer state
  const [cwd, setCwd]             = useState('/root');
  const [pathInput, setPathInput] = useState('/root');
  const [vpsItems, setVpsItems]   = useState([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [cwdHistory, setCwdHistory] = useState([]);

  // Editor state
  const [openFile, setOpenFile]           = useState(null);   // { path, name }
  const [editorContent, setEditorContent] = useState('');
  const [modified, setModified]           = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState('');
  const [fileHash, setFileHash]           = useState('');

  // Diff review
  const [diffView, setDiffView] = useState(null);  // { proposed: string, lang: string } | null

  // Context chip
  const [contextAttached, setContextAttached] = useState(false);

  // Clone notice
  const [cloneNotice, setCloneNotice] = useState(null);  // { cloneCmd, repoRoot } | null
  const [cloning, setCloning]         = useState(false);

  // Git state
  const [gitStatus, setGitStatus]   = useState('');
  const [commitMsg, setCommitMsg]   = useState('');
  const [committing, setCommitting] = useState(false);
  const [gitMsg, setGitMsg]         = useState('');

  // Commit confirmation modal
  const [commitModal, setCommitModal] = useState(null);  // { diffStat: string } | null

  // File op modal — new file, new folder, rename, delete
  const [fileModal, setFileModal] = useState(null);
  // { type: 'newfile'|'newfolder'|'rename'|'delete', item?: VpsItem, value: string }

  // Chat
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);
  const chatInputRef  = useRef(null);

  // ── Directory load ──────────────────────────────────────────────────────────
  const loadDir = useCallback(async (path) => {
    if (!connected) return;
    const safe = safeFsPath(path);
    if (!safe) return;
    setLoadingDir(true);
    const r = await runCmd(`ls -la "${safe}" 2>&1`);
    if (r.stdout.startsWith('ls: cannot')) {
      setLoadingDir(false);
      return;
    }
    const lines = r.stdout.split('\n').filter(l => l.match(/^[dl\-]/));
    const parsed = lines
      .map(line => {
        const parts = line.split(/\s+/);
        const name = parts.slice(8).join(' ');
        return { name, isDir: line.startsWith('d'), path: safe.replace(/\/$/, '') + '/' + name };
      })
      .filter(i => i.name && i.name !== '.' && i.name !== '..');
    setVpsItems(parsed);
    setCwd(safe);
    setPathInput(safe);
    setLoadingDir(false);
  }, [connected, runCmd]);

  useEffect(() => {
    if (connected) loadDir(cwd);
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = (path) => {
    setCwdHistory(h => [...h, cwd]);
    loadDir(path);
  };

  const goUp = () => {
    const parent = cwd.split('/').slice(0, -1).join('/') || '/';
    navigateTo(parent);
  };

  const goBack = () => {
    if (!cwdHistory.length) return;
    const prev = cwdHistory[cwdHistory.length - 1];
    setCwdHistory(h => h.slice(0, -1));
    loadDir(prev);
  };

  // ── Workspace prefill (from GitHub "Open in Workspace") ─────────────────────
  useEffect(() => {
    if (!workspacePrefill || !connected) return;
    const { vpsPath, fileName, content, ghOwner, ghRepo } = workspacePrefill;
    clearWorkspacePrefill();

    const isFile = fileName && content;
    const vpsDir = isFile
      ? vpsPath.substring(0, vpsPath.lastIndexOf('/'))
      : vpsPath;

    // Navigate explorer to directory
    setCwdHistory(h => [...h, cwd]);
    loadDir(vpsDir);
    setCloneNotice(null);

    if (isFile) {
      // Load file content from GitHub directly
      setOpenFile({ path: vpsPath, name: fileName });
      setEditorContent(content);
      setModified(false);
      setSaveMsg('Opened from GitHub — save will write to VPS');
      sha256(content).then(setFileHash);
      setContextAttached(true);
      setDiffView(null);

      // Check if VPS clone exists
      if (ghOwner && ghRepo) {
        const repoRoot = `/root/repos/${ghOwner}/${ghRepo}`;
        runCmd(`test -d "${repoRoot}" && echo EXISTS || echo MISSING`).then(r => {
          if (r.stdout.includes('MISSING')) {
            setCloneNotice({
              repoRoot,
              cloneCmd: `git clone git@github.com:${ghOwner}/${ghRepo} ${repoRoot}`,
            });
          }
        });
      }
    }
  }, [workspacePrefill, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File open ───────────────────────────────────────────────────────────────
  const openVpsFile = async (item) => {
    if (!connected) return;
    const safe = safeFsPath(item.path);
    const r = await runCmd(`cat "${safe}" 2>&1`);
    setOpenFile({ path: safe, name: item.name });
    setEditorContent(r.stdout);
    setModified(false);
    setSaveMsg('');
    setDiffView(null);
    setContextAttached(false);
    setCloneNotice(null);
    sha256(r.stdout).then(setFileHash);
    refreshGitStatus(cwd);
  };

  // ── File save (accepts optional content override for diff apply) ─────────────
  const saveFile = async (contentOverride) => {
    const content = contentOverride !== undefined ? contentOverride : editorContent;
    if (!openFile || saving) return;
    if (contentOverride === undefined && !modified) return;
    const bytes = new TextEncoder().encode(content);
    if (bytes.length > 102400) { setSaveMsg('File >100KB — use Terminal to save'); return; }
    setSaving(true);
    setSaveMsg('');
    const b64 = toBase64(content);
    const safe = safeFsPath(openFile.path);
    await runCmd(`python3 -c "import base64; open('${safe}','wb').write(base64.b64decode('${b64}'))"`);
    setSaving(false);
    setModified(false);
    setSaveMsg('Saved ✓');
    sha256(content).then(setFileHash);
    setTimeout(() => setSaveMsg(''), 3000);
    refreshGitStatus(cwd);
  };

  // ── Apply proposed diff ──────────────────────────────────────────────────────
  const applyDiff = async () => {
    if (!openFile || !diffView) return;
    // Hash guard: re-read file and compare
    if (fileHash) {
      const r = await runCmd(`cat "${safeFsPath(openFile.path)}" 2>&1`);
      const current = await sha256(r.stdout);
      if (current !== fileHash) {
        setSaveMsg('File changed on VPS — reload before applying');
        setDiffView(null);
        return;
      }
    }
    setEditorContent(diffView.proposed);
    setModified(false);
    setDiffView(null);
    await saveFile(diffView.proposed);
  };

  // ── Git helpers ─────────────────────────────────────────────────────────────
  const refreshGitStatus = useCallback(async (dir) => {
    if (!connected) return;
    const safe = safeFsPath(dir || cwd);
    const r = await runCmd(`git -C "${safe}" status --short 2>&1`);
    const out = r.stdout.trim();
    setGitStatus(out.includes('fatal') ? '' : out);
  }, [connected, cwd, runCmd]);

  // Step 1: show diff stat, require confirmation
  const openCommitModal = async () => {
    if (!connected || committing || !gitStatus) return;
    const safe = safeFsPath(cwd);
    const r = await runCmd(`git -C "${safe}" diff --stat HEAD 2>&1; git -C "${safe}" status --short 2>&1`);
    setCommitModal({ diffStat: r.stdout.trim() || '(no diff available)' });
  };

  // Step 2: actually commit + push after user confirms
  const confirmCommitAndPush = async () => {
    if (!connected || committing) return;
    setCommitModal(null);
    setCommitting(true);
    setGitMsg('');
    const safe = safeFsPath(cwd);
    const msg = (commitMsg.trim() || 'Update from Glitch UI').replace(/"/g, '\\"');
    const r = await runCmd(
      `git -C "${safe}" add -A && git -C "${safe}" commit -m "${msg}" && git -C "${safe}" push 2>&1`
    );
    setGitMsg(r.stdout.slice(-200));
    setCommitMsg('');
    await refreshGitStatus(safe);
    setCommitting(false);
  };

  // ── File ops ────────────────────────────────────────────────────────────────
  const openFileModal = (type, item = null) => {
    setFileModal({ type, item, value: item?.name || '' });
  };

  const confirmFileOp = async () => {
    if (!fileModal || !connected) return;
    const { type, item, value } = fileModal;
    setFileModal(null);
    const safeName = value.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const safeCwd = safeFsPath(cwd);
    if (type === 'newfile') {
      await runCmd(`touch "${safeCwd}/${safeName}" 2>&1`);
    } else if (type === 'newfolder') {
      await runCmd(`mkdir -p "${safeCwd}/${safeName}" 2>&1`);
    } else if (type === 'rename' && item) {
      const dir = item.path.substring(0, item.path.lastIndexOf('/'));
      await runCmd(`mv "${safeFsPath(item.path)}" "${safeFsPath(dir)}/${safeName}" 2>&1`);
    } else if (type === 'delete' && item) {
      await runCmd(`rm -rf "${safeFsPath(item.path)}" 2>&1`);
      if (openFile?.path === item.path) {
        setOpenFile(null);
        setEditorContent('');
        setModified(false);
      }
    }
    await loadDir(safeCwd);
  };

  // ── Clone repo (from clone notice) ──────────────────────────────────────────
  const cloneRepo = async () => {
    if (!cloneNotice || !connected) return;
    setCloning(true);
    setSaveMsg('Cloning…');
    await runCmd(`${cloneNotice.cloneCmd} 2>&1`);
    setCloning(false);
    setCloneNotice(null);
    setSaveMsg('Cloned ✓ — reload to confirm');
    loadDir(cloneNotice.repoRoot);
  };

  // ── Mini Chat ───────────────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMsg = async () => {
    let text = chatInput.trim();
    if (!text || chatSending || !connected) return;

    // Inject file context if chip is attached
    if (contextAttached && openFile) {
      const LIMIT = 2000;
      const snippet = editorContent.slice(0, LIMIT);
      const note = editorContent.length > LIMIT
        ? ` [truncated — ${editorContent.length} chars total, showing first ${LIMIT}]`
        : '';
      text = `File: \`${openFile.path}\`${note}\n\`\`\`${getLang(openFile.name)}\n${snippet}\n\`\`\`\n\n${text}`;
    }

    setChatInput('');
    await sendChat(text);
    chatInputRef.current?.focus();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="workspaces-panel">

      {/* ── Left: VPS Explorer ─────────────────────────────────────────────── */}
      <div className="ws-explorer">
        <div className="ws-explorer-toolbar">
          <button className="btn-ghost btn-xs ws-icon-btn" onClick={goBack} disabled={!cwdHistory.length} title="Back">
            <ArrowLeft size={13} />
          </button>
          <button className="btn-ghost btn-xs ws-icon-btn" onClick={goUp} title="Up one level">↑</button>
          <button
            className="btn-ghost btn-xs ws-icon-btn"
            onClick={() => loadDir(cwd)}
            disabled={loadingDir || !connected}
            title="Refresh"
          >
            <RefreshCw size={12} className={loadingDir ? 'ws-spin' : ''} />
          </button>
          <button className="btn-ghost btn-xs ws-icon-btn" onClick={() => openFileModal('newfile')} disabled={!connected} title="New file">
            <FilePlus size={13} />
          </button>
          <button className="btn-ghost btn-xs ws-icon-btn" onClick={() => openFileModal('newfolder')} disabled={!connected} title="New folder">
            <FolderPlus size={13} />
          </button>
        </div>

        <div className="ws-path-bar">
          <input
            className="input ws-path-input"
            value={pathInput}
            onChange={e => setPathInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') navigateTo(pathInput); }}
            placeholder="/root"
          />
        </div>

        <div className="ws-file-list">
          {!connected && <div className="ws-hint">Connect first</div>}
          {loadingDir && <div className="ws-hint">Loading…</div>}
          {!loadingDir && vpsItems.length === 0 && connected && <div className="ws-hint">Empty</div>}
          {vpsItems.map(item => (
            <div key={item.path} className={`ws-file-item ${openFile?.path === item.path ? 'active' : ''}`}>
              <button
                className="ws-file-item-main"
                onClick={() => item.isDir ? navigateTo(item.path) : openVpsFile(item)}
                title={item.path}
              >
                <span className="ws-file-icon">
                  {item.isDir ? <FolderOpen size={13} /> : <FileText size={13} />}
                </span>
                <span className="ws-file-name">{item.name}</span>
              </button>
              <div className="ws-file-actions">
                <button className="btn-ghost btn-xs ws-file-action-btn" onClick={e => { e.stopPropagation(); openFileModal('rename', item); }} title="Rename">
                  <Pencil size={11} />
                </button>
                <button className="btn-ghost btn-xs ws-file-action-btn" onClick={e => { e.stopPropagation(); openFileModal('delete', item); }} title="Delete" style={{ color: 'var(--danger, var(--warn))' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Middle: Editor ─────────────────────────────────────────────────── */}
      <div className="ws-editor">
        <div className="ws-editor-toolbar">
          {openFile ? (
            <>
              <span className="ws-file-path">{openFile.path}</span>
              {modified && !diffView && <span className="ws-modified-dot" title="Unsaved changes">●</span>}
              {diffView ? (
                <>
                  <span className="ws-diff-label">reviewing proposed changes</span>
                  <button className="btn btn-primary btn-xs" onClick={applyDiff}>Apply all</button>
                  <button className="btn-ghost btn-xs" onClick={() => setDiffView(null)}>Reject</button>
                </>
              ) : (
                <button
                  className="btn-ghost btn-xs"
                  onClick={() => saveFile()}
                  disabled={!modified || saving}
                  title="Save file to VPS"
                >
                  <Save size={12} />
                  {saving ? ' Saving…' : ' Save'}
                </button>
              )}
              {saveMsg && (
                <span style={{ fontSize: 'var(--text-caption)', color: saveMsg.includes('✓') || saveMsg.includes('Cloned') ? 'var(--accent)' : 'var(--warn)', flexShrink: 0 }}>
                  {saveMsg}
                </span>
              )}
            </>
          ) : (
            <span className="ws-hint-inline">Select a file from the explorer</span>
          )}
        </div>

        {cloneNotice && (
          <div className="ws-clone-notice">
            <span>Repo not cloned at <code>{cloneNotice.repoRoot}</code></span>
            <button className="btn btn-primary btn-xs" onClick={cloneRepo} disabled={cloning || !connected}>
              {cloning ? 'Cloning…' : `Clone`}
            </button>
          </div>
        )}

        <div className="ws-monaco-wrap">
          {openFile ? (
            diffView ? (
              <DiffEditor
                height="100%"
                language={diffView.lang}
                original={editorContent}
                modified={diffView.proposed}
                theme={monacoTheme}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  renderSideBySide: true,
                }}
              />
            ) : (
              <Editor
                height="100%"
                language={getLang(openFile.name)}
                value={editorContent}
                theme={monacoTheme}
                onChange={val => { setEditorContent(val ?? ''); setModified(true); setSaveMsg(''); }}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  renderLineHighlight: 'line',
                  lineNumbers: 'on',
                  folding: true,
                  automaticLayout: true,
                }}
              />
            )
          ) : (
            <div className="ws-editor-empty">
              <p>Open a file from the VPS explorer to start editing.</p>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>
                Save writes back to the VPS via Python base64 decode (≤100KB).
              </p>
            </div>
          )}
        </div>

        {/* Git bar */}
        <div className="ws-git-bar">
          <GitCommit size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          {gitStatus ? (
            <span className="ws-git-status">{gitStatus.split('\n').length} changed</span>
          ) : (
            <span className="ws-git-clean">Clean</span>
          )}
          <input
            className="input ws-commit-input"
            placeholder="Commit message…"
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitAndPush(); }}
          />
          <button
            className="btn btn-primary btn-xs"
            onClick={openCommitModal}
            disabled={committing || !connected || !gitStatus}
            title="Review changes then commit + push"
          >
            {committing ? 'Pushing…' : 'Commit + Push'}
          </button>
          {gitMsg && (
            <span className="ws-git-msg" title={gitMsg}>
              {gitMsg.includes('error') || gitMsg.includes('fatal') ? '⚠' : '✓'}
            </span>
          )}
        </div>
      </div>

      {/* ── Right: Chat ────────────────────────────────────────────────────── */}
      <div className="ws-chat">
        <div className="ws-chat-header">Glitch Chat</div>

        <div className="ws-chat-messages">
          {chatMessages.map((m, i) => {
            if (m.role === 'system') return <div key={i} className="ws-chat-system">{m.text}</div>;
            if (m.role === 'glitch') {
              const code = extractCodeBlock(m.text);
              const canReview = code && openFile && !diffView;
              return (
                <div key={i} className="ws-chat-msg ws-msg-glitch">
                  <pre className="ws-msg-text">{m.text}</pre>
                  {canReview && (
                    <button
                      className="btn-ghost btn-xs ws-apply-btn"
                      onClick={() => setDiffView({ proposed: code, lang: getLang(openFile.name) })}
                      title="Compare with current file and optionally apply"
                    >
                      <GitMerge size={10} /> Review &amp; Apply
                    </button>
                  )}
                </div>
              );
            }
            return (
              <div key={i} className={`ws-chat-msg ws-msg-${m.role}`}>
                <pre className="ws-msg-text">{m.text}</pre>
              </div>
            );
          })}
          {chatSending && (
            <div className="ws-chat-msg ws-msg-glitch">
              <span className="ws-typing"><span /><span /><span /></span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Context chip */}
        {openFile && (
          <div className="ws-context-bar">
            <button
              className={`ws-context-chip ${contextAttached ? 'ws-context-chip-on' : ''}`}
              onClick={() => setContextAttached(v => !v)}
              title={contextAttached ? 'Detach file context from messages' : 'Attach file context to next message'}
            >
              <Paperclip size={10} />
              <span>{openFile.name}</span>
              {contextAttached && editorContent.length > 2000 && (
                <span className="ws-context-trunc">truncated to 2k</span>
              )}
              <span className="ws-context-toggle">{contextAttached ? '×' : '+'}</span>
            </button>
          </div>
        )}

        <div className="ws-chat-composer">
          <textarea
            ref={chatInputRef}
            className="input ws-chat-input"
            placeholder={connected ? (contextAttached ? `Message Glitch (${openFile?.name} attached)…` : 'Message Glitch…') : 'Connect first'}
            value={chatInput}
            rows={2}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg(); } }}
            disabled={!connected || chatSending}
          />
          <button
            className="btn btn-primary ws-chat-send"
            onClick={sendChatMsg}
            disabled={!connected || chatSending || !chatInput.trim()}
          >
            <span style={{ color: '#000', fontWeight: 900, fontSize: 18 }}>➤</span>
          </button>
        </div>
      </div>

      {/* ── Commit confirmation modal ──────────────────────────────────────── */}
      {commitModal && (
        <div className="ws-modal-overlay" onClick={() => setCommitModal(null)}>
          <div className="ws-modal" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-header">
              <span>Review changes before push</span>
              <button className="btn-ghost btn-xs" onClick={() => setCommitModal(null)}><X size={14} /></button>
            </div>
            <div className="ws-modal-body">
              <pre className="ws-modal-pre">{commitModal.diffStat}</pre>
              <p className="ws-modal-label">Commit message: <strong>{commitMsg || '(Update from Glitch UI)'}</strong></p>
              <p className="ws-modal-hint">This will run <code>git add -A &amp;&amp; git commit &amp;&amp; git push</code> in <code>{cwd}</code></p>
            </div>
            <div className="ws-modal-footer">
              <button className="btn-ghost" onClick={() => setCommitModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmCommitAndPush}>Confirm Push</button>
            </div>
          </div>
        </div>
      )}

      {/* ── File op modal ───────────────────────────────────────────────────── */}
      {fileModal && (
        <div className="ws-modal-overlay" onClick={() => setFileModal(null)}>
          <div className="ws-modal" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-header">
              <span>
                {fileModal.type === 'newfile'   && 'New file'}
                {fileModal.type === 'newfolder' && 'New folder'}
                {fileModal.type === 'rename'    && `Rename "${fileModal.item?.name}"`}
                {fileModal.type === 'delete'    && `Delete "${fileModal.item?.name}"`}
              </span>
              <button className="btn-ghost btn-xs" onClick={() => setFileModal(null)}><X size={14} /></button>
            </div>
            <div className="ws-modal-body">
              {fileModal.type === 'delete' ? (
                <p className="ws-modal-hint" style={{ color: 'var(--danger, var(--warn))' }}>
                  This will permanently delete <code>{fileModal.item?.path}</code> from the VPS. This cannot be undone.
                </p>
              ) : (
                <input
                  className="input"
                  style={{ width: '100%' }}
                  placeholder={fileModal.type === 'newfile' ? 'filename.txt' : fileModal.type === 'newfolder' ? 'folder-name' : 'new-name'}
                  value={fileModal.value}
                  autoFocus
                  onChange={e => setFileModal(v => ({ ...v, value: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') confirmFileOp(); if (e.key === 'Escape') setFileModal(null); }}
                />
              )}
            </div>
            <div className="ws-modal-footer">
              <button className="btn-ghost" onClick={() => setFileModal(null)}>Cancel</button>
              <button
                className={`btn ${fileModal.type === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                onClick={confirmFileOp}
                disabled={fileModal.type !== 'delete' && !fileModal.value.trim()}
              >
                {fileModal.type === 'delete' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

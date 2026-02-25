import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../core/store';
import {
  FolderOpen, FileText, ChevronRight, RefreshCw,
  ArrowLeft, ArrowRight, Globe, Lock, ExternalLink, GitBranch, Copy, Layers, GitPullRequest,
  Paperclip, X,
} from 'lucide-react';
import './GitHubPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function bashL(cmd) {
  const extract = 'T=$(tr "\\0" "\\n" < /proc/$(pgrep -f openclaw | head -1)/environ 2>/dev/null | grep -E "^(GH_TOKEN|GITHUB_TOKEN)=" | head -1 | cut -d= -f2-); [ -n "$T" ] && export GH_TOKEN="$T"';
  return `bash -l -c '${extract}; ${cmd} 2>&1'`;
}

function safe(s, re = /[^a-zA-Z0-9._\-]/g) { return String(s || '').replace(re, ''); }
function safePath(s) { return String(s || '').replace(/\.\./g, '').replace(/[^a-zA-Z0-9._\-/ ]/g, ''); }
function safeBranch(s) { return String(s || '').replace(/[^a-zA-Z0-9._\-/]/g, ''); }

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)}K`;
  return `${(b / 1048576).toFixed(1)}M`;
}

function timeAgo(d) {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function isBinary(buf) {
  const b = new Uint8Array(buf.slice(0, 512));
  return b.filter(x => x === 0).length > b.length * 0.1;
}

const RECENT_KEY   = 'glitch-ui:recent-repos';
const GH_STATE_KEY = 'glitch-ui:github-state';
const CSV_ROW_LIMIT = 500;

function parseCsv(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const row = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (ch === ',' && !q) { row.push(cur); cur = ''; }
      else cur += ch;
    }
    row.push(cur); rows.push(row);
  }
  return rows;
}

// ── RepoItem helper ───────────────────────────────────────────────────────────

function RepoItem({ repo, selected, onClick }) {
  return (
    <button
      className={`gh-repo-item ${selected?.name === repo.name ? 'active' : ''}`}
      onClick={() => onClick(repo)}
    >
      <div className="gh-repo-row">
        {repo.visibility === 'PRIVATE'
          ? <Lock size={10} className="gh-vis-icon" />
          : <Globe size={10} className="gh-vis-icon" />}
        <span className="gh-repo-name">{repo.name}</span>
        <span className="gh-repo-age">{timeAgo(repo.updatedAt)}</span>
      </div>
      {repo.description && (
        <div className="gh-repo-desc">{repo.description}</div>
      )}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GitHubPanel() {
  const {
    connected, runCmd, openInWorkspace, sendGhChat, ghDrawerMessages, clearGhDrawer, chatSending,
    githubState, setGithubState,
  } = useStore();
  const ASK_CONTENT_LIMIT = 1800;

  // ── Store-backed state (survives tab switches) ────────────────────────────
  const { owner, repos, reposLoading, selectedRepo, branch, branches, currentPath, items, itemsLoading, recentRepos } = githubState;
  const setOwner        = (v) => setGithubState({ owner: v });
  const setRepos        = (v) => setGithubState({ repos: v });
  const setReposLoading = (v) => setGithubState({ reposLoading: v });
  const setSelectedRepo = (v) => setGithubState({ selectedRepo: v });
  const setBranch       = (v) => setGithubState({ branch: v });
  const setBranches     = (v) => setGithubState({ branches: v });
  const setCurrentPath  = (v) => setGithubState({ currentPath: v });
  const setItems        = (v) => setGithubState({ items: v });
  const setItemsLoading = (v) => setGithubState({ itemsLoading: v });
  const setRecentRepos  = (v) => setGithubState({ recentRepos: v });

  // ── Local-only state (ephemeral, no cross-tab need) ───────────────────────
  const [ghError, setGhError] = useState('');
  const [repoFilter, setRepoFilter] = useState('');
  const [activeEntry, setActiveEntry] = useState(null);
  const [fileFilter, setFileFilter]   = useState('');

  // History
  const navHistory = useRef([]);
  const navIdx     = useRef(-1);
  const [canBack, setCanBack]       = useState(false);
  const [canForward, setCanForward] = useState(false);

  // Preview pane
  const [previewFile, setPreviewFile]     = useState(null);
  const [previewContent, setPreviewContent] = useState('');  // raw text
  const [previewType, setPreviewType]     = useState('text'); // 'text' | 'pdf' | 'csv'
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null); // PDF blob
  const [previewCsvRows, setPreviewCsvRows] = useState(null); // parsed CSV rows
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState('');
  const [needsClone, setNeedsClone] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Ask drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInput, setDrawerInput] = useState('');
  const [drawerContext, setDrawerContext] = useState('');
  const [drawerContextOn, setDrawerContextOn] = useState(true);
  const [drawerLabel, setDrawerLabel] = useState('');
  const drawerBottomRef = useRef(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!connected || owner) return; // skip if already resolved (survives tab switches)
    setGhError('');
    runCmd(bashL('gh api user -q .login')).then(r => {
      const u = r.stdout.trim().split('\n')[0];
      if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(u)) {
        setOwner(u);
      } else {
        setGhError('gh CLI not authenticated on VPS. Run `gh auth login` in Terminal, or set GH_TOKEN.');
        console.warn('[GH] auth failed:', r.stdout.slice(0, 120));
      }
    });
  }, [connected, owner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ask drawer ────────────────────────────────────────────────────────────
  useEffect(() => {
    drawerBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ghDrawerMessages]);

  const openDrawer = useCallback((contextText, label) => {
    setDrawerContext(contextText);
    setDrawerLabel(label);
    setDrawerContextOn(true);
    setDrawerInput('');
    clearGhDrawer();
    setDrawerOpen(true);
  }, [clearGhDrawer]);

  const sendDrawer = async () => {
    let text = drawerInput.trim();
    if (!text || chatSending || !connected) return;
    if (drawerContextOn && drawerContext) {
      const limit = 1800;
      const truncated = drawerContext.length > limit
        ? drawerContext.slice(0, limit) + `\n[TRUNCATED – ${drawerContext.length} chars total, showing first ${limit}]`
        : drawerContext;
      text = `${truncated}\n\n${text}`;
    }
    setDrawerInput('');
    await sendGhChat(text);
  };

  // ── Repos ─────────────────────────────────────────────────────────────────
  const loadRepos = useCallback(async () => {
    if (!connected) return;
    setReposLoading(true);
    const r = await runCmd(
      bashL('gh repo list -L 200 --json name,visibility,description,updatedAt,url,defaultBranchRef')
    );
    try {
      const data = JSON.parse(r.stdout.trim());
      if (Array.isArray(data))
        setRepos(data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    } catch (e) {
      console.error('[GH] repos parse:', e.message, r.stdout.slice(0, 80));
    }
    setReposLoading(false);
  }, [connected, runCmd]);

  // Only load if repos not already in store (skip on tab-switch remounts)
  useEffect(() => { if (connected && owner && !repos.length) loadRepos(); }, [owner, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore last GitHub state after repos load
  useEffect(() => {
    if (!repos.length || !owner || selectedRepo) return;
    try {
      const saved = JSON.parse(localStorage.getItem(GH_STATE_KEY) || 'null');
      if (!saved?.repoName) return;
      const repo = repos.find(r => r.name === saved.repoName);
      if (!repo) return;
      fetchDir(repo, saved.branch || 'main', saved.path || '', false);
    } catch (_) {}
  }, [repos.length, owner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation helpers ───────────────────────────────────────────────────
  const syncNavButtons = () => {
    setCanBack(navIdx.current > 0);
    setCanForward(navIdx.current < navHistory.current.length - 1);
  };

  const pushNav = (entry) => {
    navHistory.current = [...navHistory.current.slice(0, navIdx.current + 1), entry];
    navIdx.current = navHistory.current.length - 1;
    syncNavButtons();
  };

  const resetNav = () => {
    navHistory.current = [];
    navIdx.current = -1;
    syncNavButtons();
  };

  // ── Fetch directory ───────────────────────────────────────────────────────
  const fetchDir = useCallback(async (repo, repoBranch, path, push = true) => {
    if (!connected || !repo || !owner) return;
    const rn = safe(repo.name);
    const rb = safeBranch(repoBranch);
    const rp = safePath(path);
    const seg = rp ? `/${rp}` : '';

    setItemsLoading(true);
    setItems([]);
    setActiveEntry(null);
    setPreviewFile(null);
    setPreviewContent('');
    setFileFilter('');

    const r = await runCmd(bashL(`gh api "repos/${owner}/${rn}/contents${seg}?ref=${rb}"`));
    try {
      const data = JSON.parse(r.stdout.trim());
      if (Array.isArray(data)) {
        setItems(
          [...data].sort((a, b) =>
            a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)
          )
        );
        setSelectedRepo(repo);
        setBranch(rb);
        setCurrentPath(rp);
        try { localStorage.setItem(GH_STATE_KEY, JSON.stringify({ repoName: rn, branch: rb, path: rp })); } catch(_) {}
        if (push) pushNav({ repoName: rn, branch: rb, path: rp });
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('[GH] fetchDir:', e.message, r.stdout.slice(0, 120));
    }
    setItemsLoading(false);
  }, [connected, owner, runCmd]);

  // ── Select repo ────────────────────────────────────────────────────────────
  const selectRepo = useCallback(async (repo) => {
    if (!connected || !owner) return;
    const rn = safe(repo.name);

    setBranches([]);
    const r = await runCmd(bashL(`gh api "repos/${owner}/${rn}/branches" --jq '[.[].name]'`));
    let branchList = [repo.defaultBranchRef?.name || 'main'];
    try { branchList = JSON.parse(r.stdout.trim()); } catch (_) {}
    setBranches(branchList);

    const defaultBranch = repo.defaultBranchRef?.name || branchList[0] || 'main';
    resetNav();

    // Track recent repos
    const updated = [repo.name, ...recentRepos.filter(n => n !== repo.name)].slice(0, 5);
    setRecentRepos(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));

    await fetchDir(repo, defaultBranch, '', true);
  }, [connected, owner, runCmd, fetchDir, recentRepos]);

  // ── Pull repo ───────────────────────────────────────────────────────────────
  const pullRepo = async () => {
    if (!selectedRepo || !connected) return;
    setPulling(true);
    setPullMsg('');
    setNeedsClone(false);
    const repoPath = `/root/repos/${safe(owner)}/${safe(selectedRepo.name)}`;
    const r = await runCmd(bashL(`git -C "${repoPath}" pull`));
    const out = (r.stdout + (r.stderr ? '\n' + r.stderr : '')).trim();
    const notFound = out.includes('fatal') || out.includes('cannot change to')
      || out.includes('not a git repo') || out.includes('No such file');
    if (notFound) {
      setNeedsClone(true);
    } else {
      const isErr = out.includes('error:') || out.includes('Error:');
      setPullMsg(isErr ? `⚠ ${out.slice(0, 120)}` : (out.slice(-120) || 'Up to date'));
      setTimeout(() => setPullMsg(''), 5000);
    }
    setPulling(false);
  };

  const cloneRepoToVps = async () => {
    if (!selectedRepo || !connected) return;
    setCloning(true);
    setNeedsClone(false);
    const repoPath = `/root/repos/${safe(owner)}/${safe(selectedRepo.name)}`;
    const r = await runCmd(bashL(
      `mkdir -p "/root/repos/${safe(owner)}" && gh repo clone "${safe(owner)}/${safe(selectedRepo.name)}" "${repoPath}"`
    ));
    const out = (r.stdout + (r.stderr ? '\n' + r.stderr : '')).trim();
    const ok = r.code === 0 && !out.includes('error') && !out.includes('fatal');
    setCloning(false);
    if (ok) {
      setPullMsg('Cloned ✓');
    } else {
      setPullMsg(`⚠ ${out.slice(0, 140)}`);
      setNeedsClone(true);
    }
    setTimeout(() => setPullMsg(''), 6000);
  };

  // ── Open file ──────────────────────────────────────────────────────────────
  const openFile = useCallback(async (item) => {
    if (!connected || !selectedRepo || !owner) return;
    setActiveEntry(item.path);
    setPreviewFile(item);
    setPreviewContent('');
    setPreviewType('text');
    setPreviewCsvRows(null);
    // Revoke previous blob URL
    setPreviewBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPreviewLoading(true);

    const rn = safe(selectedRepo.name);
    const rb = safeBranch(branch);
    const rp = safePath(item.path);
    const ext = item.name.split('.').pop().toLowerCase();

    const r = await runCmd(bashL(`gh api "repos/${owner}/${rn}/contents/${rp}?ref=${rb}"`));
    try {
      const data = JSON.parse(r.stdout.trim());
      if (data.encoding === 'base64' && data.content) {
        const b64 = data.content.replace(/\n/g, '');

        if (ext === 'pdf') {
          // PDF: decode → Blob → object URL → iframe
          const binStr = atob(b64);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          setPreviewBlobUrl(URL.createObjectURL(blob));
          setPreviewType('pdf');
          setPreviewContent('');
        } else if (ext === 'csv') {
          const raw = atob(b64);
          const rows = parseCsv(raw);
          setPreviewCsvRows(rows.slice(0, CSV_ROW_LIMIT + 1));
          setPreviewType('csv');
          setPreviewContent(raw); // keep raw for copy/ask
        } else {
          const raw = atob(b64);
          const bytes = raw.split('').map(c => c.charCodeAt(0));
          if (isBinary(bytes)) {
            setPreviewContent('(binary file — cannot display)');
          } else {
            setPreviewContent(raw);
          }
          setPreviewType('text');
        }
      } else if (data.download_url) {
        setPreviewContent(`File too large to inline.\n\nDownload URL:\n${data.download_url}`);
      } else {
        setPreviewContent('(no content available)');
      }
    } catch (e) {
      setPreviewContent(`Error: ${e.message}\n${r.stdout.slice(0, 300)}`);
    }
    setPreviewLoading(false);
  }, [connected, owner, runCmd, selectedRepo, branch]);

  // ── Back / Forward ─────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (navIdx.current <= 0) return;
    navIdx.current--;
    syncNavButtons();
    const entry = navHistory.current[navIdx.current];
    const repo = repos.find(r => r.name === entry.repoName) || selectedRepo;
    setBranch(entry.branch);
    fetchDir(repo, entry.branch, entry.path, false);
  }, [repos, selectedRepo, fetchDir]);

  const goForward = useCallback(() => {
    if (navIdx.current >= navHistory.current.length - 1) return;
    navIdx.current++;
    syncNavButtons();
    const entry = navHistory.current[navIdx.current];
    const repo = repos.find(r => r.name === entry.repoName) || selectedRepo;
    setBranch(entry.branch);
    fetchDir(repo, entry.branch, entry.path, false);
  }, [repos, selectedRepo, fetchDir]);

  // ── Breadcrumbs ────────────────────────────────────────────────────────────
  const breadcrumbs = (() => {
    if (!selectedRepo) return [];
    const crumbs = [{ label: selectedRepo.name, path: '' }];
    if (currentPath) {
      let acc = '';
      currentPath.split('/').forEach(seg => {
        acc = acc ? `${acc}/${seg}` : seg;
        crumbs.push({ label: seg, path: acc });
      });
    }
    return crumbs;
  })();

  const filteredRepos = repos.filter(r =>
    !repoFilter ||
    r.name.toLowerCase().includes(repoFilter.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(repoFilter.toLowerCase())
  );

  const filteredItems = items.filter(i =>
    !fileFilter || i.name.toLowerCase().includes(fileFilter.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="github-panel panel-wrap">

      {ghError && (
        <div className="gh-auth-banner">
          <span>⚠ {ghError}</span>
          <span className="gh-auth-hint">Use the Terminal tab → run <code>gh auth login</code> or <code>export GH_TOKEN=&lt;token&gt;</code></span>
        </div>
      )}

      {/* Toolbar */}
      <div className="gh-toolbar">
        <button className="icon-btn" onClick={goBack} disabled={!canBack} title="Back" aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <button className="icon-btn" onClick={goForward} disabled={!canForward} title="Forward" aria-label="Forward">
          <ArrowRight size={16} />
        </button>

        {owner && (
          <span className="gh-owner-chip">
            <GitBranch size={11} />
            <span>{owner}</span>
          </span>
        )}

        {selectedRepo && branches.length > 0 && (
          <div className="gh-branch-wrap">
            <GitBranch size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <select
              className="input gh-branch-select"
              value={branch}
              onChange={e => { setBranch(e.target.value); fetchDir(selectedRepo, e.target.value, '', true); }}
            >
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {selectedRepo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginLeft: 'var(--sp-2)' }}>
            <button
              className="btn-ghost btn-xs"
              onClick={pullRepo}
              disabled={pulling || cloning || !connected}
              title={`git pull /root/repos/${owner}/${selectedRepo.name}`}
            >
              <GitPullRequest size={12} /> {pulling ? 'Pulling…' : 'Pull'}
            </button>
            {needsClone && (
              <button
                className="btn-ghost btn-xs"
                style={{ color: 'var(--accent)' }}
                onClick={cloneRepoToVps}
                disabled={cloning || !connected}
                title={`Clone to /root/repos/${owner}/${selectedRepo.name}`}
              >
                {cloning ? 'Cloning…' : '⚡ Clone to VPS'}
              </button>
            )}
            {pullMsg && (
              <span style={{ fontSize: 'var(--text-caption)', color: pullMsg.includes('error') || pullMsg.includes('fatal') ? 'var(--warn)' : 'var(--accent)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pullMsg}
              </span>
            )}
          </div>
        )}
        <button
          className="icon-btn"
          onClick={loadRepos}
          disabled={reposLoading || !connected}
          style={{ marginLeft: 'auto' }}
          title="Refresh repo list"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={reposLoading ? 'gh-spin' : ''} />
        </button>
      </div>

      {/* Three panes + Ask drawer — drawer is relative to this wrapper, NOT the toolbar */}
      <div className="gh-panes-wrap">
      <div className="gh-panes">

        {/* Pane 1 — Repos */}
        <div className="gh-pane gh-pane-repos">
          <div className="gh-pane-header">
            <input
              className="input gh-filter"
              placeholder="Filter repos…"
              value={repoFilter}
              onChange={e => setRepoFilter(e.target.value)}
            />
          </div>
          <div className="gh-list">
            {reposLoading && <div className="gh-hint">Loading repos…</div>}
            {!reposLoading && filteredRepos.length === 0 && (
              <div className="gh-hint">
                {repos.length === 0
                  ? (connected ? 'No repos found. Refresh?' : 'Connect first.')
                  : 'No match.'}
              </div>
            )}
            {/* Recent section (only when not filtering) */}
            {!repoFilter && recentRepos.length > 0 && (
              <>
                <div className="gh-recent-header">Recent</div>
                {recentRepos.map(name => {
                  const repo = repos.find(r => r.name === name);
                  if (!repo) return null;
                  return <RepoItem key={'r:' + name} repo={repo} selected={selectedRepo} onClick={selectRepo} />;
                })}
                {filteredRepos.length > 0 && <div className="gh-recent-header">All repos</div>}
              </>
            )}
            {filteredRepos.map(repo => (
              <RepoItem key={repo.name} repo={repo} selected={selectedRepo} onClick={selectRepo} />
            ))}
          </div>
        </div>

        {/* Pane 2 — Directory */}
        <div className="gh-pane gh-pane-dir">
          {!selectedRepo ? (
            <div className="gh-pane-empty">Select a repo to browse</div>
          ) : (
            <>
              <div className="gh-pane-header" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <div className="gh-breadcrumbs" style={{ flex: 1 }}>
                    {breadcrumbs.map((bc, i) => (
                      <span key={bc.path} className="gh-bc">
                        {i > 0 && <ChevronRight size={10} className="gh-bc-sep" />}
                        <span
                          className={`gh-bc-label ${i < breadcrumbs.length - 1 ? 'gh-bc-link' : ''}`}
                          onClick={() => i < breadcrumbs.length - 1 && fetchDir(selectedRepo, branch, bc.path, true)}
                        >
                          {bc.label}
                        </span>
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn-ghost btn-xs"
                    style={{ color: 'var(--accent)', flexShrink: 0 }}
                    onClick={() => {
                      const vpsPath = `/root/repos/${owner}/${safe(selectedRepo?.name)}${currentPath ? '/' + safePath(currentPath) : ''}`;
                      openInWorkspace(vpsPath, null, null, owner, selectedRepo?.name);
                    }}
                    title={`Open this folder in Workspaces at /root/repos/${owner}/${selectedRepo?.name}`}
                  >
                    <Layers size={11} />
                  </button>
                  <button
                    className="btn-ghost btn-xs"
                    style={{ color: 'var(--accent)', flexShrink: 0 }}
                    onClick={() => {
                      const listing = items.map(i => `${i.type === 'dir' ? '📁' : '📄'} ${i.name}`).join('\n');
                      openDrawer(
                        `Repo: ${owner}/${selectedRepo?.name} @ ${branch}\nPath: /${currentPath || ''}\n\nDirectory listing:\n${listing}`,
                        currentPath || selectedRepo?.name
                      );
                    }}
                    disabled={!items.length}
                    title="Ask Glitch about this directory"
                  >
                    ⚡ Ask
                  </button>
                </div>
                {items.length > 0 && (
                  <input
                    className="input gh-filter gh-dir-filter"
                    placeholder="Filter files…"
                    value={fileFilter}
                    onChange={e => setFileFilter(e.target.value)}
                  />
                )}
              </div>
              <div className="gh-list">
                {itemsLoading && <div className="gh-hint">Loading…</div>}
                {!itemsLoading && filteredItems.length === 0 && items.length > 0 && (
                  <div className="gh-hint">No match.</div>
                )}
                {!itemsLoading && items.length === 0 && (
                  <div className="gh-hint">Empty.</div>
                )}
                {filteredItems.map(item => (
                  <button
                    key={item.sha + item.name}
                    className={`gh-entry ${activeEntry === item.path ? 'active' : ''}`}
                    onClick={() =>
                      item.type === 'dir'
                        ? fetchDir(selectedRepo, branch, item.path, true)
                        : openFile(item)
                    }
                  >
                    <span className="gh-entry-icon">
                      {item.type === 'dir'
                        ? <FolderOpen size={13} />
                        : <FileText size={13} />}
                    </span>
                    <span className="gh-entry-name">{item.name}</span>
                    {item.type === 'file' && (
                      <span className="gh-entry-size">{fmtSize(item.size)}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pane 3 — Preview */}
        <div className="gh-pane gh-pane-preview">
          {!previewFile ? (
            <div className="gh-pane-empty">Select a file to preview</div>
          ) : (
            <>
              <div className="gh-pane-header gh-preview-header">
                <span className="gh-preview-name">{previewFile.name}</span>
                {previewFile.size > 0 && (
                  <span className="gh-preview-size">{fmtSize(previewFile.size)}</span>
                )}
                <button
                  className="btn-ghost btn-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(previewContent);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  disabled={!previewContent || previewLoading}
                  title="Copy file contents"
                >
                  {copied ? '✓' : <Copy size={11} />}
                </button>
                <button
                  className="btn-ghost btn-xs"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => {
                    let body;
                    if (!previewContent || previewContent.startsWith('(binary')) {
                      body = '[binary file – cannot display contents]';
                    } else if (previewContent.length > ASK_CONTENT_LIMIT) {
                      body = `File: ${previewFile?.path}\n\`\`\`\n${previewContent.slice(0, ASK_CONTENT_LIMIT)}\n\`\`\`\n[TRUNCATED – ${previewContent.length} chars, showing first ${ASK_CONTENT_LIMIT}]`;
                    } else {
                      body = `File: ${previewFile?.path}\n\`\`\`\n${previewContent}\n\`\`\``;
                    }
                    openDrawer(
                      `Repo: ${owner}/${selectedRepo?.name} @ ${branch}\n${body}`,
                      previewFile?.name
                    );
                  }}
                  disabled={!previewFile || previewLoading}
                  title="Ask Glitch about this file"
                >
                  ⚡ Ask
                </button>
                <button
                  className="btn-ghost btn-xs"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => {
                    const vpsPath = `/root/repos/${owner}/${safe(selectedRepo?.name)}/${safePath(previewFile.path)}`;
                    openInWorkspace(vpsPath, previewFile.name, previewContent, owner, selectedRepo?.name);
                  }}
                  disabled={!previewFile || previewLoading || previewType === 'pdf' || previewContent.startsWith('(binary')}
                  title={`Open in Workspaces at /root/repos/${owner}/${selectedRepo?.name}`}
                >
                  <Layers size={11} /> Open in Workspace
                </button>
                {previewFile.html_url && (
                  <a
                    className="btn-ghost btn-xs"
                    href={previewFile.html_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open on GitHub"
                  >
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="gh-preview-body">
                {previewLoading ? (
                  <div className="gh-hint">Loading…</div>
                ) : previewType === 'pdf' && previewBlobUrl ? (
                  <iframe
                    src={previewBlobUrl}
                    className="gh-pdf-frame"
                    title={previewFile.name}
                  />
                ) : previewType === 'csv' && previewCsvRows ? (
                  <div className="gh-csv-wrap">
                    <table className="gh-csv-table">
                      <thead>
                        <tr>{previewCsvRows[0]?.map((h, i) => <th key={i}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {previewCsvRows.slice(1, CSV_ROW_LIMIT + 1).map((row, ri) => (
                          <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                    {previewCsvRows.length > CSV_ROW_LIMIT && (
                      <div className="gh-hint">Showing first {CSV_ROW_LIMIT} rows. Open in Workspace for full file.</div>
                    )}
                  </div>
                ) : (
                  <pre className="gh-code">{previewContent}</pre>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* ── Ask Glitch drawer (inside panes-wrap → doesn't overlay toolbar) ── */}
      {drawerOpen && (
        <div className="gh-ask-drawer">
          <div className="gh-drawer-header">
            <span className="gh-drawer-title">⚡ Ask about {drawerLabel}</span>
            <button
              className={`ws-context-chip ${drawerContextOn ? 'ws-context-chip-on' : ''}`}
              onClick={() => setDrawerContextOn(v => !v)}
              title={drawerContextOn ? 'Remove context from next message' : 'Attach context to next message'}
            >
              <Paperclip size={10} />
              <span>{drawerContextOn ? 'Context on' : 'Context off'}</span>
            </button>
            <button className="btn-ghost btn-xs" aria-label="Close" onClick={() => setDrawerOpen(false)} style={{ marginLeft: 'auto' }}>
              <X size={14} />
            </button>
          </div>

          <div className="gh-drawer-messages">
            {ghDrawerMessages.map((m, i) => {
              if (m.role === 'system') return <div key={i} className="ws-chat-system">{m.text}</div>;
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
            <div ref={drawerBottomRef} />
          </div>

          <div className="gh-drawer-composer">
            <textarea
              className="input gh-drawer-input"
              placeholder={connected ? `Ask about ${drawerLabel}…` : 'Connect first'}
              value={drawerInput}
              rows={2}
              onChange={e => setDrawerInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDrawer(); } }}
              disabled={!connected || chatSending}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <button
              className="btn btn-primary gh-drawer-send"
              onClick={sendDrawer}
              disabled={!connected || chatSending || !drawerInput.trim()}
            >
              <span style={{ color: '#000', fontWeight: 900, fontSize: 18 }}>➤</span>
            </button>
          </div>
        </div>
      )}
      </div>{/* gh-panes-wrap */}
    </div>
  );
}

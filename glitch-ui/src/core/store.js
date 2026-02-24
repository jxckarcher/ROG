import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

const VPS = { host: '46.225.76.215', user: 'root', tunnelPort: 18789 };
const GW_TOKEN = '8c412e4a642792b714243476219e4ed2e59fdb1b3978847d';

export const useStore = create((set, get) => ({
  // ── Connection ─────────────────────────────
  vps: VPS,
  connected: false,
  tunnelActive: false,
  connecting: false,
  connectionError: null,

  connect: async () => {
    set({ connecting: true, connectionError: null });
    try {
      const res = await invoke('ssh_run', {
        host: VPS.host, user: VPS.user,
        cmd: 'echo SSH_OK && systemctl --user is-active openclaw-gateway.service 2>/dev/null || true'
      });
      if (res.stdout.includes('SSH_OK')) {
        set({ connected: true, connecting: false, connectionError: null });
      } else {
        set({ connected: false, connecting: false, connectionError: res.stderr || 'SSH failed — are keys set up?' });
      }
    } catch (e) {
      set({ connected: false, connecting: false, connectionError: String(e) });
    }
  },

  startTunnel: async () => {
    try {
      await invoke('start_tunnel', {
        host: VPS.host, user: VPS.user,
        localPort: VPS.tunnelPort, remotePort: VPS.tunnelPort
      });
      set({ tunnelActive: true });
      setTimeout(() => get().connectWs(), 1500);
    } catch (e) { console.error('Tunnel:', e); }
  },

  stopTunnel: async () => {
    get().disconnectWs();
    try { await invoke('stop_tunnel', { localPort: VPS.tunnelPort }); } catch(_) {}
    set({ tunnelActive: false });
  },

  disconnect: () => {
    get().disconnectWs();
    set({ connected: false, tunnelActive: false });
  },

  // ── SSH runner ─────────────────────────────
  runCmd: async (cmd) => {
    return invoke('ssh_run', { host: VPS.host, user: VPS.user, cmd });
  },

  // ── WebSocket (live chat via tunnel) ───────
  ws: null,
  wsConnected: false,

  connectWs: () => {
    const old = get().ws;
    if (old) { try { old.close(); } catch(_) {} }
    try {
      const ws = new WebSocket(`ws://localhost:${VPS.tunnelPort}/?token=${GW_TOKEN}`);
      ws.onopen = () => {
        set({ wsConnected: true });
        ws.send(JSON.stringify({ type: 'subscribe', session: 'agent:main:main' }));
      };
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          const text = d.content || d.message || d.text || d.delta;
          if (text) get()._push({ role: 'glitch', text, ts: Date.now() });
        } catch(_) {
          if (ev.data) get()._push({ role: 'glitch', text: ev.data, ts: Date.now() });
        }
      };
      ws.onclose = () => set({ wsConnected: false, ws: null });
      ws.onerror = () => set({ wsConnected: false });
      set({ ws });
    } catch (e) { console.error('WS:', e); }
  },

  disconnectWs: () => {
    const { ws } = get();
    if (ws) { try { ws.close(); } catch(_) {} }
    set({ ws: null, wsConnected: false });
  },

  sendWs: (text) => {
    const { ws, wsConnected } = get();
    if (!ws || !wsConnected) return false;
    try {
      ws.send(JSON.stringify({ type: 'message', session: 'agent:main:main', content: text, channel: 'cli' }));
      return true;
    } catch(_) { return false; }
  },

  // ── Chat ───────────────────────────────────
  chatMessages: [{ role: 'system', text: 'Connect to start chatting with Glitch.', ts: Date.now() }],
  chatSending: false,

  _push: (msg) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),

  sendChat: async (text) => {
    const { wsConnected, sendWs, runCmd, _push } = get();
    _push({ role: 'user', text, ts: Date.now() });
    set({ chatSending: true });

    let sent = false;
    if (wsConnected) {
      sent = sendWs(text);
    }
    // Fallback: SSH CLI send (no live response, shows confirmation)
    if (!sent) {
      const escaped = text.replace(/"/g, '\\"');
      const res = await runCmd(`openclaw message send --channel cli --message "${escaped}" 2>&1`);
      _push({ role: 'glitch', text: res.stdout.trim() || '(sent via CLI fallback)', ts: Date.now() });
    }
    set({ chatSending: false });
  },

  clearChat: () => set({ chatMessages: [{ role: 'system', text: 'Chat cleared.', ts: Date.now() }] }),

  // ── Navigation ─────────────────────────────
  activeModule: 'chat',
  setActiveModule: (m) => set({ activeModule: m }),

  // ── Theme ──────────────────────────────────
  theme: 'cyberpunk',
  setTheme: (t) => {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },

  // ── Cron ───────────────────────────────────
  cronJobs: [],
  cronLoading: false,
  loadCronJobs: async () => {
    set({ cronLoading: true });
    const res = await get().runCmd('openclaw cron list 2>&1');
    set({ cronJobs: parseCronList(res.stdout), cronLoading: false });
  },

  // ── Overnight ──────────────────────────────
  overnightMode: false,
  toggleOvernightMode: () => set(s => ({ overnightMode: !s.overnightMode })),

  // ── Memory ─────────────────────────────────
  memorySnapshot: '',
  memoryLoading: false,
  loadMemory: async () => {
    set({ memoryLoading: true });
    const res = await get().runCmd('cat /root/.openclaw/workspace/MEMORY.md 2>/dev/null || echo "(no memory file)"');
    set({ memorySnapshot: res.stdout, memoryLoading: false });
  },
  searchMemory: async (q) => {
    const res = await get().runCmd(`memsearch "${q.replace(/"/g, '\\"')}" 2>&1`);
    return res.stdout;
  },
  appendMemory: async (entry) => {
    await get().runCmd(`glitchlog "${entry.replace(/"/g, '\\"').replace(/`/g, '\\`')}"`);
  },
}));

function parseCronList(raw) {
  return raw.split('\n')
    .filter(l => l.trim() && !l.startsWith('ID') && !l.match(/^[-─\s]+$/))
    .map(line => {
      const cols = line.trim().split(/\s{2,}/);
      if (cols.length < 6 || cols[0].length < 10) return null;
      return {
        id: cols[0], name: cols[1], schedule: cols[2],
        next: cols[3], last: cols[4], status: cols[5], agent: cols[6] || '',
      };
    })
    .filter(Boolean);
}

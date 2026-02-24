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
      // Use 127.0.0.1 to avoid IPv6 ::1 routing issues
      const ws = new WebSocket(`ws://127.0.0.1:${VPS.tunnelPort}`);

      ws.onopen = () => {
        console.log('[WS] onopen fired — waiting for connect.challenge');
      };

      ws.onmessage = (ev) => {
        console.log('[WS] message received:', ev.data.slice(0, 200));
        try {
          const msg = JSON.parse(ev.data);

          // Step 1: server sends challenge → respond with connect handshake
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            ws.send(JSON.stringify({
              type: 'req',
              id: crypto.randomUUID(),
              method: 'connect',
              params: {
                minProtocol: 3, maxProtocol: 3,
                client: { id: 'glitch-ui', version: '0.2', platform: 'windows', mode: 'operator' },
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                caps: [], commands: [], permissions: {},
                auth: { token: GW_TOKEN },
                locale: 'en-GB',
                userAgent: 'glitch-ui/0.2'
              }
            }));
            return;
          }

          // Step 2: hello-ok → handshake complete, WS ready
          if (msg.type === 'res' && msg.ok && msg.payload?.type === 'hello-ok') {
            set({ wsConnected: true });
            return;
          }

          // Step 3: incoming agent content (after connected)
          if (!get().wsConnected) return;
          const text = msg.content || msg.message || msg.text || msg.delta
                    || msg.payload?.content || msg.payload?.message || msg.payload?.text;
          if (text) get()._push({ role: 'glitch', text, ts: Date.now() });

        } catch(_) {
          if (ev.data) get()._push({ role: 'glitch', text: ev.data, ts: Date.now() });
        }
      };

      ws.onclose = (e) => { console.log('[WS] closed — code:', e.code, 'reason:', e.reason); set({ wsConnected: false, ws: null }); };
      ws.onerror = (e) => { console.error('[WS] error:', e); set({ wsConnected: false }); };
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
      ws.send(JSON.stringify({
        type: 'req',
        id: crypto.randomUUID(),
        method: 'agent.message',
        params: { content: text, session: 'main' }
      }));
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

    // Try live WebSocket first
    if (wsConnected && sendWs(text)) {
      set({ chatSending: false });
      return;
    }

    // Fallback: SSH agent run — returns response directly to stdout
    const escaped = text.replace(/"/g, '\\"');
    const res = await runCmd(`openclaw agent --agent main --message "${escaped}" --json 2>&1`);
    const raw = res.stdout.trim() || res.stderr.trim();

    // Parse openclaw agent --json response: result.payloads[].text
    let reply = raw;
    try {
      const parsed = JSON.parse(raw);
      reply = parsed.result?.payloads?.map(p => p.text).filter(Boolean).join('\n')
           || parsed.response || parsed.content || parsed.message || parsed.output
           || raw;
    } catch(_) {}

    _push({ role: 'glitch', text: reply || '(no response)', ts: Date.now() });
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

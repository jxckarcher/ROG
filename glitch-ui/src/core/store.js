import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

const VPS = { host: '46.225.76.215', user: 'root', tunnelPort: 18789 };
const GW_TOKEN = '8c412e4a642792b714243476219e4ed2e59fdb1b3978847d';

// ── PIN hash helper ───────────────────────────────────────────────────────────

async function _hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('glitch:' + pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Theme helpers ─────────────────────────────────────────────────────────────

export function applyThemeMode(mode) {
  if (mode === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-mode', isDark ? 'night' : 'day');
  } else {
    document.documentElement.setAttribute('data-mode', mode);
  }
}

export function applyAccent(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const el = document.documentElement;
  el.style.setProperty('--accent',      hex);
  el.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
  el.style.setProperty('--accent-text', hex);
  el.style.setProperty('--glow-accent', `0 0 0 2px rgba(${r},${g},${b},0.35)`);
}

export function applyThemeShape(shape) {
  const SHAPES = {
    rounded: { sm: '10px', md: '14px', lg: '20px', xl: '28px' },
    sharp:   { sm: '3px',  md: '5px',  lg: '7px',  xl: '9px'  },
    pill:    { sm: '20px', md: '24px', lg: '32px', xl: '40px' },
  };
  const r = SHAPES[shape] || SHAPES.rounded;
  const el = document.documentElement;
  el.style.setProperty('--r-sm', r.sm);
  el.style.setProperty('--r-md', r.md);
  el.style.setProperty('--r-lg', r.lg);
  el.style.setProperty('--r-xl', r.xl);
}

// ── Crypto helpers ───────────────────────────────────────────────────────────

function toBase64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getDeviceKeys() {
  const STORE_KEY = 'glitch-ui:device-keys';
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) {
      const { pub, priv } = JSON.parse(stored);
      const publicKey  = await crypto.subtle.importKey('jwk', pub,  { name: 'Ed25519' }, true,  ['verify']);
      const privateKey = await crypto.subtle.importKey('jwk', priv, { name: 'Ed25519' }, false, ['sign']);
      return { publicKey, privateKey };
    }
  } catch (_) {}
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub  = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const priv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  localStorage.setItem(STORE_KEY, JSON.stringify({ pub, priv }));
  return keyPair;
}

// ── Store ────────────────────────────────────────────────────────────────────

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
        // Preserve existing chat history, append SSH connected event (drop placeholder)
        const existing = get().chatMessages.filter(m =>
          !(m.role === 'system' && m.text === 'Connect to start chatting with Glitch.')
        );
        set({
          connected: true, connecting: false, connectionError: null,
          chatMessages: [...existing, { role: 'system', text: 'SSH connected.', ts: Date.now() }],
        });
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
  _activeRuns: {},     // { [runId]: { segIdx, lastTextLen, isDrawer } }

  connectWs: async () => {
    const old = get().ws;
    if (old) { try { old.close(); } catch(_) {} }
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${VPS.tunnelPort}`);

      ws.onopen = () => {
        console.log('[WS] onopen — waiting for connect.challenge');
      };

      ws.onmessage = async (ev) => {
        console.log('[WS] message:', ev.data.slice(0, 300));
        try {
          const msg = JSON.parse(ev.data);

          // Step 1: server sends challenge → sign with Ed25519 device key
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            const nonce = msg.payload?.nonce;
            try {
              const { publicKey, privateKey } = await getDeviceKeys();
              const pubRaw = await crypto.subtle.exportKey('raw', publicKey);
              const idHashBuf = await crypto.subtle.digest('SHA-256', pubRaw);
              const deviceId = Array.from(new Uint8Array(idHashBuf))
                .map(b => b.toString(16).padStart(2, '0')).join('');
              const signedAt = Date.now();

              // Payload format from buildDeviceAuthPayload() upstream source:
              // v2|deviceId|clientId|clientMode|role|scopesCsv|signedAtMs|token|nonce
              const scopes = ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals', 'operator.pairing'];
              const authPayload = [
                'v2',
                deviceId,
                'openclaw-control-ui',
                'webchat',
                'operator',
                scopes.join(','),
                String(signedAt),
                GW_TOKEN,
                nonce,
              ].join('|');

              const payloadBytes = new TextEncoder().encode(authPayload);
              const sigRaw = await crypto.subtle.sign(
                { name: 'Ed25519' },
                privateKey,
                payloadBytes
              );
              // Self-verify before sending — fail fast if something is wrong locally
              const selfOk = await crypto.subtle.verify(
                { name: 'Ed25519' }, publicKey, sigRaw, payloadBytes
              );
              if (!selfOk) {
                console.error('[WS] SIGNATURE SELF-TEST FAILED — not sending connect');
                return;
              }
              console.log('[WS] self-test OK — payload:', authPayload.replace(GW_TOKEN, '<TOKEN>'));
              console.log('[WS] device.id:', deviceId, '| sig length:', sigRaw.byteLength);
              ws.send(JSON.stringify({
                type: 'req',
                id: crypto.randomUUID(),
                method: 'connect',
                params: {
                  minProtocol: 3, maxProtocol: 3,
                  client: {
                    id: 'openclaw-control-ui',
                    version: '0.2',
                    platform: 'Win32',
                    mode: 'webchat',
                    instanceId: crypto.randomUUID()
                  },
                  role: 'operator',
                  scopes,
                  device: {
                    id: deviceId,
                    publicKey: toBase64url(pubRaw),
                    signature: toBase64url(sigRaw),
                    signedAt,
                    nonce
                  },
                  caps: [],
                  auth: { token: GW_TOKEN },
                  locale: 'en-GB',
                  userAgent: 'glitch-ui/0.2'
                }
              }));
            } catch (cryptoErr) {
              console.error('[WS] crypto error during connect:', cryptoErr);
            }
            return;
          }

          // Step 2: hello-ok → handshake complete, persist device token
          if (msg.type === 'res' && msg.ok && msg.payload?.type === 'hello-ok') {
            const devToken = msg.payload?.auth?.deviceToken;
            if (devToken) localStorage.setItem('glitch-ui:device-token', devToken);
            console.log('[WS] hello-ok — live mode active');
            get()._push({ role: 'system', text: '⚡ Live mode active — direct WebSocket connection established.', ts: Date.now() });
            set({ wsConnected: true });
            return;
          }

          // Step 3: incoming chat/agent content
          if (!get().wsConnected) return;

          // Show req errors in chat
          if (msg.type === 'res' && !msg.ok) {
            const errMsg = msg.error?.message || JSON.stringify(msg.error);
            console.error('[WS] req error:', errMsg);
            get()._push({ role: 'system', text: `⚠ ${errMsg}`, ts: Date.now() });
            return;
          }

          // Ignore ok ACKs
          if (msg.type === 'res' && msg.ok) return;

          // Telemetry/system events — silent
          const SILENT_EVENTS = new Set([
            'health', 'tick', 'status', 'channels.status', 'heartbeat',
            'connect.challenge', 'doctor.memory.status', 'logs.tail', 'presence',
          ]);
          if (msg.type === 'event' && SILENT_EVENTS.has(msg.event)) return;

          // ── agent stream ─────────────────────────────────────────────
          // Handles: lifecycle (start/end), assistant deltas, tool-use resets
          // A single runId can have multiple assistant turns (tool calls between them).
          // Detect turn resets via text-length regression and split into separate bubbles.
          if (msg.type === 'event' && msg.event === 'agent') {
            const { stream, data, runId } = msg.payload || {};
            const sessionKey = msg.payload?.sessionKey || '';
            const isDrawer = sessionKey.endsWith(':gh-ask');
            const isTerm   = sessionKey.endsWith(':terminal');

            if (stream === 'lifecycle') {
              if (data?.phase === 'start') {
                set(s => ({
                  ...(isTerm ? { termSending: true } : { chatSending: true }),
                  _activeRuns: { ...s._activeRuns, [runId]: { segIdx: 0, lastTextLen: -1, isDrawer, isTerm } },
                }));
              } else if (data?.phase === 'end') {
                set(s => {
                  const ar = { ...s._activeRuns };
                  delete ar[runId];
                  const hasTerm = Object.values(ar).some(r => r.isTerm);
                  const hasMain = Object.values(ar).some(r => !r.isTerm);
                  return { termSending: hasTerm, chatSending: hasMain, _activeRuns: ar };
                });
              }
              return;
            }

            if (stream !== 'assistant' || !data?.delta) return;

            set(s => {
              const runState = s._activeRuns[runId] || { segIdx: 0, lastTextLen: -1, isDrawer, isTerm };
              const newTextLen = data.text?.length ?? data.delta.length;
              // Text regression = server reset cumulative text after tool use → new turn
              const isReset = runState.lastTextLen >= 0 && newTextLen < runState.lastTextLen;
              const newSegIdx = isReset ? runState.segIdx + 1 : runState.segIdx;
              const segId = `${runId}:${newSegIdx}`;

              const targetKey = runState.isDrawer ? 'ghDrawerMessages'
                : runState.isTerm ? 'termMessages' : 'chatMessages';
              const msgs = [...s[targetKey]];
              const last = msgs[msgs.length - 1];

              let newMsgs;
              if (!isReset && last?.role === 'glitch' && last?.segId === segId) {
                // Continue existing bubble — use cumulative text (more reliable than delta accumulation)
                msgs[msgs.length - 1] = { ...last, text: data.text ?? (last.text + data.delta) };
                newMsgs = msgs;
              } else {
                // New turn or new run → new bubble
                newMsgs = [...msgs, { role: 'glitch', text: data.delta, runId, segId, ts: Date.now() }];
              }

              return {
                [targetKey]: newMsgs,
                _activeRuns: { ...s._activeRuns, [runId]: { ...runState, segIdx: newSegIdx, lastTextLen: newTextLen } },
              };
            });
            return;
          }

          // ── chat snapshot ─────────────────────────────────────────────
          // On final, replace the LAST matching runId bubble with canonical text.
          // Leaves earlier bubbles (tool-use turns) intact.
          if (msg.type === 'event' && msg.event === 'chat') {
            const { state, message, runId } = msg.payload || {};
            const sessionKey = msg.payload?.sessionKey || '';
            const isDrawer = sessionKey.endsWith(':gh-ask');
            const isTerm   = sessionKey.endsWith(':terminal');

            if (state === 'final' && message?.content) {
              const finalText = Array.isArray(message.content)
                ? message.content.filter(c => c.type === 'text').map(c => c.text).join('')
                : String(message.content);
              if (finalText) {
                set(s => {
                  const targetKey = isDrawer ? 'ghDrawerMessages'
                    : isTerm ? 'termMessages' : 'chatMessages';
                  const msgs = [...s[targetKey]];
                  let idx = -1;
                  for (let i = msgs.length - 1; i >= 0; i--) {
                    if (msgs[i].role === 'glitch' && msgs[i].runId === runId) { idx = i; break; }
                  }
                  const updated = idx >= 0
                    ? msgs.map((m, i) => i === idx ? { ...m, text: finalText } : m)
                    : [...msgs, { role: 'glitch', text: finalText, runId, ts: Date.now() }];
                  // Persist chat messages (not term or drawer)
                  if (!isDrawer && !isTerm) {
                    try { localStorage.setItem('glitch-ui:chat-history', JSON.stringify(updated.slice(-120))); } catch(_) {}
                  }
                  return { [targetKey]: updated, ...(isTerm ? { termSending: false } : { chatSending: false }) };
                });
              }
            }
            return;
          }

        } catch(_) {
          if (ev.data) get()._push({ role: 'glitch', text: ev.data, ts: Date.now() });
        }
      };

      ws.onclose = (e) => {
        console.log('[WS] closed — code:', e.code, 'reason:', e.reason);
        set({ wsConnected: false, ws: null, wsLastError: e.reason || `code ${e.code}` });
      };
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
        method: 'chat.send',
        params: { message: text, sessionKey: 'main', idempotencyKey: crypto.randomUUID() }
      }));
      return true;
    } catch(_) { return false; }
  },

  // ── Chat ───────────────────────────────────
  chatMessages: (() => {
    try {
      const saved = JSON.parse(localStorage.getItem('glitch-ui:chat-history') || '[]');
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch (_) {}
    return [{ role: 'system', text: 'Connect to start chatting with Glitch.', ts: Date.now() }];
  })(),
  chatSending: false,
  ghDrawerMessages: [],  // GitHub Ask drawer — separate thread
  termMessages: [],      // Terminal AI — separate thread
  termSending: false,

  _push: (msg) => set(s => {
    const msgs = [...s.chatMessages, msg];
    // Persist last 120 messages (skip system-only states)
    try { localStorage.setItem('glitch-ui:chat-history', JSON.stringify(msgs.slice(-120))); } catch (_) {}
    return { chatMessages: msgs };
  }),

  sendChat: async (text) => {
    const gate = get()._checkAndRecord('chat');
    if (!gate.allowed) {
      get()._push({ role: 'system', text: `⚠ Budget gate: ${gate.reason}`, ts: Date.now() });
      return;
    }
    const { wsConnected, sendWs, runCmd, _push } = get();
    _push({ role: 'user', text, ts: Date.now() });
    set({ chatSending: true });

    // Try live WebSocket first — chatSending stays true until lifecycle:end or chat.final
    if (wsConnected && sendWs(text)) {
      return;
    }

    // Fallback: SSH agent run
    const escaped = text.replace(/"/g, '\\"');
    const res = await runCmd(`openclaw agent --agent main --message "${escaped}" --json 2>&1`);
    const raw = res.stdout.trim() || res.stderr.trim();

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

  // ── GitHub Ask drawer ──────────────────────────────────────────────────────
  _pushDrawer: (msg) => set(s => ({ ghDrawerMessages: [...s.ghDrawerMessages, msg] })),

  clearGhDrawer: () => set({
    ghDrawerMessages: [{ role: 'system', text: 'Ask Glitch about this file or directory.', ts: Date.now() }],
  }),

  sendGhChat: async (text) => {
    const { ws, wsConnected, runCmd, _pushDrawer } = get();
    _pushDrawer({ role: 'user', text, ts: Date.now() });
    set({ chatSending: true });
    if (wsConnected && ws) {
      try {
        ws.send(JSON.stringify({
          type: 'req', id: crypto.randomUUID(), method: 'chat.send',
          params: { message: text, sessionKey: 'gh-ask', idempotencyKey: crypto.randomUUID() },
        }));
      } catch (_) {}
      return;
    }
    // SSH fallback
    const escaped = text.replace(/"/g, '\\"');
    const res = await runCmd(`openclaw agent --agent main --message "${escaped}" --json 2>&1`);
    const raw = res.stdout.trim() || res.stderr.trim();
    let reply = raw;
    try {
      const parsed = JSON.parse(raw);
      reply = parsed.result?.payloads?.map(p => p.text).filter(Boolean).join('\n')
           || parsed.response || parsed.content || raw;
    } catch (_) {}
    _pushDrawer({ role: 'glitch', text: reply || '(no response)', ts: Date.now() });
    set({ chatSending: false });
  },

  // ── Terminal AI ────────────────────────────────────────────────────────────
  _pushTerm: (msg) => set(s => ({ termMessages: [...s.termMessages, msg] })),

  clearTermMessages: () => set({ termMessages: [] }),

  sendTermChat: async (text) => {
    const { ws, wsConnected, runCmd, _pushTerm } = get();
    _pushTerm({ role: 'user', text, ts: Date.now() });
    set({ termSending: true });
    if (wsConnected && ws) {
      try {
        ws.send(JSON.stringify({
          type: 'req', id: crypto.randomUUID(), method: 'chat.send',
          params: { message: text, sessionKey: 'terminal', idempotencyKey: crypto.randomUUID() },
        }));
      } catch (_) {}
      return;
    }
    // SSH fallback
    const escaped = text.replace(/"/g, '\\"');
    const res = await runCmd(`openclaw agent --agent main --message "${escaped}" --json 2>&1`);
    const raw = res.stdout.trim() || res.stderr.trim();
    let reply = raw;
    try {
      const parsed = JSON.parse(raw);
      reply = parsed.result?.payloads?.map(p => p.text).filter(Boolean).join('\n')
           || parsed.response || parsed.content || raw;
    } catch (_) {}
    _pushTerm({ role: 'glitch', text: reply || '(no response)', ts: Date.now() });
    set({ termSending: false });
  },

  // ── Navigation ─────────────────────────────
  activeModule: localStorage.getItem('glitch-ui:active-module') || 'chat',
  setActiveModule: (m) => {
    localStorage.setItem('glitch-ui:active-module', m);
    set({ activeModule: m });
  },

  // ── Panel state — survives tab switches (in-memory only, no page reload) ───
  githubState: {
    owner: '', repos: [], reposLoading: false,
    selectedRepo: null, branch: '', branches: [], currentPath: '',
    items: [], itemsLoading: false,
    recentRepos: JSON.parse(localStorage.getItem('glitch-ui:recent-repos') || '[]'),
  },
  setGithubState: (patch) => set(s => ({ githubState: { ...s.githubState, ...patch } })),

  schedulerView: localStorage.getItem('glitch-ui:scheduler-view') || 'agenda',
  setSchedulerView: (v) => {
    localStorage.setItem('glitch-ui:scheduler-view', v);
    set({ schedulerView: v });
  },

  terminalAiMode: localStorage.getItem('glitch-ui:terminal-ai-mode') === 'true',
  setTerminalAiMode: (v) => {
    localStorage.setItem('glitch-ui:terminal-ai-mode', String(v));
    set({ terminalAiMode: v });
  },

  // ── Lockscreen ─────────────────────────────
  locked: true,
  pinHash: localStorage.getItem('glitch-ui:pin-hash') || '',

  lock: () => {
    get().disconnectWs();
    set({ locked: true });
  },

  unlock: async (pin) => {
    const { pinHash } = get();
    if (!pinHash) return 'NO_PIN';
    const hash = await _hashPin(pin);
    if (hash !== pinHash) return false;
    set({ locked: false });
    await get().connect();
    get().startTunnel();
    return true;
  },

  setPin: async (pin) => {
    const hash = await _hashPin(pin);
    localStorage.setItem('glitch-ui:pin-hash', hash);
    set({ pinHash: hash, locked: false });
    await get().connect();
    get().startTunnel();
  },

  // ── Theme ──────────────────────────────────
  themeMode:   localStorage.getItem('glitch-ui:theme-mode')  || 'night',
  accentColor: localStorage.getItem('glitch-ui:accent')      || '#00e5c3',
  themeShape:  localStorage.getItem('glitch-ui:theme-shape') || 'rounded',

  setThemeMode: (mode) => {
    localStorage.setItem('glitch-ui:theme-mode', mode);
    applyThemeMode(mode);
    set({ themeMode: mode });
  },

  setAccentColor: (hex) => {
    localStorage.setItem('glitch-ui:accent', hex);
    applyAccent(hex);
    set({ accentColor: hex });
  },

  setThemeShape: (shape) => {
    localStorage.setItem('glitch-ui:theme-shape', shape);
    applyThemeShape(shape);
    set({ themeShape: shape });
  },

  // Initialise all persisted appearance values on mount
  initTheme: () => {
    const { uiScale, themeMode, accentColor, themeShape } = get();
    document.documentElement.style.setProperty('--ui-scale', String(uiScale));
    applyThemeMode(themeMode);
    applyAccent(accentColor);
    applyThemeShape(themeShape);
  },

  // ── UI Scale ───────────────────────────────
  uiScale: parseFloat(localStorage.getItem('glitch-ui:ui-scale') || '1'),
  setUiScale: (s) => {
    const clamped = Math.min(1.3, Math.max(0.85, parseFloat(s)));
    localStorage.setItem('glitch-ui:ui-scale', String(clamped));
    document.documentElement.style.setProperty('--ui-scale', String(clamped));
    set({ uiScale: clamped });
  },

  // ── Chat prefill (GitHub "Ask Glitch") ─────
  chatPrefill: '',
  prefillChat: (text) => set({ chatPrefill: text, activeModule: 'chat' }),
  clearChatPrefill: () => set({ chatPrefill: '' }),

  // ── Workspace prefill (GitHub "Open in Workspace") ─────
  workspacePrefill: null,  // { vpsPath, fileName, content, ghOwner, ghRepo }
  openInWorkspace: (vpsPath, fileName, content, ghOwner, ghRepo) => {
    set({ workspacePrefill: { vpsPath, fileName, content, ghOwner, ghRepo }, activeModule: 'workspaces' });
  },
  clearWorkspacePrefill: () => set({ workspacePrefill: null }),

  // ── Model Profiles ─────────────────────────
  modelProfiles: JSON.parse(localStorage.getItem('glitch-ui:model-profiles') || JSON.stringify({
    chat:       'claude-haiku-4-5-20251001',
    workspaces: 'claude-sonnet-4-5',
    autonomy:   'claude-opus-4-6',
  })),
  activeProfile: localStorage.getItem('glitch-ui:active-profile') || 'chat',
  setModelProfile: (slot, model) => {
    const profiles = { ...get().modelProfiles, [slot]: model };
    localStorage.setItem('glitch-ui:model-profiles', JSON.stringify(profiles));
    set({ modelProfiles: profiles });
  },
  setActiveProfile: (slot) => {
    localStorage.setItem('glitch-ui:active-profile', slot);
    set({ activeProfile: slot });
  },

  // ── Budget Gate ─────────────────────────────
  budget: JSON.parse(localStorage.getItem('glitch-ui:budget') || JSON.stringify({
    maxRunsPerHour:       20,
    maxAutonomyRunsPerDay: 5,
  })),
  setBudget: (patch) => {
    const b = { ...get().budget, ...patch };
    localStorage.setItem('glitch-ui:budget', JSON.stringify(b));
    set({ budget: b });
  },
  _runs: (() => {
    const stored = localStorage.getItem('glitch-ui:runs');
    const def = { hourly: 0, daily: 0, hourlyWindowStart: Date.now(), dailyWindowStart: Date.now() };
    if (!stored) return def;
    try { return { ...def, ...JSON.parse(stored) }; } catch { return def; }
  })(),
  _checkAndRecord: (type = 'chat') => {
    const now = Date.now();
    let { hourly, daily, hourlyWindowStart, dailyWindowStart } = get()._runs;
    const { budget, overnightMode } = get();
    if (now - hourlyWindowStart > 3_600_000) { hourly = 0; hourlyWindowStart = now; }
    if (now - dailyWindowStart  > 86_400_000) { daily = 0; dailyWindowStart = now; }
    if (overnightMode && type !== 'manual')
      return { allowed: false, reason: 'Overnight Mode active — only cron & manual chat allowed' };
    if (hourly >= budget.maxRunsPerHour)
      return { allowed: false, reason: `Hourly limit reached (${budget.maxRunsPerHour} runs/hr)` };
    if (type === 'autonomy' && daily >= budget.maxAutonomyRunsPerDay)
      return { allowed: false, reason: `Daily autonomy limit reached (${budget.maxAutonomyRunsPerDay}/day)` };
    const newRuns = { hourly: hourly + 1, daily: type === 'autonomy' ? daily + 1 : daily, hourlyWindowStart, dailyWindowStart };
    localStorage.setItem('glitch-ui:runs', JSON.stringify(newRuns));
    set({ _runs: newRuns });
    return { allowed: true };
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

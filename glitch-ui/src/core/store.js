import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

const VPS = { host: '46.225.76.215', user: 'root', tunnelPort: 18789 };

export const useStore = create((set, get) => ({
  // --- Connection ---
  vps: VPS,
  connected: false,
  tunnelActive: false,
  connecting: false,
  connectionError: null,

  connect: async () => {
    set({ connecting: true, connectionError: null });
    try {
      const res = await invoke('ssh_run', {
        host: VPS.host, user: VPS.user, cmd: 'openclaw status --json 2>/dev/null || echo "ok"'
      });
      if (res.success || res.stdout.includes('ok')) {
        set({ connected: true, connecting: false });
      } else {
        set({ connected: false, connecting: false, connectionError: res.stderr || 'Connection failed' });
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
    } catch (e) {
      console.error('Tunnel error:', e);
    }
  },

  stopTunnel: async () => {
    try {
      await invoke('stop_tunnel', { localPort: VPS.tunnelPort });
      set({ tunnelActive: false });
    } catch (e) {
      console.error('Stop tunnel error:', e);
    }
  },

  disconnect: () => set({ connected: false, tunnelActive: false }),

  // --- SSH command runner ---
  runCmd: async (cmd) => {
    const { vps } = get();
    return invoke('ssh_run', { host: vps.host, user: vps.user, cmd });
  },

  // --- Active module/tab ---
  activeModule: 'chat',
  setActiveModule: (m) => set({ activeModule: m }),

  // --- Theme ---
  theme: 'cyberpunk',
  setTheme: (t) => {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },

  // --- Cron jobs ---
  cronJobs: [],
  cronLoading: false,
  loadCronJobs: async () => {
    set({ cronLoading: true });
    const { runCmd } = get();
    const res = await runCmd('openclaw cron list 2>&1');
    const jobs = parseCronList(res.stdout);
    set({ cronJobs: jobs, cronLoading: false });
  },

  // --- Budget / overnight mode ---
  overnightMode: false,
  toggleOvernightMode: () => set((s) => ({ overnightMode: !s.overnightMode })),

  // --- Memory ---
  memorySnapshot: '',
  memoryLoading: false,
  loadMemory: async () => {
    set({ memoryLoading: true });
    const { runCmd } = get();
    const res = await runCmd('cat /root/.openclaw/workspace/MEMORY.md 2>/dev/null || echo "No memory file found."');
    set({ memorySnapshot: res.stdout, memoryLoading: false });
  },
  searchMemory: async (query) => {
    const { runCmd } = get();
    const res = await runCmd(`memsearch "${query.replace(/"/g, '\\"')}" 2>&1`);
    return res.stdout;
  },
  appendMemory: async (entry) => {
    const { runCmd } = get();
    const escaped = entry.replace(/"/g, '\\"').replace(/`/g, '\\`');
    await runCmd(`glitchlog "${escaped}"`);
  },
}));

// Parse `openclaw cron list` text output into structured objects
function parseCronList(raw) {
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('ID') && !l.startsWith('-'));
  return lines.map(line => {
    const cols = line.split(/\s{2,}/);
    if (cols.length < 7) return null;
    return {
      id: cols[0]?.trim(),
      name: cols[1]?.trim(),
      schedule: cols[2]?.trim(),
      next: cols[3]?.trim(),
      last: cols[4]?.trim(),
      status: cols[5]?.trim(),
      agent: cols[6]?.trim(),
    };
  }).filter(Boolean);
}

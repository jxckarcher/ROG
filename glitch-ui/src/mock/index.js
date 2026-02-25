/**
 * Mock bootstrap for VITE_MOCK=1 mode.
 *
 * Called from main.jsx before React renders.
 * 1. Patches window.WebSocket with MockWebSocket
 * 2. Auto-connects SSH + WebSocket (no 1500ms tunnel delay)
 */

import { MockWebSocket } from './ws.js';

export async function install() {
  // Patch global WebSocket BEFORE any store actions create a real WS
  window.WebSocket = MockWebSocket;
  console.info('[mock] WebSocket patched with MockWebSocket');

  const { useStore } = await import('../core/store.js');
  const store = useStore.getState();

  // 0. Bypass lockscreen — no PIN needed in mock mode
  useStore.setState({ locked: false });
  console.info('[mock] Lockscreen bypassed');

  // 1. SSH connect
  await store.connect();
  console.info('[mock] SSH auto-connected');

  // 2. Bypass the 1500ms startTunnel delay — set state directly and connect WS immediately
  useStore.setState({ tunnelActive: true });
  store.connectWs();
  console.info('[mock] WebSocket connecting (no tunnel delay)…');
}

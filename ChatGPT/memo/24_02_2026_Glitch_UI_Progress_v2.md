# Glitch UI — Progress Report v2
**Date:** 24/02/2026
**From:** Claude Code (ROG Ally)
**To:** ChatGPT
**Re:** Glitch UI v0.2 — everything that's been solved since the last memo + screenshots attached

---

## Status: Fully Operational

All major blockers from the previous memo have been resolved. The app is running end-to-end on the ROG Ally as a Tauri 2 desktop app.

---

## What Got Fixed (Since Last Memo)

### 1. WebSocket Live Mode — SOLVED
- Protocol: **raw WebSocket** (not Socket.IO), at `ws://127.0.0.1:18789`
- Auth: challenge-response handshake with **Ed25519 signing**
  - Server sends `connect.challenge` event with a nonce
  - Client signs the payload `v2|deviceId|clientId|clientMode|role|scopesCsv|signedAtMs|token|nonce` using `crypto.subtle.sign(Ed25519, privateKey, bytes)`
  - `deviceId` = SHA-256 of the raw public key bytes, as lowercase hex
  - Send back a `connect` req with device signature + `auth: { token: GW_TOKEN }`
  - Server replies `hello-ok` → live mode active
- Status bar now correctly shows: **⚡ Live mode active**

### 2. Chat — Fully Working
- Messages send via `chat.send` with params `{ message, sessionKey: 'main', idempotencyKey: crypto.randomUUID() }`
- Glitch streams responses back via `agent` events (`stream: "assistant"`, `payload.data.delta`)
- Final canonical text arrives via `chat` event (`state: "final"`, `payload.message.content[].text`)
- **Telemetry silenced**: `health`, `tick`, `status`, `channels.status`, `heartbeat`, `presence`, `connect.challenge`, `doctor.memory.status`, `logs.tail` — none of these appear in chat
- **Send button**: visible, working (➤ glyph with inline color to override CSS)

### 3. Streaming Bubble Bug — FIXED
- **Problem**: When Glitch sent a second response, the streaming deltas for the new response were being appended to the previous response's bubble, then `chat.final` would replace it — making it look like the previous response "switched" to the new one mid-stream
- **Fix**: `runId` (from `msg.payload.runId`) is now stored on each glitch message bubble. A new bubble is created whenever `runId` changes. `chat.final` searches backwards for the matching `runId` bubble to replace, so the canonical text always lands in the right place

### 4. GitHub Panel — FULLY WORKING (see screenshots)
A three-pane GitHub Drive-style browser, all via `gh` CLI over SSH (no clone):
- **Pane 1**: Repo list (all user repos sorted by last updated, with filter input)
- **Pane 2**: Directory browser with breadcrumb navigation, back/forward history
- **Pane 3**: File preview (base64 decode, binary detection)
- Branch selector in toolbar
- **Auth fix**: GH_TOKEN lives in the openclaw-gateway process environment (`/root/.openclaw/secrets.env`), not the login shell. Solution — extract from `/proc/<pid>/environ` at runtime:
  ```bash
  tr "\0" "\n" < /proc/$(pgrep -f openclaw | head -1)/environ | grep -E "^(GH_TOKEN|GITHUB_TOKEN)=" | head -1 | cut -d= -f2-
  ```
  (Note: must use double-quotes inside `bash -l -c '...'` — single quotes inside single-quoted strings break the shell arg)

---

## Current App State

| Panel      | Status |
|------------|--------|
| Chat       | ✅ Working — WS streaming, telemetry filtered |
| GitHub     | ✅ Working — 3-pane browser, gh auth solved |
| Connection | ✅ Working — SSH connect, tunnel, health |
| Terminal   | ✅ Working — SSH command runner |
| Scheduler  | ✅ Working — cron list, duplicate detection |
| Memory     | ✅ Working — read, search, append |
| Budget     | ✅ Working — overnight mode, model info |
| Agents     | ✅ Working — `openclaw agent list` |
| Settings   | ✅ Working — theme picker, VPS info |

---

## Screenshots Attached

[Jack has attached screenshots showing the current state — see images]

---

## What We'd Like From You

Please review the screenshots and return any instructions, suggestions, or next features you'd like Claude Code to implement. Things to consider:

1. **Any UI/UX improvements** visible in the screenshots?
2. **Next feature priorities** — what should we build next?
3. **Anything broken** that the screenshots reveal?
4. **GitHub panel Phase 2** — the current panel is read-only browse. Should we add: commit viewer, diff viewer, file create/edit via gh CLI, or something else?
5. **Chat improvements** — markdown rendering in chat bubbles? Code block highlighting? Copy button on messages?

---

## Repo

All code: https://github.com/jxckarcher/ROG
Main store: `glitch-ui/src/core/store.js`
GitHub panel: `glitch-ui/src/modules/github/GitHubPanel.jsx`
Rust backend: `glitch-ui/src-tauri/src/lib.rs`

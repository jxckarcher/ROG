# Glitch UI — Build Log

**Spec:** [docs/spec/glitch-ui-specification_v1.md](spec/glitch-ui-specification_v1.md)
**Sprint board:** [docs/SPRINTS.md](SPRINTS.md)
**Decisions:** [docs/DECISIONS.md](DECISIONS.md)

Append-only record of sprints, decisions, and known issues.
Format: `## YYYY-MM-DD — Title`

---

## 2026-02-24 — Sprint 1–3: Initial scaffold + design overhaul

- Tauri 2 scaffold created (Rust + React)
- v0.1: basic panels wired up
- v0.2: full design overhaul — token system, macOS-style sidebar, 6 panels rebuilt

---

## 2026-02-24 — Sprint 4: WebSocket protocol + chat

- Implemented Ed25519 challenge-response auth handshake
- `connect.challenge` → sign → `hello-ok` flow working
- SSH fallback path via `openclaw chat send`
- Fixed WS handshake protocol (min/maxProtocol: 3)

**Known issues at close:**
- Chat streaming overwriting bubbles (delta accumulation bug)
- No typing indicator (chatSending cleared too early)
- GitHub Ask redirects to Chat tab

---

## 2026-02-25 — Sprint 5: Streaming fix + UX hardening

### Changes
- `store.js`: Fixed streaming — `runId:segIdx` bubble IDs, text-regression detection for multi-turn tool calls
- `store.js`: Fixed typing indicator — chatSending now cleared by `lifecycle:end` / `chat.final` only
- `WorkspacesPanel`: Two-step commit modal (diff stat review before push)
- `WorkspacesPanel`: +File / +Folder buttons + hover rename/delete with confirmation modals
- `GitHubPanel`: Ask drawer — docked right-side panel, own WS thread (sessionKey: `main:gh-ask`)
- `GitHubPanel`: Pull → clone detection (detects "fatal: cannot change to" → shows Clone CTA)
- `SchedulerPanel`: One-shot scheduling — date+time picker → `dateTimeToCron()` + `--once` flag
- `SchedulerPanel`: Fixed `cron history` → `cron runs --id`

### Scary bits identified
- `GW_TOKEN` hardcoded in `store.js:5` — needs env/config injection
- Budget gate is client-side only (can be bypassed via store)
- No audit log for destructive SSH operations

### Tests at close
- 17/17 sanity checks pass (Node.js script)
- E2E test harness: pending (Sprint 6)

---

## 2026-02-25 — Sprint 7 (partial): Scheduler agenda-first + Terminal AI + CSS hardening

### Changes
- `SchedulerPanel`: Agenda-first default view — Today / Next 7 Days / Later / Disabled groups; `+New Job` slides to existing form; `fmtNext()` for human-readable "in 2h" countdown; `AgendaCard` component with expand/toggle/delete inline
- `TerminalPanel`: AI mode toggle (Shell ⟷ ⚡ AI) — in AI mode, input routes to `sendTermChat` over WS session `main:terminal`; Glitch's streaming replies appear in-terminal with accent styling
- `store.js`: Added `termMessages`, `termSending`, `sendTermChat`, `clearTermMessages`; WS routing extended to route `:terminal` session events to `termMessages` with independent `termSending` flag
- `GitHubPanel.css`: Fixed preview-pane toolbar disappearing behind PDF iframe / CSV table — `flex-shrink:0`, `position:sticky; z-index:10` on `.gh-preview-header`; `min-height:0` on `.gh-preview-body`; `z-index:1` on iframe + csv-wrap
- Mock: `ws.js` — `main:terminal` session returns disk-space fixture reply

### Tests at close
- 22/22 pass; scheduler tests updated for `.sched-agenda-card` (agenda view replaces `.sched-job`)

---

## 2026-02-25 — Sprint 8: Blocker Fixes + Per-Panel Persistence

### Changes

- `shared.css`: Added `.icon-btn` CSS class with explicit `.icon-btn svg { stroke: currentColor; fill: none; width: 16px; height: 16px; opacity: 1; }` — guarantees SVG rendering regardless of WebView2 inheritance chain. `.icon-btn-accent` variant. `.icon-btn:disabled { opacity: 0.30 }`.
- `GitHubPanel.jsx`: Back, Forward, Refresh toolbar buttons now use `.icon-btn` class (was `.btn-ghost .btn-xs .gh-nav-btn`). Added `aria-label` to all three for Playwright selectors.
- `store.js`: Three new panel-state slices — `githubState` (owner, repos, selectedRepo, branch, branches, currentPath, items — survives tab switches, in-memory only), `schedulerView` (persisted to localStorage), `terminalAiMode` (persisted to localStorage).
- `GitHubPanel.jsx`: All navigation state moved from local `useState` to store-backed shims via `setGithubState`. Auth check + repo fetch skip when data already in store (no redundant re-fetch on tab remount). Removes tab-switch flicker entirely.
- `SchedulerPanel.jsx`: `view` state (`'agenda' | 'new'`) wired to `schedulerView` from store — view persists across tab switches.
- `TerminalPanel.jsx`: `aiMode` state wired to `terminalAiMode` from store — AI/Shell mode persists across tab switches.
- `TopBar.jsx`: Model/profile chip added — clickable, cycles `chat → workspaces → autonomy`; shows model shortname (Haiku/Sonnet/Opus); orange `chip-warn` on Autonomy.
- `store.js`: `activeModule` persisted to localStorage. `chatMessages` restored from localStorage on init; saved on every push + `chat.final`.
- `store.js`: `connect()` preserves existing chat history (filters placeholder, appends "SSH connected") instead of wiping.
- `GitHubPanel.jsx`: `GH_STATE_KEY` localStorage restore — on first load, restore last repo/branch/path from localStorage.
- `GitHubPanel.css`: `.gh-panes-wrap { position: relative }` wrapper so Ask drawer `top: 0` is relative to panes only, not the toolbar.
- `tests/e2e/screenshots.spec.js`: Auto-screenshot suite — 12 tests (6 panels × 2 viewports: 1280×800 and 900×600). Output to `tests/screenshots/` (gitignored).
- `tests/e2e/github.spec.js`: 2 new tests — `icon-btn SVGs render with non-zero size` (asserts SVG bounding box > 0); `GitHub panel state survives tab switch` (selects repo → Chat → GitHub → asserts same repo active).

### What didn't ship (planned vs actual)

Sprint 8 as originally defined in SPRINTS.md (Curated ControlUI Surfaces — budget/sessions/skills/channels) was deferred in favour of emergency blocker fixes. See Sprint 9 for rescheduled ControlUI work.

### Tests at close

- **25/25 pass** — chat (8), github (7), scheduler (4), workspaces (6)
- Screenshot suite: 12/12 pass (auto-capture, no assertions)
- Zero console errors in CI

---

## 2026-02-25 — Sprint 6: Test harness + BUILDLOG setup

### Changes
- `VITE_MOCK=1` mode: mock `invoke` + `MockWebSocket` (auto-connects, no VPS needed)
- `playwright.config.js` + 4 smoke test files (chat / github / workspaces / scheduler)
- Artifact capture: screenshot + trace on failure (via Playwright config)
- `package.json`: added `@playwright/test`, `cross-env`, `test:e2e` scripts
- `docs/BUILDLOG.md` (this file), `docs/DECISIONS.md`
- `scripts/session_close.sh`

### Known issues at close
- MockWebSocket does not simulate tool-call turn resets (only single-turn streaming)
- GitHub Ask drawer close button selector may need `aria-label` attribute added
- Scheduler test uses fragile select-option matching — may need `data-testid` on select

---

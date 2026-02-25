# Glitch UI — Sprint Board

**Spec:** [docs/spec/glitch-ui-specification_v1.md](spec/glitch-ui-specification_v1.md)
**Buildlog:** [docs/BUILDLOG.md](BUILDLOG.md)

---

## Completed

### Sprint 1–3 — Initial scaffold + design overhaul
- Tauri 2 scaffold, basic panels, v0.2 design system

### Sprint 4 — WebSocket protocol + chat
- Ed25519 handshake, chat streaming, SSH fallback

### Sprint 5 — Streaming fix + UX hardening
- Streaming bubble-split fix, typing indicator, two-step commit, file ops, GitHub Ask drawer, clone detection, cron runs, one-shot scheduler

### Sprint 6 — Test harness + BUILDLOG setup ✓
- VITE_MOCK=1 (mock Tauri + mock WS), Playwright E2E (19/22 pass, 3 skipped), BUILDLOG/DECISIONS/session_close

### Sprint 7 — Scheduler Agenda + Terminal AI + CSS Hardening ✓
- Agenda-first scheduler view (Today/Week/Later groups), Terminal AI mode (Shell ⟷ ⚡), streaming fix, GitHub preview CSS
- 22/22 pass

### Sprint 8 — Blocker Fixes + Per-Panel Persistence ✓ (2026-02-25)
- `.icon-btn` CSS class (guarantees SVG rendering in WebView2)
- Back/Forward/Refresh now use `icon-btn` with `aria-label`
- `githubState`, `schedulerView`, `terminalAiMode` in Zustand store — panel state survives tab switches
- GitHub repo/branch/path restored from store on remount (no re-fetch flicker)
- Model/profile chip in TopBar (clickable, cycles Chat→Workspaces→Autonomy)
- `activeModule` + `chatMessages` persisted to localStorage
- Ask drawer no longer overlays toolbar (`.gh-panes-wrap` scoping fix)
- Auto-screenshot suite (12 captures, 2 viewports)
- **25/25 pass**

---

## Sprint 9 — Stateful OS + Collaboration Layer (Milestone A+B)

**Goal:** Make the most common daily workflows feel complete: open any file type cleanly, and schedule tasks in < 30s on a 7" screen.

### Deliverables

| # | Feature | Acceptance Test |
|---|---------|-----------------|
| 7.1 | **PDF viewer (PDF.js)** — detect `.pdf` extension → fetch via base64 from VPS → render with `pdfjs-dist`. "Open externally" fallback. | Opening a fixture `.pdf` shows rendered pages (not raw bytes); external viewer button calls Tauri shell open. |
| 7.2 | **CSV table viewer (TanStack)** — detect `.csv` → parse → render virtualised table. Raw/Table toggle. Column sort. | 50k-row fixture scrolls smoothly; Raw/Table toggle works; sorting a column reorders rows. |
| 7.3 | **File type router** — dispatch `.pdf`/`.csv`/image/binary files to correct viewer; all others use Monaco. | Each fixture type renders in the right viewer with no fallback to "raw bytes". |
| 7.4 | **Scheduler agenda view** — default view: "Today / Next 7 days" list with large tap targets. Month strip for navigation. | User creates a one-shot reminder from agenda view in < 30s without touching a month grid. |
| 7.5 | **Scheduler run detail** — clicking a job shows run status/output/timestamps. "Open log tail" stub. | Run detail expands inline; shows ok/error/skipped + timestamps from mock. |
| 7.6 | **GitHub mock fixtures** — add repo+branch+file fixture data so 3 skipped GitHub Ask drawer tests become active. | `npm run test:e2e` reports 22/22 pass (0 skipped). |
| 7.7 | **Screenshot tests** — automated captures of 6 core pages at desktop + "ROG 7-inch" (800×530) viewport. | `playwright-report/` contains screenshots per page per viewport on every test run. |

### Mock/CI requirements
- `src/mock/tauri.js`: add fixtures for `gh repo list`, `gh api repos/…/git/trees`, `cat fixture.pdf` (base64), large CSV generation
- `tests/fixtures/`: `sample.pdf.b64`, `sample-50k.csv` (generated in test setup)
- Playwright config: add `ROG-7inch` project at `800×530`

---

## Sprint 9 — Stateful OS + Collaboration Layer (Milestone A+B)

**Goal:** Make the app feel like an OS, not a dashboard. Persistent sessions, multi-root workspaces, and Glitch-as-pair-programmer UX.

### Deliverables

| # | Feature | Effort | Risk | Acceptance Test |
|---|---------|--------|------|-----------------|
| 9.1 | **Session Manager** — sidebar session list; create/rename/switch sessions; `sessionKey` per chat | M | Med | Opening a new session shows blank chat; previous session history preserved |
| 9.2 | **Chat per sessionKey** — `chatMessages` keyed by `sessionKey`; switch session = switch history | M | Low | Two sessions have independent chat histories |
| 9.3 | **Workspace roots model** — multi-root support; store `workspaceRoots[]`; persist to localStorage | S | Low | Adding a second root persists across tab switches and page reload |
| 9.4 | **Unified context chip** — `@file`, `@dir`, `@repo` chips in chat composer; appear as tags | M | Med | Typing `@` shows file picker; selected file attaches as context in next message |
| 9.5 | **Inline Propose Edit** — Glitch reply with code → "Apply to file" button → diff modal → apply | L | High | After Glitch suggests a code change, user can apply it to a VPS file with one click |
| 9.6 | **Ctrl+K command palette** — fuzzy search of panels, actions, recent files | M | Low | Ctrl+K opens palette; typing "sched" navigates to Scheduler; Esc closes |

### Mock/CI requirements
- `src/mock/ws.js`: session switching fixtures (multiple `sessionKey` values)
- `tests/e2e/sessions.spec.js`: session create + switch + history isolation
- `tests/e2e/palette.spec.js`: Ctrl+K opens, closes, navigates

---

## Sprint 10 — Curated ControlUI Surfaces (originally Sprint 8)

**Goal:** Mirror the highest-leverage OpenClaw operator surfaces directly in Glitch UI. No tab-switching to external ControlUI for daily ops.

### Deliverables

| # | Feature | Acceptance Test |
|---|---------|-----------------|
| 10.1 | **Usage & costs (Budget tab upgrade)** — poll `/status` + `/usage cost` endpoints; show per-session tokens + estimated cost. | Budget page displays tokens used + cost for last session when WS connected. |
| 10.2 | **Sessions mini-admin** — list active sessions; patch `thinking`/`verbose` overrides per session. | Changing thinking level updates session; subsequent reply metadata reflects change. |
| 10.3 | **Skills toggles (Settings → Skills tab)** — fetch skill list; show enabled state + required env keys; safe enable/disable with confirm. | Disabling a skill updates config and requires explicit Apply if restart needed. |
| 10.4 | **Channels status (Settings → Channels)** — show channel name/status; "Open ControlUI" button opens tunnel URL in browser. | Channel status loads; external URL opens via Tauri shell open. |
| 10.5 | **Config safe editor (Settings → OpenClaw)** — fetch config + schema; schema-driven form; base-hash guard; validate before apply. | Invalid config edits are blocked client-side before submit; apply triggers gateway restart. |
| 10.6 | **OpenClaw operator reconnect** — persist device token in Tauri Stronghold (not localStorage); reconnect on restart. | Clearing localStorage does not break auth; app reconnects using stored device token. |

### Mock/CI requirements
- MockWebSocket: add `gateway call config.get`, `gateway call skills.list`, `gateway call sessions.list` response fixtures
- Tests: each new settings tab has a `settings-*.spec.js` smoke test

---

## Sprint 11 — Safety Firewall + Quality Gates

**Goal:** Production-grade safety model. The app should be safe enough for "friends/family" operators.

### Deliverables

| # | Feature | Acceptance Test |
|---|---------|-----------------|
| 11.1 | **Central Action Firewall** — `canRun(actionType): { allowed, reason }` at store action layer; replaces scattered UI disables. | Budget-gate blocks "Run now" + `agentTurn` cron creation; Overnight Mode also blocks; both provide a clear reason string. |
| 11.2 | **Server-side agentTurn gate** — when Overnight Mode ON, iterate cron jobs; `disable` any `agentTurn` job; store "gate-disabled" set for restore. | With Overnight Mode ON: `agentTurn` jobs become `disabled`; `systemEvent` reminders still execute; toggling Overnight OFF restores only gate-disabled jobs. |
| 11.3 | **Audit log** — append-only `operations.auditLog[]` in store; every destructive/confirm action records `{ ts, action, params, outcome }`. | After a delete + a commit: audit log has 2 entries with correct action names and timestamps. |
| 11.4 | **Secrets out of localStorage** — gateway token + device keypair → Tauri Stronghold (or OS credential store). | Clearing app localStorage does not break WS reconnect; token persists across restarts. |
| 11.5 | **Patch safety** — `git apply --check` before apply; scope to workspace root; fail safely if check fails. | Applying a bad patch shows error from `git apply --check`; no files are modified. |
| 11.6 | **CI screenshot discipline** — Playwright visual regression baseline; fail CI on layout regressions. | CI produces `buildlog/YYYY-MM-DD-{SHA}/` with screenshots; manual approval gates visual changes. |

### Mock/CI requirements
- Playwright: `--fail-on-snapshot-diff` after first approved baseline
- `scripts/capture-baseline.sh` for initial screenshot approval

---

## Backlog (unscheduled)

- Friends/family role-based restrictions (operator.read vs operator.write scopes in UI)
- Approvals UI for `exec.approval.requested` events
- Tauri log plugin + frontend console forwarding
- Zustand slice refactor (domain vs ephemeral state separation)
- "Open in Workspace" multi-file patch set flow
- Hunk-level diff toggles (include/exclude per hunk)

---

## Non-negotiables (invariants enforced in code — do not drift)

1. **No silent writes** — AI proposals → diff → explicit apply only
2. **No auto-clone / no auto-push** — always explicit + confirmed
3. **Overnight Mode + Budget gate hard-block autonomy** — and server-side disable `agentTurn` cron jobs
4. **No destructive ops without confirm** — delete/rename/cron removal/config apply

See [docs/DECISIONS.md](DECISIONS.md) for architecture decisions.

# Glitch UI — Architecture Decisions

Key decisions recorded with rationale and alternatives considered.

---

## D-001: VITE_MOCK=1 via Vite alias, not runtime patching

**Decision:** Use `resolve.alias` in `vite.config.js` to swap `@tauri-apps/api/core` → `src/mock/tauri.js` when `VITE_MOCK=1`.

**Rationale:** Compile-time alias is cleaner than runtime monkey-patching `window.__TAURI_INTERNALS__`. The alias is transparent to all consumers; no code changes needed in store.js or panels.

**Alternatives considered:**
- Runtime patching of the invoke proxy → requires knowing Tauri internals, fragile
- Separate mock store → duplicates all business logic

---

## D-002: MockWebSocket as class, not service worker

**Decision:** Replace `window.WebSocket` with a `MockWebSocket` class in the browser context.

**Rationale:** Service worker interception requires HTTPS or localhost and extra setup. Class replacement is zero-dependency, works in any browser context, and supports the exact same `onopen`/`onmessage`/`onclose`/`send` API that the store uses.

**Alternatives considered:**
- Playwright `page.route('ws://**')` — available in Playwright 1.48+, but requires more complex message routing to match the exact challenge/hello-ok handshake
- Mock WS server (ws npm package) — requires extra process, port management

---

## D-003: Auto-connect in mock mode (no manual connect button in tests)

**Decision:** `src/mock/index.js` auto-calls `store.connect()` + `store.startTunnel()` before React renders.

**Rationale:** Tests should not repeat the connect flow as a prerequisite. Each test should start from a "ready" state. Auto-connect in mock mode achieves this without modifying the real connect flow.

**Risk:** If `connect()` or `startTunnel()` is refactored, mock/index.js needs updating. Mitigation: tests check `.chip-on` as a health check, so regressions are caught.

---

## D-004: Bubble splitting via runId:segIdx (not resetText flag)

**Decision:** Track `{ segIdx, lastTextLen }` per `runId` in `_activeRuns`. Increment `segIdx` when `data.text.length < lastTextLen` (text regression = server reset cumulative after tool use).

**Rationale:** The server sends `data.text` as the cumulative text for the current turn. When a tool call completes, a new turn starts and `data.text` resets to just the new delta. Detecting this regression is more reliable than a server-side `resetText` flag (which doesn't exist in the current protocol).

**Alternatives considered:**
- Append `data.delta` only (simpler) — breaks when server resets between turns
- Server-side `turnIndex` field — would require server changes

---

## D-005: GitHub Ask → inline drawer, not Chat tab switch

**Decision:** "Ask Glitch" in the GitHub panel opens a docked right-side drawer with its own WS session (`sessionKey: 'main:gh-ask'`). Does NOT switch `activeModule` to `'chat'`.

**Rationale:** Context loss — switching tabs loses the GitHub file context the user was looking at. The drawer keeps file/PR/issue context visible while chatting.

**Alternatives considered:**
- Prefill main chat + switch tab → context loss, disruptive UX
- Separate Glitch instance per panel → resource overhead, confusing

---

## D-006: Two-step commit (diff stat modal before git push)

**Decision:** "Commit + Push" button shows a modal with `git diff --stat HEAD` before committing. User must type a commit message and click "Confirm Push".

**Rationale:** SSH push to production VPS is irreversible. The existing UX had a single button that ran `git add -A && commit && push` immediately — no review, no message. This is a T3 scary bit.

**Alternatives considered:**
- Allow direct push with undo (git revert) — complex, revert of pushed commits is tricky
- Staged commit only (no push in UI) — safer but reduces utility

---

## D-007: cron runs instead of cron history

**Decision:** Use `openclaw cron runs --id <id>` to fetch run history for a job.

**Rationale:** `openclaw cron history` does not exist in OpenClaw 2026.2.23. The correct subcommand is `cron runs`. Confirmed via VPS testing.

---

## D-009: `.icon-btn` wrapper over `.btn-ghost svg` for icon-only buttons

**Decision:** Introduce a dedicated `.icon-btn` CSS class for all icon-only buttons. Never rely on `.btn-ghost svg` selectors or CSS `color` inheritance to style SVG stroke.

**Rationale:** In WebView2 (Tauri's renderer), `color: var(--text-secondary)` on a `<button>` does not reliably cascade to `svg[stroke="currentColor"]` presentation attributes. The SVG presentation attribute `stroke` has lower specificity than a CSS rule, but only if a CSS rule explicitly targets it. Without an explicit `svg { stroke: currentColor }` rule, buttons appeared as invisible dark squares. The `.icon-btn` class guarantees this with `stroke: currentColor; fill: none; width: 16px; height: 16px` on `.icon-btn svg`.

**Alternatives considered:**
- Inline `style={{ stroke: 'currentColor' }}` on every SVG — verbose, easy to forget
- Upgrading Lucide to a version with better defaults — didn't fix root cause

---

## D-010: Per-panel state in Zustand store (in-memory slices)

**Decision:** Move key panel navigation state (`githubState`, `schedulerView`, `terminalAiMode`) to the global Zustand store as plain fields (not zustand/persist middleware). Use shim setters in components (`const setOwner = (v) => setGithubState({ owner: v })`).

**Rationale:** React panels unmount when the user switches tabs, destroying all local `useState`. This caused GitHub to re-fetch the entire repo list and lose the selected repo on every tab switch. Moving state to the store (which survives as long as the app is open) eliminates the flicker. The shim pattern keeps component code identical to before — no logic changes, just the state destination changes.

**Alternatives considered:**
- zustand/persist middleware — adds complexity, overkill for in-memory survival; serialisation issues with non-JSON state like `selectedRepo` object
- React Context above the router — would require lifting all panel state up and re-structuring the app
- `keepMounted` / CSS `display:none` panels — Tauri WebView2 doesn't benefit from this pattern; adds DOM weight

**Trade-off:** `githubState` is not persisted across page reloads (intentional — user must reconnect SSH anyway). `schedulerView` and `terminalAiMode` are persisted to localStorage for UX continuity.

---

## D-008: Playwright over Vitest for E2E

**Decision:** Use Playwright for end-to-end tests, not Vitest component tests.

**Rationale:** The critical paths involve WS streaming, multi-step UI flows (commit modal), and cross-panel interactions (GitHub drawer vs Chat tab). These require a full browser context. Vitest component tests would require extensive mocking of the Zustand store and React tree.

**Trade-off:** Playwright tests are slower (~3–8s each) but test the real integration path.

---

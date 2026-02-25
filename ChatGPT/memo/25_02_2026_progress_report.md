# Glitch UI — Sprint 8 Close / Progress Report
**Date:** 2026-02-25 (PM session)
**Author:** Claude Code (Sonnet 4.6)
**Branch:** master
**Repo:** https://github.com/jxckarcher/ROG — `ROG/glitch-ui/`

---

## 1. Current State Summary

**What works (confirmed in mock + live screenshots)**

- Chat: connect → send → streaming reply → typing dots → finalise. History persists across page reloads (localStorage). Live WS + SSH fallback path both wired.
- GitHub: 3-pane layout (repos / dir / preview), PDF viewer, CSV table, inline Ask drawer (independent WS thread), clone detection, Pull/Clone to VPS. Back/Forward/Refresh buttons now visually correct (SVGs rendering).
- Workspaces: file browser, editor pane, 2-step commit modal, +File/+Folder/rename/delete with confirmation.
- Scheduler: agenda-first (Today/Week/Later groups), reminder form, agent-run form, one-shot scheduling, expand-to-history.
- Terminal: shell mode + AI mode (routes to `main:terminal` WS session). Quick command buttons.
- Budget: limit config, run counter, overnight mode toggle, model profile chip in TopBar.
- Settings, Agents: stubs/placeholders — not broken, just empty.
- Test suite: **25/25 E2E + 12/12 screenshots** — all green.

**What's flaky / known broken (honest list)**

- GitHub Back/Forward buttons: SVGs now render (Sprint 8 fix), but navigation history is reset on tab switch (it lives in `useRef`, not the store). Pressing Back after switching away does nothing.
- File preview on tab-switch: `previewFile`, `previewContent`, `activeEntry` are still local state — switching tabs loses the open file. User has to re-click.
- Chat history restore: loads from localStorage correctly, but restored messages don't have `runId` so "copy message" won't work on old messages.
- `GW_TOKEN` is hardcoded in `store.js:5`. Anyone who reads the source code gets the token.
- Budget gate is client-side only (Zustand). Can be bypassed by opening DevTools.
- No real Settings panel. The `settings/` module exists but renders a placeholder.
- No real Agents panel. Same.
- Lockscreen PIN is SHA-256 in localStorage — not Tauri Stronghold.
- Scheduler edit: can delete and create but cannot edit an existing job in place.
- "Tracking Prevention blocked access to storage for…" console warning spam in WebView2. Not breaking but noisy.

**What feels unfinished (UX gut check)**

- The app does not feel like an OS. It feels like a dashboard with tabs. Session concept is missing — you can't work on "the ROG codebase" and "the Homing-Heroes codebase" in separate sessions with separate chat histories.
- No `@file` / `@dir` context chips in chat. You have to manually copy-paste file content into chat via the Ask drawer.
- No command palette. Navigating between panels requires clicking the sidebar.
- Design is functional but not tight. Buttons are inconsistent sizes. Cards have varying padding. No skeleton loaders anywhere.
- Glitch does not feel like Claude-in-VSCode. It feels like a remote terminal with a chat box.

---

## 2. Per-Tab Status

| Tab | Status | Notes |
|-----|--------|-------|
| **Chat** | ✅ Working | Streaming, SSH fallback, history persistence, overnight mode |
| **GitHub** | ✅ Working (with caveats) | Icons visible, 3 panes work, Ask drawer works. Nav history lost on tab switch. Preview state lost on tab switch. |
| **Workspaces** | ✅ Working | File browser, editor, 2-step commit. Multi-root not supported yet. |
| **Scheduler** | ✅ Working | Agenda view correct, view persists across tabs. Edit existing job: not possible. |
| **Terminal** | ✅ Working | Shell + AI mode, mode persists across tabs. |
| **Budget** | ⚠️ Partial | UI controls present, limits enforced client-side only. No real cost data from VPS. |
| **Settings** | ❌ Placeholder | Renders a static form. Nothing saves. |
| **Agents** | ❌ Not built | Module exists, renders placeholder. |
| **Memory** | ❌ Not wired | Old store actions exist (`loadMemory`, `searchMemory`) but no dedicated panel. |

---

## 3. Known Issues / Regressions (Priority Order)

1. **GitHub nav history resets on tab switch** — `navHistory` is `useRef`, not in store. All other GitHub state is in store now. This is the most jarring remaining issue in the GitHub panel. Easy fix.

2. **File preview state not persistent** — `previewFile`, `previewContent`, `previewBlobUrl` are local state. Easy to move to store but need to decide whether to persist PDF blob URLs (answer: no, re-fetch).

3. **GW_TOKEN hardcoded** — `store.js:5`. Anyone with source access has the gateway token. Needs to move to Tauri Stronghold or at minimum an env var injected at build time.

4. **No real Settings panel** — the app presents a Settings tab that does nothing. Users will notice.

5. **Scheduler can't edit jobs** — delete + recreate is the only path. Annoying for recurrence changes.

6. **No `@file` context in chat** — user must copy-paste or use the Ask drawer workaround. This is the #1 thing that makes it feel less like Claude-in-VSCode.

7. **Budget is honour-system only** — server-side gate doesn't exist. A budget-aware user could bypass via DevTools.

8. **Tracking Prevention warning spam** — WebView2 blocks some localStorage access patterns. Low severity but noisy in console.

---

## 4. Evidence

**Test results:** 25/25 E2E + 12/12 screenshot tests — all green.

**Screenshot locations:** `glitch-ui/tests/screenshots/` (gitignored — run `npx playwright test tests/e2e/screenshots.spec.js` to regenerate).

Generated files:
```
chat-1280x800.png         chat-900x600.png
github-1280x800.png       github-900x600.png
scheduler-1280x800.png    scheduler-900x600.png
workspaces-1280x800.png   workspaces-900x600.png
terminal-1280x800.png     terminal-900x600.png
budget-1280x800.png       budget-900x600.png
```

**Console warnings observed in WebView2 (live mode):**
- `"Tracking Prevention blocked access to storage for https://..."` — WebView2 cookie/storage isolation. Non-breaking.
- No errors in mock mode E2E tests.

---

## 5. What Changed Since Last Report (Sprint 8 Deltas)

All of these were in this session (2026-02-25 PM):

- **`.icon-btn` CSS class** — explicit `svg { stroke: currentColor; fill: none; width: 16px; height: 16px }` in `shared.css`. Fixes GitHub toolbar buttons appearing as invisible dark squares in WebView2.
- **GitHub Back/Forward/Refresh** → now use `icon-btn` class + `aria-label`.
- **`githubState` in Zustand store** — `owner, repos, selectedRepo, branch, branches, currentPath, items` survive tab switches without re-fetch.
- **`schedulerView` in store** — view persists to localStorage.
- **`terminalAiMode` in store** — AI/Shell mode persists to localStorage.
- **Model/profile chip** in TopBar — click to cycle Chat/Workspaces/Autonomy; shows model shortname; orange on Autonomy.
- **`activeModule` + `chatMessages`** persisted to localStorage.
- **Ask drawer scoping** — `gh-panes-wrap { position: relative }` so drawer no longer overlays toolbar.
- **`GH_STATE_KEY` restore** — on first mount, restores last visited repo/branch/path from localStorage.
- **Auto-screenshot suite** — `tests/e2e/screenshots.spec.js` captures 12 screenshots per run.
- **2 new E2E tests** — SVG bounding-box assertion, panel-state survival test.
- **`connect()` fix** — no longer wipes chat history on reconnect.

---

## 6. Next Sprint Recommendation (Sprint 9)

**Goal:** Make it feel like an OS, not a dashboard. Two concrete improvements that would make Jack's daily workflow visibly better.

| # | Feature | Effort | Risk | "Done when" |
|---|---------|--------|------|-------------|
| 9.1 | **GitHub nav history in store** | S | Low | Back/Forward works after switching tabs |
| 9.2 | **File preview state in store** | S | Low | Open a file → switch tabs → return → file still shown |
| 9.3 | **Session Manager** — create/rename/switch sessions, chat keyed per `sessionKey` | M | Med | Two sessions have independent chat histories; sidebar shows session list |
| 9.4 | **`@file` context chip** — `@` trigger in chat composer, file picker, attach as context | M | Med | Typing `@` shows VPS file picker; selection sends file path as context prefix |
| 9.5 | **Ctrl+K command palette** — fuzzy search panels, recent files, actions | M | Low | Ctrl+K opens palette; Esc closes; typing navigates |
| 9.6 | **Scheduler job edit** — click job → edit form pre-filled | M | Low | Can change schedule/message of existing job without delete+recreate |
| 9.7 | **Settings skeleton** — at minimum: theme/accent/shape controls + model profiles UI | S | Low | Settings tab has working controls that actually save |
| 9.8 | **GW_TOKEN out of source** | S | High | Token loaded from Tauri Stronghold or env; not in `store.js` |

**Recommended order:** 9.1 → 9.2 (quick wins, removes the most jarring UX regressions) → 9.7 (settings feels empty) → 9.4 (biggest daily-use unlock) → 9.3 → 9.5 → 9.6 → 9.8.

---

## 7. Non-Negotiables Reminder

These are invariants enforced in code. Do not remove or work around them:

1. **No silent writes** — Glitch proposes code → diff modal → user clicks Apply. Never auto-apply.
2. **No auto-clone / no auto-push** — always explicit + confirmed.
3. **Overnight Mode + Budget gate hard-block autonomy** — `_checkAndRecord()` returns `{ allowed: false }` for non-manual sends. Budget tab shows current limits. Gate must run before any `openclaw agent` invocation.
4. **No destructive ops without confirm** — delete/rename/cron removal/config apply all require a confirmation dialog.
5. **Keep gateway loopback-only** — `127.0.0.1:18789`. Never expose port 18789 publicly.

---

## 8. Sanity Demo Results (live app check, for honesty)

Ran manually against mock mode (screenshots captured). Live VPS not checked this session.

| Check | Result |
|-------|--------|
| GitHub: select repo → browse → open file → switch tab → return | ✅ Repo + dir persist. ❌ Preview file lost (local state). Back button disabled (history reset). |
| Persistence: open repo + restart app | ✅ Last repo/branch/path restored from `GH_STATE_KEY`. ❌ Preview content not saved. |
| Chat: send 3 messages → reload page | ✅ History restored from localStorage (up to 120 msgs). |
| Scheduler: switch to 'new job' → switch tabs → return | ✅ View stays on 'new job' (schedulerView in store). |

---

*End of report. Next session: start with Sprint 9.1 + 9.2 (move remaining GitHub local state to store) — quick wins that close the most jarring gaps.*

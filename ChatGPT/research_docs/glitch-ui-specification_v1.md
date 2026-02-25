# Glitch UI Specification v0.4+ Implementation Memo

## Outcome and scope

This memo specifies the next implementation phase of **Glitch UI**: a desktop “Git/Docs OS” built with entity["organization","Tauri","desktop app framework"] 2 + entity["organization","React","javascript ui library"] + entity["organization","Zustand","state management library"], controlling entity["organization","OpenClaw","agent gateway and tools"] on an Ubuntu VPS over SSH + an SSH-forwarded WebSocket (default `127.0.0.1:18789`). citeturn8view0turn7search15turn16view0

This phase focuses on: IA + flows, editor/AI pair-editing UX, a small-screen scheduler/calendar UX, a curated subset of “Control UI-grade” features (usage/config/skills/cron/channels) without UI bloat, and a strict safety model.

### Non‑negotiable safety rules (must be enforced in code)
1) **No silent file writes**: AI proposals must land as a diff → reviewed → explicitly applied.  
2) **No auto-clone / no auto-push**: cloning and pushing are always explicit user actions with confirmation.  
3) **Budget + Overnight Mode hard-block autonomy** in the UI, and should also stop server-side autonomous runs where possible.  
4) **No destructive ops without confirm**: delete/rename, cron removal, skill disable, config apply/restart, etc.

These rules align with the way entity["organization","OpenClaw","agent gateway and tools"] treats “operator surfaces” as sensitive (Control UI is explicitly an admin surface; do not expose it publicly). citeturn7search1turn10search8

## North star and personas

### North star
Glitch UI is a **trustworthy operator console** for a remote agent runtime:
- Fast repo/workspace navigation, minimal friction.
- “AI pair editing” that is *review-first* and diff-native.
- Autonomy is powerful but gated (budget, overnight, confirmations).
- “Windows 11 / modern settings” layout with layered glass panels, but tuned for **7" ROG Ally readability** and keyboard-first workflows.

The “layered materials” direction maps cleanly to entity["company","Microsoft","windows and developer platform"]’s Fluent/Windows guidance: a single backdrop layer (Mica) + a content layer, with acrylic reserved for transient overlays and smoke for modal blocking. citeturn12search0turn12search2turn12search15

### Personas
**Jack (solo operator)**  
- Primary: rapid iteration across many repos and docs, shipping changes with confidence.  
- Needs: strong safety rails, predictable “diff → apply” mechanics, and quick context-carrying chat.

**Friends/family (permissioned helpers, future)**  
- Primary: triage tasks, run safe scheduled jobs, view results.  
- Needs: role-based restrictions (read-only vs operator approvals), minimal destructive capability exposure.

This dovetails with entity["organization","OpenClaw","agent gateway and tools"]’s model of explicit roles/scopes for operator connections (e.g., `operator.read`, `operator.write`, `operator.approvals`, `operator.admin`). citeturn16view0

## Information architecture and UI system

### Navigation and panel model
Keep the current left-rail layout (matches “Settings-style” navigation) but formalise it as a stable IA:

**Primary tabs (left rail):**
- Chat
- GitHub
- Workspaces
- Scheduler
- Memory
- Budget
- Settings

**System section (left rail bottom):**
- Terminal
- Connection
- Lockscreen

This matches best practices for left navigation when there are ~5–10 top-level categories. citeturn12search5

### “Panels + drawers” rule to avoid bloat
Use a consistent containment model:
- **Page = stable surface** (what you’d screenshot in a demo).
- **Right drawer = advanced controls** (rarely touched; collapsible; remembers last width).
- **Bottom sheet (small screens) = contextual actions** (e.g., Apply Patch, Commit/Push, Schedule confirmation).

This is aligned with Fluent/F2 guidance that nav typically sits in a drawer with a default width and can move to overlay behaviour on narrower widths. citeturn12search1turn12search5

### Visual tokens and rules (explicit)
These are proposed design tokens to implement your “Windows 11 + glass + futuristic dark” north star. Use them as CSS variables and a “design tokens” module:

**Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32, 40  
**Corner radius scale (px):** 8 (small), 12 (default), 16 (card), 20 (modal)  
**Border:** 1px, low-opacity (e.g., 10–16% white in dark mode)  
**Shadows:** soft, short y-offset (avoid big “material” shadows; rely on borders + blur)  
**Blur usage:** one window-level blur/backdrop (don’t stack multiple backdrops) per Windows material guidance. citeturn12search0turn12search2turn12search15

**Typography for 7" target:**
- Base UI: 14–15px
- Secondary: 12–13px
- Section headers: 16–18px
- Code/editor: 13–14px monospaced, with increased line-height (1.45–1.6)
- Minimum interactive target: aim for **48dp touch targets**, and at least **24×24 CSS pixels** minimum for pointer targets. citeturn11search1turn11search3

### Component map (exists vs add)
**Assumed existing and stable (Sprint 5):**
- Streaming chat with multi-bubble responses, typing indicator.
- GitHub 3-pane browser + branch select + “Ask” drawer + clone prompt + open in workspace.
- Workspaces with entity["organization","Monaco Editor","code editor component"] editor + diff apply flow; file ops; commit/push confirm modal.
- Scheduler with one-shot scheduling and cron run history via `cron runs --id`.
- Settings: theme/accent/shape, UI scale, model profiles, lockscreen PIN.
- Budget: overnight mode toggle and run limits surfaces.

**Add in v0.4+:**
- File viewer system: PDF viewer + CSV table viewer + “Open externally” fallback.
- Curated OpenClaw control surfaces: Usage/Costs, Sessions, Cron, Skills, Channels (mostly summaries + safe toggles).
- Calendar/diary UI for Scheduler (agenda-first for 7").
- State model refactor: explicit “operations” with audit logs, and gating at the action layer.
- “No silent writes” enforcement layer (even if some backends/tools could write).

## Core UX flows and editor patterns

### Repo → file → ask AI → diff → apply → commit/push
**Goal:** replicate the “suggested changes” mental model (review, optionally batch, then commit), not “AI edits your repo”. citeturn2search1turn2search6

**Wire-level flow:**
1. User navigates entity["organization","GitHub","code hosting platform"] panel → opens file preview.
2. User clicks **Ask** → right-side chat drawer opens with a context chip (“repo/file/path@branch” + optional selected lines).
3. AI response must produce either:
   - **Patch proposal** (preferred): one or more hunks, per file.
   - **Explanation-only** (no changes).
4. UI renders **Diff-first**:
   - Use entity["organization","Monaco Editor","code editor component"] DiffEditor for side-by-side or inline diff, with “hide unchanged regions” enabled for usability on small screens. citeturn2search4turn13search15
   - Provide hunk-level toggles (include/exclude), and batch apply across multiple files.
5. **Apply** is always explicit:
   - Apply only selected hunks.
   - After apply, show a “Working tree changed” badge and enable commit flow.
6. **Commit + push**:
   - Show diffstat, list of changed files; require confirmation (already exists).
   - “Push” remains explicit.

**Answer to research question: AI pair-editing UX patterns**
- “Suggested changes” works because it creates a *reviewable unit* that can be applied individually or in a batch, creating a clear commit boundary. citeturn2search1turn2search6  
- Diff editors should default to “only what changed” (collapse unchanged regions), particularly on 7" screens. citeturn13search15turn12search1  
- Treat multi-file edits as “patch sets” with a stable preview and clear apply semantics.

### Scheduler: an overnight task with £ cap, enforced gates, results + logs
Use entity["organization","OpenClaw","agent gateway and tools"] cron as the source of truth for scheduled runs (since it already has job persistence, history, and API surface). citeturn17view0turn9search0

**Job types (map directly to OpenClaw cron payload kinds):**
- **Reminder (deterministic):** `payload.kind = "systemEvent"` (main-session job) — no model call required. citeturn17view0  
- **Agent Run (autonomous):** `payload.kind = "agentTurn"` (isolated job) — model call. citeturn17view0  

**Calendar UX (agenda-first)**
On 7", month grids are informational but not operational. Default to:
- “Today / Next 7 days” agenda list (large tap targets).
- A compact month strip for navigation.
- Month grid available as an optional overlay/drawer.

This aligns with mobile guidance: on touch devices, calendars often move into a larger dialog mode because of limited screen real estate and target size needs. citeturn4search0turn4search2turn11search1

**Budget + Overnight gating behaviour**
- **Client-side hard block:** disable “Run now”, disable creating/enabling `agentTurn` cron jobs, disable “Autonomy” profile actions.
- **Server-side best-effort hard block:** when Overnight Mode is enabled or budget exceeded:
  - Iterate cron jobs; set `enabled=false` for any job where payload is `agentTurn`.
  - Keep `systemEvent` reminders enabled so deterministic reminders still fire.
  - Store a local “disabled-by-gate” set so reenabling restores only the jobs previously gate-disabled.

This is feasible because cron jobs have explicit enable/disable and are managed through gateway cron APIs (`cron.list`, `cron.update`, etc.), with storage under `~/.openclaw/cron/jobs.json` and run history in JSONL files. citeturn17view0turn9search0

**Results + logs**
- Scheduler entry opens a **Run detail** view:
  - status: ok/error/skipped
  - timestamps
  - output summary
  - “Open log tail” (gateway logs tail if exposed)
- Cron runs history is accessible server-side (`cron.runs`). citeturn9search0turn8view0

### Safe model/profile change
Glitch UI should treat “model profile” switches as *behaviour changes that must be visible*.

Implementation pattern:
- A profile switch shows:
  - What surfaces are affected (Chat / Workspaces / Autonomy).
  - Immediate effect vs “next run”.
  - Any tool policy changes (e.g., restricting tooling for autonomy).

This aligns with OpenClaw’s notion of session-level overrides (`sessions.patch`) and per-job model overrides for isolated cron jobs (recommended to avoid unexpected main-session context shifts). citeturn8view0turn17view0

### Enable a skill/plugin with requirements and restart semantics
Surface “what will happen” before toggling:
- What config keys will change.
- Whether a restart/apply is required.
- Whether secrets are needed.

OpenClaw already has a strong stance on config validation (unknown keys or invalid values can prevent gateway start) and exposes config editing via Control UI (`config.get`, `config.set`, `config.apply`) plus schema/form rendering (`config.schema`). citeturn10search13turn8view0

## Data, state model, and integration architecture

### Integration contract with OpenClaw
Glitch UI should connect as an **operator** over WebSocket and implement the Gateway protocol handshake (including the server’s `connect.challenge` and a signed nonce), then persist the returned device token for future connects. citeturn16view0

Key protocol facts to encode:
- WebSocket JSON frames: `req/res/event`.
- First message is connect handshake.
- Operator scopes should be least-privilege: start with `operator.read` + `operator.write`, add `operator.approvals` only if you surface approvals UI. citeturn16view0

### Credentials and secret storage
Do **not** store gateway tokens or device keys in plain localStorage (unlike the browser Control UI default). Instead:
- Use entity["organization","Tauri","desktop app framework"] Stronghold as the secure storage vault for:
  - gateway token
  - device keypair / fingerprint material
  - SSH key passphrase (if needed)
  citeturn5search0turn7search1turn16view0
- Enforce entity["organization","Tauri","desktop app framework"] capabilities/permissions so only the main window can invoke sensitive commands, and scope filesystem access tightly. citeturn5search2turn5search4

### Zustand state model improvements (shape)
Current UI already works, but v0.4+ needs a clearer separation between:
- **Durable domain state** (repos/workspaces/jobs/config snapshots)
- **Ephemeral UI state** (drawers open, selection, focus)
- **Operations + audits** (what actions were attempted, approved, applied)

Recommended store organisation:
- Use slice composition + middleware for persistence and devtools. citeturn3search0turn3search4  
- Persist only what is safe and needed (settings, last opened repo/workspace, connection target), not ephemeral UI. citeturn3search2turn3search0

Concrete top-level state groups (example):
- `settings`: theme, scale, model profiles, lockscreen
- `connection`: ssh status, ws status, auth state, device token
- `github`: repo list, selected repo/branch/path
- `workspace`: open workspace roots, file tree cache, open editors, dirty states
- `scheduler`: cron jobs cache, calendar filters, run history cache
- `budget`: gate config + counters + current state (open/blocked)
- `operations`: queue of pending confirmations (apply patch, delete, push, cron disable), and an append-only `auditLog[]`

### File viewing reliability in Tauri/WebView2 (PDF + CSV)

**Problem observed:** PDFs opening as raw text indicates the app is treating binary as “editor buffer”, not as a dedicated viewer.

**PDF strategy (recommended): embed PDF.js**
- entity["organization","PDF.js","pdf renderer"] is a web-standards PDF renderer; you can use the viewer or build your own component using `pdfjs-dist`. citeturn1search0turn1search4turn1search2  
- PDF.js requires a worker; in entity["organization","Tauri","desktop app framework"] this means your CSP and asset loading must allow the worker source you choose (typically `blob:` or same-origin). citeturn15search0turn1search0  
- Prefer a **local cached file** (download from VPS to app cache) and load via entity["organization","Tauri","desktop app framework"] `convertFileSrc` / asset protocol rather than brittle `file://` direct loads. citeturn15search15turn15search0

**PDF fallback (fast escape hatch): open externally**
- Use entity["organization","Tauri","desktop app framework"] shell open to open the cached PDF in the default system viewer. citeturn1search1turn1search9  
- Configure plugin scopes for least-privilege (restrict which paths/URLs can be opened). citeturn1search3

**Why not rely on WebView2’s built-in PDF viewer**
- WebView2 PDF behaviour can differ by runtime and policies (e.g., Adobe-powered viewer rollout; annotations and feature differences). citeturn0search1turn0search8  
- A bundled PDF.js path is more deterministic across machines.

**CSV table strategy**
- Provide a “Table” view alongside “Raw” text.
- For large CSVs, virtualise rows to stay responsive.
  - TanStack Table scales to large row counts and explicitly suggests pairing with TanStack Virtual for virtualization. citeturn14search3turn14search8turn14search0

### “Control UI-grade” feature mapping, curated for Glitch UI
The OpenClaw browser Control UI can do a lot (chat, sessions, cron, skills, config, logs tail, update, approvals, channels). citeturn8view0  
Glitch UI should mirror only the highest-leverage operator features, using drawers to hide complexity:

**In Glitch UI, replicate these OpenClaw surfaces:**
- **Usage & costs (Budget tab):**
  - show session usage snapshots and local cost summaries; OpenClaw exposes `/status`, `/usage`, and CLI usage windows. citeturn9search7turn9search9turn9search5
- **Sessions (Budget or Chat advanced drawer):**
  - list sessions + patch session overrides (thinking/verbose) where needed. citeturn8view0turn9search11
- **Cron (Scheduler tab):**
  - full CRUD on cron jobs, run now, runs history. citeturn17view0turn9search0turn8view0
- **Skills (Settings → Skills):**
  - enable/disable, show required env var keys, minimal config editor. citeturn10search7turn10search11turn8view0
- **Channels (Settings → Channels):**
  - status and minimal configuration entry points (don’t replicate everything; link to “open external” control UI if needed). citeturn8view0turn7search1
- **Config (Settings → OpenClaw):**
  - “safe edit”: fetch config + schema, validate, apply with restart, and guard against clobber via base-hash. citeturn8view0turn10search13
- **Approvals (optional, advanced):**
  - If you surface host exec approvals, wire it to `exec.approval.requested` events and `exec.approval.resolve`. citeturn16view0turn10search0

## Security, safety, testing, and roadmap

### Safety model and guardrails

**Hard boundaries**
- Glitch UI is an operator UI; treat it like an admin console.
- Keep entity["organization","OpenClaw","agent gateway and tools"] private (loopback + SSH tunnel or Tailscale Serve; avoid public exposure). citeturn8view0turn7search13turn7search15

**No silent writes enforcement**
- Even if you enable OpenClaw filesystem tools (`write`, `edit`, `apply_patch`), Glitch UI should still present the “diff → apply” UX discipline:
  - If OpenClaw generates an `apply_patch` suggestion, render it, require user apply.  
  - Consider keeping OpenClaw’s `apply_patch` tool disabled by default because it is explicitly “experimental and disabled by default” and gated by config under `tools.exec.applyPatch`. citeturn18search0turn18search2turn18search3

**Patch application safety**
- If you apply unified diffs via git tooling, prefer atomic checks:
  - `git apply --check` before applying. citeturn13search1  
  - Avoid `git apply --reject` on patches that could be untrusted; there are documented risks around reject file writes when handling crafted patches. citeturn13search0turn13search1  
- Safer alternative: apply patches using your own patch applier restricted to workspace paths; OpenClaw’s own `apply_patch` supports a `workspaceOnly` guardrail. citeturn18search0turn18search3

**Budget + overnight gate as a first-class “action firewall”**
Implement gating at the action dispatcher level (“can this action execute right now?”), not scattered UI disables.
- When blocked: prevent `agentTurn` cron execution by disabling those jobs server-side; prevent “Run now”; prevent “Overnight project” creation. citeturn17view0turn9search0  
- When unblocked: require explicit re-enable for autonomy jobs (optionally “restore gate-disabled jobs”).

**Secure config exposure**
- Never display secrets in cleartext; provide “copy once” semantics only when necessary.
- Favour schema-driven forms (OpenClaw rejects invalid configs and can refuse to start on validation failure). citeturn10search13turn8view0
- In entity["organization","Tauri","desktop app framework"], lock down plugin permissions (capabilities + command scopes), because scopes must be enforced correctly by command implementations. citeturn5search2turn5search4turn5search7

### Testing and logging plan

**Logging**
- Use entity["organization","Tauri","desktop app framework"] log plugin and forward frontend console logs to it.
- Persist logs to the OS log directory; the plugin supports rotation strategies and multiple targets. citeturn6search0turn6search2

**Testing**
- Unit/integration testing with entity["organization","Tauri","desktop app framework"] mock runtime (fast, no native webview). citeturn6search1  
- End-to-end testing via WebDriver using `tauri-driver` (Windows + Linux supported). citeturn6search1turn6search3  
- Smoke test matrix (must run locally and in CI):
  - Connect/disconnect SSH + WS handshake.
  - Open repo → preview file → open in workspace.
  - Ask → generate diff → apply → commit (but do not push in CI).
  - Create cron reminder (systemEvent) and run immediately; verify run history entry. citeturn17view0turn9search0
  - Toggle Overnight Mode → verify `agentTurn` jobs disabled server-side.

**Screenshot discipline**
- For every PR that changes UI layout: automated capture of core pages (Chat, GitHub, Workspaces, Scheduler, Budget, Settings) at two sizes:
  - Desktop baseline
  - 7" scale (simulated viewport + increased UI scale)
- Store in `buildlog/` with timestamp + git SHA; include in changelog.

### Roadmap and acceptance tests

#### Sprint goals
Keep the next phase to three sprints, each 5–8 deliverables, each with acceptance tests.

##### Sprint focus: Viewing + scheduling foundations
1) **File viewer system (PDF/CSV/Raw)**
   - PDF renders in-app via PDF.js for cached remote PDFs; “Open externally” fallback works. citeturn1search0turn1search4turn1search1turn15search15  
   **Acceptance:** Opening a `.pdf` shows pages (not raw bytes); switching to external viewer opens OS default app.
2) **CSV Table view (virtualised)**
   - “Table” view supports sort/filter at least per-column; virtualisation prevents UI lockups on large CSVs. citeturn14search3turn14search0  
   **Acceptance:** 50k-row CSV scrolls smoothly; user can toggle Raw/Table.
3) **Scheduler agenda-first UI**
   - Today/Next 7 days list + month navigation overlay; big touch targets. citeturn4search0turn11search1turn11search3  
   **Acceptance:** User creates a one-shot reminder in <30 seconds without using month grid.
4) **Cron integration upgrade**
   - Scheduler uses OpenClaw cron payload mapping:
     - Reminder → systemEvent
     - Agent Run → agentTurn citeturn17view0  
   **Acceptance:** Creating each job type results in correct payload kind and appears in `cron.list`.
5) **Structured logging**
   - Enable log plugin; forward console; write to file with rotation. citeturn6search0turn6search2  
   **Acceptance:** A log file exists after a run; rotation happens at configured size.

##### Sprint focus: Curated Control UI surfaces
1) **OpenClaw WS operator client (first-class)**
   - Implement connect handshake with signed nonce, scoped operator role. citeturn16view0  
   **Acceptance:** App reconnects successfully after restart using persisted device token.
2) **Usage & costs panel**
   - Show per-session usage snapshot + local cost summary surfaces. citeturn9search7turn9search9turn9search5  
   **Acceptance:** “Budget” page displays last-response tokens and cost when API-key pricing exists.
3) **Sessions mini-admin**
   - List sessions, patch thinking/verbose overrides. citeturn8view0turn9search11  
   **Acceptance:** Changing thinking level updates session behaviour (confirmed by subsequent reply metadata).
4) **Skills toggles (curated)**
   - Show enabled state + required env keys; safe enable/disable flows. citeturn10search7turn10search11  
   **Acceptance:** Disabling a skill updates config and requires explicit Apply/Restart if needed.
5) **Channels status (minimal)**
   - Show channel status and provide “go to advanced” (open Control UI in browser over tunnel). citeturn8view0turn7search1turn7search15  
   **Acceptance:** Channel status loads; external Control UI opens via safe URL/open rules.

##### Sprint focus: Safety firewall + quality gates
1) **Budget + Overnight gate enforcement**
   - Central action firewall; blocks autonomy actions UI-side and disables `agentTurn` cron jobs server-side. citeturn17view0turn9search0  
   **Acceptance:** When Overnight Mode ON, `agentTurn` jobs become disabled and do not execute; `systemEvent` reminders still execute.
2) **Diff-first everywhere**
   - Any AI-proposed write is rendered as diff; apply is explicit; audit log records action.  
   **Acceptance:** No backend file write happens until user clicks Apply and confirms.
3) **Secure secret storage**
   - Move gateway tokens/device keys into Stronghold; no plaintext persistence. citeturn5search0turn7search1turn16view0  
   **Acceptance:** Clearing app localStorage does not break auth; secrets remain protected.
4) **E2E test harness**
   - WebDriver-based smoke suite + screenshots per release. citeturn6search1turn6search3  
   **Acceptance:** CI runs smoke suite on Windows runner; produces artefacts (logs + screenshots).
5) **Config safety**
   - Schema-driven config edits with explicit apply/restart and clobber guard. citeturn8view0turn10search13  
   **Acceptance:** Invalid config edits are blocked client-side; gateway remains bootable.

This roadmap keeps Glitch UI minimal while still capturing the highest-value capabilities already proven in OpenClaw’s Control UI (sessions, cron, skills, config, logs), and wraps them in stricter user-facing safety guarantees. citeturn8view0turn16view0turn18search2
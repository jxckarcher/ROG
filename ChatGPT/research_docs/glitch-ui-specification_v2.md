# Glitch UI v2 Spec Research — OS-like UX + ControlUI parity map

This memo specifies **Glitch UI v2** as a minimal “Git/Docs OS” that still reaches “ControlUI-grade” capability where it matters (models/auth, usage, sessions, cron, skills) without turning into a config labyrinth. It is written to be implementation-ready for a **Tauri v2 + React + Zustand** desktop client controlling an **OpenClaw gateway on a VPS** over SSH + tunneled WebSocket.

A note on inputs: in the connected `jxckarcher/ROG` repo I could retrieve a historical progress memo and an older `store.js`, but the specific files named `glitch-ui-specification_v1.md`, `docs/BUILDLOG.md`, `docs/DECISIONS.md`, and `SPRUNTS.md` were not discoverable via the available repo search/fetch surface during this run. Where repo history is missing, I anchor requirements to the **current UI screenshots you supplied** plus primary vendor docs for OpenClaw/Tauri/WebView2. fileciteturn25file23L1-L1

## North star and non‑negotiables

Glitch v2 is a **continuity-first desktop control surface** for remote-coded projects. The win condition is: you can close the app Friday night, open it Saturday morning, and you’re instantly back in the same repo, branch, workspace, file, diff state, and chat context with clear budgets and safe controls.

The **non‑negotiables** stay hard rules and must be enforced in both UX and data flow:

No silent writes: any AI change must land as a **diff** first and requires explicit apply, never directly writing to disk from an agent response. This aligns with the risk model implied by Tauri’s security posture (tight CSP, avoid untrusted remote content) and with OpenClaw’s guidance that the gateway is the source of truth and should be queried explicitly rather than guessed from side effects. citeturn4search0turn1search1

No auto-clone / no auto-push: cloning and pushing are always user-triggered, always named, always confirmed.

Budget + overnight mode must hard-block autonomy: OpenClaw’s cron and sessions can run “for real” and persist; the UI must make “autonomy allowed” a visible state with explicit gating. Cron is persistent and runs inside the gateway process, which means a mis-click can create durable background execution; the UI’s duty is to put guardrails around this power. citeturn7search0turn7search3

No destructive operations without confirmation: delete, rename, cron removal, and config writes require a confirm step and should be reversible where possible.

Personas:

Jack solo operator: moves fast, wants keyboard-first, but needs safe rails (diff-first, budget-first).

Future multi-user with permissions: read-only viewers vs operators; a path to role-based gates is needed, even if v2 keeps it simple.

## Design system spec

The visual north star is “Windows 11 Settings meets glassy dashboards”: calm typography, strong hierarchy, soft surfaces, neon only as accent, and **materials** used intentionally.

The Fluent 2 system explicitly defines material surfaces like **acrylic** (frosted glass) for transient surfaces and recommends using acrylic sparingly (avoid large acrylic backgrounds; avoid placing accent-coloured text on acrylic; avoid adjacent acrylic panes that create seams). citeturn3search0turn3search6

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["Windows 11 Settings app left navigation layout","Fluent Design acrylic material UI example","dark glassmorphism dashboard UI"],"num_per_query":1}

### Tokens

Tokens should be implemented as CSS variables (or a TS token object) and should map to your existing theme/accent/shape settings.

Colour and material tokens:

Surface base: a near-black neutral (for OLED-like contrast) with subtle elevation steps.

Acrylic surfaces: use blur + translucency but apply only to **transient** surfaces (drawers, menus, context popovers) consistent with acrylic guidance. citeturn3search6

Borders: thin 1px borders with low alpha to define panels without heavy outlines.

Text: high-contrast primary; secondary text subdued, never neon by default.

Accent: one accent colour at a time; accent used for “current selection”, primary action, and “live state”.

Spacing scale:

Use a 4px base grid: 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48.

For 7" readability, default paddings should be 12–16, and panel gutters 16–24.

Corner radii scale:

Default: 10–12 for cards/panels, 8 for inputs, 16 for larger containers, and “pill mode” at 999.

Shadows and elevation:

One soft shadow level for raised overlays; avoid harsh shadows. Emphasise separation via material + border instead of shadow stacking.

Blur usage:

Blur is reserved: drawers, popovers, pinned “inspector” side panels. If blur is not stable/perf-friendly on a given platform, fall back to solid with border (Fluent 2’s material selection explicitly asks you to check technical limitations before committing to a material). citeturn3search0

Typography scale:

Base (body): 14–15

Section header: 16–18

Page title: 22–26

Code/mono: 13–14, line height ~1.45

### Component library and anatomy

Everything in v2 should build from a small kit of primitives so the app feels like an OS, not a pile of bespoke panels.

Core primitives:

Panel: the basic surface container with header, optional toolbar row, body, footer.

PanelHeader: title, subtitle/status line, right-slot actions, optional breadcrumb.

Drawer: right-side drawer for contextual chat/inspect/config; must support “pin” and “detach to window later” (later).

Card: a smaller surface; used for settings groups, job summaries, session summaries.

Toolbar: row with search, filters, “primary action” and 1–2 contextual actions.

Chip: small tag for branch, repo, context, “live/ssh/budget”.

Table/List: virtualised list for repos, files, sessions, jobs. Must support row actions without clutter.

DiffReviewPane: the critical component for safe AI edits; see flows.

Touch-first and accessibility:

Windows touch guidance recommends comfortable hit targets and calls out **44×44** for touch-optimised UI, with spacing between targets. citeturn9search4turn9search7  
For the Ally, treat all primary actions, toggles, and row action buttons as touch-optimised.

Also account for on-screen keyboard taking large screen space on smaller devices: when a text field is focused, ensure it doesn’t get obscured; scroll/shift content as needed. citeturn9search4

## Information architecture and navigation model

v2 should clearly separate: **where you are** (a “place” like GitHub/Workspaces/Scheduler) from **what you’re doing** (chatting, reviewing a diff, editing config, inspecting a session).

Top-level tabs should remain:

Chat, GitHub, Workspaces, Scheduler, Memory, Budget, Settings.

System tools (still in main nav but visually separated):

Terminal, Connection, Lock.

This mirrors the current left-rail split you already show and keeps the OS-like feel.

### Settings internal nav

Settings should become a “mini Settings app” with a search-first layout: left column category list + right content. This is consistent with the Windows Settings mental model and reduces hunting.

Recommended Settings categories:

Appearance: theme mode, accent, shape, UI scale.

Models and profiles: the curated model selection and provider/auth.

Budget and autonomy: hourly/daily caps, overnight mode, per-project budgets.

Security: secrets handling, confirmation behaviour, “danger zone” toggles (never default on).

Storage and paths: VPS repo root convention, workspace root, cache, logs.

Developer: mock mode, Playwright hooks, build metadata, diagnostics export.

### Global chat vs contextual chat

Glitch needs three “chat modes” that share one underlying transcript model but appear differently:

Global Chat: general “operator” chat.

Context Chat: bound to a repo/file/workspace selection (GitHub Ask drawer, Workspaces chat panel). Context is explicit and visible via chips.

Job Chat: bound to an overnight run or cron run where outputs stream into a run log and can be resumed.

This structure is important because OpenClaw supports routing and session stickiness; you want the UI to treat “session context” as a first-class object rather than mixing everything into one transcript. citeturn1search1turn1search6

## State model and durable continuity

The state model needs to support “resume yesterday” as a first-class capability, and it must do so without secret leakage and without silently drifting from server truth.

### Source of truth hierarchy

Gateway truth: OpenClaw’s docs are explicit that **the gateway is the source of truth** for session lists and token counts; UI clients should query the gateway rather than reconstructing totals from transcripts. citeturn1search1

Client truth: the UI stores layout and navigation state (selected tab, expanded panels, open workspace, scroll positions, last opened files).

Hybrid truth: project metadata (repo list cache, last opened timestamp, pinned workspaces) is locally persisted but must reconcile with VPS state on reconnect.

### Proposed Zustand shape

Move from a monolithic store to slice-based stores with clear boundaries and persisted subtrees.

Suggested top-level slices:

`connection`: sshConnected, tunnelConnected, wsConnected, lastError, reconnectBackoff, “capabilities” fetched from gateway.

`nav`: activeRoute, lastRoutesPerTab, split sizes, drawer open/pinned, focus mode.

`projects`: repoIndex, repoFilters, repoMetadata, cloneQueue, “repoRootConvention”.

`githubBrowser`: selection state (repo/branch/path), filePreview state, “Ask drawer” context pack.

`workspaces`: openedWorkspaces[], each with: workspaceId, repoRef, rootPath, openFiles[], activeFileId, dirty state, diff sessions, staged changes.

`scheduler`: jobsIndex, agenda view model, cron jobs, run history caches, job editor drafts.

`budget`: gates, caps, current usage snapshot, per-project budgets, overnight hard lock.

`settings`: appearance tokens, model profiles, permissions, toggles.

The critical shift: workspaces and scheduler need IDs and persisted states that survive app restarts and reconnects.

### Durable sessions model

Define an explicit `SessionRef` type in the UI:

`{ agentId, sessionId, sessionKey?, channel?, displayName?, startedAt, updatedAt, inputTokens, outputTokens, totalTokens }`

OpenClaw stores sessions in a gateway-managed sessions store with token count fields like `inputTokens`, `outputTokens`, and `totalTokens`. citeturn1search1  
v2 should show these fields directly and never “guess” cost by parsing JSONL unless explicitly in an “advanced / forensic” mode.

Resume yesterday should restore:

Last active repo + branch

Last open workspace(s)

Last open file tabs + cursor positions

Last diff review state (pending hunks, un-applied patches)

Associated chat session (global + context chat)

Budget state (overnight on/off, caps, remaining)

## ControlUI parity map

The guiding principle: replicate the **outcomes** of ControlUI, not its entire configuration surface. The minimal UI should expose a curated subset of high-value controls, with advanced details in drawers.

OpenClaw already exposes powerful primitives in chat and CLI: `/model` and `/model status` for model selection and provider details; `/usage` and CLI `openclaw status --usage` for usage surfaces; sessions are stored with timestamps and token counts; cron is persisted with job history; skills can be installed via ClawHub and loaded from workspace/shared directories. citeturn1search0turn1search1turn1search2turn7search0turn8search0turn8search1

### Parity decisions

| ControlUI category | v2 priority | “Simple UI” equivalent | Anti-clutter strategy |
|---|---|---|---|
| Config (models/auth/profiles) | Must | “Models & Profiles” settings page + “Session Model” quick switch | Default view is 3 profiles (Chat / Workspaces / Autonomy). Advanced drawer shows provider endpoint + profile ID. |
| Usage (cost/tokens) | Must | Budget tab with Usage dashboard + per-session breakdown | Default is “Today / Week / Month” and “Top sessions / projects”. Advanced shows raw `openclaw status --usage`. |
| Sessions | Must | Sessions list (search, pin, resume) + per-session details (tokens, timestamps) | Default shows recent sessions. Advanced shows channel metadata and raw session key. |
| Cron Jobs | Must | Scheduler “Diary” + Cron subpage | Default is agenda-first diary. Cron list is secondary. Editing requires explicit confirm. |
| Skills / Plugins | Should | Curated skills page: installed list, enable/disable, provenance | Default is “safe curated pack”. Advanced “Install from ClawHub” requires review step and warnings. |
| Channels | Later | Basic channel status + route indicator | Default shows “current route” and health checks; advanced per-channel config later. |

### Model switching and auth profiles

OpenClaw’s `/model` command supports listing, selecting numbered entries, selecting by provider/model, and showing `/model status` with configured endpoint and API mode. citeturn1search0

It also supports per-session routing to specific auth profiles like `Opus@anthropic:work`, and OpenClaw pins the chosen auth profile per session for cache friendliness (session stickiness). citeturn1search7turn1search6

v2 should implement:

Global profile defaults: Chat / Workspaces / Autonomy dropdowns (as you already show).

Session-level override: in any chat/workspace/session header, a “Session Model” chip opens a quick picker:

Change model family/provider.

Optional “use profile” selector (only showing non-secret profile IDs, not tokens).

A “What will change?” preview panel: model, provider, profileId, cost visibility expectations.

Important: config writes are dangerous. OpenClaw’s `/config` surface persists to disk and is owner-only with an explicit gate (`commands.config: true`). v2 must treat anything that writes to disk as a reviewed operation. citeturn1search0

### Skills and security posture

OpenClaw’s skills system loads from workspace skills and shared skills directories, and ClawHub is a public registry that installs skills into `./skills` by default. citeturn8search0turn8search1

Given recent reporting that malicious skills have been distributed via public skill marketplaces, v2 must treat “install skill” as equivalent to installing untrusted code: default off, provenance visible, and a review step required. citeturn8news48turn8news50

The minimal, safe approach:

Default to “built-in / vetted” skill pack (shipped with the app or installed manually by you).

If enabling external skills: require displaying the skill files, require user confirmation, and never silently overwrite local skill files (align with ClawHub’s own behaviour where it prompts before overwriting or requires `--force` in non-interactive scenarios). citeturn8search1

## Core UX flows

These flows are written at “wire-level”: the steps should map directly to screens/components and are designed to preserve the non‑negotiables.

### Open repo to diff to apply to push

Entry: GitHub tab.

Select repo (left list) → select branch (top dropdown) → browse files (middle list) → preview (right pane).

Ask AI:

Click “Ask” opens a right drawer (“Context Chat”).

Drawer shows context chips: repo, branch, file path, optional selection/range.

User sends message; responses stream into bubbles.

Diff-first result:

The agent response that includes changes must be captured as a “Proposed Change Set” object: `ChangeSet { id, createdAt, scope, files[], rationale, warnings }`.

Each file entry has: original content hash, proposed content or patch, and a preview diff.

Review + apply:

Click “Review” opens DiffReviewPane (modal or full-page within Workspaces).

DiffReviewPane supports hunk-level toggles. This mirrors the established review workflow patterns seen in code review tools where you review file by file and mark progress; GitHub review UX explicitly supports reviewing file-by-file and even generating suggestion blocks as discrete changes. citeturn5search0

Apply writes are explicit:

“Apply selected hunks” button triggers:

summary panel: number of files, hunks, insertions/deletions

explicit confirm: “Write changes to disk”

only then, file writes occur.

Commit + push:

After apply, workspace shows “Git status panel” with staged/unstaged.

Commit button opens a “Push confirmation” modal with:

diff stat

branch name

remote name

explicit confirm: “Push now”

No auto-push. No auto-clone.

### Schedule overnight task with £ cap

Entry: Scheduler tab.

Create job:

User chooses “Overnight Project” (new standard).

Wizard:

Name + description

Target repo/workspace

Budget cap (£) + max wall clock + max turns

Delivery: where should output go (in-app run log, optional channel announce)

Hard gate step:

If Overnight Mode is enabled (the “block autonomy” mode), the wizard must refuse to arm the job and explain why (“Overnight Mode blocks autonomous tasks”). This matches the requirement to hard-block autonomy and it aligns with OpenClaw’s cron persistence: you must not create durable background work in a locked state. citeturn7search0

Schedule mechanism:

Where possible, implement via OpenClaw cron primitives (cron inside gateway, stored jobs, run history JSONL). citeturn7search0turn7search2

The “job type” should map to OpenClaw’s two cron execution styles:

Main session: enqueue a system event and run next heartbeat.

Isolated: run a dedicated agent turn in `cron:<jobId>` with delivery control. citeturn7search0

Monitor:

Budget tab shows “Active run” with:

tokens so far / estimated cost

turn count

time elapsed

Stop / Pause buttons

Stop behaviour:

Stop must be explicit and should call the most reliable available stop primitive (gateway stop, cron disable, or session abort), never a best-effort silent action.

### Switch model or profile for a session

Entry: Any chat/workspace header has “Session Model” chip.

Chip click opens quick picker:

Model family list

Provider list

Profile list (if available)

Preview panel uses `/model status` mental model: show endpoint (`baseUrl`) and API mode if available. citeturn1search0

Apply requires confirm:

“Switch model for this session” confirm.

A “revert” option is kept in the session’s history (not a rollback of effects, but a fast switch back).

### Resume yesterday’s work

Entry: Home state on launch.

v2 must show a “Resume” section (like an OS task switcher):

Last session card: last repo/workspace/file + last chat excerpt + last budget state.

Pinned workspaces card list.

Recent sessions list powered by gateway session store (timestamps + token counts). citeturn1search1

Resume action restores:

Navigation route

Workspace layout and opened files

Right drawer state (pinned/unpinned chat)

Pending diffs and unapplied change sets (these must never auto-apply).

## Reliability, safety, and the “viewer problem”

You explicitly called out PDF viewing and CSV rendering reliability in Tauri/WebView2. v2 should treat “document rendering” as a **capability with explicit fallbacks**, not a best-effort browser behaviour.

### PDFs in WebView2 and Tauri constraints

WebView2’s PDF experience is changing and can be controlled by policy for WebView2 apps (NewPDFReaderWebView2List). citeturn2search5turn2search3  
In practice, this means PDF rendering behaviour may differ across environments, and relying on the embedded runtime’s built-in viewer is fragile.

Recommendation:

Primary: render PDFs with a bundled renderer (for example, a JS renderer) inside the app so behaviour is predictable.

Fallback: if rendering fails, show:

download/open externally (explicit user action)

raw text hex/metadata view (what you’re currently seeing in the workspace screenshot)

Viewer pipeline for local files:

Use Tauri’s asset protocol for loading local files into the webview instead of `file://` URLs. Tauri requires enabling the asset protocol and scoping it, and it requires CSP entries for `asset:` and `http://asset.localhost`. citeturn4search1turn4search4turn4search0

CSP must be explicit and minimal; Tauri’s CSP guidance emphasises restricting to trusted sources and notes that WASM/frontends may require `'wasm-unsafe-eval'`. citeturn4search0

### CSV tables

CSV is less about “viewer tech” and more about UX:

Default view: table grid with:

column inference

sticky header

search within table

copy cell/row

Schema view: infer types and show summary.

Fallback: raw text view.

Make table rendering deterministic (don’t rely on browser file sniffing). Use the same asset protocol pipeline.

### Config exposure without leaks

OpenClaw supports disk config writes via `/config`, but this is owner-only and requires explicit enable flags. citeturn1search0

v2 should implement:

View raw config: always safe, but secrets redacted by default.

Edit config: opens DiffReviewPane against current config.

Apply writes require:

explicit confirm: “Write config to gateway disk”

optional “restart required” banner if applicable

A “show secrets” toggle should require re-auth (PIN) and should time out.

### Skill/plugin safety model

Because skills can be installed into workspace/shared folders and can teach the agent to execute tools, “skill enable” must be treated as an elevated permission change. citeturn8search0turn8search1  
Given recent reports of malicious skills distributed through public registries, implement provenance and warnings as default UI, not advanced UI. citeturn8news48turn8news50

## Sprint plan and acceptance tests

The roadmap is biased toward your stated priority: **agenda-first scheduler + persistence** because it changes daily usability more than viewer polish.

### Sprint focus

Sprint 1 should lock the OS frame and continuity model.

Sprint 2 should ship diary-grade scheduling + budgets.

Sprint 3 should close the loop on ControlUI parity (sessions/usage/config/skills) and harden viewers.

### Sprint one

Deliverable: “OS shell + continuity backbone”.

Items:

Navigation and layout system: left rail + content canvas + global status bar + universal drawer.  
Acceptance: on resize, drawer behaves predictably; per-tab last state restored; touch targets meet 44×44 for primary controls. citeturn9search4turn9search7

Session-aware state model: introduce `SessionRef`, persist resume state, restore last workspace and chat context on launch.  
Acceptance: after app restart, “Resume yesterday” restores open workspace and last active file without auto-applying any changes. citeturn1search1

DiffReviewPane v2: unified diff review component used for “AI edits”, “config edits”, and “file ops previews”.  
Acceptance: any AI-proposed changes appear as a diff; apply requires explicit confirm; cancel leaves disk untouched.

Repo/workspace path convention: define and enforce a canonical VPS layout (`/root/workspaces/<org>/<repo>` or similar) with migration helper that only acts on explicit user request.  
Acceptance: UI always displays full path; “Open in Workspace” resolves deterministically; no silent moves.

Risks:

Without repo docs, there’s risk of re-implementing patterns that already exist in your internal sprint history; mitigate by making v2 additive and migrating components gradually.

### Sprint two

Deliverable: “Diary scheduler + budgets that actually gate”.

Items:

Agenda-first diary: default view is a chronological agenda list (Today / Next 7 days / All upcoming), with month view secondary. Use Windows date/time control guidance for picking dates/times in a way that supports keyboard/mouse/touch. citeturn6search0turn6search1  
Acceptance: create, edit, clone, enable/disable, delete jobs with confirm; jobs appear in agenda; items are tappable at 7" scale.

Cron integration hardening: build against OpenClaw cron jobs primitives and run history (`openclaw cron runs --id`, job storage and history paths). citeturn7search0turn7search2  
Acceptance: UI shows job next/last/run status; “Run now” works; run history is visible; delete requires confirm.

Budget v2: per-task caps + per-project caps + visible gate reasons. Use OpenClaw usage surfaces (`/usage cost`, `/status`, CLI `openclaw status --usage`) as the primary truth surfaces. citeturn1search0turn1search2turn1search4  
Acceptance: exceeding cap blocks new autonomy runs; user sees banner explaining block; manual “chat send” can be configured to block too.

Risks:

Cost estimation depends on pricing config; OpenClaw shows tokens only if pricing missing or OAuth hides dollar cost. v2 must handle “tokens-only” gracefully. citeturn1search2

### Sprint three

Deliverable: “ControlUI-grade minimal config + viewer reliability”.

Items:

Models/auth UI: session model picker, profile routing, “model status” view; safe diff-first config edits. citeturn1search0turn1search7turn1search6  
Acceptance: switching model updates the active session; config edits require review/apply; secrets redacted by default.

Sessions page: recent sessions backed by gateway store, with per-session tokens and timestamps. citeturn1search1  
Acceptance: sessions list loads; selecting session shows details; resuming session restores context without side effects.

Skills page (curated): installed list, enable/disable, provenance, import/export; external install requires review step and explicit confirm. citeturn8search0turn8search1turn8news48  
Acceptance: enabling a skill requires confirm and shows what tools it enables; disabling removes from active load set after restart.

Viewer reliability pass: PDF/CSV pipeline with asset protocol + CSP tuned; policy-aware WebView2 PDF fallback. citeturn4search1turn4search4turn4search0turn2search5turn2search3  
Acceptance: PDFs render reliably or fall back with explicit choices; CSVs render as tables; no “random raw binary in editor” except in explicit raw mode.

Risks:

Tauri CSP and asset protocol scoping are easy to misconfigure; build fails/403s are common when the scope is wrong. Bake a “diagnostics panel” that checks CSP + asset protocol enable + scope at runtime and reports actionable errors. citeturn4search0turn4search4turn4search6
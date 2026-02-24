````md
# Memo for Claude Code — “Glitch” Custom UI (ROG Ally) + OpenClaw Setup

## 0) Goal (what we’re building)
Jack wants a **beautiful, modular, future-proof control panel** for “Glitch” (OpenClaw bot) on a **ROG Ally (Windows)**:

Must-have:
- **Chat** with Glitch (fast, dead simple, minimal friction)
- **Scheduled tasks**: create/list/disable/delete, with reliable Telegram delivery
- **Autonomous tasks**: safe “run this project overnight” / “monitor X” flows with guardrails
- **Budget monitoring + guardrails** (esp. overnight/autonomy spending)
- **Built-in VPS terminal/CLI** to manage configs, plugins, keys, etc.

Nice-to-have (Phase 2+):
- Voice chat (STT/TTS)
- GitHub browsing + collab workflow
- Modular plugin-like growth over time
- macOS/Cyberpunk-ish UX: clean, minimal, futuristic, **theme/color customizable**

---

## 1) Current live backend (Glitch / OpenClaw)
### Server
- VPS: Hetzner Ubuntu 24.04
- Hostname: `glitch-bot-server`
- Public IP: `46.225.76.215`

### OpenClaw
- OpenClaw CLI version: **2026.2.23**
- Gateway: **loopback-only** `127.0.0.1:18789` (NOT publicly exposed)
- Systemd service: **user service** `openclaw-gateway.service`
- Heartbeat: **disabled**
- Telegram channel: **working**
- Model currently: OpenRouter `anthropic/claude-3.5-haiku` (cheap; ok for chat, not ideal for tool/autonomy safety)

### Key paths
- Config: `/root/.openclaw/openclaw.json`
- Workspace: `/root/.openclaw/workspace/`
- Memory (local files): `/root/.openclaw/workspace/memory/`
- Secrets: `/root/.openclaw/secrets.env` (currently GH_TOKEN only)

### Important behavior we fixed
- “Reminders” must **NOT** use `wall`/terminal broadcast.
- Reliable Telegram reminders work via OpenClaw cron with:
  - `--at <ISO timestamp>` (this build rejects `+2m` style)
  - `--announce --channel telegram --to <chatId> --expect-final`

---

## 2) How to access + operate the VPS (canonical commands)
### SSH (from Jack’s PC/ROG Ally)
```bash
ssh root@46.225.76.215
````

### Control UI access (keep gateway private)

From Windows (NOT from inside the VPS):

```powershell
ssh -N -L 18789:127.0.0.1:18789 root@46.225.76.215
```

Then open:

* `http://localhost:18789/`

### Service control

```bash
loginctl enable-linger root
systemctl --user restart openclaw-gateway.service
systemctl --user status openclaw-gateway.service --no-pager
openclaw status
openclaw logs --follow
```

### Telegram send test (works)

```bash
openclaw message send --channel telegram --target 7117966167 --message "PING_FROM_CLI"
```

---

## 3) “Local memory files” (no API keys, no embeddings cost)

We intentionally avoided paid memory providers. Memory is **file-based** + local search tools.

### Files

* Daily logs: `/root/.openclaw/workspace/memory/YYYY-MM-DD.md`
* Snapshot: `/root/.openclaw/workspace/MEMORY.md`
* Reference: `/root/.openclaw/workspace/memory/rules.md`, `/root/.openclaw/workspace/memory/projects.md`

### Helper scripts (already installed)

#### Append-only memory logging

* Script: `/usr/local/bin/glitchlog`
* Usage:

```bash
glitchlog "What happened. Decision. Next action. Blocker (if any)."
```

#### Local search (ripgrep/grep fallback)

* Script: `/usr/local/bin/memsearch`
* Usage:

```bash
memsearch "keyword"
```

#### Peek context around a hit

* Script: `/usr/local/bin/mempeek`
* Usage:

```bash
mempeek /root/.openclaw/workspace/memory/2026-02-24.md 12
```

### Note

OpenClaw `memory search` currently shows `Provider: none`, indexes `0 chunks`. We’re not relying on it right now. The UI should treat `MEMORY.md + memory/*.md + memsearch` as the “real” memory system.

---

## 4) Scheduling / reminders — the correct reliable approach

### OpenClaw cron “at” requires ISO timestamps

Example (works):

```bash
AT="$(date -d 'now + 2 minutes' -Is)"
openclaw cron add \
  --name "tg-test-ok" \
  --at "$AT" \
  --message "Reply with exactly: TEST_OK" \
  --announce \
  --channel telegram \
  --to 7117966167 \
  --expect-final \
  --delete-after-run
```

### Safer: use helper wrapper (prevents format mistakes)

We installed:

* Script: `/usr/local/bin/tgremind`

Usage:

```bash
tgremind 20m "TEXT"
tgremind 2h "TEXT"
tgremind 1d "TEXT"
```

This converts `2m/2h/1d` to ISO internally + schedules via cron announce to Telegram.

### Existing cron jobs

`openclaw cron list` shows several older recurring jobs (some duplicates). They were “skipped” previously. UI should:

* list all cron jobs clearly
* allow disable/delete
* highlight duplicates
* show next run + last run + status

---

## 5) Glitch persona rules (SOUL.md)

SOUL.md includes hard rules:

* No narration, results only
* No destructive commands without approval
* Local memory must use `glitchlog` + `memsearch`
* Reminders must use `tgremind` (not exec/wall/sleep)

File:

* `/root/.openclaw/workspace/SOUL.md`

---

## 6) UI architecture recommendation (efficient + modular)

### Core recommendation: build in phases

#### Phase 1 (fast MVP, lowest risk) — “Wrapper + Power Panels”

* Tauri app (Windows) on ROG Ally
* Automatically:

  1. starts SSH tunnel to the VPS (localhost:18789 -> 127.0.0.1:18789)
  2. embeds the existing OpenClaw Control UI in a WebView tab
* Adds native “Power Panels”:

  * Restart gateway
  * Tail logs
  * Cron list/add (using `tgremind`)
  * Memory viewer (daily files)
  * Budget panel (manual caps + “overnight mode” toggles)
  * Terminal panel (SSH inside app)

This avoids relying on undocumented gateway APIs early and still delivers a slick experience.

#### Phase 2 (deeper, more custom) — “API Client + Native Views”

* Reverse-engineer or formalize OpenClaw gateway API calls:

  * Inspect Control UI network calls
  * Or read gateway routes in OpenClaw node module
* Replace embedded UI with native tabs:

  * chat sessions
  * cron manager
  * approvals queue
  * memory browser/search

#### Phase 3 (secure remote access)

* Add Tailscale (preferred) to avoid exposing ports.
* Optional: remote access over Tailscale SSH + allowlists.

---

## 7) Proposed modular structure (frontend)

Use “modules” that can evolve independently:

* **Core**: app shell, routing, theme engine, settings store, auth/keychain
* **Connection**: SSH tunnel manager, health checks (port open, status)
* **Chat**: UI for speaking to Glitch (and optionally Telegram sync)
* **Scheduler**: cron list/create/disable/delete, templates, “overnight mode”
* **Autonomy**: safe “project runs” with approvals + explicit scopes
* **Budget**: caps, warnings, usage history, “overnight guardrails”
* **Memory**: file browser, search, “append entry”, show MEMORY.md
* **Terminal**: embedded terminal (xterm.js) over SSH
* **Projects/GitHub** (Phase 2): repo list, issues/PRs, basic file viewer

Suggested repo layout:

```
rog-glitch-ui/
  src/
    core/
    modules/
      connection/
      chat/
      scheduler/
      autonomy/
      budget/
      memory/
      terminal/
      github/
    ui/
      components/
      theme/
      icons/
  src-tauri/
```

State management:

* keep it simple (Zustand or Redux Toolkit)
* strict service boundary: UI components never run SSH directly; they call services.

---

## 8) Backend integration strategy (pragmatic + safe)

### Primary integration methods

1. **SSH tunnel** for Control UI (keeps gateway private)
2. **SSH command runner** for actions:

   * `openclaw status`
   * `openclaw cron list`
   * `tgremind ...`
   * `systemctl --user restart openclaw-gateway.service`
   * `openclaw logs --follow`
   * `memsearch ...`
   * `glitchlog ...`

This approach is stable even if gateway internals shift.

### Built-in terminal implementation options

* Easiest: embed xterm.js, connect to an SSH session via:

  * Rust SSH (e.g., `russh`) or
  * spawn `ssh.exe` and proxy stdin/stdout (works, but requires careful PTY handling)
* Acceptable MVP alternative: “Open terminal” button that launches Windows Terminal prefilled with `ssh root@...` (not fully “built-in”, but cheap + robust)

---

## 9) Budgeting guardrails (minimizing spend)

We previously saw spend drain from background wakeups. Guardrails should include:

* “Overnight mode” toggle:

  * disables/blocks autonomy jobs unless explicitly approved
  * schedules only deterministic cron messages (not open-ended agent tasks)
* Hard caps at provider level (OpenRouter dashboard)
* UI-level budgeting:

  * show tokens per session from `openclaw sessions --json` (when available)
  * show last 24h job runs + message counts
  * optional: integrate OpenRouter usage API later (requires additional key)

Model strategy:

* cheap model for chat
* stronger model for tools/autonomy only (set per cron/agent job, not global)

---

## 10) UX direction (macOS + Cyberpunk)

* Glassy panels, soft blur, clean typography, minimal noise
* “Cyberpunk accent” via neon highlight + subtle grid/scanline textures (optional)
* Color customization:

  * CSS variables for accent, background, glass tint, danger/warn colors
  * theme presets + custom picker
* Controller-friendly:

  * large hit targets
  * focus states for D-pad navigation
  * quick radial menu for common actions

---

## 11) Acceptance criteria (MVP)

MVP is “done” when:

* App opens on ROG Ally and connects with 1 click
* Tunnel auto-start + Control UI loads
* Chat tab can message Glitch (either via embedded UI or Telegram bridge)
* Scheduler can:

  * list cron jobs
  * create a one-shot reminder via `tgremind 2m "TEXT"`
  * disable/delete a job
* Budget tab has:

  * “Overnight mode” with clear guardrails
  * clear warnings when automation is enabled
* Terminal tab provides a usable SSH shell (or launches terminal as fallback)
* Memory tab:

  * shows MEMORY.md + daily logs
  * search via memsearch
  * append entry via glitchlog

---

## 12) Handy commands for UI buttons (copy/paste)

Health:

```bash
openclaw status
systemctl --user status openclaw-gateway.service --no-pager
ss -lntp | grep ':18789'
```

Logs:

```bash
openclaw logs --follow
journalctl --user -u openclaw-gateway.service -n 200 --no-pager
```

Cron:

```bash
openclaw cron list
tgremind 20m "TEXT"
openclaw cron delete --help
openclaw cron disable --help
```

Memory:

```bash
glitchlog "entry..."
memsearch "keyword"
```

Telegram direct send:

```bash
openclaw message send --channel telegram --target 7117966167 --message "TEXT"
```

---

## 13) Notes / gotchas

* `openclaw cron add --at` rejects `+2m`. Use ISO timestamps or `tgremind`.
* Keep gateway loopback-only. Don’t expose 18789 publicly.
* OpenClaw memory indexing currently doesn’t chunk without a provider; stick to file + search.
* Existing cron jobs include duplicates; UI should help clean them.

---

End.

```
::contentReference[oaicite:0]{index=0}
```

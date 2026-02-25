# Glitch UI v0.3 — Sprint 3 Research Memo
**Date:** 24 Feb 2026
**Author:** Jack Archer
**For:** ChatGPT — architecture research + direction

---

## Context

Glitch UI is a Tauri 2 (Rust + React + Zustand) desktop app on Windows/ROG Ally that controls the **OpenClaw** AI assistant running on a Hetzner VPS (Ubuntu 24.04). OpenClaw communicates over a local WebSocket at `127.0.0.1:18789` via SSH tunnel.

Sprints 1 and 2 are complete:
- Chat (WS streaming), GitHub panel (3-pane browser), Terminal (xterm.js), Agents, Scheduler, Budget, Memory, Settings
- UI Scale, Lockscreen (PIN), Workspaces (Monaco + VPS explorer + mini chat), GitHub polish (recent repos, file filter)

---

## Sprint 3 Research Areas

### 1. Collaborative Repo Editing (Highest Priority)

**Vision:** Jack (with Claude Code on laptop), Glitch (on VPS), and the repo should all be in sync. When working on a file together:
- Jack edits in Workspaces panel (Monaco editor, file served over SSH from VPS)
- Glitch can see the current file content in context
- Glitch can suggest edits / write changes back to the same VPS file
- Both can work on files from any GitHub repo (already cloned to VPS at `/root/repos/<repo>`)

**Questions for ChatGPT:**
1. What's the best UX pattern for "pair programming with an AI" in a custom editor? (e.g. diff-then-apply vs inline suggestion vs chat-driven edit)
2. When Glitch responds with code changes, how should the UI present them? (unified diff format? inline highlight? accept/reject per-block?)
3. Should we implement a "send current file to Glitch" button that pre-populates the chat with the file content + a prompt? Or should the Workspaces chat pane always have file context automatically injected?
4. For Glitch to write edits back, we use the existing `python3 -c "base64 decode > file"` SSH approach. Should there be a confirmation/diff step before applying?

**Current implementation:**
- Workspaces has VPS file explorer (SSH ls), Monaco editor, mini chat pane, git bar
- File read: `cat path` → Monaco. File write: `python3 base64 decode` ≤100KB
- Mini chat shares `chatMessages`/`sendChat` from main store

---

### 2. GitHub Panel: PDF Viewer + CSV Tables + Open in Workspace

**PDF viewer:**
- GitHub API returns PDF as base64. Decode → Blob URL → `<iframe src={blobUrl}>` or `<embed>`
- Tauri WebView is Chromium-based → native PDF rendering in iframe should work
- Question: Does `URL.createObjectURL` work in Tauri? What blob MIME type is needed?
- Alternative: `pdf.js` library for fully custom rendering

**CSV as tables:**
- Detect `.csv` extension → parse with simple JS split (or PapaParse library)
- Render as `<table>` with sticky header, alternating rows
- Should handle large CSVs gracefully (virtual scroll or limit to 500 rows)
- Question: Is PapaParse worth adding as a dependency? Or use native `fetch` CSV parse?

**Open in Workspace button:**
- GitHub panel has repo/path context. Workspace panel has `cwd` state
- Button should: (a) set Workspaces `cwd` to the local VPS clone of the repo, (b) navigate to the same subdirectory, (c) optionally open the currently previewed file in Monaco
- Need: convention for where repos are cloned on VPS (`/root/repos/<repoName>` or `/root/<repoName>`?)
- Should check if repo exists on VPS first, offer to `git clone` if not

---

### 3. Settings: OpenClaw Configure Integration

**`openclaw configure` on VPS** is an interactive TUI. We need a non-interactive equivalent.

**What we want to expose in Settings:**
1. **Model/Provider** — already partially implemented (read + write `openclaw.json`). Need to expand.
2. **Dynamic model routing** — OpenClaw may support routing different task types to different models. Research: does OpenClaw have a config key for routing rules? What's the schema?
3. **API keys** — read from `/root/.openclaw/secrets.env`. Show masked values, allow rotate (overwrite file)
4. **Plugins/extensions** — what does `openclaw configure plugins` expose? Can we list/toggle from UI?
5. **Anthropic account vs API billing** — is this a config switch? What key enables "use Anthropic OAuth/console usage"?

**Questions for ChatGPT:**
1. Design a Settings UX that cleanly separates: Model Selection, API Keys, Plugins, Billing mode — without being overwhelming
2. For dynamic model routing: what's a good UI for "use cheap model for chat, balanced for tool use, powerful for autonomy"? (Slider? Preset profiles?)
3. For API key management: should we show/hide keys inline or link to Terminal for security?

---

### 4. Budget: Hard Limits + Per-Project Allocation

**Current state:** Budget panel shows Overnight Mode toggle, current model, guardrail tips. No actual enforcement.

**Vision:**
1. **Hard limit per session** — e.g. max £5/day. If OpenClaw has a spend tracking endpoint, read it. Otherwise, track token usage from WS stream.
2. **Per-project budget** — when starting an overnight agent run (Agents tab → schedule), assign a max budget. Agent stops when budget hit.
3. **Model cost awareness** — show estimated cost per request based on model pricing. Input/output token counts from WS stream.
4. **Overnight autonomy pause** — when Overnight Mode is ON, block `chat.send` with risky patterns, only allow cron-triggered deterministic tasks.
5. **Usage reset** — if using Anthropic included usage, it resets every 4hrs. Show countdown + auto-switch to API if over limit.

**Questions for ChatGPT:**
1. Does the OpenClaw WS protocol expose token usage per run? (Check `agent` event payload for usage data)
2. Design: how should "per-project budget" work in the UI? Where does the user set it? Where is it enforced?
3. For the Anthropic 4hr reset cycle: is there an API endpoint to check current usage? How to detect "over limit" vs "on API"?
4. What's the right architecture for enforcing a budget client-side vs server-side (VPS)?

---

### 5. Dynamic Model Routing UI

**Vision:** Instead of one global model, different tasks use different models based on a cost/performance bias.

Examples:
- Quick chat reply → Haiku (cheap, fast)
- File analysis / code review → Sonnet (balanced)
- Autonomous overnight project → Opus (powerful but expensive)
- User can set a "quality/cost" bias slider: full left = always cheapest, full right = always best

**Questions for ChatGPT:**
1. What's the UI pattern? (Slider + preview of what model each task type maps to? Or explicit per-task dropdowns?)
2. Does OpenClaw support routing natively? If yes, what's the config schema?
3. If not native: can we implement routing client-side by choosing the model before sending a `chat.send` WS message? Does the protocol support a `model` override per request?
4. For the "Anthropic included → API fallback" flow: what triggers the switch? Should it be manual, automatic, or threshold-based?

---

### 6. Glitch Context Awareness in Workspaces

**Problem:** When Glitch responds to questions about a file, he doesn't have the file in context unless the user explicitly sends it.

**Vision:**
- "Auto-inject" current open file content into every Workspaces chat message (up to ~2000 chars)
- Or: "Context chip" above the chat input showing "📄 store.js (attached)" — click to remove
- Glitch should be able to respond with code edits and have a one-click "Apply to file" button

**Questions for ChatGPT:**
1. Best UX for "file context in chat" — always-on injection vs manual attach chip vs explicit "send file" button?
2. How to represent "Glitch suggests a change" in the chat bubble? (Raw code block? Diff? Just apply silently?)
3. Should context be truncated (current file first N chars) or summarized (send a prompt to Glitch to summarize, then use summary as context for future messages)?

---

## Current Technical State

**Stack:**
- Tauri 2, React 19, Zustand 5, Lucide icons, xterm.js, @monaco-editor/react
- VPS: Ubuntu 24.04, OpenClaw 2026.2.23, openclaw-gateway systemd service

**Key file locations:**
- OpenClaw config: `/root/.openclaw/openclaw.json`
- Secrets: `/root/.openclaw/secrets.env`
- SOUL.md: `/root/.openclaw/workspace/SOUL.md`
- Repos: `/root/repos/` (convention, not enforced)
- Project dirs: `/root/projects/autonomous-projects/`, `/root/projects/collaborative-projects/`

**WS Protocol (v3):**
- Auth: Ed25519 challenge-response, device token cached in localStorage
- Events: `agent` (streaming), `chat` (final), `health`, `tick`, `status`
- Methods: `chat.send`, `status`, `channels.*`

**Current Workspaces file write:**
```js
python3 -c "import base64; open('PATH','wb').write(base64.b64decode('B64'))"
```
Limit: 100KB. Base64 built in 3000-byte chunks to avoid stack overflow.

**GitHub auth:** GH_TOKEN extracted from openclaw-gateway process env at `/proc/PID/environ`

---

## Deliverables Requested from ChatGPT

1. **Architecture doc** for collaborative editing: UX flow, diff/apply pattern, context injection strategy
2. **Settings redesign** covering model routing, dynamic switching, API key management
3. **Budget enforcement** architecture: client-side vs server-side, per-project allocation flow
4. **GitHub panel additions**: PDF/CSV viewer approach recommendation (library vs native)
5. **Priority ranking** for Sprint 3 — what gives most user value vs implementation effort?
6. **Any OpenClaw config schema insights** — especially for routing, plugins, billing mode

Please attach screenshots of current UI when sending this memo.

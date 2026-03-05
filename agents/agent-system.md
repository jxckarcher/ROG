# Agent System Architecture

## Overview
- **Main session** (Glitch): Chat, strategy, orchestration
- **Programmer agent**: Code generation, testing, reviews (OpenRouter cheap models)
- **Research agent**: Data gathering, summaries (Gemini Flash)
- **Task scheduler**: Cron + calendar, visible to Jack
- **Budget controller**: Real-time spend tracking, hard stops

## Agent Roles

### Programmer Agent
- **Model**: DeepSeek (R1-Lite) or Mistral Small 3.1 (OpenRouter)
- **Tasks**: Code generation, debugging, refactoring, PR creation
- **Handoff**: Glitch spawns with brief (file paths, requirements, repo link)
- **Return**: Code diff, test results, PR link (or summary if non-PR)

### Research Agent
- **Model**: Gemini Flash 1.5 (cheapest, fast)
- **Tasks**: Web search, document analysis, competitive research
- **Handoff**: Query + context
- **Return**: Structured findings, links, summary

### Scheduler Agent
- **Model**: Haiku (fast decisions)
- **Tasks**: Manage cron schedule, surface tasks to Jack's calendar
- **Handoff**: Task name, schedule (cron or datetime), agent assignment
- **Return**: Task ID, scheduled start time

## Spawn Protocol

```
sessions_spawn(
  runtime: "subagent",
  agentId: "<agent-id>",
  mode: "run",  // one-shot
  task: "<brief description>",
  attachments: [files Jack needs agent to access]
)
```

**Result handling:**
1. Agent completes, returns output
2. Glitch logs result to memory/YYYY-MM-DD.md
3. If external action needed (Telegram alert, repo push), Glitch does it
4. Budget delta recorded

## Budget Tracking

**Real-time tracking:**
- Track tokens used per agent execution
- Estimate cost against pricing table
- Alert Jack at 80% of monthly cap
- Hard stop at cap

**File**: `/root/.openclaw/workspace/agents/budget-tracker.json`

**Fields:**
- agent_id, task_id, timestamp
- tokens_in, tokens_out
- cost_gbp
- model_used
- status (running|completed|error)

## Calendar Integration

**Goal**: Jack can see scheduled agents in his calendar and cancel/manage from there.

**Approach:**
1. Create calendar events for scheduled tasks
2. Store event ID + task ID mapping
3. Webhook/poll for cancellation requests from calendar
4. Agent system respects cancellation before spawn

**Integration point**: `/root/.openclaw/workspace/agents/calendar-sync.js` (Node.js listener)

## Model Routing Policy

**For agent tasks:**
- Code: OpenRouter DeepSeek or Mistral (£0.08-0.24 / 1M)
- Research: Gemini Flash 1.5 (£0.06 / 1M)
- Decision: Haiku (£0.63 / 1M)

**Main session (Jack chat):** Always Anthropic Sonnet (subscription window) or Haiku (fallback)

## Next: Implementation
1. Create agent spawner wrapper
2. Implement budget-tracker
3. Build calendar sync listener
4. Test programmer agent on a real task

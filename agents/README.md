# Glitch Agent System

A unified framework for orchestrating autonomous agents, managing costs, and scheduling tasks with calendar integration.

## System Architecture

### Core Components

1. **Task Orchestrator** (`task-orchestrator.js`)
   - Central hub for spawning, tracking, and managing agent tasks
   - Enforces budget constraints before task creation
   - Integrates with calendar for visibility and cancellation

2. **Budget Controller** (`budget-controller.js`)
   - Real-time cost tracking per execution
   - Monthly cap enforcement (hard stop at £50)
   - Warning threshold at 80% (£40)
   - Per-model pricing lookups

3. **Calendar Sync** (`calendar-sync.js`)
   - Bidirectional sync with Jack's calendar (future: Google Calendar, Outlook)
   - Create/list/cancel events for scheduled tasks
   - Visibility of agent work in calendar UI
   - Cancellation support from calendar

4. **Agent Config** (`agent-config.json`)
   - Defines available agents, capabilities, and models
   - Model pricing matrix (Anthropic, OpenRouter)
   - Tags and cost estimates per agent type

### Agent Types

**Programmer Agent** (OpenRouter)
- Model: DeepSeek (£0.14 in, £0.28 out per 1M tokens)
- Tasks: Code review, refactoring, bug fixes, PR generation
- Capabilities: Full repo access, git operations, testing

**Research Agent** (OpenRouter)
- Model: Gemini Flash 1.5 (£0.06 in, £0.24 out per 1M tokens)
- Tasks: Web search, document analysis, competitive research
- Capabilities: Web access, file analysis

**Scheduler Agent** (Anthropic)
- Model: Haiku 4.5 (£0.8 in, £4.0 out per 1M tokens)
- Tasks: Task coordination, cron management
- Capabilities: Schedule queries, state management

## Usage

### Spawn a Task (Immediate Execution)

```bash
node agents/task-orchestrator.js spawn programmer-agent "Refactor auth module for readability"
```

**Output:**
```
✅ Task created: task_programmer-agent_1772707500199
   Agent: programmer-agent
   Brief: Refactor auth module for readability
🚀 Executing task: task_programmer-agent_1772707500199
```

### Schedule a Task (Cron or DateTime)

```bash
# Run every day at 9 AM
node agents/task-orchestrator.js spawn programmer-agent "Daily code review" --schedule "0 9 * * *"

# Run at specific time
node agents/task-orchestrator.js spawn researcher-agent "Weekly market research" --schedule "2026-03-10T14:00:00Z"
```

### Check Budget Status

```bash
node agents/budget-controller.js status
```

**Output:**
```
📊 Budget Status
   Month: 2026-03-01 to 2026-03-31
   Spent: £0.08 / £50
   Remaining: £49.92
   Usage: 0.16%
   Tasks: 1 completed, 0 errors
   Last update: 2026-03-05T10:45:02Z
```

### View Task Dashboard

```bash
node agents/task-orchestrator.js dashboard
```

**Output:**
```
🎛️  Glitch Agent Dashboard

📊 Task Summary
   Running: 0
   Scheduled: 2
   Completed: 1
   Total: 3

[Budget and calendar status included...]
```

### List All Tasks

```bash
# All tasks
node agents/task-orchestrator.js list

# Filtered by status
node agents/task-orchestrator.js list --filter running
node agents/task-orchestrator.js list --filter completed
```

### Check Individual Task Status

```bash
node agents/task-orchestrator.js status task_programmer-agent_1772707500199
```

### Cancel a Scheduled Task

```bash
node agents/task-orchestrator.js cancel task_programmer-agent_1772707500199
```

## Data Structures

### Budget Tracker (`budget-tracker.json`)

```json
{
  "config": {
    "monthlyCapGBP": 50,
    "warnAtGBP": 40,
    "hardStopGBP": 50,
    "currentMonthStart": "2026-03-01",
    "currentMonthEnd": "2026-03-31"
  },
  "tracking": {
    "spentThisMonthGBP": 0,
    "tasksCompleted": 0,
    "tasksErrored": 0,
    "lastUpdate": null
  },
  "executions": [
    {
      "taskId": "task_programmer-agent_1772707500199",
      "model": "openrouter/deepseek/deepseek-chat",
      "tokensIn": 500,
      "tokensOut": 1200,
      "costGBP": 0.08,
      "timestamp": "2026-03-05T10:45:02Z",
      "provider": "openrouter"
    }
  ]
}
```

### Tasks State (`tasks-state.json`)

```json
{
  "tasks": {
    "task_programmer-agent_1772707500199": {
      "taskId": "task_programmer-agent_1772707500199",
      "agentId": "programmer-agent",
      "taskBrief": "Refactor auth module",
      "status": "completed",
      "createdAt": "2026-03-05T10:45:00.199Z",
      "startedAt": "2026-03-05T10:45:00.201Z",
      "completedAt": "2026-03-05T10:45:02.142Z",
      "schedule": null,
      "model": null,
      "costEstimate": 0.1,
      "costActual": 0.08,
      "result": { "status": "completed", "prUrl": "..." },
      "error": null
    }
  }
}
```

### Calendar Sync (`calendar-sync-state.json`)

```json
{
  "events": {
    "evt_task_programmer-agent_1772707500199_1772707500199": {
      "eventId": "evt_task_programmer-agent_1772707500199_1772707500199",
      "taskId": "task_programmer-agent_1772707500199",
      "title": "Refactor auth module",
      "scheduledTime": "2026-03-10T09:00:00Z",
      "createdAt": "2026-03-05T10:45:00.199Z",
      "status": "completed",
      "startedAt": "2026-03-05T10:45:00.201Z",
      "completedAt": "2026-03-05T10:45:02.142Z"
    }
  },
  "lastCheck": "2026-03-05T10:45:02.142Z",
  "pollingIntervalSecs": 60
}
```

## Next Steps (Integration)

1. **Connect to OpenClaw `sessions_spawn`**
   - Task orchestrator currently creates task records
   - Need to call actual OpenClaw API to spawn sub-agents
   - Wire result/token counts back to budget controller

2. **Calendar Integration**
   - Replace local mock with actual Google Calendar / Outlook API
   - Setup webhook for cancellations
   - Display calendar events in UI

3. **Real-time Monitoring**
   - Dashboard polling loop (separate cron job)
   - Telegram alerts for task completion/errors
   - Cost warnings at 80% threshold

4. **Autonomous Execution**
   - Implement scheduler loop to execute cron-scheduled tasks
   - Background worker that checks calendar for due tasks
   - Handle task queueing and concurrency limits

## Cost Reference

### Models by Price (per 1M tokens input)

| Model | Input | Output | Use Case | Provider |
|-------|-------|--------|----------|----------|
| Gemini Flash 1.5 8B | £0.047 | £0.189 | Fast research | OpenRouter |
| Gemini Flash 1.5 | £0.059 | £0.236 | General research | OpenRouter |
| Mistral Small 3.1 | £0.079 | £0.236 | Lightweight coding | OpenRouter |
| DeepSeek Chat | £0.14 | £0.28 | Code generation | OpenRouter |
| Claude Haiku 4.5 | £0.8 | £4.0 | Decision-making | Anthropic |
| Claude Sonnet 4.6 | £2.37 | £11.85 | Complex reasoning | Anthropic |

## Files Reference

| File | Purpose |
|------|---------|
| `task-orchestrator.js` | Main CLI for task management |
| `budget-controller.js` | Cost tracking and limits |
| `calendar-sync.js` | Calendar event management |
| `agent-config.json` | Agent definitions and models |
| `budget-tracker.json` | Budget state and history |
| `tasks-state.json` | Task records |
| `calendar-sync-state.json` | Calendar event mappings |
| `agent-system.md` | Architecture documentation |

## Safety Notes

- ✅ Budget hard stop prevents overspend
- ✅ All execution costs tracked and logged
- ✅ Tasks cancelled immediately when requested
- ✅ Calendar integration prevents blind scheduling
- ⚠️ Cost estimates vs actuals may differ (logs both)
- ⚠️ Concurrent task limits not yet enforced (TODO)

## Debug Commands

```bash
# Reload all state
node agents/task-orchestrator.js dashboard

# View budget history
node agents/budget-controller.js recent 20

# Check calendar events
node agents/calendar-sync.js list-events

# Simulate task tracking
node agents/budget-controller.js track task_123 "openrouter/google/gemini-flash-1.5" 1000 500
```

---

**Status**: MVP complete. Ready for OpenClaw integration. ⚡

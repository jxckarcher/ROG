# Agent System Integration Guide

## Phase 1: Current State (MVP Complete)

✅ **Task Management**
- Task spawning, tracking, cancellation
- Status queries and dashboards
- Cost estimation and tracking

✅ **Budget Control**
- Real-time cost tracking per execution
- Monthly cap (£50) with warn threshold (£40)
- Hard stop enforcement

✅ **Calendar Integration**
- Event creation for scheduled tasks
- Visibility of task timeline
- Cancellation support

✅ **Agent Configuration**
- 3 agent types defined (programmer, researcher, scheduler)
- Model pricing matrix
- Capability tags

## Phase 2: OpenClaw Integration (Immediate)

### Step 1: Connect to `sessions_spawn`

**Current state:**
- Task orchestrator creates task records
- `_executeTask()` is a stub

**What needs to happen:**
```javascript
// In task-orchestrator.js, _executeTask():
async _executeTask(taskId) {
  const task = this.tasks.tasks[taskId];
  
  // Call OpenClaw sessions_spawn API
  const result = await openclaw.sessions_spawn({
    runtime: "subagent",
    agentId: task.agentId,
    mode: "run",
    task: task.taskBrief,
    model: task.model || "openrouter/deepseek/deepseek-chat"
  });
  
  // Extract tokens used + result
  const tokensIn = result.meta?.tokensUsed?.input || 0;
  const tokensOut = result.meta?.tokensUsed?.output || 0;
  
  // Track cost
  execSync(`node ${BUDGET_CONTROLLER} track ${taskId} ${task.model} ${tokensIn} ${tokensOut}`);
  
  // Mark complete
  this.complete(taskId, result.output, this.estimateCost(tokensIn, tokensOut));
}
```

**Required:**
- OpenClaw API bindings for sessions_spawn
- Token usage reporting from sub-agents
- Result marshalling format

### Step 2: Connect to Calendar UI

**Current state:**
- Local calendar-sync-state.json
- Mock event creation

**What needs to happen:**
- Calendar sync → Jack's calendar provider (Google Calendar, etc.)
- Webhook listener for cancellation events
- Event linking back to task IDs

**Approach:**
```javascript
// calendar-sync.js would integrate with:
// - Google Calendar API (oauth2 flow)
// - Outlook API (oauth2 flow)
// - Or simple webhook receiver for event updates

createEvent() {
  // 1. Create local record (done)
  // 2. Create calendar event via API
  calendar.events.insert({
    summary: title,
    start: { dateTime: scheduledTime },
    description: `Task: ${taskId}`,
    metadata: { taskId }
  });
}
```

### Step 3: Connect Budget to Alerts

**Current state:**
- Budget tracking in JSON
- No external notifications

**What needs to happen:**
- Telegram alerts when usage crosses thresholds
- Daily/weekly budget summaries
- Cost breakdown by agent

**Implementation:**
```javascript
// After cost tracking, check thresholds:
const spent = this.budget.tracking.spentThisMonthGBP;
const cap = this.budget.config.hardStopGBP;
const warnAt = this.budget.config.warnAtGBP;

if (spent >= warnAt && spent < cap) {
  // Alert to Telegram
  message.send({
    channel: "telegram",
    message: `⚠️ Budget warning: £${spent}/${cap} spent. ${(cap-spent).toFixed(2)} remaining.`
  });
}
```

## Phase 3: Autonomous Execution (Week 2)

### Scheduler Loop

A separate long-running process that:
1. Polls `tasks-state.json` for scheduled tasks
2. Checks if task time has arrived (respects cron + one-time schedules)
3. Checks calendar for cancellations
4. Executes via task-orchestrator
5. Logs completion

**Pseudocode:**
```javascript
// scheduler-daemon.js
setInterval(async () => {
  const tasks = loadTasks();
  
  for (const task of tasks) {
    if (task.status !== "scheduled") continue;
    
    // Check if time to run
    if (!isTimeToRun(task.schedule)) continue;
    
    // Check for cancellations from calendar
    const cancelled = checkCalendarCancellations();
    if (cancelled.includes(task.taskId)) {
      cancel(task.taskId);
      continue;
    }
    
    // Execute
    await executeTask(task.taskId);
  }
}, 30000); // Poll every 30 seconds
```

### Cron Integration (Optional)

For precise timing, delegate to system cron:
```bash
# /etc/cron.d/glitch-scheduler
* * * * * node /path/to/agents/scheduler-daemon.js >> /var/log/glitch.log 2>&1
```

## Phase 4: UI Dashboard (Week 3)

Display in ControlUI:
- Task list (running, scheduled, completed)
- Budget gauge + spend history
- Calendar event timeline
- Cost breakdown by agent

**Data sources:**
- `tasks-state.json` (task list)
- `budget-tracker.json` (costs)
- `calendar-sync-state.json` (timeline)

## Files to Update

### agents/task-orchestrator.js
- [ ] Import OpenClaw sessions_spawn
- [ ] Implement _executeTask() with real agent spawn
- [ ] Add token/cost handling from result

### agents/calendar-sync.js
- [ ] Integrate with calendar provider API
- [ ] Setup webhook listener for cancellations
- [ ] Test create/update/cancel flows

### agents/budget-controller.js
- [ ] Add Telegram alerting
- [ ] Daily summary emails/messages
- [ ] Per-agent cost breakdown

### New: scheduler-daemon.js
- [ ] Poll scheduled tasks
- [ ] Check calendar for cancellations
- [ ] Execute via task-orchestrator
- [ ] Handle cron parsing

### New: glitch-ui integration
- [ ] Dashboard component for agents
- [ ] Real-time cost display
- [ ] Task cancellation UI

## Testing Checklist

- [ ] Spawn task → agents_list populated
- [ ] Task completes → cost tracked
- [ ] Cost threshold hit → alert sent
- [ ] Schedule cron task → appears in calendar
- [ ] Cancel from UI → task.status = "cancelled"
- [ ] Budget hard stop → blocks new tasks
- [ ] Concurrent tasks → queue/limit enforced

## Timeline

| Phase | Target | Status |
|-------|--------|--------|
| 1: MVP | Today | ✅ Done |
| 2: OpenClaw Integration | Tomorrow | 🟡 In progress |
| 3: Autonomous Execution | End of week | ⬜ Planned |
| 4: UI Dashboard | Following week | ⬜ Planned |

## Questions for Jack

1. **OpenClaw API**: What's the actual shape of `sessions_spawn` result for token usage?
2. **Calendar**: Which provider? (Google, Outlook, custom?)
3. **Alerts**: Telegram only, or email too?
4. **Concurrency**: How many agents can run simultaneously?
5. **Rollback**: Should cancelled tasks clean up partial results?

---

**Next: Stand by for integration with OpenClaw API.** 🚀

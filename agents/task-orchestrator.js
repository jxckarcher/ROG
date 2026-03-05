#!/usr/bin/env node
/**
 * task-orchestrator.js
 * Unified interface for spawning agents, tracking costs, and managing lifecycle
 * 
 * Usage:
 *   node task-orchestrator.js spawn <agent-id> <task-brief> [--schedule CRON] [--model MODEL]
 *   node task-orchestrator.js status <task-id>
 *   node task-orchestrator.js list [--filter running|completed|cancelled]
 *   node task-orchestrator.js cancel <task-id>
 *   node task-orchestrator.js dashboard
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TASKS_FILE = path.join(__dirname, "tasks-state.json");
const BUDGET_CONTROLLER = path.join(__dirname, "budget-controller.js");
const CALENDAR_SYNC = path.join(__dirname, "calendar-sync.js");

class TaskOrchestrator {
  constructor() {
    this.tasks = this._loadTasks();
  }

  _loadTasks() {
    if (fs.existsSync(TASKS_FILE)) {
      return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
    }
    return { tasks: {} };
  }

  _saveTasks() {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(this.tasks, null, 2));
  }

  /**
   * Spawn an agent task
   */
  spawn(agentId, taskBrief, options = {}) {
    // Check budget first
    try {
      execSync(`node "${BUDGET_CONTROLLER}" can-proceed`, { stdio: "pipe" });
    } catch (e) {
      console.error("❌ Budget check failed. Cannot spawn task.");
      return null;
    }

    const taskId = `task_${agentId}_${Date.now()}`;
    const task = {
      taskId,
      agentId,
      taskBrief,
      status: "pending", // pending, scheduled, running, completed, cancelled, error
      createdAt: new Date().toISOString(),
      schedule: options.schedule || null, // cron string or ISO datetime
      model: options.model || null,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      costEstimate: options.costEstimate || 0,
      costActual: null,
    };

    this.tasks.tasks[taskId] = task;
    this._saveTasks();

    console.log(`✅ Task created: ${taskId}`);
    console.log(`   Agent: ${agentId}`);
    console.log(`   Brief: ${taskBrief}`);

    // If scheduled, create calendar event
    if (task.schedule) {
      try {
        execSync(
          `node "${CALENDAR_SYNC}" create-event "${taskId}" "${taskBrief}" "${task.schedule}"`,
          { stdio: "inherit" }
        );
        task.status = "scheduled";
        this._saveTasks();
      } catch (e) {
        console.error("⚠️  Failed to create calendar event:", e.message);
      }
    } else {
      // Immediate execution
      this._executeTask(taskId);
    }

    return task;
  }

  /**
   * Execute a task immediately (internal)
   */
  _executeTask(taskId) {
    const task = this.tasks.tasks[taskId];
    if (!task) {
      console.error(`❌ Task not found: ${taskId}`);
      return;
    }

    task.status = "running";
    task.startedAt = new Date().toISOString();
    this._saveTasks();

    // Mark in calendar as running
    if (task.schedule) {
      try {
        execSync(`node "${CALENDAR_SYNC}" mark-running "${taskId}"`, { stdio: "pipe" });
      } catch (e) {
        // Non-fatal
      }
    }

    console.log(`🚀 Executing task: ${taskId}`);
    // TODO: Call sessions_spawn here with proper OpenClaw API
    // For MVP, just mark as running and simulate completion
  }

  /**
   * Mark task as completed with result
   */
  complete(taskId, result = null, costActual = null) {
    const task = this.tasks.tasks[taskId];
    if (!task) {
      console.error(`❌ Task not found: ${taskId}`);
      return;
    }

    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.result = result;
    task.costActual = costActual;
    this._saveTasks();

    // Update calendar
    try {
      execSync(`node "${CALENDAR_SYNC}" mark-completed "${taskId}" '${JSON.stringify(result)}'`, {
        stdio: "pipe",
      });
    } catch (e) {
      // Non-fatal
    }

    console.log(`✅ Task completed: ${taskId}`);
    if (costActual) {
      console.log(`   Cost: £${costActual}`);
    }
  }

  /**
   * Cancel a task
   */
  cancel(taskId) {
    const task = this.tasks.tasks[taskId];
    if (!task) {
      console.error(`❌ Task not found: ${taskId}`);
      return;
    }

    if (task.status === "completed" || task.status === "cancelled") {
      console.error(`❌ Cannot cancel task with status: ${task.status}`);
      return;
    }

    task.status = "cancelled";
    task.cancelledAt = new Date().toISOString();
    this._saveTasks();

    console.log(`✅ Task cancelled: ${taskId}`);
  }

  /**
   * Get task status
   */
  status(taskId) {
    const task = this.tasks.tasks[taskId];
    if (!task) {
      console.error(`❌ Task not found: ${taskId}`);
      return;
    }

    console.log(`\n📋 Task: ${taskId}`);
    console.log(`   Agent: ${task.agentId}`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Brief: ${task.taskBrief}`);
    console.log(`   Created: ${task.createdAt}`);
    if (task.startedAt) console.log(`   Started: ${task.startedAt}`);
    if (task.completedAt) console.log(`   Completed: ${task.completedAt}`);
    if (task.costEstimate) console.log(`   Cost (est): £${task.costEstimate}`);
    if (task.costActual) console.log(`   Cost (actual): £${task.costActual}`);
    if (task.result) console.log(`   Result: ${JSON.stringify(task.result)}`);
    if (task.error) console.log(`   Error: ${task.error}`);
    console.log("");
  }

  /**
   * List all tasks
   */
  list(filter = null) {
    let tasks = Object.values(this.tasks.tasks);
    if (filter) {
      tasks = tasks.filter((t) => t.status === filter);
    }

    console.log(`\n📊 Tasks (${tasks.length})\n`);
    tasks.forEach((task) => {
      const icon = {
        pending: "⏳",
        scheduled: "📅",
        running: "🚀",
        completed: "✅",
        cancelled: "❌",
        error: "⚠️",
      }[task.status];

      console.log(`${icon} ${task.taskId}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Agent: ${task.agentId}`);
      console.log(`   Brief: ${task.taskBrief}`);
    });
    console.log("");
  }

  /**
   * Dashboard: overview of all systems
   */
  dashboard() {
    const tasks = Object.values(this.tasks.tasks);
    const running = tasks.filter((t) => t.status === "running").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const scheduled = tasks.filter((t) => t.status === "scheduled").length;

    console.log("\n🎛️  Glitch Agent Dashboard\n");
    console.log(`📊 Task Summary`);
    console.log(`   Running: ${running}`);
    console.log(`   Scheduled: ${scheduled}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Total: ${tasks.length}`);

    // Budget status
    try {
      const output = execSync(`node "${BUDGET_CONTROLLER}" status`, { encoding: "utf-8" });
      console.log(`\n${output}`);
    } catch (e) {
      console.error("❌ Failed to load budget status");
    }

    // Scheduled events
    try {
      const output = execSync(`node "${CALENDAR_SYNC}" list-events`, { encoding: "utf-8" });
      console.log(`${output}`);
    } catch (e) {
      console.error("❌ Failed to load calendar events");
    }
  }
}

// CLI
const orch = new TaskOrchestrator();
const cmd = process.argv[2];

switch (cmd) {
  case "spawn":
    {
      const agentId = process.argv[3];
      const taskBrief = process.argv[4];
      const options = {};

      // Parse optional flags
      for (let i = 5; i < process.argv.length; i += 2) {
        if (process.argv[i] === "--schedule") options.schedule = process.argv[i + 1];
        if (process.argv[i] === "--model") options.model = process.argv[i + 1];
      }

      if (!agentId || !taskBrief) {
        console.error("Usage: spawn <agent-id> <task-brief> [--schedule CRON] [--model MODEL]");
        process.exit(1);
      }
      orch.spawn(agentId, taskBrief, options);
    }
    break;
  case "status":
    {
      const taskId = process.argv[3];
      if (!taskId) {
        console.error("Usage: status <task-id>");
        process.exit(1);
      }
      orch.status(taskId);
    }
    break;
  case "list":
    {
      const filter = process.argv[3] === "--filter" ? process.argv[4] : null;
      orch.list(filter);
    }
    break;
  case "cancel":
    {
      const taskId = process.argv[3];
      if (!taskId) {
        console.error("Usage: cancel <task-id>");
        process.exit(1);
      }
      orch.cancel(taskId);
    }
    break;
  case "complete":
    {
      const taskId = process.argv[3];
      const result = process.argv[4] || null;
      const cost = process.argv[5] || null;
      if (!taskId) {
        console.error("Usage: complete <task-id> [result-json] [cost-gbp]");
        process.exit(1);
      }
      orch.complete(taskId, result, cost);
    }
    break;
  case "dashboard":
    orch.dashboard();
    break;
  default:
    console.error("Usage:");
    console.error("  spawn <agent-id> <task-brief> [--schedule CRON] [--model MODEL]");
    console.error("  status <task-id>");
    console.error("  list [--filter status]");
    console.error("  cancel <task-id>");
    console.error("  complete <task-id> [result-json] [cost-gbp]");
    console.error("  dashboard");
    process.exit(1);
}

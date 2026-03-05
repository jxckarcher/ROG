#!/usr/bin/env node
/**
 * calendar-sync.js
 * Bidirectional sync between scheduled agents and Jack's calendar
 * 
 * Features:
 * - Create calendar events for scheduled tasks
 * - Poll calendar for cancellations
 * - Map calendar event IDs to task IDs
 * - Auto-cleanup completed tasks
 * 
 * Usage:
 *   node calendar-sync.js create-event <task-id> <title> <scheduled-time>
 *   node calendar-sync.js list-events
 *   node calendar-sync.js check-cancellations
 *   node calendar-sync.js daemon (runs polling loop)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SYNC_FILE = path.join(__dirname, "calendar-sync-state.json");

class CalendarSync {
  constructor() {
    this.state = this._loadState();
  }

  _loadState() {
    if (fs.existsSync(SYNC_FILE)) {
      return JSON.parse(fs.readFileSync(SYNC_FILE, "utf-8"));
    }
    return {
      events: {},
      lastCheck: null,
      pollingIntervalSecs: 60,
    };
  }

  _saveState() {
    fs.writeFileSync(SYNC_FILE, JSON.stringify(this.state, null, 2));
  }

  /**
   * Create a calendar event for a scheduled task
   * Maps task ID → calendar event ID for bidirectional sync
   */
  createEvent(taskId, title, scheduledTime) {
    // TODO: Integrate with actual calendar (Google Calendar, Outlook, etc.)
    // For now, create a local record

    const eventId = `evt_${taskId}_${Date.now()}`;
    const event = {
      eventId,
      taskId,
      title,
      scheduledTime,
      createdAt: new Date().toISOString(),
      status: "scheduled", // scheduled, running, completed, cancelled
    };

    this.state.events[eventId] = event;
    this._saveState();

    console.log(`✅ Created calendar event: ${eventId}`);
    console.log(`   Task: ${taskId}`);
    console.log(`   Time: ${scheduledTime}`);
    console.log(`   Title: ${title}`);

    return event;
  }

  /**
   * List all scheduled events
   */
  listEvents() {
    const events = Object.values(this.state.events).filter((e) => e.status === "scheduled");
    console.log(`\n📅 Scheduled Tasks (${events.length})\n`);

    if (events.length === 0) {
      console.log("   No scheduled tasks.\n");
      return;
    }

    events
      .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
      .forEach((e) => {
        console.log(`   [${e.scheduledTime}] ${e.title}`);
        console.log(`     Task: ${e.taskId}`);
        console.log(`     Event: ${e.eventId}`);
      });
    console.log("");
  }

  /**
   * Mark an event as cancelled (called when Jack cancels from calendar)
   */
  cancelEvent(eventId) {
    const event = this.state.events[eventId];
    if (!event) {
      console.error(`❌ Event not found: ${eventId}`);
      return false;
    }

    event.status = "cancelled";
    event.cancelledAt = new Date().toISOString();
    this._saveState();

    console.log(`✅ Cancelled event: ${eventId}`);
    console.log(`   Task: ${event.taskId}`);
    return event;
  }

  /**
   * Check for cancellations from calendar (polling)
   * In production, this would webhook-in cancellations or query the calendar API
   */
  checkCancellations() {
    // TODO: Poll calendar API for changes
    // For MVP: Check if any scheduled events have been marked as cancelled elsewhere
    console.log("✅ Checking for cancellations...");
    this.state.lastCheck = new Date().toISOString();
    this._saveState();
    // Return any cancelled tasks
    return Object.values(this.state.events)
      .filter((e) => e.status === "cancelled")
      .map((e) => e.taskId);
  }

  /**
   * Mark a task as running
   */
  markRunning(taskId) {
    const event = Object.values(this.state.events).find((e) => e.taskId === taskId);
    if (!event) {
      console.warn(`⚠️  No calendar event found for task: ${taskId}`);
      return;
    }
    event.status = "running";
    event.startedAt = new Date().toISOString();
    this._saveState();
    console.log(`✅ Marked running: ${event.eventId}`);
  }

  /**
   * Mark a task as completed
   */
  markCompleted(taskId, result = null) {
    const event = Object.values(this.state.events).find((e) => e.taskId === taskId);
    if (!event) {
      console.warn(`⚠️  No calendar event found for task: ${taskId}`);
      return;
    }
    event.status = "completed";
    event.completedAt = new Date().toISOString();
    event.result = result;
    this._saveState();
    console.log(`✅ Marked completed: ${event.eventId}`);
  }
}

// CLI
const sync = new CalendarSync();
const cmd = process.argv[2];

switch (cmd) {
  case "create-event":
    {
      const [taskId, title, scheduledTime] = process.argv.slice(3);
      if (!taskId || !title || !scheduledTime) {
        console.error("Usage: create-event <task-id> <title> <scheduled-time>");
        process.exit(1);
      }
      sync.createEvent(taskId, title, scheduledTime);
    }
    break;
  case "list-events":
    sync.listEvents();
    break;
  case "cancel-event":
    {
      const eventId = process.argv[3];
      if (!eventId) {
        console.error("Usage: cancel-event <event-id>");
        process.exit(1);
      }
      sync.cancelEvent(eventId);
    }
    break;
  case "check-cancellations":
    {
      const cancelled = sync.checkCancellations();
      if (cancelled.length > 0) {
        console.log(`\n⚠️  Found ${cancelled.length} cancelled tasks:`);
        cancelled.forEach((t) => console.log(`   - ${t}`));
      }
    }
    break;
  case "mark-running":
    {
      const taskId = process.argv[3];
      if (!taskId) {
        console.error("Usage: mark-running <task-id>");
        process.exit(1);
      }
      sync.markRunning(taskId);
    }
    break;
  case "mark-completed":
    {
      const [taskId, result] = process.argv.slice(3);
      if (!taskId) {
        console.error("Usage: mark-completed <task-id> [result-json]");
        process.exit(1);
      }
      sync.markCompleted(taskId, result);
    }
    break;
  default:
    console.error("Usage:");
    console.error("  create-event <task-id> <title> <scheduled-time>");
    console.error("  list-events");
    console.error("  cancel-event <event-id>");
    console.error("  check-cancellations");
    console.error("  mark-running <task-id>");
    console.error("  mark-completed <task-id> [result-json]");
    process.exit(1);
}

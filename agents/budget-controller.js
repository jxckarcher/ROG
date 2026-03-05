#!/usr/bin/env node
/**
 * budget-controller.js
 * Real-time cost tracking for agent executions
 * 
 * Usage:
 *   node budget-controller.js track <task-id> <model> <tokens-in> <tokens-out>
 *   node budget-controller.js status
 *   node budget-controller.js alert
 */

const fs = require("fs");
const path = require("path");

const BUDGET_FILE = path.join(__dirname, "budget-tracker.json");
const AGENT_CONFIG = path.join(__dirname, "agent-config.json");

class BudgetController {
  constructor() {
    this.budget = this._load(BUDGET_FILE);
    this.config = this._load(AGENT_CONFIG);
  }

  _load(file) {
    if (!fs.existsSync(file)) {
      console.error(`❌ File not found: ${file}`);
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  }

  _save() {
    fs.writeFileSync(BUDGET_FILE, JSON.stringify(this.budget, null, 2));
  }

  /**
   * Track a completed task execution
   */
  track(taskId, model, tokensIn, tokensOut) {
    const modelConfig = this.config.models[model];
    if (!modelConfig) {
      console.error(`❌ Unknown model: ${model}`);
      return false;
    }

    // Calculate cost in GBP
    const costInput = (tokensIn / 1_000_000) * modelConfig.inputGBPer1M;
    const costOutput = (tokensOut / 1_000_000) * modelConfig.outputGBPer1M;
    const totalCost = costInput + costOutput;

    // Record execution
    const execution = {
      taskId,
      model,
      tokensIn,
      tokensOut,
      costGBP: parseFloat(totalCost.toFixed(6)),
      timestamp: new Date().toISOString(),
      provider: modelConfig.provider,
    };

    this.budget.executions.push(execution);
    this.budget.tracking.spentThisMonthGBP += totalCost;
    this.budget.tracking.tasksCompleted += 1;
    this.budget.tracking.lastUpdate = execution.timestamp;

    this._save();
    console.log(`✅ Tracked: ${taskId}`);
    console.log(`   Cost: £${execution.costGBP} (${tokensIn}→${tokensOut} tokens)`);

    return execution;
  }

  /**
   * Check if we can proceed with a task
   */
  canProceed() {
    const spent = this.budget.tracking.spentThisMonthGBP;
    const hardStop = this.budget.config.hardStopGBP;
    const warnAt = this.budget.config.warnAtGBP;

    if (spent >= hardStop) {
      console.error(`❌ HARD STOP: Spent £${spent.toFixed(2)} / £${hardStop}`);
      return false;
    }

    if (spent >= warnAt) {
      console.warn(`⚠️  WARNING: Spent £${spent.toFixed(2)} / £${hardStop} (warn at £${warnAt})`);
    }

    return true;
  }

  /**
   * Print budget status
   */
  status() {
    const spent = this.budget.tracking.spentThisMonthGBP;
    const cap = this.budget.config.hardStopGBP;
    const percentUsed = ((spent / cap) * 100).toFixed(1);
    const remaining = (cap - spent).toFixed(2);

    console.log("\n📊 Budget Status");
    console.log(`   Month: ${this.budget.config.currentMonthStart} to ${this.budget.config.currentMonthEnd}`);
    console.log(`   Spent: £${spent.toFixed(2)} / £${cap}`);
    console.log(`   Remaining: £${remaining}`);
    console.log(`   Usage: ${percentUsed}%`);
    console.log(`   Tasks: ${this.budget.tracking.tasksCompleted} completed, ${this.budget.tracking.tasksErrored} errors`);
    console.log(`   Last update: ${this.budget.tracking.lastUpdate || "Never"}\n`);

    if (spent >= this.budget.config.warnAtGBP) {
      console.warn("⚠️  Budget warning threshold reached.");
    }
  }

  /**
   * Get recent executions
   */
  recent(limit = 10) {
    const execs = this.budget.executions.slice(-limit);
    console.log(`\n📋 Recent Executions (last ${limit})`);
    execs.forEach((e) => {
      console.log(`  [${e.timestamp}] ${e.taskId}`);
      console.log(`    Model: ${e.model}`);
      console.log(`    Cost: £${e.costGBP} (${e.tokensIn}→${e.tokensOut} tokens)`);
    });
    console.log("");
  }
}

// CLI
const ctrl = new BudgetController();
const cmd = process.argv[2];

switch (cmd) {
  case "track":
    {
      const [taskId, model, tokensIn, tokensOut] = process.argv.slice(3);
      if (!taskId || !model || !tokensIn || !tokensOut) {
        console.error("Usage: track <task-id> <model> <tokens-in> <tokens-out>");
        process.exit(1);
      }
      ctrl.track(taskId, model, parseInt(tokensIn), parseInt(tokensOut));
    }
    break;
  case "status":
    ctrl.status();
    break;
  case "recent":
    ctrl.recent(parseInt(process.argv[3]) || 10);
    break;
  case "can-proceed":
    process.exit(ctrl.canProceed() ? 0 : 1);
    break;
  default:
    console.error("Usage:");
    console.error("  track <task-id> <model> <tokens-in> <tokens-out>");
    console.error("  status");
    console.error("  recent [limit]");
    console.error("  can-proceed");
    process.exit(1);
}

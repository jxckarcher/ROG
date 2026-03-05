#!/bin/bash
# spawn-agent.sh
# Wrapper for sessions_spawn that enforces budget + logging

AGENT_ID="$1"
TASK_BRIEF="$2"
MODE="${3:-run}"
ATTACHMENTS="${4:-}"

if [[ -z "$AGENT_ID" || -z "$TASK_BRIEF" ]]; then
  echo "Usage: $0 <agent-id> <task-brief> [mode] [attachments-json]"
  echo "Example: $0 programmer-agent 'Refactor auth.js' run '[{\"name\":\"auth.js\",\"content\":\"...\"}]'"
  exit 1
fi

# Read budget
BUDGET_FILE="/root/.openclaw/workspace/agents/budget-tracker.json"
CURRENT_SPENT=$(jq -r '.tracking.spentThisMonthGBP' "$BUDGET_FILE")
HARD_STOP=$(jq -r '.config.hardStopGBP' "$BUDGET_FILE")

if (( $(echo "$CURRENT_SPENT >= $HARD_STOP" | bc -l) )); then
  echo "❌ BUDGET HARD STOP: Already spent £$CURRENT_SPENT / £$HARD_STOP this month"
  exit 1
fi

echo "✅ Budget OK: £$CURRENT_SPENT / £$HARD_STOP"
echo "Spawning $AGENT_ID: $TASK_BRIEF"

# TODO: Call sessions_spawn here with proper parameters
# For now, log the intent

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "[$TIMESTAMP] Spawned $AGENT_ID: $TASK_BRIEF (mode: $MODE)" >> /root/.openclaw/workspace/agents/spawn.log

exit 0

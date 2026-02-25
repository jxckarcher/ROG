#!/usr/bin/env bash
# session_close.sh — Append a timestamped session summary to docs/BUILDLOG.md
#
# Usage: bash scripts/session_close.sh [optional summary text]
#
# Appends:
#   - Timestamp
#   - git diff --stat (what changed this session)
#   - Passed in summary or prompt for one

set -euo pipefail
cd "$(git rev-parse --show-toplevel)" 2>/dev/null || cd "$(dirname "$0")/.."

BUILDLOG="docs/BUILDLOG.md"
DATE=$(date -u +"%Y-%m-%d %H:%M UTC")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Collect what changed
DIFF_STAT=$(git diff --stat HEAD 2>/dev/null | tail -5 || echo "  (no diff)")
UNTRACKED=$(git status --short 2>/dev/null | grep "^?" | awk '{print $2}' | head -10 | tr '\n' ' ' || echo "")

# Summary from args or default
if [ $# -gt 0 ]; then
  SUMMARY="$*"
else
  SUMMARY="(no summary provided)"
fi

# Append to BUILDLOG
cat >> "$BUILDLOG" << EOF

---

## SESSION CLOSE — $DATE

**Branch:** $BRANCH @ $COMMIT
**Summary:** $SUMMARY

**Changed files:**
\`\`\`
$DIFF_STAT
\`\`\`

**Untracked:** ${UNTRACKED:-(none)}

EOF

echo "✓ Appended session close to $BUILDLOG"
echo "  $DATE — $BRANCH @ $COMMIT"

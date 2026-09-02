#!/usr/bin/env bash
# GROUNDS supervised-build dispatcher.
#
# Sends one well-scoped task to a worker model, then persists the single code
# fence it returns to a target path. The worker authors; the supervisor
# verifies. Workers run in stdout-only mode because agy's headless mode cannot
# prompt for tool permissions, so file writes are done here instead.
#
#   tools/dispatch.sh <task-file> <target-path> [account1|account2]
#
# Context (worker brief + domain types) is prepended automatically so every
# task is self-contained and the worker never needs to read the repo.

set -euo pipefail

TASK_FILE="${1:?usage: dispatch.sh <task-file> <target-path> [account]}"
TARGET="${2:?usage: dispatch.sh <task-file> <target-path> [account]}"
ACCOUNT="${3:-account1}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Include the PID: two dispatches launched in the same second would otherwise
# share a prompt file and silently run each other's task.
STAMP="$(date +%Y%m%d-%H%M%S)-$$"
LOGDIR="$ROOT/.worker-logs"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/$(basename "$TARGET" | tr '/.' '__')-$STAMP.log"
PROMPT="$LOGDIR/prompt-$STAMP.txt"

{
  cat docs/WORKER_BRIEF.md
  printf '\n\n=== CONTRACT: src/lib/types.ts (read-only, do not redefine) ===\n'
  cat src/lib/types.ts
  printf '\n\n=== YOUR TASK ===\n'
  cat "$TASK_FILE"
  cat <<EOF

=== OUTPUT MODE (strict) ===
Do NOT use any tools. Do NOT attempt to read or write files — every file you need
is pasted above. Reply with ONLY the complete contents of $TARGET, wrapped in a
single triple-backtick code fence. No prose before or after the fence.
EOF
} > "$PROMPT"

echo "[dispatch] task=$(basename "$TASK_FILE") target=$TARGET account=$ACCOUNT"

if [ "$ACCOUNT" = "account2" ]; then
  PROFILE="$HOME/.agy-profiles/account2"
  security unlock-keychain -p "agy-profile-account2" \
    "$PROFILE/Library/Keychains/login.keychain-db" >/dev/null 2>&1 || true
  env HOME="$PROFILE" agy -p "$(cat "$PROMPT")" \
    --model gemini-3.8-flash-high --effort high > "$LOG" 2>&1
else
  agy -p "$(cat "$PROMPT")" \
    --model gemini-3.8-flash-high --effort high > "$LOG" 2>&1
fi

# Strip the fence. Everything between the first ``` line and the last ``` line.
mkdir -p "$(dirname "$TARGET")"
awk '
  /^```/ { fence++; if (fence==1) next; if (fence>=2) exit }
  fence==1 { print }
' "$LOG" > "$TARGET"

BYTES=$(wc -c < "$TARGET" | tr -d ' ')
if [ "$BYTES" -lt 200 ]; then
  echo "[dispatch] FAILED — target is only ${BYTES}b. Worker log:" >&2
  tail -20 "$LOG" >&2
  exit 1
fi

echo "[dispatch] wrote $TARGET (${BYTES}b) | log: $LOG"

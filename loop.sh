#!/usr/bin/env bash
set -o pipefail

MODE="${1:-auto}"
MAX="${2:-0}"
ITER=0
BRANCH=$(git branch --show-current)

case "$MODE" in
  create) PROMPT="PROMPT_create.md" ;;
  build)  PROMPT="PROMPT_build.md" ;;
  review) PROMPT="PROMPT_review.md" ;;
  auto)   PROMPT="PROMPT_auto.md" ;;
  *)      echo "Usage: ./loop.sh [create|build|review|auto] [max_iterations]"; exit 1 ;;
esac

echo "=== GDS Autonomous Loop ==="
echo "Mode: $MODE | Prompt: $PROMPT | Branch: $BRANCH | Max: ${MAX:-unlimited}"
echo ""

while :; do
  ((ITER++))
  echo "=== Iteration $ITER (mode: $MODE) — $(date '+%H:%M:%S') ==="

  cat "$PROMPT" | claude -p \
    --dangerously-skip-permissions \
    --model opus \
    --output-format stream-json \
    --verbose

  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo "Claude exited with code $EXIT_CODE — stopping loop"
    exit $EXIT_CODE
  fi

  # Push changes
  git push origin "$BRANCH" 2>/dev/null || git push -u origin "$BRANCH"

  # Check iteration limit
  if [ "$MAX" -gt 0 ] && [ "$ITER" -ge "$MAX" ]; then
    echo "=== Reached max iterations ($MAX) ==="
    exit 0
  fi

  sleep 2  # Ctrl-C window
done

#!/usr/bin/env bash
# One-step rollback: starts the release deployed before the current one (code only; database
# migrations are not undone, see docs/runbook.md for restoring a backup).
# Usage: rollback.sh [release-dir]   (default: the newest release older than current)
source "$(dirname "$0")/lib.sh"

current=$(readlink -f "$BASE/current")
if [ $# -gt 0 ]; then
  target=$(cd "$1" && pwd)
else
  # Release names start with their deploy time, so the previous one sorts right before current.
  target=$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort |
    awk -v cur="$current" '$0 == cur { print prev; exit } { prev = $0 }')
fi
[ -n "$target" ] || {
  log "No earlier release found in $RELEASES"
  exit 1
}

backup_db "before-rollback"
start_release "$target"
wait_healthy
mark_current "$target"
log "Rolled back to $(basename "$target")"

#!/usr/bin/env bash
# Deploys an unpacked release on the server: backup, build and start, health check.
# If the new version is not healthy, the previous release is started again and the script fails.
# Usage: deploy.sh <release-dir>     (called by .github/workflows/deploy.yml)
source "$(dirname "$0")/lib.sh"

release=$(cd "${1:?Usage: deploy.sh <release-dir>}" && pwd)
previous=$(readlink -f "$BASE/current" 2>/dev/null || true)

backup_db "before-$(basename "$release")"
start_release "$release"

if wait_healthy; then
  mark_current "$release"
  prune_releases
  log "Deployed $(basename "$release")"
  exit 0
fi

if [ -n "$previous" ] && [ "$previous" != "$release" ] && [ -d "$previous" ]; then
  log "Rolling back to $(basename "$previous")"
  start_release "$previous"
  wait_healthy || log "Previous release is not healthy either: check docker compose logs"
fi
exit 1

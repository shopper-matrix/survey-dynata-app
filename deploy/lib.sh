#!/usr/bin/env bash
# Shared functions for deploy.sh, rollback.sh and backup.sh (run on the server, see
# docs/runbook.md). Server layout under BASE:
#   .env          settings and secrets (server only)
#   releases/<x>  one unpacked copy of the repo per deploy, named <UTC time>-<commit>, so
#                 sorting by name is sorting by age; current -> the one running
#   backups/      database dumps (pg_dump custom format)
set -euo pipefail

BASE=${SURVEY_BASE:-/opt/survey}
ENV_FILE=$BASE/.env
BACKUPS=$BASE/backups
RELEASES=$BASE/releases
KEEP_BACKUPS=${KEEP_BACKUPS:-30}
KEEP_RELEASES=${KEEP_RELEASES:-5}
DB_CONTAINER=survey-db-1

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

site_domain() { grep -E '^SITE_DOMAIN=' "$ENV_FILE" | cut -d= -f2-; }

# Dumps the database (if it is running) and checks the dump can be read back.
backup_db() {
  local label=${1:-manual}
  if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    log "No running database: nothing to back up"
    return 0
  fi
  mkdir -p "$BACKUPS"
  chmod 700 "$BACKUPS"
  local file
  file=$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ)-$label.dump
  docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
    >"$file.tmp"
  docker exec -i "$DB_CONTAINER" pg_restore --list <"$file.tmp" >/dev/null
  chmod 600 "$file.tmp"
  mv "$file.tmp" "$file"
  log "Backup written: $file ($(du -h "$file" | cut -f1))"
  # Keep the newest KEEP_BACKUPS dumps.
  find "$BACKUPS" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' | sort -rn |
    tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- | xargs -r rm --
}

# Builds and (re)starts the stack from a release directory.
start_release() {
  local release=$1
  ln -sfn "$ENV_FILE" "$release/deploy/.env"
  log "Starting $(basename "$release")"
  (cd "$release/deploy" && docker compose -f compose.prod.yaml up -d --build --remove-orphans)
}

# Waits up to ~3 minutes for /health to report the API and database ok.
wait_healthy() {
  local url
  url=https://$(site_domain)/health
  for _ in $(seq 1 36); do
    if curl -fsS --max-time 5 "$url" 2>/dev/null | grep -q '"database":"ok"'; then
      log "Healthy: $url"
      return 0
    fi
    sleep 5
  done
  log "Not healthy after 3 minutes: $url"
  return 1
}

mark_current() {
  ln -sfn "$1" "$BASE/current"
}

# Removes old releases (never the current one) and unused images.
prune_releases() {
  local current
  current=$(readlink -f "$BASE/current")
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort -r |
    tail -n +$((KEEP_RELEASES + 1)) | while read -r dir; do
    [ "$(readlink -f "$dir")" = "$current" ] || rm -rf -- "$dir"
  done
  docker image prune -f >/dev/null
}

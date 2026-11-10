#!/usr/bin/env bash
# Shared functions for deploy.sh, rollback.sh and backup.sh (run on the server, see
# docs/runbook.md). One directory per stack (/opt/survey = production, /opt/survey-staging):
#   .env          settings and secrets (server only); STACK_NAME names the compose project
#   releases/<x>  one unpacked copy of the repo per deploy, named <UTC time>-<commit>, so
#                 sorting by name is sorting by age; current -> the one running
#   backups/      database dumps (pg_dump custom format)
# The scripts live in <stack>/releases/<x>/deploy/, so the stack directory is found from there.
set -euo pipefail

BASE=$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
ENV_FILE=$BASE/.env
BACKUPS=$BASE/backups
RELEASES=$BASE/releases
KEEP_BACKUPS=${KEEP_BACKUPS:-30}
KEEP_RELEASES=${KEEP_RELEASES:-5}

[ -f "$ENV_FILE" ] || {
  echo "Missing $ENV_FILE (see deploy/README.md)" >&2
  exit 1
}

env_value() { grep -E "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }

STACK=$(env_value STACK_NAME)
STACK=${STACK:-survey}
DB_CONTAINER=$STACK-db-1

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

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

# Builds and (re)starts the stack from a release directory. On production
# (MANAGE_EDGE=true) the edge proxy is (re)started from the same release.
start_release() {
  local release=$1
  docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null
  ln -sfn "$ENV_FILE" "$release/deploy/.env"
  log "Starting $STACK from $(basename "$release")"
  (cd "$release/deploy" && docker compose -f compose.prod.yaml up -d --build --remove-orphans)
  if [ "$(env_value MANAGE_EDGE)" = true ]; then
    log "Starting edge proxy"
    (cd "$release/deploy/edge" && docker compose --env-file "$ENV_FILE" up -d --remove-orphans)
  fi
}

# Waits up to ~3 minutes for the API (and its database) and the web container to answer inside
# the server, then reports whether the public address answers too (it needs DNS and HTTPS).
wait_healthy() {
  for _ in $(seq 1 36); do
    if docker exec "$STACK-api-1" wget -qO- http://127.0.0.1:3000/health 2>/dev/null |
      grep -q '"database":"ok"' &&
      docker exec "$STACK-web-1" wget -qO- http://127.0.0.1:80/ 2>/dev/null | grep -q '<div id="root"'; then
      log "Healthy: $STACK api, database and web"
      local url
      url=https://$(env_value SITE_DOMAIN)/health
      if curl -fsS --max-time 10 "$url" 2>/dev/null | grep -q '"database":"ok"'; then
        log "Public address ok: $url"
      else
        log "Warning: $url does not answer yet (DNS record or certificate missing?)"
      fi
      return 0
    fi
    sleep 5
  done
  log "Not healthy after 3 minutes: docker compose logs api"
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

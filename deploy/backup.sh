#!/usr/bin/env bash
# Manual database backup on the server. Usage: backup.sh [label]
source "$(dirname "$0")/lib.sh"
backup_db "${1:-manual}"

#!/usr/bin/env bash

# Restore a custom-format PostgreSQL backup into the Docker Compose DB.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

DB_SERVICE="${DB_SERVICE:-db}"
POSTGRES_DB="${POSTGRES_DB:-tams}"
POSTGRES_USER="${POSTGRES_USER:-tams}"

usage() {
    echo "Usage: $0 <backup-file.dump> [--yes]" >&2
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
    usage
    exit 1
fi

BACKUP_FILE="$1"
AUTO_CONFIRM="${2:-}"

if [[ "$AUTO_CONFIRM" != "" && "$AUTO_CONFIRM" != "--yes" ]]; then
    usage
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Error: backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "Error: Docker is required but was not found in PATH." >&2
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "Error: Docker Compose is required but is not available." >&2
    exit 1
fi

if ! docker compose exec -T "$DB_SERVICE" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null; then
    echo "Error: PostgreSQL service '$DB_SERVICE' is not ready." >&2
    exit 1
fi

if [[ "$AUTO_CONFIRM" != "--yes" ]]; then
    echo "WARNING: This permanently replaces the contents of database '$POSTGRES_DB'."
    read -r -p "Type RESTORE to continue: " confirmation
    if [[ "$confirmation" != "RESTORE" ]]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

echo "Restoring '$BACKUP_FILE' into database '$POSTGRES_DB'..."
docker compose exec -T "$DB_SERVICE" pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --single-transaction \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    <"$BACKUP_FILE"
echo "Restore completed."

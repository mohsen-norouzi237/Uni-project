#!/usr/bin/env bash

# Create a portable PostgreSQL custom-format backup from the Docker Compose DB.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

DB_SERVICE="${DB_SERVICE:-db}"
POSTGRES_DB="${POSTGRES_DB:-tams}"
POSTGRES_USER="${POSTGRES_USER:-tams}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
BACKUP_FILE="$BACKUP_DIR/${POSTGRES_DB}_${TIMESTAMP}.dump"
TEMP_BACKUP_FILE="${BACKUP_FILE}.tmp"

if ! command -v docker >/dev/null 2>&1; then
    echo "Error: Docker is required but was not found in PATH." >&2
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "Error: Docker Compose is required but is not available." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

if ! docker compose exec -T "$DB_SERVICE" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null; then
    echo "Error: PostgreSQL service '$DB_SERVICE' is not ready." >&2
    exit 1
fi

echo "Creating backup: $BACKUP_FILE"
if docker compose exec -T "$DB_SERVICE" pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --format=custom \
    --no-owner \
    --no-privileges >"$TEMP_BACKUP_FILE"; then
    mv "$TEMP_BACKUP_FILE" "$BACKUP_FILE"
    echo "Backup completed: $BACKUP_FILE"
else
    rm -f "$TEMP_BACKUP_FILE"
    echo "Error: backup failed; no backup file was created." >&2
    exit 1
fi

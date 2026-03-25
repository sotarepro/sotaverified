#!/bin/bash
set -euo pipefail

# Usage: ./scripts/restore_reproductions.sh BACKUP_DIR [DATABASE_URL]
# Restores user-generated tables from CSV backup files.
# WARNING: This inserts data — may conflict with existing rows.

BACKUP_PATH="${1:-}"
DB_URL="${2:-}"

if [ -z "$BACKUP_PATH" ]; then
  echo "Usage: ./scripts/restore_reproductions.sh BACKUP_DIR [DATABASE_URL]"
  echo ""
  echo "Available backups:"
  ls -d ~/backups/sotaverified/*/ 2>/dev/null || echo "  No backups found"
  exit 1
fi

if [ -z "$DB_URL" ]; then
  DB_URL="${DATABASE_PUBLIC_URL:-}"
fi
if [ -z "$DB_URL" ]; then
  DB_URL=$(grep '^DATABASE_URL=' web/.env.local 2>/dev/null | cut -d'=' -f2- || true)
fi

if [ -z "$DB_URL" ]; then
  echo "ERROR: No DATABASE_URL provided or found"
  exit 1
fi

echo "WARNING: This will restore data from $BACKUP_PATH"
echo "Target: ${DB_URL:0:30}..."
read -p "Continue? (y/N) " confirm
if [ "$confirm" != "y" ]; then
  echo "Aborted."
  exit 0
fi

# Restore in FK-safe order
TABLES=(
  users
  reproductions
  reproduction_flags
  reproduction_upvotes
  paper_authors
  upvotes
  activity_log
  api_keys
  sign_up_requests
)

for TABLE in "${TABLES[@]}"; do
  CSV="$BACKUP_PATH/${TABLE}.csv"
  if [ -f "$CSV" ]; then
    ROWS=$(($(wc -l < "$CSV") - 1))
    echo "  Restoring $TABLE ($ROWS rows)..."
    psql "$DB_URL" -c "\COPY $TABLE FROM STDIN WITH CSV HEADER" < "$CSV" 2>/dev/null \
      || echo "    ⚠ Warning: some rows may have conflicted"
  fi
done

echo ""
echo "Restore complete."

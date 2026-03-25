#!/bin/bash
set -euo pipefail

# Usage: ./scripts/backup_reproductions.sh [DATABASE_URL]
# Backs up user-generated tables via psql \COPY (avoids pg_dump version mismatch).

DB_URL="${1:-}"
if [ -z "$DB_URL" ]; then
  DB_URL="${DATABASE_PUBLIC_URL:-}"
fi
if [ -z "$DB_URL" ]; then
  DB_URL=$(grep '^DATABASE_URL=' web/.env.local 2>/dev/null | cut -d'=' -f2- || true)
fi

if [ -z "$DB_URL" ]; then
  echo "ERROR: No DATABASE_URL provided, DATABASE_PUBLIC_URL not set, and not found in web/.env.local"
  exit 1
fi

BACKUP_DIR="$HOME/backups/sotaverified"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$DATE"
mkdir -p "$BACKUP_PATH"

echo "Backing up user-generated data to $BACKUP_PATH..."
echo ""

TABLES=(
  reproductions
  reproduction_flags
  reproduction_upvotes
  paper_authors
  users
  upvotes
  activity_log
  api_keys
)

for TABLE in "${TABLES[@]}"; do
  echo "  Dumping $TABLE..."
  psql "$DB_URL" -c "\COPY $TABLE TO STDOUT WITH CSV HEADER" \
    > "$BACKUP_PATH/${TABLE}.csv" 2>/dev/null
  ROWS=$(($(wc -l < "$BACKUP_PATH/${TABLE}.csv") - 1))
  echo "    → $ROWS rows"
done

# Sign-up requests (if table exists)
if psql "$DB_URL" -c "SELECT 1 FROM sign_up_requests LIMIT 0" 2>/dev/null; then
  echo "  Dumping sign_up_requests..."
  psql "$DB_URL" -c "\COPY sign_up_requests TO STDOUT WITH CSV HEADER" \
    > "$BACKUP_PATH/sign_up_requests.csv" 2>/dev/null
  ROWS=$(($(wc -l < "$BACKUP_PATH/sign_up_requests.csv") - 1))
  echo "    → $ROWS rows"
fi

# Author-submitted leaderboard results only
echo "  Dumping author-submitted leaderboard_results..."
psql "$DB_URL" -c "\COPY (SELECT * FROM leaderboard_results WHERE source IS NOT NULL AND source != 'pwc_import') TO STDOUT WITH CSV HEADER" \
  > "$BACKUP_PATH/leaderboard_results_author.csv" 2>/dev/null
ROWS=$(($(wc -l < "$BACKUP_PATH/leaderboard_results_author.csv") - 1))
echo "    → $ROWS rows"

# Summary
TOTAL_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
echo ""
echo "Backup complete: $BACKUP_PATH ($TOTAL_SIZE)"
echo "To restore: ./scripts/restore_reproductions.sh $BACKUP_PATH"

# REVIVAL.md — restoring the full catalog

Maintenance mode runs a **trimmed catalog (2,012 papers)** on Neon Free + Vercel Hobby.
This file explains how to go back to the full ~510k-paper site.

Assets (all produced 2026-10-10):
- Tag `v1-live` = the last full-catalog code (`main` at the time of the switch).
- `backups/sotaverified-prod-20261010.dump` = full Railway prod dump (`pg_dump -Fc`, PG18, ~300 MB,
  gitignored — **copy it off this machine**). Railway DB should be kept ~1 week after the new
  setup is confirmed healthy, then deleted by you.

## Which code to run

**Check out `v1-live` (or branch from it) for the full catalog. Do not just scale up the
maintenance branch.** The maintenance code is built around a 2k-paper catalog:
- `generateStaticParams` pre-renders every paper at build (510k pages: impossible).
- search, `/api/v1/sota`, `getPaperIndex`, `getUsernameIndex` hold the whole corpus in a single
  `unstable_cache` entry (limit 2 MB per entry) and filter in memory.
- paper-id membership check for 404s depends on that index.

Port forward only what you want (e.g. `withDbGuard`, robots.txt rules, `/maintenance` UX) onto `v1-live`.

## Option A — restore the full dump into a paid DB (simplest, loses maintenance-mode user data)

```bash
export NEW_URL='postgresql://…'          # new paid Postgres 18 (direct, non-pooled)
pg_restore --no-owner --no-acl --exit-on-error -j4 -d "$NEW_URL" backups/sotaverified-prod-20261010.dump
```
Anything users did in maintenance mode (sign-ups, hypes, reproductions) would be lost —
use Option B if there is any.

## Option B — keep maintenance-mode data (merge full catalog into the live Neon/new DB)

Tested locally 2026-10-10 (trimmed restore + simulated user data + merge): all five catalog
tables matched the full dump (papers 510,095; paper_code_links 251,776; paper_tasks 1,069,187;
paper_methods 637,350; leaderboard_results 59,349), user rows/reproductions/live hype were
preserved. Took ~7 min locally.

1. Restore the full dump to a scratch DB (local PG18 or the new paid DB):
   `createdb sotaverified_full && pg_restore --no-owner --no-acl -j4 -d sotaverified_full backups/sotaverified-prod-20261010.dump`
2. Export catalog rows as idempotent inserts (data-only; `pg_restore` has no such option):
   ```bash
   pg_dump -d sotaverified_full --data-only --inserts --rows-per-insert=500 --on-conflict-do-nothing \
     -t public.papers -t public.paper_code_links -t public.paper_tasks \
     -t public.paper_methods -t public.leaderboard_results \
     | sed '/^SELECT pg_catalog.setval(/d' > catalog-merge.sql
   ```
   **The `sed` is mandatory**: the export ends with `setval` calls (`leaderboard_results_id_seq`,
   `paper_code_links_id_seq`) that would rewind live sequences and cause duplicate-key errors on
   the next user write.
3. Apply to the target (direct URL): `psql "$TARGET_URL" -v ON_ERROR_STOP=1 -1 -f catalog-merge.sql`
   (Rows that already exist — the 2,012 kept papers, user-touched rows — are skipped, so live
   hype scores and user data stay as they are.)
4. `psql "$TARGET_URL" -f scripts/recompute_task_counts.sql` (re-derives paper/result counts and
   `is_visible`) and `python3 scripts/refresh_sitemap_papers.py` (rebuilds `sitemap_papers`).
5. Sanity check counts against the numbers above.

Note: Neon Free is 0.5 GB; the full catalog is several GB — this needs a paid DB.

## Switch the app

1. Check out `v1-live` (or branch from it); redeploy on a paid Vercel plan if traffic/commercial use
   requires it (Hobby is non-commercial).
2. Vercel env: `DATABASE_URL` → new DB (use a pooled endpoint with `prepare:false` only if PgBouncer
   in transaction mode; `v1-live` does not set it). Keep `NEXTAUTH_*`, `GITHUB_*`, `ADMIN_GITHUB_ID`.
   Remove `CATALOG_VERSION` / `NEXT_PUBLIC_CATALOG_SNAPSHOT_DATE` / `NEXT_PUBLIC_SUBSTACK_URL` if the
   branch you deploy doesn't use them. `ENABLE_TEST_TOOLS` must stay **unset**.
3. If you do run the maintenance branch against a bigger catalog anyway, bump `CATALOG_VERSION`
   (the Data Cache persists across deployments) and expect to revisit the points above.
4. Remove the maintenance banner and restore the old `robots.txt` (the maintenance one disallows
   `/api/`, `/search`, and pagination/filter params).
5. GitHub OAuth callback is unchanged unless the domain changes (`<domain>/api/auth/callback/github`).

## Ingestion / cron

There was never a scheduler (no `vercel.json`, no workflows in git history); the pipeline is the
manual `python3 scripts/update_pipeline.py` (needs `DATABASE_URL` and `GITHUB_TOKEN`). To re-enable
weekly runs, add the Stage 3g GitHub Action from CLAUDE.md. Don't run it right after a deploy
(see the Railway collision memory). Scripts are unchanged and still work; see
`scripts/MAINTENANCE_NOTE.md`.

## Collation note

Neon's database collation is `C.UTF-8` (local/Railway used `en_US.UTF-8`), so text `ORDER BY` on
Neon sorts uppercase before lowercase. Content is identical. A new paid DB can be created with
`en_US.UTF-8` if you care.

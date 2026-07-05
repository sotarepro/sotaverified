# SOTAVerified

## Workflow (follow this every session)
1. **Before working:** Read new instructions/spec changes → update CLAUDE.md first
   (add to Current State, Design Decisions, TODOs as appropriate), then start work
2. **While working:** Keep CLAUDE.md in sync as design decisions get made
3. **Before committing:** Check progress against CLAUDE.md — if items are incomplete,
   keep working; if done, mark them complete in CLAUDE.md
4. **When done:** Update CLAUDE.md (mark completed, add any new decisions), then commit
   and push

## Mission Statement
Open verification infrastructure for ML research. Built for humans reproducing
papers and agents verifying techniques at scale. Tracking SOTA benchmarks and
adding the reproducibility layer the field has always needed.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4
- **Database:** PostgreSQL (local: `pwc`, production: Railway)
- **Auth:** NextAuth.js v4 with GitHub provider (JWT strategy)
- **Hosting:** Vercel (frontend), Railway (Postgres)
- **Language:** TypeScript (frontend), Python (scripts/ingestion)
- **Queries:** Raw SQL via `postgres` npm package (tagged template literals) — no ORM
- **Testing:** Jest + ts-jest, node environment (no jsdom), all DB/auth mocked

## Project Overview
Community-maintained ML paper benchmark tracker. Open infrastructure for
indexing arXiv papers, tracking benchmark leaderboards, and verifying that
reported results actually reproduce — for humans and autonomous agents alike.

---

## Current State

- Stage 1 ✅ DONE — 575k papers, 242k code links, 59k leaderboard results in Postgres
- Stage 1.5 ✅ DONE — data cleanup, junction tables, paper detail query fix
- Stage 2 ✅ DONE — task browser, task detail, paper detail pages
- Stage 2.5 ✅ DONE — homepage redesign with research area grouping, hero section
- Stage 3a ✅ DONE — GitHub OAuth auth, users table, session provider, age gate
- Stage 3b ✅ DONE — hype/upvotes, API v1, "Copy JSON for Agent" button
- Stage 3c ✅ DONE — junction tables populated, arxiv_backfill.py (23,193 new papers inserted 2025-07–2026-03), arxiv_delta.py
- Stage 3d ✅ DONE — reproductions table, ReproductionForm, ReproductionList, admin page, flag/upvote
- Stage 3e ✅ DONE — About page, hero refresh with stats + agent snippet, nav links
- Stage 3-enrich ✅ DONE — github_enrich.py (--since flag added), hype_seed.py (18,320 papers seeded with recency weighting), daily_update.py, semantic_scholar_enrich.py; star counts on paper detail
- Stage 3-author ✅ DONE — paper_authors table, claim-author API, AuthorClaimButton, VerifiedAuthors, admin author claim queue
- Stage 3-verification ✅ DONE — two-dimension verification system: verification_score (int) + BadgeType; recomputeVerificationScore() on all events; /api/v1/sota; 146k papers seeded +5 for official repo
- Stage 3-social ✅ DONE — activity_log table, logEvent() utility, tier-based reputation (T1:+5/T2:+10/T3:+15/T4:+20), trusted threshold at rep≥30, trusted flags (auto-hide at 2 instead of 3), Agent Write API (POST /api/v1/reproductions), PromoteButton, revamped admin dashboard (3 sections + activity feed)
- Stage 3-test-tools ✅ DONE — admin test tools (dev/ENABLE_TEST_TOOLS=true only): create test users/papers, impersonate, reset; impersonation banner; is_test column on users+papers
- Stage 3-taxonomy ✅ DONE — research area taxonomy: 11 areas (Code & Math folded into Language & Reasoning); General ML fully dissolved (all 1,669 zero-result tasks classified via keyword rules); 3 duplicate task merges; 32 MMLU subtasks collapsed to canonical 'mmlu'; AREA_COLORS updated in all frontend files
- Stage 3-discover ✅ DONE — repo_discover_hf.py (Hugging Face Papers API),
  repo_discover_abstracts.py (abstract regex extraction); auto-discovers
  GitHub repos for papers without code links; 11,095 repos from abstracts alone
- Stage 3-perf ✅ DONE — robots.txt throttling (Crawl-delay: 10, SEO bot blocks);
  paper pages refactored to ISR-cacheable static shell (revalidate=86400,
  s-maxage=86400); /api/me/paper-state endpoint + usePaperState hook move
  user-specific UI (hype, author claim, repro/author form gating, agent promote)
  into client components; eliminates per-request DB queries and serverless
  invocations for bot/crawler hits on /papers/[id]

---

## Next: Stage 3f — Going Live

**TODO before deploying:**
- [ ] Seed 2-3 real reproductions (use your 3090) so flow isn't empty at launch
- [ ] Run github_enrich.py overnight to get broad star coverage, then re-run hype_seed.py
  - Currently: 5,583 of 242k code links enriched, 22,337 papers have hype_score > 0 (recency-weighted)
  - Command: `GITHUB_TOKEN=ghp_... python3 scripts/github_enrich.py --since 2020-01-01 --limit 250000 --db "dbname=pwc" > /tmp/enrich.log 2>&1 &`
  - After: `python3 scripts/hype_seed.py --db "dbname=pwc"`
- [ ] Run semantic_scholar_enrich.py once Semantic Scholar API key obtained
- [ ] Confirm hero stats aren't showing zeros
- [ ] npm audit clean
- [ ] Draft 2-sentence launch pitch before deploying

**Step 1 — Cloud DB (Railway): ✅ DONE**
- [x] Created Railway Postgres instance
- [x] Migrated via `pg_dump -Fc pwc | pg_restore --no-owner -d RAILWAY_URL`
- [x] Row counts verified matching (658k papers, 254k code links, 59k LR, etc.)
- [x] Scripts updated to use `DATABASE_PUBLIC_URL` env var (no --db needed)

**Step 2 — Deploy (Vercel):**
- [ ] Connect GitHub repo (github.com/sotarepro/sotaverified), set env vars in Vercel dashboard
- [ ] Update GitHub OAuth callback URL to production domain
- [ ] Set ENABLE_TEST_TOOLS=false (or omit) in production — NEVER true in prod
- [ ] Auto-deploys on git push to main

**Step 3 — Domain:**
- [ ] sotaverified.org (primary) — buy if not yet owned
- [ ] Configure DNS in Vercel, update NEXTAUTH_URL + OAuth callback URLs

**Step 4 — Launch day:**
- [ ] r/MachineLearning — frame around agent verification vision
- [ ] Hacker News — open benchmark tracking + reproducibility for agents
- [ ] Twitter/X thread: the reproducibility problem in ML, what this fixes, the agent future
- [ ] MLOps Community Slack

**Estimated monthly cost: ~$5-6 (Railway $5 + domain amortized)**

---

## Stage 3g — Post-Launch Automation (first week)
- [ ] GitHub Action: .github/workflows/arxiv-update.yml
  - Cron weekly + manual trigger, connects to Railway DB via DATABASE_URL secret
- [ ] Railway DB backups — enable in dashboard (built-in)
- [ ] Weekly backup cron: `scripts/backup_reproductions.sh`
  - Backs up: reproductions, users, upvotes, paper_authors, activity_log, api_keys,
    sign_up_requests, author-submitted leaderboard_results
  - Restore via: `scripts/restore_reproductions.sh BACKUP_DIR`
  - Uses CSV format (avoids pg_dump version mismatch with Railway Postgres 18)
- [ ] UptimeRobot free tier — pings every 5 min
- [ ] API key generation UI — api_keys table exists, no UI yet to issue keys to users

---

## Design Decisions & Implementation Notes

### Access Model & Thresholds
- All thresholds in `lib/thresholds.ts` — single source of truth, env-configurable
- Sign-in: legitimacy score computed from GitHub account signals (age, repos, followers, etc.)
- Score below LEGITIMACY_SCORE_THRESHOLD → rejected, pending row in `sign_up_requests`
- Admin (ADMIN_GITHUB_ID) exempt from legitimacy check
- Approved accounts bypass legitimacy check on subsequent sign-ins
- Once signed in: full access to all features, no reputation gates
- Human reproductions: status='community' immediately (NO auto-verify from upvotes)
- Upvotes on reproductions: +1 rep per upvote to submitter (no status change)
- Flag auto-hide: **2 flags** (FLAGS_TO_HIDE=2) from any users
- Rep per upvote: +1 to submitter per upvote (uncapped)
- Rep author claim: +5 (REP_AUTHOR_VERIFIED=5)
- Author claims: **auto-approved immediately** during early launch (SKIP_CONTRIBUTOR_CHECK=true).
  All claims visible in admin panel for spot-checking. Admin can remove bad claims
  (deducts rep + recomputes verification score). Re-enable GitHub contributor check at scale.
- Spam penalty: -20 (REP_SPAM_PENALTY=-20)
- Agent rate limit: 2/day (AGENT_SUBMISSIONS_PER_DAY=2)
- Authors CAN hype their own papers

### Impersonation / Test Tools
- Enabled when: `NODE_ENV=development` OR `ENABLE_TEST_TOOLS=true`
- **NEVER enable in production** — test users bypass GitHub OAuth
- Impersonation cookie: `sv_impersonate` (httpOnly, sameSite=lax, 24h)
- `lib/effective-session.ts` → `getEffectiveSession()` wraps `getServerSession` and
  substitutes impersonated user when cookie is present
- All user-facing action routes use `getEffectiveSession` (not `getServerSession`) so
  impersonated actions are properly attributed in the activity log
- Test user presets: `test_user` (rep 0, age 90d), `test_author` (rep 10, age 3yr)
- Reset deletes activity_log entries first (FK is SET NULL, not CASCADE), then users/papers

### Agent Write API
- `POST /api/v1/reproductions` — Bearer token auth via SHA-256 key hash in api_keys table
- Rate limit: flat **2 submissions/day** per API key (increase post-launch if needed)
- Agent submissions use `source='api'`, `status='agent_pending'`
- Any logged-in user can promote agent_pending → community via PromoteButton
- Admin sees agent submissions in a dedicated section (separate from community reproductions)

### Activity Log
- Append-only `activity_log` table — never update or delete rows
- `logEvent()` in `lib/activity.ts` swallows all errors (logging never breaks main flow)
- Events: user_signin, paper_hyped, paper_unhyped, reproduction_submitted,
  author_claimed, author_claim_failed, reproduction_flagged, reproduction_unflagged,
  agent_reproduction_submitted, agent_reproduction_promoted, rate_limit_hit,
  author_benchmark_submitted

### Hype vs Upvotes
- "Hype" is the user-facing name for upvotes throughout the UI
- `hype_score` column on papers = **single source of truth** for hype count (seeded + organic)
  - Seeded from GitHub stars (one-time, pre-launch) via hype_seed.py
  - Thresholds: 10–49→1, 50–199→2, 200–499→3, 500–999→4, 1k–1.9k→5, 2k–4.9k→7, 5k–9.9k→9, 10k–24.9k→11, 25k–49.9k→13, 50k+→15
  - Recency multipliers: 2024+: 1.0x, 2022-23: 0.5x, pre-2022: 0.25x
- `upvotes` table used only for toggle tracking (which user hyped which paper)
- When user hypes: INSERT upvotes row + UPDATE papers SET hype_score = hype_score + 1
- When user unhypes: DELETE upvotes row + UPDATE papers SET hype_score = hype_score - 1
- All display reads from `papers.hype_score` directly (no LATERAL count query needed)
- After launch: all hype from organic votes only — don't re-run hype_seed.py
- hype_seed.py has --reset flag to zero all scores before re-seeding

### Auto Repo Discovery
- `repo_discover_hf.py` — queries HF Papers API by arXiv ID, discovers
  githubRepo URLs. No auth needed. ~2% hit rate on repo-less papers.
- `repo_discover_abstracts.py` — regex extracts GitHub URLs from
  papers.abstract column. Zero API calls. ~2.3% hit rate (11,095 from 474k papers).
  Handles plain URLs, LaTeX `\url{}` and `\href{}{}` wrapping.
- Both are idempotent, safe to re-run, insert into paper_code_links
  with is_official=true, mentioned_in_paper=true (abstracts) or false (HF)
- Run order: HF first (finds repos HF community curated), abstracts second
  (catches author-mentioned repos HF doesn't know about), then github_enrich.py
  for star/fork counts, then hype_seed.py to update hype scores
- CLI: `--db`, `--limit`, `--since` (HF), `--pass {1,2,both}` (abstracts), `--dry-run`
- **Key differentiator vs PWC:** proactive repo discovery vs manual author submission

### GitHub Enrichment
- `github_enrich.py` has `--since YYYY-MM-DD` flag to filter by paper.published
- Safe to re-run — skips repos enriched in last 7 days
- `GITHUB_TOKEN` must be set as shell env var (not .env.local — Python doesn't read it)
- Pattern: `GITHUB_TOKEN=ghp_... python3 scripts/github_enrich.py ...`

### Script Pipeline

**Production pipeline (weekly, single command):**
```
export DATABASE_URL="postgresql://..."
export GITHUB_TOKEN="ghp_..."
python3 scripts/update_pipeline.py
```

Steps run in sequence:
1. `arxiv_delta.py --days 7` — ingest new papers from arXiv
2. `repo_discover_abstracts.py --pass 1` — regex scan new paper abstracts for GitHub URLs (zero API calls, instant)
3. `repo_discover_hf.py --limit 2000 --since 2025-01-01` — discover repos via HF API for papers still missing code links (2 req/s)
4. `github_enrich.py --limit 2000` — fetch star/fork counts from GitHub
5. `backup_reproductions.sh` — CSV backup of user-generated tables

Tuning flags: `--days 14`, `--hf-limit 5000`, `--enrich-limit 5000`, `--skip-backup`, `--dry-run`

**Parked scripts (do not run in production):**
- `hype_seed.py` — one-time launch bootstrapping, organic hype post-launch
- `repo_discover_fulltext.py` — high false positive rate, needs manual audit
- `daily_update.py` — deprecated, replaced by `update_pipeline.py`
- `ingest.py`, `link_papers.py`, `seed_verification_scores.py` — one-time setup

### Paper Detail — Author vs Reproducer
- Verified authors see "Submit benchmark results" but NOT "I reproduced this"
- Non-authors see "I reproduced this" but NOT "Submit benchmark results"
- Nobody sees both on the same paper
- Reproduction tiers: 1 (code runs), 2 (metrics match), 3 (independent) — Tier 4 removed
  (Tier 4 "multi-verified" is paper-level, not individually claimable)
- Tier 3 uses free text model name (new implementation, not existing model)
- Tiers 1-2 use dropdown selector from existing leaderboard models

### Code Links Display
- Paper detail page shows top 10 repos by stars, with "Show all N repos" expand button
- Repos sorted by: is_official DESC, stars DESC, mentioned_in_paper DESC
- CodeLinksList client component handles expand/collapse toggle

### Methods Hidden from UI
- Methods section removed from paper detail page
- `methods` field removed from getPaper query and PaperDetail type
- methods/paper_methods tables retained in DB for future technique registry
- See Parking Lot → "Methods as Technique Registry" for long-term vision

### Submit Page Removed
- `/submit` page, `SubmitPaperForm` component, and `/api/submit-paper` route were removed
- Paper ingestion is via scripts only (arxiv_backfill.py, arxiv_delta.py)
- "Submit" link removed from nav

### Tab Tables (5 tabs everywhere)
- Tabs: Recently Added | Most Hyped | Most Active | Needs Verification | Most Verified
- "Most Active" = papers with recent activity_log entries (7-day window), sorted by last activity
- All scoped versions (homepage, category, task page) use same PaperTabTable component
- Pagination: 10/25/50 per page, URL-based; links include `#paper-table` hash so browser
  scrolls to table position after navigation (section has scroll-mt-16)
- "Needs Verification" = unverified papers (verification_score=0) with hype>0, sorted by hype
- Leaderboard datasets ordered by submission count DESC, then alphabetically
- Hype column has InlineHypeButton (client component) — heart icon, toggles on click,
  tooltip for unauthenticated users, optimistic count update
- Paper titles in table have LaTeX stripped (stripLatex() removes $...$, \commands)
- Homepage is force-dynamic (no caching) so hype counts are always fresh

### Leaderboard Sort
- Sort options: metric value (default), verification score, date
- No hype sort on leaderboard (hype is paper-level, not result-level)
- Datasets ordered by submission_count DESC within each leaderboard view

### Performance Notes
- Area-scoped tab queries use EXISTS instead of JOIN+DISTINCT ON (~300ms vs ~600ms)
- Admin page queries run in parallel via Promise.all
- Index on activity_log(paper_id) WHERE paper_id IS NOT NULL for Most Active tab
- Indexes: idx_tasks_area, paper_tasks_pkey (paper_id, task_id), paper_tasks_task_idx,
  idx_papers_recent_sort, idx_papers_hype_score, idx_papers_verification_score,
  activity_log_created_at_idx, idx_activity_log_paper_id

### ISR + Client Session Pattern (paper pages)
- `/papers/[id]` is ISR-cached: `export const revalidate = 86400`,
  `dynamic = "force-static"`, `generateStaticParams = async () => []`
- Server component renders only public data (title, abstract, benchmarks,
  badge, code links, agent repros); does NOT call `getEffectiveSession()`
- User-specific state comes from `GET /api/me/paper-state?paper_id=X` →
  `{logged_in, upvoted, claim}` — fetched client-side via `usePaperState(paperId)`
  hook in `lib/use-paper-state.ts` (module-level Promise cache, one fetch per
  paper per session; `invalidatePaperState(paperId)` busts on mutations)
- Client components driving user UI: `UpvoteButton`, `AuthorClaimButton`,
  `AuthorVerifiedCTA` (swaps CTA copy for verified authors), `PaperReproSection`
  (gates `ReproductionForm` vs `AuthorBenchmarkForm` by claim status),
  `PromoteButton` (self-gates on `useSession`)
- Cache-Control served to browser: `s-maxage=86400, stale-while-revalidate=31449600`
- Verified locally via `next start`: first hit = cache MISS, second hit =
  `x-nextjs-cache: HIT`
- Gotcha: `layout.tsx` reads `cookies()` when `isTestToolsEnabled()` is true
  (dev OR `ENABLE_TEST_TOOLS=true`), which forces every page dynamic. In
  production `ENABLE_TEST_TOOLS` must be unset for ISR to activate — the
  existing rule "NEVER enable test tools in production" already covers this,
  but it's now load-bearing for caching, not just for safety.
- Gotcha: `ReproductionList` previously relied on `key={Date.now()}` from the
  server page to remount after submit. With ISR the server render is cached,
  so `PaperReproSection` now owns a `reproVersion` state that increments via
  `ReproductionForm`'s `onSubmitted` callback to force remount.

### Bot Throttling
- `web/public/robots.txt` — Crawl-delay: 10, Disallow /api/ and /admin/;
  full Disallow for AhrefsBot, SemrushBot, DotBot, MJ12bot (zero-value SEO crawlers);
  `Sitemap:` line points to `/sitemap-index.xml`

### Sitemap
- `web/app/sitemap.ts` — `generateSitemaps()` produces chunk id 0 (static pages +
  area pages + task pages + blog posts, ~4,840 URLs) plus one chunk per 50,000
  papers (id 1..N). Next.js serves these at `/sitemap/[id].xml` — it does **not**
  auto-generate an index at `/sitemap.xml` despite doc examples implying otherwise
  (confirmed empirically: `/sitemap.xml` 404s even with `generateSitemaps` present).
- `web/app/sitemap-index.xml/route.ts` — hand-written `<sitemapindex>` XML listing
  all chunk URLs; this is what `robots.txt` actually references. Named
  `sitemap-index.xml` (not `sitemap.xml`) because a folder literally named
  `app/sitemap.xml/` collides with the reserved `app/sitemap.ts` convention path
  and produces a silent "Duplicate page" 500 at build/runtime.
- Paper inclusion query (`getSitemapPaperCount` / `getSitemapPaperChunk` in
  `lib/queries.ts`): only papers with ≥1 code link, ≥1 leaderboard result, ≥1
  reproduction, or hype/upvote/activity signal are listed (183,717 of 471,889
  papers locally). Excluded papers remain fully live at `/papers/[id]` — this
  only changes what crawlers are pointed at, not what's servable.
- Both the index and chunk routes use `revalidate = 86400` (24h ISR) so repeat
  crawler fetches don't hit the DB.

### Data Cleanup Scripts
- `scripts/clean_methods_spam.py` — removes SEO spam from methods table (phone numbers,
  customer service entries, brand spam). Idempotent, safe to re-run. Run once pre-launch.

---

## Database Schema

### Core tables (from PWC import)
- `papers` — 471,889 rows (local dev DB count, verified 2026-07-04 during sitemap audit;
  prior "658k" figure was from an earlier snapshot and hasn't been re-confirmed against
  Railway prod — local dev DB may lag production)
  - id TEXT PK, arxiv_id, title, abstract, published DATE, authors TEXT[],
    tasks TEXT[], methods TEXT[], verification verification_tier DEFAULT 'unverified',
    hype_score INT DEFAULT 0, verification_score INT DEFAULT 0, is_test BOOLEAN DEFAULT false
- `tasks` — 4,818 rows (11 research areas, no General ML)
- `methods` — ~4,500 rows (8,580 original minus 4,073 spam entries cleaned via clean_methods_spam.py)
- `datasets` — ~16,300 rows (18,522 original minus 2,218 spam entries cleaned)
- `leaderboard_results` — 59,758 rows, metrics JSONB
- `paper_code_links` — 242k rows
  - id BIGSERIAL PK, paper_id, repo_url, is_official, framework,
    stars INT DEFAULT 0, forks INT, last_enriched_at TIMESTAMPTZ
- `paper_tasks` — populated from papers.tasks TEXT[] array
- `paper_methods` — populated from papers.methods TEXT[] array

### Tables added in launch sprint
- `users` — github_id TEXT PK, username, email, avatar_url, account_created_at,
  is_flagged_new_account BOOLEAN DEFAULT false, reputation_score INT DEFAULT 0,
  is_test BOOLEAN DEFAULT false, is_system BOOLEAN DEFAULT false, created_at,
  display_name TEXT, bio TEXT, company TEXT, location TEXT (all nullable, no default)
  - `is_system=true` for pwc-import-bot (excluded from leaderboard/profiles)
  - **Schema drift — resolved 2026-07-04:** `lib/auth.ts`, `app/leaderboard/page.tsx`,
    `app/admin/page.tsx`, and `app/profile/[username]/page.tsx` all read/write
    `display_name`, `bio`, `company`, `location` columns on `users`. These columns
    existed on Railway prod (confirmed via prod `\d users`) but were missing from
    the local dev DB (`pwc`), causing `/leaderboard`, `/admin`, and
    `/profile/[username]` to 500 locally (22 Playwright failures, all traced to
    this one cause). Fixed via `ALTER TABLE users ADD COLUMN IF NOT EXISTS
    display_name/bio/company/location text` against local `pwc` — local now
    matches prod.
- `upvotes` — paper_id, user_id, created_at (UNIQUE paper_id+user_id)
- `reproductions` — id SERIAL PK, paper_id, user_id, tier_claimed (1-3),
  hardware_spec, run_log_url (nullable), notes, upvote_count INT DEFAULT 0,
  flag_count INT DEFAULT 0, status TEXT DEFAULT 'community',
  actual_metric_name TEXT, actual_metric_value FLOAT, model_name TEXT,
  source TEXT DEFAULT 'community', created_at, reviewed_at
- `reproduction_flags` — reproduction_id, user_id (UNIQUE)
- `reproduction_upvotes` — reproduction_id, user_id (UNIQUE)
- `paper_authors` — paper_id, user_id, verified BOOLEAN, verified_at,
  verification_method TEXT, status TEXT (verified/pending_admin),
  admin_reviewed BOOLEAN DEFAULT false (nullable)
  - **Schema drift — resolved 2026-07-04:** `app/admin/page.tsx` and
    `app/api/admin/paper-authors/[paperId]/[userId]/route.ts` read/write
    `admin_reviewed` on `paper_authors`, which existed on Railway prod
    (confirmed via prod `\d paper_authors`: boolean, nullable, default false)
    but was missing locally — same direction as the `users` drift above, found
    right after fixing it. Caused `/admin` to 500 locally, cascading into 11 of
    13 remaining Playwright failures (admin page tests + claim-author flows
    that touch `paper_authors`). Fixed via `ALTER TABLE paper_authors ADD
    COLUMN IF NOT EXISTS admin_reviewed boolean DEFAULT false` against local
    `pwc` — local now matches prod. Given two drift instances found in one
    session, local `pwc` schema should be diffed against prod wholesale before
    the next work session, rather than fixing columns one 500 at a time.
  - **Schema drift — resolved 2026-07-05 (reverse direction):** `papers.methods`
    (TEXT[]) exists on local `pwc` but not on Railway prod. `insert_papers()` in
    `scripts/arxiv_backfill.py` (shared by `arxiv_backfill.py` and
    `arxiv_delta.py`) inserted into it as a hardcoded `'{}'` literal — never
    real data — so running `update_pipeline.py` against prod failed with
    `psycopg2.errors.UndefinedColumn: column "methods" of relation "papers"
    does not exist`. Fixed by dropping `methods` from the INSERT column list
    and VALUES entirely (no behavior change; it was always empty). Opposite
    direction from the drift above: there local was missing columns prod had;
    here local has a column prod lacks. Confirms the wholesale schema diff
    flagged above is still outstanding and would have caught this too.
- `activity_log` — id BIGSERIAL PK, event_type, user_id (FK SET NULL),
  paper_id (FK SET NULL), metadata JSONB, created_at
- `api_keys` — id SERIAL PK, user_id FK CASCADE, key_hash TEXT (SHA-256),
  label TEXT, created_at

### Reproduction status lifecycle
**Human reproductions:**
- `community` — submitted by user, live immediately, counts toward score
- Upvoted → submitter earns +1 rep per upvote (no status change)
- `hidden` — auto-hidden at FLAGS_TO_HIDE (2) flags, visible in admin Flagged queue
- `removed` — admin confirmed bad, permanently gone (kept in DB for audit)
- `community` — admin restored from hidden (flag_count reset, flags cleared, rep restored)
- Admin restore: restores tier_rep + upvote_count rep that was lost during flagging

**Agent reproductions:**
- `agent_pending` — submitted via API, visible in separate section, NOT counted
- `promoted` — 1 human promotion, counts toward score, moves to main section
- Flagging/removal same as human reproductions

### Benchmark status (per leaderboard row)
- Unverified: no reproductions with this dataset_id
- Author Reported: source='author', no community reproduction yet
- Community Reported: source='community', created from Tier 3 reproductions with dataset+metric+model
- Verified: has reproduction(s) with matching dataset_id and metric_value
  (shows median verified value + count; green if within 5% of claimed)

### Tier 3 → Leaderboard Row
- When a Tier 3 reproduction includes dataset_id + metric_name + metric_value + model_name,
  a `leaderboard_results` row is auto-created with source='community'
- task_id is looked up from existing leaderboard entries for the paper+dataset
- Displayed as "Community Reported" (teal badge) in PaperBenchmarks
- Only fires when all four fields are present (dataset, metric name, metric value, model name)

---

## Verification System (two-dimension)

Papers assessed on two axes:

1. **verification_score** (integer, machine-readable):
   - Any code repo exists: +5
   - Verified author claimed metrics: +10
   - Per active community reproduction: +10
   - Per reproduction within 5% of claimed metric: +5 bonus
   - Per unique hardware config across reproductions: +3
   - Recomputed via `recomputeVerificationScore(paperId)` in `lib/verification.ts`
   - Called on: repro create, flag/unflag, admin approve/remove, author claim

2. **BadgeType** (categorical, human-readable):
   - `unverified` — no repo, no author, no reproductions
   - `code_available` — has any repo in paper_code_links
   - `author_verified` — GitHub contributor claimed authorship
   - `community_verified` — at least one active reproduction exists

---

## Environment Variables

**Local `.env.local` (never commit):**
```
DATABASE_URL=postgresql://david@localhost/pwc
GITHUB_ID=your_github_oauth_app_client_id
GITHUB_SECRET=your_github_oauth_app_client_secret
NEXTAUTH_SECRET=run: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
ADMIN_GITHUB_ID=your_numeric_github_id
ENABLE_TEST_TOOLS=true         ← dev only, never in production

# Thresholds (change without code deploy — restart server to pick up)
GITHUB_MIN_ACCOUNT_AGE_DAYS=30
UPVOTES_TO_VERIFY=1
FLAGS_TO_HIDE=2
PROMOTES_TO_ACTIVATE=1
AGENT_SUBMISSIONS_PER_DAY=2
REP_TIER_1=2
REP_TIER_2=5
REP_TIER_3=10
REP_TIER_4=15
REP_METRIC_MATCH_BONUS=5
REP_PER_UPVOTE=1
REP_AUTHOR_VERIFIED=5
REP_SPAM_PENALTY=-20
```

**Production (Vercel dashboard):**
```
DATABASE_URL=railway_connection_string
GITHUB_ID=prod_oauth_app_client_id
GITHUB_SECRET=prod_oauth_app_client_secret
NEXTAUTH_SECRET=different_from_local
NEXTAUTH_URL=https://sotaverified.org
ADMIN_GITHUB_ID=same
# ENABLE_TEST_TOOLS — omit entirely in production

# Thresholds (same defaults as lib/thresholds.ts — override here to tune)
GITHUB_MIN_ACCOUNT_AGE_DAYS=30
UPVOTES_TO_VERIFY=1
FLAGS_TO_HIDE=2
PROMOTES_TO_ACTIVATE=1
AGENT_SUBMISSIONS_PER_DAY=2
REP_TIER_1=2
REP_TIER_2=5
REP_TIER_3=10
REP_TIER_4=15
REP_METRIC_MATCH_BONUS=5
REP_PER_UPVOTE=1
REP_AUTHOR_VERIFIED=5
REP_SPAM_PENALTY=-20
```

**Scripts (shell env, not .env.local):**
```
GITHUB_TOKEN=ghp_...   ← for github_enrich.py
SEMANTIC_SCHOLAR_KEY=  ← for semantic_scholar_enrich.py (optional)
```

---

## Pre-Launch QA — Test Suite Status

### Unit Tests (`npm test`) — 172 tests, 14 suites, all passing
All DB/auth/API mocked, no external deps.

- `__tests__/auth.test.ts` — sign-in callback, age gate, allowlist bypass, JWT/session (8 tests)
- `__tests__/upvotes.test.ts` — hype toggle, auth guard (7 tests)
- `__tests__/api-v1.test.ts` — GET /api/v1/papers/{id} shape + 404 (6 tests)
- `__tests__/data-layer.test.ts` — query shapes, empty states (9 tests)
- `__tests__/reproductions.test.ts` — submit, flag auto-hide, admin approve/remove (12 tests)
- `__tests__/author-verification.test.ts` — contributor check, pending claim, no-repo (6 tests)
- `__tests__/routing.test.ts` — paper links resolve to /papers/[id] (6 tests)
- `__tests__/agent-api.test.ts` — agent write API: auth, rate limit, validation, paper lookup (12 tests)
- `__tests__/sota-api.test.ts` — SOTA API: badge computation, sort, filter, empty state (11 tests)
- `__tests__/persona-flows.test.ts` — persona flows: new user age gate, promote, flag, upvote rep (13 tests)
- `__tests__/verification.test.ts` — recomputeVerificationScore + getBadgeData (12 tests)
- `__tests__/admin.test.ts` — admin author claims, reproduction approve/remove/restore (12 tests)
- `__tests__/user-journeys.test.ts` — comprehensive journey: unauth 401s, hype toggle, repro validation,
  self-upvote block, promote, author benchmarks, admin restore, thresholds, search entities (24 tests)
- `__tests__/admin-infrastructure.test.ts` — test tools: create users/papers, impersonate, reset (34 tests)

### E2E Tests (`npm run test:e2e`) — 75 tests, 14 spec files
Playwright + Chromium against localhost:3000. Requires dev server running.
(Note: this count is stale — the suite has grown to 26 spec files/~114 tests
since this section was last updated; not reconciled below, out of scope of
the 2026-07-04/05 sitemap work that found the issues below.)

**Known gaps found 2026-07-04/05, not yet resolved:**
- `signInAsTestUser()` in `e2e/helpers/auth.ts` is a literal alias for
  `signInAsAdmin()` — both sign in as `ADMIN_GITHUB_ID`. Every spec file that
  calls it shares one real identity, not a distinct persona. Combined with
  `seed-test-data` permanently marking that same account as verified author of
  `test_full`, this can leak claim state across spec files that assume a fresh
  identity. `resetTestData()` does NOT clean this up — its deletion scope is
  `WHERE user_id IN (SELECT github_id FROM users WHERE is_test = true)`, and
  the admin account has `is_test = false` by design. Fixing this properly
  means either giving specs distinct test-user personas or accepting the
  shared-identity model and writing specs accordingly — not done, needs a
  decision.
- 3 tests are `test.skip()`'d in `author.spec.ts` and
  `author-claim-scoping.spec.ts` — they assert on the claim-author route's
  contributor-check path (`pending`/`no_repo` statuses, a pre-claim repo-URL
  input), which is dead code while `SKIP_CONTRIBUTOR_CHECK = true` in
  `app/api/papers/[id]/claim-author/route.ts` (see Design Decisions →
  Access Model & Thresholds). Re-enable these tests when that flag flips back
  to `false`.

- `e2e/homepage.spec.ts` — hero, stats, 5 tabs, pagination, area cards (7 tests)
- `e2e/paper-detail.spec.ts` — title, badge, CTA, code repos, benchmarks, arXiv, tasks (13 tests)
- `e2e/hype.spec.ts` — toggle, count sync to detail, double-click guard, unauth 401 (4 tests)
- `e2e/reproduction.spec.ts` — tier restriction, submit, dataset+metric, self-upvote block, unauth 401 (6 tests)
- `e2e/author.spec.ts` — button visibility, claim flow, mutually exclusive forms (5 tests)
- `e2e/search.spec.ts` — paper search, task search, badges, links, empty state (6 tests)
- `e2e/admin.spec.ts` — access control, activity feed, test tools (5 tests)
- `e2e/navigation.spec.ts` — about, agents (tier 1-3), leaderboard, tasks, 404s, profile (9 tests)
- `e2e/lifecycle.spec.ts` — QA Workflow 4: full author→verification lifecycle (4 tests)
- `e2e/workflow1-browsing.spec.ts` — task card click, dataset accordion (2 tests)
- `e2e/workflow2-hype.spec.ts` — sign out reverts hearts to grey (1 test)
- `e2e/workflow3-repro-benchmark.spec.ts` — repro with metric → benchmark shows verified (1 test)
- `e2e/workflow5-flagging.spec.ts` — flag, auto-hide at 2, admin restore (4 tests)
- `e2e/workflow7-admin.spec.ts` — remove/restore repro, impersonation banner, reset (4 tests)
- `e2e/workflow8-consistency.spec.ts` — search badge = detail badge, leaderboard = profile (2 tests)

---

## User Journey Verification Checklist

### Persona 1: Unauthenticated Visitor (read-only)
- [x] Homepage loads with hero, stats, paper table (5 tabs)
- [x] Tab switching (recent/hyped/active/unverified/verified)
- [x] Pagination (10/25/50, URL-based with scroll anchor)
- [x] Browse research area cards → category pages
- [x] Task pages with scoped paper table + dataset leaderboards
- [x] Paper detail: title, authors, badge, CTA, code, benchmarks, reproductions
- [x] Search: papers + tasks results
- [x] Invalid routes (/papers/admin, nonexistent IDs) → 404
- [x] All interactive endpoints return 401 (unit tested)
- [x] About, Agents, Leaderboard pages render

### Persona 2: Authenticated User
- [x] Sign-in: GitHub OAuth → user upsert → session
- [x] Sign-in rejected: legitimacy score below threshold → /auth/too-new + pending signup request
- [x] Approved accounts bypass age check on retry
- [x] Hype toggle: heart red/grey, count increment/decrement
- [x] Hype count consistent between table and paper detail page
- [x] Sign out → hearts revert to grey
- [x] Authors CAN hype their own papers (no self-hype restriction)
- [x] Submit reproduction: tier 1-3 (or tier 3 only if no code repo), hardware required
- [x] Submit reproduction with dataset + metric → benchmark shows verified value
- [x] Reproduction appears without page refresh
- [x] Input validation: tier range, field lengths, metric finiteness, URL domain allowlist
- [x] Per-upvote rep: +1 per upvote to submitter (no status change on reproductions)
- [x] Self-upvote blocked on reproductions (button hidden + API 403)
- [x] Flag: increments count, auto-hide at 2 flags (FLAGS_TO_HIDE=2)
- [x] Promote agent reproductions: any logged-in user, no rep gate
- [x] Profile page: /profile/[username] with rep, rank, repros, authored papers
- [x] Leaderboard: /leaderboard with top 50 + "help verify" CTA

### Persona 3: Author
- [x] Claim authorship: GitHub contributor check on ALL repos (not just official), includes repo owners → auto-verify + badge + rep
- [x] Claim rejected: not in contributors → pending_admin row created for admin review
- [x] No official repo: descriptive message
- [x] Submit benchmark results: task + dataset + metric (author-only form)
- [x] Benchmark creates leaderboard_results row with source='author', status 'Author Reported'
- [x] Author sees 'Submit benchmark results' but NOT 'I reproduced this' on own papers
- [x] Non-authors see 'I reproduced this' but NOT 'Submit benchmark results'
- [x] Page updates without refresh after claim and benchmark submission

### Persona 4: Admin
- [x] /admin: activity feed, author claims, agent pending, signup queue, flagged reproductions
- [x] Non-admin → 404
- [x] Approve/reject author claims + clear all pending
- [x] Remove/restore reproductions
- [x] Sign-up rejection queue: approve/reject/clear-all
- [x] Test tools: create users, create papers, impersonate, reset
- [x] Impersonation: banner, attributed actions, exit restores admin

### Cross-cutting
- [x] All thresholds from lib/thresholds.ts (env-configurable, unit tested)
- [x] Verification score: +5 any code repo, +10 author, +10 per repro, +5 metric match, +3 hardware
- [x] Verification badge synced to papers.verification column (search matches detail)
- [x] Paper titles link to /papers/[id] (never direct to arXiv)
- [x] Activity logging on all user actions
- [x] Leaderboard excludes system users (pwc-import-bot)
- [x] Leaderboard shows model names (not repeated paper titles)

---

## Session Startup Checklist
1. `git log --oneline -5`
2. `psql -d pwc -c "\dt"`
3. `cd web && npm run dev --webpack` (NOT turbopack — causes FATAL panics in this version)
4. Read this file top to bottom before starting work

---

## Project Name & Branding
- Project name: SOTAVerified
- Handle/org: sotarepro
- Domain: sotaverified.org (primary), sotaverified.com (redirect)
- GitHub: github.com/sotarepro/sotaverified
- Twitter/X: @sotarepro
- Reddit: u/Life-Temperature4068 (display name: SOTA Verified)
- Do NOT reference other projects in site copy — SOTAVerified stands on its own

**Nav:** `[SOTAVerified]  Agents  Browse  About  [search]  [Sign In / avatar]`
- Browse links to `/#browse` (homepage anchor), not /tasks
- View All Tasks accessible via link next to "Browse by Research Area" heading

**Hero:**
- Headline: "The Open Verification Layer for ML Research"
- Sub: Community benchmark tracking and reproducibility verification.
  Built for researchers and autonomous research agents.
- No CTA buttons (removed — redundant with nav)

---

## Security Rules (non-negotiable)
- All SQL queries use parameterized queries. Never interpolate user input.
- User-submitted URLs validated against allowlist before storage:
  github.com, gist.github.com, wandb.ai, colab.research.google.com, huggingface.co
- Max field lengths enforced server-side: hardware_spec 500, notes 2000, metric_name 200,
  tier_claimed 1-4 range, metric_value must be finite
- Rate limiting: Agent Write API rate-limited by reputation tier (1/day, 5/hr, 20/hr).
  User-facing endpoints (upvotes, repro submit, flags) rely on auth + idempotent toggles;
  explicit rate limiting to be added post-launch if abuse detected.
- Production DB credentials use a limited-privilege role, not superuser
- Local and production NEXTAUTH_SECRET must be different values
- Security headers configured in next.config.ts: X-Content-Type-Options, X-Frame-Options,
  HSTS, Referrer-Policy, Permissions-Policy
- npm audit clean before every deploy
- ENABLE_TEST_TOOLS must NEVER be set in production
- Database credentials only in .env.local (gitignored) and Vercel dashboard
- Scripts read from DATABASE_PUBLIC_URL env var — never hardcode or commit credentials

---

## Parking Lot

**High impact — build when there's traction:**
- Extend ISR pattern to `/`, `/tasks`, `/tasks/[id]`: same refactor shape as
  paper pages — remove `getEffectiveSession()` from the server component,
  move user-specific hype-heart state into client components backed by a
  `/api/me/*` endpoint. Homepage and tasks index have user-specific tab/pagination
  state in URL that complicates full static caching; consider `unstable_cache`
  around query functions as a lower-risk alternative that cuts DB egress without
  eliminating function invocations.
- Code links display — official vs community implementations:
  Many popular papers have community code links from other teams
  that built on or reimplemented the work. These show alongside
  the official repo on the paper detail page, which is confusing.
  Fix: on paper detail, show only is_official=true repos by
  default. Add a "Show N community implementations" expand
  button for the rest. This separates the author's own code
  from third-party reimplementations. Also consider: admin tool
  to manually mark repos as official/community, and a script
  to auto-detect community repos (repo owner != paper author
  org, repo name doesn't match paper name, etc).
- Author dataset creation: authors cannot add datasets that don't exist in the
  dropdown. Need "Add new dataset" option in the benchmark form for novel benchmarks.
  Required for authors working on new benchmarks not yet in the system.
- Author claim approval notification: users who get manually approved have no way
  to know unless they revisit the paper. Need email or on-site notification.
- Methods as Technique Registry (future, high impact for agents)
  The methods/paper_methods tables contain noisy PWC tag data (hidden from UI since
  launch). The long-term vision is to rebuild methods as a structured technique
  registry for autoML and autonomous research agents.
  Future architecture:
  - Each method is a technique entry: name, description, category
    (optimizer, architecture, regularization, data augmentation, etc.)
  - Methods linked to benchmark results with measured impact:
    "Adding cosine annealing improved Top-1 accuracy by 2.1% on ImageNet for ResNet-50"
  - Community can submit new techniques with evidence
  - Authors can tag which techniques their paper introduces vs uses
  - Techniques have their own verification scores based on how many
    papers/reproductions confirm the improvement
  - API endpoint: GET /api/v1/techniques?category=optimizer&task=image-classification&min_impact=1.0
    Returns ranked techniques with verified impact metrics
  - MCP tool: query_techniques(category, task, min_verified_impact)
    → ranked techniques an autonomous researcher should try next
  This is the "technique queue" for Karpathy-style autoresearch:
  an agent queries SOTAVerified for verified techniques, applies them to its current
  architecture, measures impact, and submits results back. The methods table becomes
  the backlog that autonomous research agents pull from during development.
  Requires: data curation pass on existing methods, structured method-to-result linking
  schema, technique impact measurement, community submission flow. Not MVP — build when
  agent API usage demonstrates demand for technique-level queries.
- Community paper→task tagging
  Problem: arxiv-ingested papers have no task assignments, so they never
  appear in area browsing or leaderboards. ~50-80k backfilled papers are task-less stubs.
  Solution (3 tiers, implement in order):
  Tier 1 — Admin tagging UI
    - Admin page gets "Untagged Papers" tab
    - Shows recent papers with tasks = '{}'
    - Admin can assign 1+ tasks from existing task list via autocomplete
    - Updates papers.tasks array and paper_tasks junction table
  Tier 2 — Community tagging (reputation-gated)
    - Users with rep >= 10 can suggest task tags for papers
    - New table: paper_task_suggestions (paper_id, user_id, task_name, created_at)
    - Suggestions shown to admin for approval, or auto-approved after N=3 votes
  Tier 3 — Auto-classification
    - On ingestion, run lightweight classifier (title + abstract → task)
    - Use existing task list as label set; assign above confidence threshold
    - Claude API option: send title+abstract, get back task names
    - Or simpler: keyword matching against task names (good enough for ~80%)
- Trending papers with external signal (GitHub stars, HN, Twitter/X)
- Conference-based filtering (NeurIPS 2025, CVPR 2026 etc.)
- API key generation UI (api_keys table exists, no UI yet)
- Embeddings-based paper similarity / recommendation

**Medium — strong differentiators:**
- Multi-implementation verification from existing data: attempted and rolled back.
  The leaderboard_results table has no FK to paper_code_links, making it impossible
  to trace which repo produced which result. All leaderboard entries are model variants
  from the same study, not cross-repo reproductions. Future approach: if we add a
  code_link_id column to leaderboard_results and populate it during ingestion, cross-repo
  verification becomes possible. For now, all verification comes from user and agent
  submissions only.
- Hardware-normalized leaderboards (accuracy/VRAM, accuracy/FLOPs) — nobody has built this
- Compare two methods head to head across benchmarks
- Email digest — weekly newly replicated papers in your areas
- MCP server exposing query_techniques, get_paper, submit_verification

**Stage 4 — Reputation & Delegated Moderation:**
- Users with rep > 100 gain "Moderator Lite": 2x flag weight, 2x upvote weight
- Automated flagging worker: ping run_log_url nightly, 404 → auto-flag

**Stage 5 — Agentic Integration:**
- MCP server (see parking lot above)
- Verification bounty board with Stripe escrow
- Automated eval in Modal sandbox for ML benchmarks (longer term)

**Stage 6 — Hype Economy (post-traction, data-informed):**
- Replace simple upvotes with hype balance system
- Hype earned via reproductions, spent on papers you want verified
- Calibrate thresholds from real traffic data first

**Lower priority:**
- Community discussion threads per paper (HN-style)
- Reading list, Cmd+K search palette, research area heatmap
- Mobile app, Semantic Scholar citation graph integration

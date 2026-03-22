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
papers and agents verifying techniques at scale. Restoring the SOTA tracking
the community lost when Papers With Code shut down in July 2025 — and adding
the reproducibility layer it never had.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4
- **Database:** PostgreSQL (local: `pwc`, production: Railway)
- **Auth:** NextAuth.js v4 with GitHub provider (JWT strategy)
- **Hosting:** Vercel (frontend), Railway (Postgres)
- **Language:** TypeScript (frontend), Python (scripts/ingestion)
- **Queries:** Raw SQL via `postgres` npm package (tagged template literals) — no ORM
- **Testing:** Jest + ts-jest, node environment (no jsdom), all DB/auth mocked

## Project Overview
Community-maintained ML paper benchmark tracker and spiritual successor to
Papers With Code. Meta shut it down without notice in July 2025. The archived
data lives on GitHub/HuggingFace but is frozen. We restore it, keep it current
via arXiv ingestion, and add verification tiers so the community (and
eventually autonomous agents) can confirm that reported results actually
reproduce.

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
- Stage 3-enrich ✅ DONE — github_enrich.py (--since flag added), hype_seed.py (57 papers seeded), daily_update.py, semantic_scholar_enrich.py; star counts on paper detail
- Stage 3-author ✅ DONE — paper_authors table, claim-author API, AuthorClaimButton, VerifiedAuthors, admin author claim queue
- Stage 3-verification ✅ DONE — two-dimension verification system: verification_score (int) + BadgeType; recomputeVerificationScore() on all events; /api/v1/sota; 146k papers seeded +5 for official repo
- Stage 3-social ✅ DONE — activity_log table, logEvent() utility, tier-based reputation (T1:+5/T2:+10/T3:+15/T4:+20), trusted threshold at rep≥30, trusted flags (auto-hide at 2 instead of 3), Agent Write API (POST /api/v1/reproductions), PromoteButton, revamped admin dashboard (3 sections + activity feed)
- Stage 3-test-tools ✅ DONE — admin test tools (dev/ENABLE_TEST_TOOLS=true only): create test users/papers, impersonate, reset; impersonation banner; is_test column on users+papers

---

## Next: Stage 3f — Going Live

**TODO before deploying:**
- [ ] Seed 2-3 real reproductions (use your 3090) so flow isn't empty at launch
- [ ] Run github_enrich.py overnight to get broad star coverage, then re-run hype_seed.py
  - Currently: 5,583 of 242k code links enriched, 57 papers have hype_score > 0
  - Command: `GITHUB_TOKEN=ghp_... python3 scripts/github_enrich.py --since 2020-01-01 --limit 250000 --db "dbname=pwc" > /tmp/enrich.log 2>&1 &`
  - After: `python3 scripts/hype_seed.py --db "dbname=pwc"`
- [ ] Run semantic_scholar_enrich.py once Semantic Scholar API key obtained
- [ ] Confirm hero stats aren't showing zeros
- [ ] npm audit clean
- [ ] Draft 2-sentence launch pitch before deploying

**Step 1 — Cloud DB (Railway):**
- [ ] Create account at railway.app, provision Postgres
- [ ] Migrate: `pg_dump -Fc pwc | pg_restore --no-owner -d RAILWAY_URL`
- [ ] Verify row counts match

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
- [ ] Hacker News — "Papers With Code is back, built for agents"
- [ ] Twitter/X thread: what happened to PWC, what this fixes, the agent future
- [ ] MLOps Community Slack

**Estimated monthly cost: ~$5-6 (Railway $5 + domain amortized)**

---

## Stage 3g — Post-Launch Automation (first week)
- [ ] GitHub Action: .github/workflows/arxiv-update.yml
  - Cron weekly + manual trigger, connects to Railway DB via DATABASE_URL secret
- [ ] Railway DB backups — enable in dashboard (built-in)
- [ ] UptimeRobot free tier — pings every 5 min
- [ ] API key generation UI — api_keys table exists, no UI yet to issue keys to users

---

## Design Decisions & Implementation Notes

### Reputation & Trust
- Trusted threshold: **rep ≥ 30** (not 50 — lowered to make trust achievable early)
- Tier-based rep awards on reproduction verified: T1:+5, T2:+10, T3:+15, T4:+20
- Flag weight: trusted users (rep≥30) trigger auto-hide at **2 flags** (regular: 3)
- Upvote auto-verify: reproduction reaches "verified" when 3+ upvotes from rep≥30 users
- Penalty for spam: -20 rep when reproduction auto-hidden at 3 flags

### Impersonation / Test Tools
- Enabled when: `NODE_ENV=development` OR `ENABLE_TEST_TOOLS=true`
- **NEVER enable in production** — test users bypass GitHub OAuth
- Impersonation cookie: `sv_impersonate` (httpOnly, sameSite=lax, 24h)
- `lib/effective-session.ts` → `getEffectiveSession()` wraps `getServerSession` and
  substitutes impersonated user when cookie is present
- All user-facing action routes use `getEffectiveSession` (not `getServerSession`) so
  impersonated actions are properly attributed in the activity log
- Test user presets: `test_new_user` (rep 0, age-gated), `test_trusted_user` (rep 50),
  `test_author` (rep 10, age 3yr)
- Reset deletes activity_log entries first (FK is SET NULL, not CASCADE), then users/papers

### Agent Write API
- `POST /api/v1/reproductions` — Bearer token auth via SHA-256 key hash in api_keys table
- Rate limits by reputation: rep<30 → 1/day, rep 30–200 → 5/hr, rep 200+ → 20/hr
- Agent submissions use `source='api'`, `status='agent_pending'`
- Trusted users (rep≥30) can promote agent_pending → community via PromoteButton
- Admin sees agent submissions in a dedicated section (separate from community reproductions)

### Activity Log
- Append-only `activity_log` table — never update or delete rows
- `logEvent()` in `lib/activity.ts` swallows all errors (logging never breaks main flow)
- Events: user_signin, paper_hyped, paper_unhyped, reproduction_submitted,
  author_claimed, reproduction_flagged, reproduction_unflagged,
  agent_reproduction_submitted, agent_reproduction_promoted, rate_limit_hit

### Hype vs Upvotes
- "Hype" is the user-facing name for upvotes throughout the UI
- `hype_score` column on papers = seeded from GitHub stars (one-time, pre-launch)
  - Thresholds: 10–99 stars→1, 100–499→3, 500–1999→5, 2000+→10
- Organic upvotes stored in `upvotes` table, counted at query time
- "Most Hyped" sort = `COUNT(upvotes) + hype_score DESC`
- After launch: all hype from organic votes only — don't re-run hype_seed.py

### GitHub Enrichment
- `github_enrich.py` now has `--since YYYY-MM-DD` flag to filter by paper.published
- Safe to re-run — skips repos enriched in last 7 days
- `GITHUB_TOKEN` must be set as shell env var (not .env.local — Python doesn't read it)
- Pattern: `GITHUB_TOKEN=ghp_... python3 scripts/github_enrich.py ...`

### Submit Page Removed
- `/submit` page, `SubmitPaperForm` component, and `/api/submit-paper` route were removed
- Paper ingestion is via scripts only (arxiv_backfill.py, arxiv_delta.py)
- "Submit" link removed from nav

### Tab Tables (4 tabs everywhere)
- Tabs: Recent | Most Hyped | Needs Verification | Most Verified
- All scoped versions (homepage, category, task page) use same PaperTabTable component
- Pagination: 10/25/50 per page, URL-based (no client JS needed)
- "Needs Verification" = unverified papers (verification_score=0) with hype>0, sorted by hype
- Leaderboard datasets ordered by submission count DESC, then alphabetically

### Leaderboard Sort
- Sort options: metric value (default), verification score, date
- No hype sort on leaderboard (hype is paper-level, not result-level)
- Datasets ordered by submission_count DESC within each leaderboard view

---

## Database Schema

### Core tables (from PWC import)
- `papers` — 658k rows (575k original + 23k arXiv backfill 2025-07–2026-03)
  - id TEXT PK, arxiv_id, title, abstract, published DATE, authors TEXT[],
    tasks TEXT[], methods TEXT[], verification verification_tier DEFAULT 'unverified',
    hype_score INT DEFAULT 0, verification_score INT DEFAULT 0, is_test BOOLEAN DEFAULT false
- `tasks` — 3,956 rows
- `methods` — 8,580 rows
- `datasets` — 18,522 rows
- `leaderboard_results` — 59,758 rows, metrics JSONB
- `paper_code_links` — 242k rows
  - id BIGSERIAL PK, paper_id, repo_url, is_official, framework,
    stars INT DEFAULT 0, forks INT, last_enriched_at TIMESTAMPTZ
- `paper_tasks` — populated from papers.tasks TEXT[] array
- `paper_methods` — populated from papers.methods TEXT[] array

### Tables added in launch sprint
- `users` — github_id TEXT PK, username, email, avatar_url, account_created_at,
  is_flagged_new_account BOOLEAN DEFAULT false, reputation_score INT DEFAULT 0,
  is_test BOOLEAN DEFAULT false, created_at
- `upvotes` — paper_id, user_id, created_at (UNIQUE paper_id+user_id)
- `reproductions` — id SERIAL PK, paper_id, user_id, tier_claimed (1-4),
  hardware_spec, run_log_url, notes, upvote_count INT DEFAULT 0,
  flag_count INT DEFAULT 0, status TEXT DEFAULT 'community',
  actual_metric_name TEXT, actual_metric_value FLOAT,
  source TEXT DEFAULT 'community', created_at, reviewed_at
- `reproduction_flags` — reproduction_id, user_id (UNIQUE)
- `reproduction_upvotes` — reproduction_id, user_id (UNIQUE)
- `paper_authors` — paper_id, user_id, verified BOOLEAN, verified_at,
  verification_method TEXT, status TEXT (verified/pending_admin)
- `activity_log` — id BIGSERIAL PK, event_type, user_id (FK SET NULL),
  paper_id (FK SET NULL), metadata JSONB, created_at
- `api_keys` — id SERIAL PK, user_id FK CASCADE, key_hash TEXT (SHA-256),
  label TEXT, created_at

### Reproduction status values
- `community` — submitted by user, live immediately
- `agent_pending` — submitted via API, needs trusted-user promotion
- `verified` — 3+ upvotes from rep≥30 users OR admin approved
- `hidden` — auto-hidden by flag threshold (3 flags, or 2 from trusted user)
- `removed` — admin rejected

---

## Verification System (two-dimension)

Papers assessed on two axes:

1. **verification_score** (integer, machine-readable):
   - Official code repo exists: +5
   - Verified author claimed metrics: +10
   - Per active community reproduction: +10
   - Per reproduction within 5% of claimed metric: +5 bonus
   - Per unique hardware config across reproductions: +3
   - Recomputed via `recomputeVerificationScore(paperId)` in `lib/verification.ts`
   - Called on: repro create, flag/unflag, admin approve/remove, author claim

2. **BadgeType** (categorical, human-readable):
   - `unverified` — no repo, no author, no reproductions
   - `code_available` — has official repo in paper_code_links
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
GITHUB_MIN_ACCOUNT_AGE_DAYS=60
ENABLE_TEST_TOOLS=true         ← dev only, never in production
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
```

**Scripts (shell env, not .env.local):**
```
GITHUB_TOKEN=ghp_...   ← for github_enrich.py
SEMANTIC_SCHOLAR_KEY=  ← for semantic_scholar_enrich.py (optional)
```

---

## Pre-Launch QA — Test Suite Status
All tests run with `npm test` (no external deps — all DB/auth/API mocked).
**59 tests, all passing.**

- `__tests__/auth.test.ts` — session, age gate, user upsert (8 tests)
- `__tests__/upvotes.test.ts` — toggle upvote, auth guard (8 tests)
- `__tests__/api-v1.test.ts` — GET /api/v1/papers/{id} shape + 404 (6 tests)
- `__tests__/data-layer.test.ts` — query shapes, empty states (9 tests)
- `__tests__/reproductions.test.ts` — submit, flag, admin approve/remove (12 tests)
- `__tests__/author-verification.test.ts` — contributor check, fallback (6 tests)
- `__tests__/routing.test.ts` — paper links resolve to /papers/[id] (6 tests)

**Remaining uncovered (low priority pre-launch):**
- Ingestion scripts (arxiv_delta, semantic_scholar_enrich, github_enrich)
- Unique DB constraints (would need real DB)
- arXiv link only appears on paper detail page

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
- Do NOT use "Papers with Code" in site name or hero headline —
  reference only as "successor to Papers with Code" on the About page

**Nav:** `[SOTAVerified]  Browse  About  [search]  [Sign In / avatar]`

**Hero:**
- Headline: "The Open Verification Layer for ML Research"
- Sub: Community benchmark tracking and reproducibility verification.
  Built for researchers and autonomous research agents.
- CTA: [Browse Benchmarks]  [Sign in with GitHub]

---

## Security Rules (non-negotiable)
- All SQL queries use parameterized queries. Never interpolate user input.
- User-submitted URLs validated against allowlist before storage:
  github.com, gist.github.com, wandb.ai, colab.research.google.com, huggingface.co
- Max field lengths enforced server-side: hardware_spec 500 chars, notes 2000 chars
- Rate limiting on all API endpoints (100/min) and auth endpoints (30/min)
- Production DB credentials use a limited-privilege role, not superuser
- Local and production NEXTAUTH_SECRET must be different values
- Security headers configured in next.config.js (CSP, HSTS, X-Frame-Options)
- npm audit clean before every deploy
- ENABLE_TEST_TOOLS must NEVER be set in production

---

## Parking Lot

**High impact — build when there's traction:**
- Trending papers with external signal (GitHub stars, HN, Twitter/X)
- Conference-based filtering (NeurIPS 2025, CVPR 2026 etc.)
- API key generation UI (api_keys table exists, no UI yet)
- Embeddings-based paper similarity / recommendation

**Medium — strong differentiators:**
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

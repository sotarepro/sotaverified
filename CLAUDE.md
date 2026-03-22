# SOTAVerified

## Mission Statement
Open verification infrastructure for ML research. Built for humans reproducing
papers and agents verifying techniques at scale. Restoring the SOTA tracking
the community lost when Papers With Code shut down in July 2025 — and adding
the reproducibility layer it never had.

## Tech Stack
- **Frontend:** Next.js (App Router), Tailwind CSS
- **Database:** PostgreSQL (local: `pwc`, production: Railway)
- **Auth:** NextAuth.js with GitHub provider
- **Hosting:** Vercel (frontend), Railway (Postgres)
- **Language:** TypeScript (frontend), Python (scripts/ingestion)
- **Queries:** Raw SQL via `pg` — no ORM

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
- Stage 3b ✅ DONE — upvotes, API v1, "Copy JSON for Agent" button, sort by upvotes
- Stage 3c ✅ DONE — junction tables populated, arxiv_backfill.py, arxiv_delta.py, submit page
- Stage 3d ✅ DONE — reproductions table, ReproductionForm, ReproductionList, admin page, flag/upvote
- Stage 3e ✅ DONE — About page, hero refresh with stats + agent snippet, nav links
- Stage 3d-enrich ✅ DONE — enrichment pipeline: github_enrich.py, semantic_scholar_enrich.py, hype_seed.py, daily_update.py; star counts on paper detail; hype_score in "hyped" tab
- Stage 3e-author ✅ DONE — paper_authors table, claim-author API, AuthorClaimButton, VerifiedAuthors component, admin author claim queue

---

## Upcoming Stages

## 🚀 The Launch Sprint

### Stage 3a — Identity ✅ DONE
- [x] Install and configure NextAuth.js with GitHub provider
- [x] Add users table:
  - github_id (text, primary key), username, email, avatar_url,
    account_created_at, created_at, reputation_score (default 0)
- [x] Session provider wrapper in app layout
- [x] Login/logout button in nav — shows avatar + username when logged in
- [x] GitHub account age gate on first login:
  - Soft check: flag accounts < 60 days old
    (GITHUB_MIN_ACCOUNT_AGE_DAYS env var, default 60)
  - Upvoting open to all logged-in users regardless of account age
  - Reproduction submissions require passing the age gate
  - Store account_created_at for future policy tuning
- [x] .env.local for secrets (never commit):
  - GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL,
    ADMIN_GITHUB_ID, GITHUB_MIN_ACCOUNT_AGE_DAYS
- [x] .env.example committed to repo with placeholder values
- [x] Jest unit tests (mocked GitHub provider, no real credentials):
  - Session creation, unauthenticated redirect, user upsert on first login
- [x] Manual prereq: create GitHub OAuth App at
  github.com → Settings → Developer Settings → OAuth Apps → New OAuth App
  - Homepage URL: http://localhost:3000
  - Callback URL: http://localhost:3000/api/auth/callback/github

### Stage 3b — Social Signal + Agent Hook ✅ DONE
**Upvotes:**
- [x] upvotes table: paper_id, user_id, created_at
  - Unique constraint on (paper_id, user_id)
- [x] Toggle upvote on/off — clicking again removes vote, requires login
- [x] Upvote count visible on paper cards and paper detail page header
- [x] Sort options on leaderboard pages: by metric value, by upvotes

**API v1 (one route, same stage):**
- [x] GET /api/v1/papers/{arxiv_id}
  - Returns structured JSON: title, abstract, authors, tasks,
    verified leaderboard results, code links
- [x] "Copy JSON for Agent" button on every paper detail page
  - Dark-themed code preview showing the response shape
  - This is the visual signal that this is infrastructure, not a blog

### Stage 3c — Ingestion Heartbeat ✅ DONE
**Fix junction tables first (enables task/method browsing):**
- [x] Populate paper_tasks from papers.tasks TEXT[] array (1.09M rows)
- [x] Populate paper_methods the same way
- [ ] Add paper_count column to tasks table, update from junction table

**arXiv backfill (run before going live):**
- [x] Write scripts/arxiv_backfill.py using arXiv OAI-PMH API
  - Pull papers from 2025-07-01 to today
  - Categories: cs.CV, cs.LG, cs.CL, cs.AI, cs.NE, stat.ML
  - ON CONFLICT (arxiv_id) DO NOTHING — safe to re-run
  - Run: python scripts/arxiv_backfill.py --from 2025-07-01

**Weekly delta:**
- [x] Write scripts/arxiv_delta.py
  - Pull papers from last N days (default 7), same categories and upsert logic
  - Run manually at first: python scripts/arxiv_delta.py --days 7

**Community paper submission:**
- [x] "Submit a Paper" page — text input takes an arXiv ID
  - Hits arXiv API, pulls metadata, inserts into papers table
  - Requires login
  - Deduplicates on arxiv_id (if exists, redirect to paper page)

### Stage 3d — Social Verification (Post & Flag) ✅ DONE
**The reproduction flow:**
- [x] "I reproduced this" button on paper detail page
  - Requires login + passing account age gate
- [x] reproductions table:
  - id SERIAL PRIMARY KEY
  - paper_id, user_id, tier_claimed (1-4)
  - hardware_spec TEXT (e.g. "RTX 3090, 24GB, Ubuntu 22.04")
  - run_log_url TEXT (GitHub gist, wandb run, etc.)
  - notes TEXT (metrics, observations — keep freeform)
  - upvote_count INT default 0, flag_count INT default 0
  - status TEXT default 'community_verified'
  - created_at, reviewed_at
- [ ] Submission form — minimal:
  - Tier claimed (dropdown: 1-4)
  - Hardware (free text)
  - Run log URL
  - Notes (tell people to include metric name + value here)

**Immediate posting, community moderation:**
- [ ] Submissions go live instantly as "Community Contribution"
- [ ] Upgrade to "Verified" badge via either path:
  - 3+ upvotes from users with reputation_score > 50
  - Admin manual verification (high signal, low volume)
- [x] "Flag" button on reproductions — requires login
  - 3 flags auto-hides the post, sends to /admin queue
- [x] Reputation: +10 for a reproduction that reaches "Verified",
  -20 for a confirmed spam flag

**Simple /admin page:**
- [x] Access control: session.user.github_id !== ADMIN_GITHUB_ID → 404
- [x] Table of flagged/hidden submissions
- [x] Approve (restore) / Remove buttons
- [x] Updates status + reviewed_at

### Stage 3e — Launch Polish ✅ DONE
**About page (/about):**
- [x] What happened to Papers With Code (2-3 sentences)
- [x] What this project is and why it exists
- [x] The verification tier system explained simply
- [x] The agent vision: "Built for humans and autonomous research agents.
  Donate your compute to verify papers you care about —
  verification as a public good."
- [x] Link to GitHub repo + how to contribute

**Hero section refresh:**
- [x] Headline: "The Open Verification Layer for AI Research"
- [x] Sub-headline: "Tracking SOTA, ingesting arXiv weekly, and building
  the ground-truth data for autonomous research agents."
- [x] Stat bar with paper count + code links count
- [x] Agent console snippet on homepage
- [ ] "Verification Needed" feed: papers sorted by (upvotes / age)

**Pre-launch seeding:**
- [ ] Seed 2-3 reproductions yourself (use your 3090)
  so the verification flow isn't empty when people arrive
- [ ] Pick papers you've actually run — authenticity matters

### Stage 3f — Going Live

**Step 1 — Cloud DB (Railway):**
- [ ] Create account at railway.app, provision Postgres
- [ ] Migrate: pg_dump -Fc pwc | pg_restore --no-owner -d RAILWAY_URL
- [ ] Verify row counts match

**Step 2 — Deploy (Vercel):**
- [ ] Connect GitHub repo, set env vars in Vercel dashboard
- [ ] Update GitHub OAuth callback URL to production domain
- [ ] Auto-deploys on git push to main

**Step 3 — Domain:**
- [ ] Buy domain (~$12/year — Namecheap or Cloudflare)
  - Options: paperswithcode.community, sotabench.org, mlpapers.io
- [ ] Configure DNS in Vercel, update NEXTAUTH_URL + OAuth URLs

**Step 4 — Launch day:**
- [ ] Draft 2-sentence pitch BEFORE deploying — don't wing it
- [ ] r/MachineLearning — frame around agent verification vision
- [ ] Hacker News — "Papers With Code is back, built for agents"
- [ ] Twitter thread: what happened to PWC, what this fixes, the agent future
- [ ] MLOps Community Slack
- [ ] Confirm: About page clean, GitHub README clean, repo public,
  example reproductions seeded, hero stats not showing zeros

**Estimated monthly cost: ~$5-6 (Railway $5 + domain amortized)**

### Stage 3d — Ingestion & Enrichment Pipeline

**arXiv ingestion (run before going live):**
- [ ] scripts/arxiv_backfill.py — backfill from 2025-07-01 to today
  - Categories: cs.CV, cs.LG, cs.CL, cs.AI, cs.NE, stat.ML
  - ON CONFLICT (arxiv_id) DO NOTHING — safe to re-run
  - Shortcut: last 30 days only pre-launch, backfill gap async

**Enrichment pipeline:**
- [ ] scripts/semantic_scholar_enrich.py
  - For papers missing code links, query Semantic Scholar API
  - Store found repos in paper_code_links with source='semantic_scholar'
  - Prioritize: enrich recent papers first (last 6 months),
    then backfill older papers overnight
- [ ] scripts/github_enrich.py
  - For repos in paper_code_links, fetch star/fork counts
  - Add columns to paper_code_links: stars INT, forks INT,
    last_enriched_at TIMESTAMP
  - Display stars on repo cards in paper detail page
- [ ] scripts/hype_seed.py (ONE-TIME, run before launch)
  - Convert star counts to initial hype scores:
    10-100 stars → 1, 100-500 → 3, 500-2000 → 5, 2000+ → 10
  - Max hype per paper capped at 10
  - Run once to populate "Most Hyped" tab for launch
  - After launch, all hype comes from organic user votes only
  - Reset option if needed: TRUNCATE paper_hype and let it rebuild

**Master script:**
- [ ] scripts/daily_update.py — runs all steps in sequence:
  1. arxiv_delta.py → new papers
  2. semantic_scholar_enrich.py → code links for new papers
  3. github_enrich.py → star counts for new repos
  4. hype_seed.py → initial hype for papers with zero organic votes
- [ ] GitHub Action runs daily_update.py on cron (Stage 3g)

**Community paper submission:**
- [ ] "Submit a Paper" — arXiv ID input, pulls metadata, deduplicates
  - Triggers enrichment for submitted paper immediately

**Rate limits to respect:**
- arXiv OAI-PMH: 1 req/sec max
- Semantic Scholar: 100 req/sec with API key
- GitHub: 5000 req/hour with token

**Env vars (add to .env.local and Vercel):**
- SEMANTIC_SCHOLAR_KEY=free key from semanticscholar.org/product/api
- GITHUB_TOKEN=personal access token with public_repo read scope

### Stage 3e — Author Verification

**Key insight:** GitHub OAuth + Semantic Scholar repo enrichment enables
automatic author verification without manual review.

- [ ] paper_authors table:
  - paper_id, user_id, verified BOOLEAN, verified_at,
    verification_method TEXT (github_contributor / manual_admin)
- [ ] "I authored this paper" button on paper detail page (login required)
- [ ] Verification flow:
  1. Paper must have an official repo (is_official=true in paper_code_links)
  2. User clicks "I authored this"
  3. Backend: GET /repos/{owner}/{repo}/contributors via GitHub API
  4. If user's github_username is in contributor list → auto-verified
  5. User added to paper_authors with verified=true,
     verification_method='github_contributor'
  6. Verified authors can submit benchmark scores at Tier 2 automatically
     (trusted without manual review, still logged and visible)
- [ ] Verified author badge on paper detail page: "Author verified via
  GitHub" with the author's avatar
- [ ] If paper has no official repo OR user is not a contributor:
  - Submission goes to pending queue for admin review
  - Status: 'pending_admin' in paper_authors table

**Edge cases (handle post-launch):**
- Author didn't push code → vouching from other verified authors
- Multiple official repos → check contributors across all
- Org-owned repos → check org membership as fallback

### Stage 3g — Automation (first week post-launch)
- [ ] GitHub Action: .github/workflows/arxiv-update.yml
  - Cron weekly + manual trigger, connects to Railway DB
- [ ] Railway DB backups — enable in dashboard (built-in)
- [ ] UptimeRobot free tier — pings every 5 min

---

## 📈 Stage 4 — The Scaling Phase

### 4a — Reputation & Delegated Moderation
- [ ] Users with reputation_score > 100 gain "Moderator Lite" status:
  - Their flags carry 2x weight (auto-hide at 2 mod flags instead of 3)
  - Their upvotes count toward "Verified" badge at 2x weight
- [ ] Automated flagging worker:
  - Ping run_log_url — 404 or non-code domain → auto-flag
  - Runs nightly, kills low-effort spam before humans see it

### 4b — Trending & Discovery
- [ ] Trending calculation: upvote velocity over 7-day window
  (only meaningful once you have real traffic)
- [ ] Cmd+K command palette for paper search
- [ ] Research area heatmap: color tiles by activity / new papers this week
- [ ] Infinite scroll or "Load More" on paper lists

### 4c — Hardware-Normalized Leaderboards
- [ ] Introduce metrics: Accuracy / VRAM, Accuracy / FLOPs
- [ ] Filter leaderboards by hardware class (e.g. "SOTA on consumer GPU")
- [ ] Nobody has built this — strong differentiator

---

## 🤖 Stage 5 — Agentic Integration

### 5a — MCP Server
- [ ] Model Context Protocol server exposing:
  - query_techniques(architecture, task, dataset_type) → ranked methods
  - get_paper(arxiv_id) → paper + verification status
  - submit_verification(arxiv_id, tier, run_log) → create reproduction
  - list_bounties() → open replication bounties
- [ ] Queryable by Claude, GPT, autoresearch agents

### 5b — Verification Bounties
- [ ] Bounty board — users flag papers as "High Demand for Verification"
- [ ] Stripe escrow — funds held until reproduction approved
- [ ] Community replication pool (Stripe or OpenCollective)
- [ ] Auto-bounty: papers hitting X upvotes get small pool bounty
- [ ] Auto-release funds 48h after approval if no dispute

### 5c — AutoML Integration
- [ ] API key system for programmatic access
- [ ] Rate limiting on API endpoints
- [ ] Hooks for autonomous agents to submit verification logs programmatically
- [ ] Automated eval in Modal sandbox for ML benchmarks (longer term)

---

## 💡 Stage 6 — Hype Economy (data-informed, post-traction)
- [ ] Replace simple upvotes with hype balance system
- [ ] Hype earned through reproductions, spent on papers you want verified
- [ ] Tier badges: normal → hot 🔥 → trending ⚡ → legendary 💎
- [ ] Calibrate thresholds from actual upvote data collected in Stage 3b
- [ ] Verification multiplier: trending papers offer bonus hype for reproduction
- [ ] Transaction history on user profile page

---

## Database Schema Summary
Existing tables (DB: pwc):
- papers — 575k rows, arxiv_id, title, abstract, url, tasks TEXT[], methods TEXT[]
- tasks — 3,956 rows, name, description, area/category
- methods — 8,580 rows
- datasets — 18,522 rows
- leaderboard_results — 59,758 rows, metrics JSONB, verification_tier
- paper_code_links — 242k rows, is_official, framework
- paper_tasks — populated in Stage 3c from TEXT[] arrays
- paper_methods — populated in Stage 3c from TEXT[] arrays

Tables added in launch sprint:
- users — github_id PK, username, email, avatar_url, account_created_at,
  created_at, reputation_score
- upvotes — paper_id, user_id, created_at (unique paper_id + user_id)
- reproductions — id, paper_id, user_id, tier_claimed, hardware_spec,
  run_log_url, notes, upvote_count, flag_count, status, created_at, reviewed_at

## Known Data Limitations
1. stars = 0 everywhere — not in HF parquet export, fixable from original JSON.gz
2. paper_tasks / paper_methods empty until junction table population in Stage 3c
3. paper detail leaderboard may have query issues in lib/queries.ts

## Environment Variables
Local .env.local (never commit — in .gitignore):
- DATABASE_URL=postgresql://david@localhost/pwc
- GITHUB_ID=your_github_oauth_app_client_id
- GITHUB_SECRET=your_github_oauth_app_client_secret
- NEXTAUTH_SECRET=run: openssl rand -base64 32
- NEXTAUTH_URL=http://localhost:3000
- ADMIN_GITHUB_ID=your_numeric_github_id (api.github.com/users/yourusername)
- GITHUB_MIN_ACCOUNT_AGE_DAYS=60

Production (set in Vercel dashboard):
- DATABASE_URL=railway_connection_string
- GITHUB_ID=same or separate prod OAuth app
- GITHUB_SECRET=same
- NEXTAUTH_SECRET=same or new
- NEXTAUTH_URL=https://yourdomain.com
- ADMIN_GITHUB_ID=same

---

## Session Startup Checklist
1. git log --oneline -5
2. psql -d pwc -c "\dt"
3. cd web && npm run dev
4. Read this file top to bottom before starting work

## Project Name & Branding
- Project name: SOTAVerified
- Handle/org everywhere: sotarepro
- Domain: sotaverified.org (primary), sotaverified.com (redirect)
- GitHub org: github.com/sotarepro
- Repo: github.com/sotarepro/sotaverified
- Twitter/X: @sotarepro
- Reddit: u/Life-Temperature4068 (display name: SOTA Verified)
- Tagline: "Verified state-of-the-art ML research infrastructure"
- Sub-tagline: "Open benchmark tracking, reproducibility verification,
  and SOTA leaderboards — built for researchers and autonomous agents"
- Hero copy:
    Headline: SOTAVerified
    Subhead: Verified state-of-the-art ML research infrastructure
    Body: Open benchmark tracking, reproducibility verification, and SOTA
    leaderboards for researchers and autonomous research agents.
    Community successor to Papers with Code.
    CTA: Browse Benchmarks / Sign in with GitHub
- Do NOT use "Papers with Code" in site name or hero headline —
  reference only as "successor to Papers with Code" in about page
  to avoid trademark issues with Meta

Nav:  [SOTAVerified logo]              [Browse] [About] [Sign In]

Hero: "The Open Verification Layer for ML Research"
Sub:  Community benchmark tracking and reproducibility verification.
      Built for researchers and autonomous research agents.
CTA:  [Browse Benchmarks]  [Sign in with GitHub]

## Security Rules (non-negotiable)
- All SQL queries use parameterized queries ($1, $2). Never interpolate user input.
- All user-submitted URLs validated against allowlist of domains before storage.
- run_log_url only allows: github.com, gist.github.com, wandb.ai,
  colab.research.google.com, huggingface.co
- Max field lengths enforced server-side: hardware_spec 500 chars, notes 2000 chars
- Rate limiting on all API endpoints (100/min) and auth endpoints (30/min)
- Production DB credentials use a limited-privilege role, not superuser
- Local and production NEXTAUTH_SECRET must be different values
- Security headers configured in next.config.js (CSP, HSTS, X-Frame-Options)
- npm audit clean before every deploy

## User Journey & Page Hierarchy

### Homepage
- Hero: headline, tagline, CTAs (Browse Benchmarks / Sign in with GitHub)
- Paper table with tab switching:
  - "Recently Added" — papers by ingestion date DESC, limit 10
  - "Most Hyped" — papers by upvote count DESC, limit 10
    (placeholder until Stage 3b, show Recently Added in both tabs)
  - "Needs Verification" — papers sorted by (upvotes DESC) WHERE
    verification_tier = 0, limit 10. Call to action: high-interest
    papers nobody has verified yet.
  - Each row: title (links to /papers/[id]), date, task tags,
    verification tier badge, hype/upvote count
  - "View all" link below each tab
- Research area category grid below the table (existing Stage 2.5 design)

### Category Page (e.g., Computer Vision)
- Same tab-switching table scoped to this category
  (Recently Added / Most Hyped / Needs Verification)
- Below: task cards for this category, linking to task pages

### Task Page (e.g., Image Classification)
- Same tab-switching table scoped to this task
  - Scoped means: papers that have this task in their tasks[] array
  - Hype is on the paper itself, not tied to dataset performance
- Below: dataset leaderboards
  - Datasets sorted by number of submissions (most populated first)
  - Default view shows the top dataset's leaderboard expanded
  - Each leaderboard row: rank, paper title (links to /papers/[id]),
    claimed metric (author-reported), verified metric (if any
    reproduction exists — show best verified result),
    verification tier badge
  - Leaderboard ranks by claimed metric by default
  - Future: toggle "Rank by claimed" vs "Rank by verified"

### Paper Detail Page (the canonical hub)
- Hero: title, authors, published date, verification tier badge
  (prominent), hype count + hype button, arXiv external link button
- Verification CTA banner:
  - Tier 0: "Unverified — Be the first to reproduce this paper"
  - Tier 1+: shows current tier with explanation
  - Links to reproduction form (Stage 3d), disabled until then
- Code repositories section (PROMINENT — first content after CTA):
  - Query paper_code_links for this paper
  - Each repo as card: GitHub URL, is_official badge, framework badge
    (PyTorch/TF/JAX/Other), opens in new tab
  - Empty state: "No code available yet"
- Benchmark results section:
  - All leaderboard_results for this paper, grouped by task → dataset
  - Each entry: dataset name, metric name, claimed value,
    verified value (from reproductions if any), rank, tier badge
  - Gap between claimed and verified is valuable signal — display it
- Reproduction history section:
  - All reproduction submissions for this paper
  - Each: submitter username, tier claimed, hardware, metric values
    (from notes), run log link, date, status
  - Empty state: "No reproductions yet — be the first to verify"

### Search
- Global search bar in nav (always visible)
- Returns both tasks and papers
- Paper results link to /papers/[id], task results link to /tasks/[id]

### Key Routing Principle
Paper titles ALWAYS link to /papers/[id] throughout the entire site —
homepage tables, leaderboard rows, search results, category pages.
arXiv is an external link that appears ONLY on the paper detail page.
We are the hub, not a pass-through.

### Metrics & Verification Philosophy
- Leaderboards rank by the author's CLAIMED metric
- When reproductions exist, display the VERIFIED metric alongside
- The gap between claimed and verified is the core signal
- Hardware is captured but not strictly matched — any reproduction
  on any hardware is valuable at this stage
- Each reproduction displayed individually with hardware context
- Future: aggregate metrics once volume exists
- Future: hardware-normalized rankings (accuracy per FLOP / per VRAM)

---

## Parking Lot (prioritized)

**High impact — build when there's traction:**
- Trending papers with external signal (GitHub stars, HN, Twitter/X)
- Embeddings-based paper similarity / recommendation
- Conference-based filtering (NeurIPS 2025, CVPR 2026 etc.)

**Medium — strong differentiators:**
- Compare two methods head to head across benchmarks
- Author paper claiming — authors verify they wrote a paper
- Email digest — weekly newly replicated papers in your areas

**Lower priority — build if community asks:**
- Community discussion threads per paper (HN-style)
- Reading list — save papers to read later
- Mind map / force-directed graph of research areas
- Mobile app
- Integration with Semantic Scholar for citation graph
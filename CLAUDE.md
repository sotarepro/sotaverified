# PapersWithCode Revival

## Project Overview
Community-maintained ML paper benchmark tracker and spiritual successor to Papers With Code (shut down by Meta, July 2025). Goal: restore the SOTA leaderboard infrastructure the ML community lost, then add layers PWC never had.

## Tech Stack
- **DB**: PostgreSQL (local: `postgresql://david@localhost/pwc`)
- **Backend**: Python (ingestion scripts), Next.js API routes
- **Frontend**: Next.js
- **Infra**: TBD (Vercel for frontend, maybe Railway/Supabase for DB)

## Project Stages

### Stage 1 — Data Foundation (DONE)
- [x] Ingest PWC Hugging Face parquet dumps into Postgres
- [x] Schema: papers, tasks, methods, datasets, leaderboard_results, paper_code_links
- [x] 575k papers, 242k code links, 59k leaderboard results loaded

### Stage 2 — Basic Site (DONE)
- [x] Homepage: task browser with result counts + search (web/ Next.js 16 app)
- [x] Task detail page: leaderboard grouped by dataset, metric value, verification_tier badge, dataset filter pills
- [x] Paper detail page: title, abstract, arxiv link, code links (official/framework badges), tasks/methods chips, benchmark results table
- [x] Read-only, no auth yet
- [x] DB: postgresql://david@localhost/pwc via Unix socket (/var/run/postgresql)

### Stage 2.5 — Data Cleanup (do after Stage 2 site is working)
- [ ] Fix stars — pull original JSON.gz from github.com/paperswithcode/paperswithcode-data
- [ ] Fix paper_tasks junction table — secondary pass through papers.tasks TEXT[] array
- [ ] Fix paper_methods junction table — same secondary pass

### Stage 3 — Community Verification Layer
- [ ] GitHub OAuth login
- [ ] Verification tier system:
  - Tier 0: Inherited/Unverified (gray) — all imported PWC data starts here
  - Tier 1: Code Runs (yellow) — someone confirmed repo installs and runs
  - Tier 2: Numbers Reproduce (green) — metric confirmed within 1% tolerance
  - Tier 3: Independently Reproduced (gold) — 2+ independent Tier 2 confirmations
  - Tier 4: Automated/Sandboxed (blue) — platform ran it in a Modal container
- [ ] Contributor reputation score (based on GitHub identity + reproduction history)
- [ ] "I reproduced this" submission form: hardware spec, actual metric, run log link

### Stage 4 — New Papers Pipeline
- [ ] arXiv API cron job — daily ingest of new CS/ML papers
- [ ] Auto-create stub entries for new papers
- [ ] Community can claim papers to add benchmark results

### Stage 5 — Bounty Layer
- [ ] Bounty board: pay to prioritize replication of a specific paper
- [ ] Stripe escrow — funds held until submission accepted
- [ ] Automated eval in Modal sandbox for code tasks
- [ ] Auto-release after 48h if no dispute

### Stage 6 — Agent API
- [ ] REST endpoint: `GET /api/sota?task=X&dataset=Y&verified=true`
- [ ] Returns ranked methods with reproducibility scores
- [ ] MCP server exposing `query_techniques(architecture, task, dataset_type)`
- [ ] Queryable by AutoML agents for technique discovery

## Database
- Local connection: `postgresql://david@localhost/pwc`
- Key tables: `papers`, `tasks`, `methods`, `datasets`, `leaderboard_results`, `paper_code_links`
- All leaderboard entries have `verification_tier` field (default 0 = unverified)

## Key Design Decisions
- Verification is tiered not binary — trust accumulates naturally
- Community is the verifier, not the platform (except Tier 4 automated)
- MIT license on code, CC-BY-SA 4.0 inherited on data
- Public repo, community hub model first, monetization layer later if traction
- Papers With Code data is the seed — everything starts at Tier 0 and gets upgraded

## Current Session Prompt
When starting a new session, run `git log --oneline -5` to see recent state,
then `psql -d pwc -c "\dt"` to confirm DB is accessible.
# SOTAVerified

**Verified state-of-the-art ML research infrastructure.**

Open benchmark tracking, reproducibility verification, and SOTA leaderboards — built for researchers and autonomous research agents.

---

## What it is

SOTAVerified is open infrastructure for tracking and verifying machine learning research results:

- **658k+ papers** indexed from arXiv, updated weekly
- **Benchmark leaderboards** across 3,900+ ML tasks and 18,500+ datasets
- **Two-dimension verification** — every paper gets a machine-readable score *and* a human-readable badge
- **Community reproductions** — log hardware specs, run logs, and metric values; earn reputation
- **Agent API** — structured JSON for autonomous research agents and LLM tool use
- **Author verification** — GitHub OAuth lets authors self-verify via contributor check

---

## Verification system

Papers are assessed on two independent axes:

### Verification score (integer, machine-readable)
Computed from underlying evidence, exposed in the API for sorting and filtering:

| Signal | Points |
|--------|--------|
| Official code repo exists | +5 |
| Verified author claimed metrics | +10 |
| Per active community reproduction | +10 |
| Reproduction within 5% of claimed metric | +5 bonus |
| Per unique hardware config across reproductions | +3 |

### Badge (categorical, human-readable)
| Badge | Meaning |
|-------|---------|
| `unverified` | No evidence beyond the paper itself |
| `code_available` | Official code repo linked |
| `author_verified` | A GitHub contributor to the repo claimed authorship |
| `community_verified` | At least one independent reproduction logged |

---

## API

### Get paper data
```bash
curl https://sotaverified.org/api/v1/papers/{arxiv_id}
```

Returns title, abstract, authors, tasks, leaderboard results, code links, verification score and badge.

### Query SOTA
```bash
curl "https://sotaverified.org/api/v1/sota?task=image-classification&min_score=10&sort=score"
```

Parameters: `task`, `dataset`, `min_score`, `sort` (score | metric | date), `limit`.

### Submit a reproduction (agent write)
```bash
curl -X POST https://sotaverified.org/api/v1/reproductions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "paper_id": "abc123",
    "tier_claimed": 2,
    "hardware_spec": "RTX 3090, 24GB, Ubuntu 22.04",
    "run_log_url": "https://wandb.ai/your/run",
    "notes": "BLEU 28.4 on WMT14 En-De",
    "actual_metric_name": "BLEU",
    "actual_metric_value": 28.4
  }'
```

Agent submissions land in `agent_pending` status. Trusted users (reputation ≥ 30) can promote them to community status.

---

## Reputation system

Users earn reputation through verified contributions:

| Action | Change |
|--------|--------|
| Reproduction reaches Verified (Tier 1) | +5 |
| Reproduction reaches Verified (Tier 2) | +10 |
| Reproduction reaches Verified (Tier 3) | +15 |
| Reproduction reaches Verified (Tier 4) | +20 |
| Reproduction confirmed spam | −20 |

**Trusted users (rep ≥ 30):** flags carry 2× weight (auto-hide at 2 flags instead of 3); can promote agent reproductions to community status.

Verification tiers (1–4) reflect confidence level: Tier 1 = partial/qualitative, Tier 4 = exact metric match on identical hardware.

---

## Running locally

**Prerequisites:** Node.js 20+, PostgreSQL, Python 3.10+

```bash
# Clone
git clone https://github.com/sotarepro/sotaverified
cd sotaverified

# Install dependencies
cd web && npm install

# Configure environment
cp .env.example .env.local
# Fill in: DATABASE_URL, GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, ADMIN_GITHUB_ID

# Start dev server (use --webpack — Turbopack has known panics in this Next.js version)
npm run dev -- --webpack
```

The database needs to be seeded. See `scripts/` for ingestion tooling.

### Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GITHUB_ID` | GitHub OAuth app client ID |
| `GITHUB_SECRET` | GitHub OAuth app client secret |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Base URL (`http://localhost:3000` locally) |
| `ADMIN_GITHUB_ID` | Your numeric GitHub user ID — grants /admin access |
| `GITHUB_MIN_ACCOUNT_AGE_DAYS` | Minimum account age to submit reproductions (default: 60) |
| `ENABLE_TEST_TOOLS` | `true` to enable admin test tools — **never in production** |

---

## Data ingestion scripts

Located in `scripts/`. Require `psycopg2` and optionally `requests`.

```bash
# Backfill arXiv papers from a start date
python3 scripts/arxiv_backfill.py --from 2025-07-01 --db "dbname=pwc"

# Weekly delta (run on cron)
python3 scripts/arxiv_delta.py --days 7 --db "dbname=pwc"

# Enrich GitHub star/fork counts (requires GITHUB_TOKEN in shell env)
GITHUB_TOKEN=ghp_... python3 scripts/github_enrich.py --since 2022-01-01 --db "dbname=pwc"

# Seed initial hype scores from star counts (run after github_enrich)
python3 scripts/hype_seed.py --db "dbname=pwc"

# Full daily pipeline
python3 scripts/daily_update.py --db "dbname=pwc"
```

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16 (App Router), Tailwind CSS v4 |
| Database | PostgreSQL — raw SQL via `postgres` npm package, no ORM |
| Auth | NextAuth.js v4, GitHub OAuth provider |
| Hosting | Vercel (frontend) + Railway (Postgres) |
| Ingestion | Python 3, arXiv OAI-PMH, GitHub API, Semantic Scholar API |
| Tests | Jest + ts-jest, all DB/network mocked (59 tests) |

---

## Contributing

Contributions welcome. A few ground rules:

- All SQL uses parameterized queries — never interpolate user input
- `run_log_url` only accepts: github.com, gist.github.com, wandb.ai, colab.research.google.com, huggingface.co
- Run `npm test` before opening a PR — all 59 tests must pass
- `npm audit` must be clean before any deploy

The most valuable contributions right now:
1. **Reproduce a paper** — use your GPU, log the run, submit via the site
2. **Claim authorship** — if you wrote a paper that's in the DB, verify via GitHub
3. **Flag bad reproductions** — keep the data honest

---

## Links

- Site: [sotaverified.org](https://sotaverified.org)
- GitHub org: [github.com/sotarepro](https://github.com/sotarepro)
- Twitter/X: [@sotarepro](https://x.com/sotarepro)
- Reddit: [u/Life-Temperature4068](https://reddit.com/u/Life-Temperature4068) (SOTA Verified)

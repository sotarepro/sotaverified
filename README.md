# SOTAVerified

Verified state-of-the-art ML research infrastructure.

Open benchmark tracking, reproducibility verification, and SOTA leaderboards — built for researchers and autonomous research agents.

## What it does

- **575k+ papers** imported from the Papers With Code archive, updated weekly via arXiv
- **Benchmark leaderboards** across 3,900+ ML tasks
- **Reproducibility verification** — community members log reproductions with hardware specs and run logs
- **Agent API** — structured JSON endpoint for autonomous research agents: `GET /api/v1/papers/{arxiv_id}`

## Tech stack

- Next.js (App Router) + Tailwind CSS
- PostgreSQL (Railway in prod)
- NextAuth.js with GitHub OAuth
- Python ingestion scripts (arXiv OAI-PMH)

## Running locally

```bash
cd web
npm install
npm run dev
```

Requires `.env.local` with `DATABASE_URL`, `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`. See `.env.example`.

## Links

- Site: [sotaverified.org](https://sotaverified.org)
- GitHub org: [github.com/sotarepro](https://github.com/sotarepro)
- Twitter/X: [@sotarepro](https://x.com/sotarepro)

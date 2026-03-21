-- Papers with Code Revival — Postgres Schema
-- Designed to capture papers, tasks, methods, datasets, leaderboard results,
-- and a verification_tier for credibility grading.

BEGIN;

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fast text search

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE verification_tier AS ENUM (
    'unverified',     -- raw import, no checks
    'auto_verified',  -- passed automated consistency checks
    'community',      -- community-confirmed
    'official'        -- confirmed by authors or curators
);

-- ─── Papers ──────────────────────────────────────────────────────────────────

CREATE TABLE papers (
    id              TEXT        PRIMARY KEY,   -- PwC paper ID (e.g. "2106.01234")
    arxiv_id        TEXT        UNIQUE,
    title           TEXT        NOT NULL,
    abstract        TEXT,
    url_abs         TEXT,
    url_pdf         TEXT,
    published       DATE,
    authors         TEXT[],                    -- ordered list of author names
    proceeding      TEXT,                      -- venue / conference string
    tasks           TEXT[],                    -- denormalised task name list for quick filter
    methods         TEXT[],                    -- denormalised method name list
    framework       TEXT,                      -- primary framework if known
    stars           INTEGER     DEFAULT 0,     -- sum of GitHub stars across code links
    verification    verification_tier NOT NULL DEFAULT 'unverified',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX papers_published_idx  ON papers (published DESC);
CREATE INDEX papers_title_trgm_idx ON papers USING GIN (title gin_trgm_ops);
CREATE INDEX papers_tasks_idx      ON papers USING GIN (tasks);

-- ─── Code Links ──────────────────────────────────────────────────────────────

CREATE TABLE paper_code_links (
    id              BIGSERIAL   PRIMARY KEY,
    paper_id        TEXT        NOT NULL REFERENCES papers (id) ON DELETE CASCADE,
    repo_url        TEXT        NOT NULL,
    framework       TEXT,
    stars           INTEGER     DEFAULT 0,
    is_official     BOOLEAN     NOT NULL DEFAULT FALSE,
    mentioned_in_paper BOOLEAN NOT NULL DEFAULT FALSE,
    verification    verification_tier NOT NULL DEFAULT 'unverified',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX paper_code_links_paper_idx ON paper_code_links (paper_id);

-- ─── Tasks ───────────────────────────────────────────────────────────────────

CREATE TABLE tasks (
    id              TEXT        PRIMARY KEY,   -- slugified name
    name            TEXT        NOT NULL UNIQUE,
    description     TEXT,
    parent_id       TEXT        REFERENCES tasks (id),
    area            TEXT,                      -- broad area e.g. "Computer Vision"
    verification    verification_tier NOT NULL DEFAULT 'unverified',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_parent_idx ON tasks (parent_id);

-- paper ↔ task many-to-many
CREATE TABLE paper_tasks (
    paper_id        TEXT NOT NULL REFERENCES papers (id) ON DELETE CASCADE,
    task_id         TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, task_id)
);

-- ─── Methods ─────────────────────────────────────────────────────────────────

CREATE TABLE methods (
    id              TEXT        PRIMARY KEY,   -- slugified name
    name            TEXT        NOT NULL UNIQUE,
    full_name       TEXT,
    description     TEXT,
    category        TEXT,                      -- e.g. "Attention Mechanism"
    main_collection TEXT,                      -- PwC collection name
    introduced_year INTEGER,
    url             TEXT,                      -- canonical reference URL
    verification    verification_tier NOT NULL DEFAULT 'unverified',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX methods_name_trgm_idx ON methods USING GIN (name gin_trgm_ops);

-- paper ↔ method many-to-many
CREATE TABLE paper_methods (
    paper_id        TEXT NOT NULL REFERENCES papers (id) ON DELETE CASCADE,
    method_id       TEXT NOT NULL REFERENCES methods (id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, method_id)
);

-- ─── Datasets ────────────────────────────────────────────────────────────────

CREATE TABLE datasets (
    id              TEXT        PRIMARY KEY,   -- slugified name
    name            TEXT        NOT NULL UNIQUE,
    full_name       TEXT,
    description     TEXT,
    url             TEXT,
    introduced_year INTEGER,
    n_samples       BIGINT,
    modalities      TEXT[],                    -- e.g. ["image", "text"]
    languages       TEXT[],
    licenses        TEXT[],
    verification    verification_tier NOT NULL DEFAULT 'unverified',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dataset ↔ task many-to-many (a dataset is used for multiple tasks)
CREATE TABLE dataset_tasks (
    dataset_id      TEXT NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
    task_id         TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    PRIMARY KEY (dataset_id, task_id)
);

-- ─── Leaderboard Results ─────────────────────────────────────────────────────

-- Each row is one model evaluated on one dataset for one task.
CREATE TABLE leaderboard_results (
    id              BIGSERIAL   PRIMARY KEY,
    task_id         TEXT        NOT NULL REFERENCES tasks (id),
    dataset_id      TEXT        NOT NULL REFERENCES datasets (id),
    paper_id        TEXT        REFERENCES papers (id),
    model_name      TEXT        NOT NULL,
    -- Metrics are stored as key→value maps; schema-less by design because
    -- every benchmark has different metric names.
    metrics         JSONB       NOT NULL DEFAULT '{}',
    -- The single "best" metric value for ranking (populated by ingestion).
    best_metric_name  TEXT,
    best_metric_value DOUBLE PRECISION,
    evaluated_on    DATE,
    uses_extra_data BOOLEAN     NOT NULL DEFAULT FALSE,
    uses_ensemble   BOOLEAN     NOT NULL DEFAULT FALSE,
    verification    verification_tier NOT NULL DEFAULT 'unverified',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lb_task_dataset_idx    ON leaderboard_results (task_id, dataset_id);
CREATE INDEX lb_paper_idx           ON leaderboard_results (paper_id);
CREATE INDEX lb_best_metric_idx     ON leaderboard_results (task_id, dataset_id, best_metric_value DESC NULLS LAST);
CREATE INDEX lb_metrics_gin_idx     ON leaderboard_results USING GIN (metrics);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['papers','tasks','methods','datasets','leaderboard_results']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;

COMMIT;

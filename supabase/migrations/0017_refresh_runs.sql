-- 0017_refresh_runs (v2, amended after second-reader review)
-- Durable home for per-partner, per-feed counters currently emitted only to
-- Vercel runtime logs, which have limited retention.
-- One row per (run, partner, feed). Written by cron routes via service-role.

create table public.refresh_runs (
  id                       uuid primary key default gen_random_uuid(),
  run_id                   uuid not null,
  route                    text not null,
  partner_id               text not null,
  feed_id                  text not null,
  feed_rows                integer,
  matched                  integer,
  matched_by_id            integer,
  matched_by_name          integer,
  compared                 integer,
  changed_vs_current       integer,
  unchanged_vs_current     integer,
  upserted                 integer,
  new_rows                 integer,
  stale_overrides          integer,
  duplicate_key_collisions integer,
  error_message            text,
  started_at               timestamptz not null,
  finished_at              timestamptz not null,
  created_at               timestamptz not null default now(),
  constraint refresh_runs_run_partner_feed_unique
    unique (run_id, partner_id, feed_id)
);

create index refresh_runs_partner_feed_created_idx
  on public.refresh_runs (partner_id, feed_id, created_at desc);

create index refresh_runs_run_idx
  on public.refresh_runs (run_id);

alter table public.refresh_runs enable row level security;
-- Deliberately NO policies. Operational telemetry, not user data.
-- Service-role writes bypass RLS; anon and authenticated get nothing.

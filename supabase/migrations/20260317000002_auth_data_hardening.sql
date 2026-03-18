-- Hardening migration: canonical TMDB IDs, user-owned swipe data, strict RLS.

-- 1) Enum for swipe actions
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'swipe_action' and n.nspname = 'public'
  ) then
    create type public.swipe_action as enum ('unwatched', 'watched', 'loved', 'disliked');
  end if;
end $$;

-- 2) Append-only swipe events
create table if not exists public.swipe_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tmdb_movie_id integer not null,
  action public.swipe_action not null,
  movie_title text,
  movie_year integer,
  movie_director text,
  movie_genre text,
  poster_url text,
  created_at timestamptz not null default now()
);

alter table public.swipe_events enable row level security;

drop policy if exists "Users can read own swipe events" on public.swipe_events;
drop policy if exists "Users can insert own swipe events" on public.swipe_events;
drop policy if exists "Users can update own swipe events" on public.swipe_events;
drop policy if exists "Users can delete own swipe events" on public.swipe_events;

create policy "Users can read own swipe events"
  on public.swipe_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own swipe events"
  on public.swipe_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own swipe events"
  on public.swipe_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own swipe events"
  on public.swipe_events for delete
  using (auth.uid() = user_id);

create index if not exists swipe_events_user_created_at_idx
  on public.swipe_events (user_id, created_at desc);
create index if not exists swipe_events_user_tmdb_idx
  on public.swipe_events (user_id, tmdb_movie_id);

-- Backfill from legacy swipe_history (authenticated + valid numeric movie IDs only)
do $$
begin
  if to_regclass('public.swipe_history') is not null then
    insert into public.swipe_events (
      user_id,
      tmdb_movie_id,
      action,
      created_at
    )
    select
      sh.user_id,
      sh.movie_id::integer,
      sh.action::public.swipe_action,
      coalesce(sh.created_at, now())
    from public.swipe_history sh
    where sh.user_id is not null
      and sh.movie_id ~ '^[0-9]+$'
      and sh.action in ('unwatched', 'watched', 'loved', 'disliked');
  end if;
end $$;

-- 3) Current-state swipe table (latest action per user/movie)
create table if not exists public.swipe_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tmdb_movie_id integer not null,
  latest_action public.swipe_action not null,
  updated_at timestamptz not null default now(),
  unique (user_id, tmdb_movie_id)
);

alter table public.swipe_states enable row level security;

drop policy if exists "Users can read own swipe states" on public.swipe_states;
drop policy if exists "Users can insert own swipe states" on public.swipe_states;
drop policy if exists "Users can update own swipe states" on public.swipe_states;
drop policy if exists "Users can delete own swipe states" on public.swipe_states;

create policy "Users can read own swipe states"
  on public.swipe_states for select
  using (auth.uid() = user_id);

create policy "Users can insert own swipe states"
  on public.swipe_states for insert
  with check (auth.uid() = user_id);

create policy "Users can update own swipe states"
  on public.swipe_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own swipe states"
  on public.swipe_states for delete
  using (auth.uid() = user_id);

create index if not exists swipe_states_user_tmdb_idx
  on public.swipe_states (user_id, tmdb_movie_id);
create index if not exists swipe_states_user_updated_at_idx
  on public.swipe_states (user_id, updated_at desc);

create or replace function public.record_swipe_event(
  p_tmdb_movie_id integer,
  p_action public.swipe_action,
  p_movie_title text default null,
  p_movie_year integer default null,
  p_movie_director text default null,
  p_movie_genre text default null,
  p_poster_url text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.swipe_events (
    user_id,
    tmdb_movie_id,
    action,
    movie_title,
    movie_year,
    movie_director,
    movie_genre,
    poster_url
  )
  values (
    v_user_id,
    p_tmdb_movie_id,
    p_action,
    p_movie_title,
    p_movie_year,
    p_movie_director,
    p_movie_genre,
    p_poster_url
  );

  insert into public.swipe_states (
    user_id,
    tmdb_movie_id,
    latest_action
  )
  values (
    v_user_id,
    p_tmdb_movie_id,
    p_action
  )
  on conflict (user_id, tmdb_movie_id)
  do update set
    latest_action = excluded.latest_action,
    updated_at = now();
end;
$$;

revoke all on function public.record_swipe_event(
  integer,
  public.swipe_action,
  text,
  integer,
  text,
  text,
  text
) from public, anon;
grant execute on function public.record_swipe_event(
  integer,
  public.swipe_action,
  text,
  integer,
  text,
  text,
  text
) to authenticated;

insert into public.swipe_states (
  user_id,
  tmdb_movie_id,
  latest_action,
  updated_at
)
select distinct on (se.user_id, se.tmdb_movie_id)
  se.user_id,
  se.tmdb_movie_id,
  se.action,
  se.created_at
from public.swipe_events se
order by se.user_id, se.tmdb_movie_id, se.created_at desc
on conflict (user_id, tmdb_movie_id)
do update set
  latest_action = excluded.latest_action,
  updated_at = excluded.updated_at;

-- 4) Canonicalize watchlists to tmdb_movie_id and optional metadata snapshot
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tmdb_movie_id integer not null,
  movie_title text,
  movie_year integer,
  poster_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.watchlists add column if not exists tmdb_movie_id integer;
alter table public.watchlists add column if not exists movie_year integer;
alter table public.watchlists add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'watchlists'
      and column_name = 'movie_id'
  ) then
    update public.watchlists
    set tmdb_movie_id = movie_id::integer
    where tmdb_movie_id is null
      and movie_id ~ '^[0-9]+$';
  end if;
end $$;

delete from public.watchlists where tmdb_movie_id is null;

alter table public.watchlists alter column tmdb_movie_id set not null;
alter table public.watchlists alter column movie_title drop not null;

alter table public.watchlists drop constraint if exists watchlists_user_id_movie_id_key;
alter table public.watchlists drop constraint if exists watchlists_user_id_tmdb_movie_id_key;
alter table public.watchlists add constraint watchlists_user_id_tmdb_movie_id_key
  unique (user_id, tmdb_movie_id);

alter table public.watchlists drop column if exists movie_id;

alter table public.watchlists enable row level security;

drop policy if exists "Users can read own watchlist" on public.watchlists;
drop policy if exists "Users can insert into own watchlist" on public.watchlists;
drop policy if exists "Users can delete from own watchlist" on public.watchlists;
drop policy if exists "Users can insert own watchlist items" on public.watchlists;
drop policy if exists "Users can update own watchlist items" on public.watchlists;
drop policy if exists "Users can delete own watchlist items" on public.watchlists;

create policy "Users can read own watchlist"
  on public.watchlists for select
  using (auth.uid() = user_id);

create policy "Users can insert own watchlist items"
  on public.watchlists for insert
  with check (auth.uid() = user_id);

create policy "Users can update own watchlist items"
  on public.watchlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own watchlist items"
  on public.watchlists for delete
  using (auth.uid() = user_id);

create index if not exists watchlists_user_created_at_idx
  on public.watchlists (user_id, created_at desc);
create index if not exists watchlists_user_tmdb_idx
  on public.watchlists (user_id, tmdb_movie_id);

-- 5) Lock down rate limit RPC execution
revoke all on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, interval) to service_role;

-- 6) Remove legacy table after backfill
drop table if exists public.swipe_history;

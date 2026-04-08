-- Filmmoo swipe queue + TMDB cache foundation.

create table if not exists public.movies_cache (
  tmdb_movie_id integer primary key,
  title text not null,
  year integer,
  director text,
  genre text,
  synopsis text,
  poster_url text,
  top_actors text[] not null default '{}',
  release_date date,
  popularity numeric,
  vote_average numeric,
  vote_count integer,
  original_language text,
  source_tier text,
  cached_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_movie_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_movie_id integer not null references public.movies_cache(tmdb_movie_id) on delete cascade,
  queue_rank bigint not null,
  source_tier text,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  discarded_at timestamptz
);

create index if not exists user_movie_queue_user_rank_idx
  on public.user_movie_queue (user_id, queue_rank asc)
  where consumed_at is null and discarded_at is null;

create index if not exists user_movie_queue_user_tmdb_idx
  on public.user_movie_queue (user_id, tmdb_movie_id);

create unique index if not exists user_movie_queue_active_unique_idx
  on public.user_movie_queue (user_id, tmdb_movie_id)
  where consumed_at is null and discarded_at is null;

alter table public.movies_cache enable row level security;
alter table public.user_movie_queue enable row level security;

create policy "Authenticated users can read movies cache"
  on public.movies_cache
  for select
  to authenticated
  using (true);

create policy "Users can read own queue"
  on public.user_movie_queue
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own queue"
  on public.user_movie_queue
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop function if exists public.record_swipe_event(
  integer,
  public.swipe_action,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
);

create function public.record_swipe_event(
  p_tmdb_movie_id integer,
  p_action public.swipe_action,
  p_movie_title text default null,
  p_movie_year integer default null,
  p_movie_director text default null,
  p_movie_genre text default null,
  p_poster_url text default null,
  p_movie_synopsis text default null,
  p_recommendation_reason text default null,
  p_source text default null
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exists boolean := false;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select exists (
    select 1
    from public.swipe_states
    where user_id = v_user_id
      and tmdb_movie_id = p_tmdb_movie_id
  ) into v_exists;

  if v_exists then
    return false;
  end if;

  insert into public.swipe_events (
    user_id,
    tmdb_movie_id,
    action,
    movie_title,
    movie_year,
    movie_director,
    movie_genre,
    poster_url,
    movie_synopsis,
    recommendation_reason,
    source
  )
  values (
    v_user_id,
    p_tmdb_movie_id,
    p_action,
    p_movie_title,
    p_movie_year,
    p_movie_director,
    p_movie_genre,
    p_poster_url,
    p_movie_synopsis,
    p_recommendation_reason,
    p_source
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

  update public.user_movie_queue
  set consumed_at = now()
  where user_id = v_user_id
    and tmdb_movie_id = p_tmdb_movie_id
    and consumed_at is null
    and discarded_at is null;

  return true;
end;
$$;

revoke all on function public.record_swipe_event(
  integer,
  public.swipe_action,
  text,
  integer,
  text,
  text,
  text,
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
  text,
  text,
  text,
  text
) to authenticated;

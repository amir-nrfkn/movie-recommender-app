-- Persist recommendation context for watchlist/history reuse without extra Gemini calls.

alter table public.watchlists
  add column if not exists movie_director text,
  add column if not exists movie_genre text,
  add column if not exists movie_synopsis text,
  add column if not exists recommendation_reason text,
  add column if not exists source text,
  add column if not exists recommended_at timestamptz;

alter table public.swipe_events
  add column if not exists movie_synopsis text,
  add column if not exists recommendation_reason text,
  add column if not exists source text;

create index if not exists watchlists_user_updated_at_idx
  on public.watchlists (user_id, updated_at desc);

create index if not exists swipe_events_user_created_at_action_idx
  on public.swipe_events (user_id, created_at desc, action);

create or replace function public.record_swipe_event(
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

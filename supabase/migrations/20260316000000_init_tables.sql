-- Create rate_limits table
create table if not exists public.rate_limits (
  key text primary key,
  count int default 1,
  window_start timestamptz default now()
);

-- Enable RLS (though typically server-only accessed, still good practice)
alter table public.rate_limits enable row level security;

-- Only service role can access rate limits
create policy "Service role can manage rate limits"
  on public.rate_limits
  for all
  to service_role
  using (true)
  with check (true);

-- Create RPC function to check and increment rate limit atomically
create or replace function public.check_rate_limit(
  ip_action_key text,
  max_reqs int,
  window_interval interval
) returns json language plpgsql security definer as $$
declare
  r public.rate_limits;
  now_tz timestamptz := now();
  is_allowed boolean;
  retry_after float;
begin
  -- upsert the rate limit row
  insert into public.rate_limits (key, count, window_start)
  values (ip_action_key, 1, now_tz)
  on conflict (key) do update
  set
    count = case 
      when public.rate_limits.window_start < now_tz - window_interval then 1
      else public.rate_limits.count + 1
    end,
    window_start = case 
      when public.rate_limits.window_start < now_tz - window_interval then now_tz
      else public.rate_limits.window_start
    end
  returning * into r;

  -- check if allowed
  is_allowed := r.count <= max_reqs;
  
  if is_allowed then
    return json_build_object('allowed', true);
  else
    retry_after := extract(epoch from (r.window_start + window_interval - now_tz));
    return json_build_object('allowed', false, 'retryAfter', ceil(retry_after));
  end if;
end;
$$;

-- Create swipe_history table
create table if not exists public.swipe_history (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  movie_id text not null,
  action text not null,
  created_at timestamptz default now()
);

-- Index for fast lookup by session_id
create index if not exists swipe_history_session_id_idx on public.swipe_history(session_id);

-- Enable RLS
alter table public.swipe_history enable row level security;

-- Policies for anonymous users (matching their session_id)
create policy "Users can read own swipe history"
  on public.swipe_history for select
  using (session_id = current_setting('request.jwt.claims', true)::json->>'session_id');

create policy "Users can insert own swipe history"
  on public.swipe_history for insert
  with check (session_id = current_setting('request.jwt.claims', true)::json->>'session_id');

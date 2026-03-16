-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Setup trigger to automatically create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update swipe_history to support authenticated users
alter table public.swipe_history add column if not exists user_id uuid references auth.users on delete cascade;

-- Allow authenticated users to see their own history
create policy "Authenticated users can read own history"
  on public.swipe_history for select
  using (auth.uid() = user_id);

create policy "Authenticated users can insert own history"
  on public.swipe_history for insert
  with check (auth.uid() = user_id);

create policy "Authenticated users can update own history"
  on public.swipe_history for update
  using (auth.uid() = user_id);

-- Create watchlists table
create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  movie_id text not null,
  movie_title text not null,
  poster_url text,
  created_at timestamptz default now(),
  unique(user_id, movie_id)
);

alter table public.watchlists enable row level security;

create policy "Users can read own watchlist"
  on public.watchlists for select
  using (auth.uid() = user_id);

create policy "Users can insert into own watchlist"
  on public.watchlists for insert
  with check (auth.uid() = user_id);

create policy "Users can delete from own watchlist"
  on public.watchlists for delete
  using (auth.uid() = user_id);

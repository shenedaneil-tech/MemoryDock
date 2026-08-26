-- Run this once in the Supabase SQL editor for the MemoryDock project.
-- Every row is protected by Row Level Security and can only be read or changed
-- by the signed-in person who owns it.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_data_url text,
  avatar_color text not null default '#315e47',
  focus_areas text[] not null default '{}',
  macro_goals jsonb not null default '{"calories":2000,"protein":100,"carbs":250,"fat":65}'::jsonb,
  spend_budget numeric(12,2) not null default 0,
  theme text not null default 'day' check (theme in ('day', 'night')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  category text not null,
  value text,
  event_time timestamptz not null,
  macros jsonb,
  expense jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_user_event_time_idx
  on public.entries (user_id, event_time desc);

alter table public.profiles enable row level security;
alter table public.entries enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their profile" on public.profiles;
create policy "Users can delete their profile" on public.profiles
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their entries" on public.entries;
create policy "Users can read their entries" on public.entries
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their entries" on public.entries;
create policy "Users can create their entries" on public.entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their entries" on public.entries;
create policy "Users can update their entries" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their entries" on public.entries;
create policy "Users can delete their entries" on public.entries
  for delete using (auth.uid() = user_id);

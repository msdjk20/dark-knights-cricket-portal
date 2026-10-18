-- Dark Knights Cricket Portal schema.
-- Run once in Supabase SQL Editor. Row Level Security is the security boundary.

create extension if not exists pgcrypto;

create type public.app_role as enum ('player', 'admin');
create type public.leave_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  display_name text,
  role public.app_role not null default 'player',
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent text not null check (length(trim(opponent)) between 1 and 120),
  match_date date not null,
  start_time time,
  venue text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 5 and 1000),
  status public.leave_status not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique(player_id, match_id)
);

create index matches_match_date_idx on public.matches(match_date);
create index leave_requests_player_created_idx on public.leave_requests(player_id, created_at desc);
create index leave_requests_match_status_idx on public.leave_requests(match_id, status);

-- Create a profile on signup. Phone number is copied from the verified Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone, display_name, role)
  values (new.id, new.phone, null, 'player')
  on conflict (id) do update set phone = excluded.phone;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Sync phone changes from Supabase Auth without changing the role.
create or replace function public.sync_user_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone then
    update public.profiles set phone = new.phone where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_phone_updated
after update of phone on auth.users
for each row execute procedure public.sync_user_phone();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.leave_requests enable row level security;

-- Players can read and update their own basic profile, never their role.
create policy "profile read self or admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_admin());

create policy "profile update own display name" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Signed-in team members can see fixtures; only admins manage them.
create policy "authenticated users read matches" on public.matches
for select to authenticated using (true);

create policy "admins insert matches" on public.matches
for insert to authenticated with check (public.is_admin() and created_by = (select auth.uid()));

create policy "admins update matches" on public.matches
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete matches" on public.matches
for delete to authenticated using (public.is_admin());

-- Admins see all requests. Players see only their own requests.
create policy "read own requests or all for admin" on public.leave_requests
for select to authenticated
using (player_id = (select auth.uid()) or public.is_admin());

create policy "players submit own pending requests" on public.leave_requests
for insert to authenticated
with check (
  player_id = (select auth.uid())
  and status = 'pending'
  and admin_note is null
  and decided_at is null
);

-- Only admins can change decisions. Restrict mutable fields to status, note, and decision timestamp.
create policy "admins decide leave requests" on public.leave_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Do not grant anonymous table access.
revoke all on public.profiles from anon;
revoke all on public.matches from anon;
revoke all on public.leave_requests from anon;
grant select on public.profiles to authenticated;
-- Column-level grant prevents players from changing their own role or phone.
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update on public.leave_requests to authenticated;

-- Optional: enable realtime for live changes. Client refresh button remains available regardless.
-- alter publication supabase_realtime add table public.leave_requests;

-- =====================================================================
-- TEST SHIM: the small slice of Supabase that the migrations and tests rely
-- on (auth.users, auth.uid(), storage.buckets/objects, storage.foldername,
-- the anon/authenticated roles), so they can run on a plain local Postgres.
--
-- !!! NEVER RUN THIS ON A REAL SUPABASE PROJECT. It is for scratch databases
-- only (see supabase/tests/run.sh).
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists storage;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);

-- Supabase reads the signed-in user from the request's JWT claims
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner_id text,
  created_at timestamptz default now(),
  metadata jsonb
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language plpgsql as $$
declare parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end $$;

grant usage on schema auth, storage, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to authenticated;
-- Supabase gives API roles access to new public tables; RLS does the filtering
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

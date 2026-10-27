-- =====================================================================
-- 0001 BASELINE: tables, indexes, row-level security, storage policies
--
-- !!! RUN MANUALLY in the Supabase SQL editor (deploying the app does not
-- apply it). It is idempotent: safe to run on your live database and safe
-- to re-run. It replaces the old supabase_rls_policies.sql,
-- supabase_schema_tasks.sql and supabase_schema_personnel.sql (removed from
-- the repo; see git history).
--
-- What it does
--  1. Creates any missing tables (existing tables and data are untouched).
--  2. Adds the indexes the app's queries and the security policies need.
--  3. Replaces EVERY policy on the five app tables with one canonical set:
--     - owner-only access, with an explicit `WITH CHECK` on updates, so a row
--       can't be handed to another user by changing user_id (the old
--       policies already behaved this way; it is now spelled out)
--     - a task can only be filed under one of your own tasks (new)
--     - task_personnel links need BOTH the task and the person to be yours
--       (new: closes RISKS.md R5; also removes the older overlapping
--       "manage assignments" policy, which had the same gap)
--     - `(select auth.uid())` instead of `auth.uid()`: same meaning, but
--       Postgres evaluates it once per query instead of once per row
--  4. Re-creates the per-user storage policies for the 'task-images' bucket.
--
-- Before running on live data, run supabase/verify_live.sql and keep its
-- output, so we can compare. Column types below are inferred from the app's
-- code; if verify_live.sql shows differences, tell Claude before running.
-- =====================================================================

-- 1. TABLES -----------------------------------------------------------

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  completed   boolean not null default false,
  due_date    timestamptz,
  details     text,
  images      text[] not null default '{}',
  parent_id   uuid references public.tasks(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  content     text,
  images      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.library_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null,
  title       text not null,
  subtitle    text,
  details     jsonb not null default '{}',
  description text,
  images      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.personnel (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  rank        text,
  image_url   text,
  birthplace  text,
  education   text,
  expertise   text,
  bio         text,
  created_at  timestamptz not null default now()
);

create table if not exists public.task_personnel (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  personnel_id  uuid not null references public.personnel(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (task_id, personnel_id)
);

-- Deleting a task deletes its subtasks (App.deleteTask relies on this).
alter table public.tasks drop constraint if exists tasks_parent_id_fkey;
alter table public.tasks
  add constraint tasks_parent_id_fkey
  foreign key (parent_id) references public.tasks(id) on delete cascade;

-- 2. INDEXES ----------------------------------------------------------
-- Every policy filters on user_id, and the app filters/sorts as below.

create index if not exists tasks_user_due_idx          on public.tasks (user_id, due_date, created_at);
create index if not exists tasks_parent_idx            on public.tasks (parent_id);
create index if not exists notes_user_created_idx      on public.notes (user_id, created_at desc);
create index if not exists library_user_category_idx   on public.library_items (user_id, category, title);
create index if not exists personnel_user_name_idx     on public.personnel (user_id, name);
create index if not exists task_personnel_task_idx     on public.task_personnel (task_id);
create index if not exists task_personnel_person_idx   on public.task_personnel (personnel_id);

-- 3. ROW-LEVEL SECURITY -----------------------------------------------

alter table public.tasks          enable row level security;
alter table public.notes          enable row level security;
alter table public.library_items  enable row level security;
alter table public.personnel      enable row level security;
alter table public.task_personnel enable row level security;

-- Start clean: drop every existing policy on these tables (policies are
-- OR'd together, so a stray permissive one would silently undo the rest).
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('tasks', 'notes', 'library_items', 'personnel', 'task_personnel')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- A policy on `tasks` can't query `tasks` directly (Postgres reports "infinite
-- recursion detected in policy"), so ownership of a parent task is checked by
-- this small helper. SECURITY DEFINER lets it read the table without going
-- through the policy; it only ever answers "is this task mine?", which is
-- true for the caller's own tasks and false for everything else.
create or replace function public.owns_task(task uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = task and t.user_id = (select auth.uid())
  )
$$;
revoke all on function public.owns_task(uuid) from public, anon;
grant execute on function public.owns_task(uuid) to authenticated;

-- Tasks. A parent, if any, must also be yours.
create policy "tasks: select own" on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "tasks: insert own" on public.tasks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (parent_id is null or public.owns_task(parent_id))
  );
create policy "tasks: update own" on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (parent_id is null or public.owns_task(parent_id))
  );
create policy "tasks: delete own" on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Notes (Captain's Log)
create policy "notes: select own" on public.notes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "notes: insert own" on public.notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "notes: update own" on public.notes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes: delete own" on public.notes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Library
create policy "library_items: select own" on public.library_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "library_items: insert own" on public.library_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "library_items: update own" on public.library_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "library_items: delete own" on public.library_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Personnel
create policy "personnel: select own" on public.personnel for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "personnel: insert own" on public.personnel for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "personnel: update own" on public.personnel for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "personnel: delete own" on public.personnel for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Task assignments: both ends must be yours. (No update policy: the app only
-- inserts and deletes links.)
create policy "task_personnel: select own" on public.task_personnel for select to authenticated
  using (exists (select 1 from public.tasks t
                 where t.id = task_id and t.user_id = (select auth.uid())));
create policy "task_personnel: insert own" on public.task_personnel for insert to authenticated
  with check (
    exists (select 1 from public.tasks t
            where t.id = task_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.personnel p
                where p.id = personnel_id and p.user_id = (select auth.uid()))
  );
create policy "task_personnel: delete own" on public.task_personnel for delete to authenticated
  using (exists (select 1 from public.tasks t
                 where t.id = task_id and t.user_id = (select auth.uid())));

-- 4. STORAGE ('task-images' bucket) -----------------------------------
-- Files live under '<user_id>/...' (src/lib/storage.js). SELECT is needed by
-- the Storage API for remove()/move() and for creating signed URLs. Legacy
-- files uploaded before per-user folders stay reachable by their uploader
-- through owner_id.

-- Older bucket-wide policies (any signed-in user could touch any file)
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow authenticated update/delete" on storage.objects;
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Authenticated users can update images" on storage.objects;
drop policy if exists "Authenticated users can delete images" on storage.objects;

drop policy if exists "Users can select own images" on storage.objects;
create policy "Users can select own images" on storage.objects for select to authenticated
  using (
    bucket_id = 'task-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or owner_id = (select auth.uid())::text)
  );

drop policy if exists "Users can upload images to own folder" on storage.objects;
create policy "Users can upload images to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own images" on storage.objects;
create policy "Users can update own images" on storage.objects for update to authenticated
  using (
    bucket_id = 'task-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or owner_id = (select auth.uid())::text)
  )
  with check (
    bucket_id = 'task-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own images" on storage.objects;
create policy "Users can delete own images" on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or owner_id = (select auth.uid())::text)
  );

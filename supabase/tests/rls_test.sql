-- !!! DO NOT RUN IN THE SUPABASE SQL EDITOR !!!
-- Test script for a scratch local Postgres only (npm run test:db, see run.sh).
-- It uses psql commands (\i) and fake data. The real migrations are in
-- supabase/migrations/.

-- =====================================================================
-- Row-level security tests. Run via supabase/tests/run.sh on a SCRATCH
-- database (never on your live project). Everything happens inside one
-- transaction that is rolled back, so it leaves nothing behind.
--
-- "blocked" = the database refused it (error, or 0 rows touched).
-- Any failure raises an exception and the runner exits non-zero.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

-- ---- helpers --------------------------------------------------------
create function public.t_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute 'reset role';
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
end $$;

create function public.t_super() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end $$;

-- the statement must raise an error (e.g. an RLS violation)
create function public.t_blocked(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt;
  exception when others then
    raise notice 'ok    blocked: %', label; return;
  end;
  raise exception 'FAIL allowed but should be blocked: %', label;
end $$;

-- the statement must succeed
create function public.t_allowed(label text, stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'ok    allowed: %', label;
exception when others then
  raise exception 'FAIL blocked but should be allowed: % (%)', label, sqlerrm;
end $$;

-- the statement must touch exactly `expected` rows (RLS filters UPDATE/DELETE silently)
create function public.t_rows(label text, stmt text, expected int) returns void language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'FAIL %: touched % rows, expected %', label, n, expected;
  end if;
  raise notice 'ok    % rows=%', label, n;
end $$;

create function public.t_count(label text, query text, expected int) returns void language plpgsql as $$
declare n int;
begin
  execute 'select count(*) from (' || query || ') q' into n;
  if n <> expected then
    raise exception 'FAIL %: saw % rows, expected %', label, n, expected;
  end if;
  raise notice 'ok    % sees=%', label, n;
end $$;

-- ---- fixtures (as the table owner, which bypasses RLS) ----------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@example.com');

insert into public.tasks (id, user_id, text) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'A parent'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'B task');
insert into public.personnel (id, user_id, name) values
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'A person'),
  ('b2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'B person');
insert into public.notes (user_id, title) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'A note'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'B note');
insert into public.library_items (user_id, category, title) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'SHIPS', 'A ship'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'SHIPS', 'B ship');
insert into public.task_personnel (task_id, personnel_id) values
  ('b1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001');

insert into storage.buckets (id, name, public) values ('task-images', 'task-images', false), ('other', 'other', false)
  on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner_id) values
  ('task-images', 'bbbbbbbb-0000-0000-0000-00000000000b/tasks/1/b.png', 'bbbbbbbb-0000-0000-0000-00000000000b'),
  ('task-images', 'legacy-a.png', 'aaaaaaaa-0000-0000-0000-00000000000a');

-- ---- user A -----------------------------------------------------------
select public.t_as('aaaaaaaa-0000-0000-0000-00000000000a');

select public.t_count('A tasks', 'select 1 from public.tasks', 1);
select public.t_count('A personnel', 'select 1 from public.personnel', 1);
select public.t_count('A notes', 'select 1 from public.notes', 1);
select public.t_count('A library', 'select 1 from public.library_items', 1);
select public.t_count('A assignments (B''s link is invisible)', 'select 1 from public.task_personnel', 0);

select public.t_allowed('A adds own task',
  $$insert into public.tasks (user_id, text) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'mine')$$);
select public.t_blocked('A adds a task as B',
  $$insert into public.tasks (user_id, text) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'planted')$$);
select public.t_blocked('A hands own task to B (update user_id)',
  $$update public.tasks set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where id = 'a1000000-0000-0000-0000-000000000001'$$);
select public.t_rows('A edits B''s task',
  $$update public.tasks set text = 'hacked' where id = 'b1000000-0000-0000-0000-000000000001'$$, 0);
select public.t_rows('A deletes B''s task',
  $$delete from public.tasks where id = 'b1000000-0000-0000-0000-000000000001'$$, 0);

-- subtasks
select public.t_allowed('A adds a subtask under own task',
  $$insert into public.tasks (id, user_id, text, parent_id) values ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'child', 'a1000000-0000-0000-0000-000000000001')$$);
select public.t_blocked('A adds a subtask under B''s task',
  $$insert into public.tasks (user_id, text, parent_id) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'intruder', 'b1000000-0000-0000-0000-000000000001')$$);
select public.t_blocked('A re-parents own task under B''s task',
  $$update public.tasks set parent_id = 'b1000000-0000-0000-0000-000000000001' where id = 'a1000000-0000-0000-0000-000000000002'$$);

-- assignments (the R5 gap)
select public.t_allowed('A assigns own person to own task',
  $$insert into public.task_personnel (task_id, personnel_id) values ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001')$$);
select public.t_blocked('A assigns B''s person to own task (R5)',
  $$insert into public.task_personnel (task_id, personnel_id) values ('a1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001')$$);
select public.t_blocked('A assigns own person to B''s task',
  $$insert into public.task_personnel (task_id, personnel_id) values ('b1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001')$$);
select public.t_count('A sees only own assignment', 'select 1 from public.task_personnel', 1);

-- the other tables: planting rows as B, and handing rows to B
select public.t_blocked('A adds a note as B',
  $$insert into public.notes (user_id, title) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x')$$);
select public.t_blocked('A adds a library item as B',
  $$insert into public.library_items (user_id, category, title) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'S', 'x')$$);
select public.t_blocked('A adds personnel as B',
  $$insert into public.personnel (user_id, name) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'x')$$);
select public.t_blocked('A hands a note to B',
  $$update public.notes set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where title = 'A note'$$);
select public.t_blocked('A hands a library item to B',
  $$update public.library_items set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where title = 'A ship'$$);
select public.t_blocked('A hands personnel to B',
  $$update public.personnel set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where name = 'A person'$$);
select public.t_rows('A edits B''s note', $$update public.notes set title = 'x' where title = 'B note'$$, 0);
select public.t_rows('A deletes B''s library item', $$delete from public.library_items where title = 'B ship'$$, 0);
select public.t_rows('A deletes B''s personnel', $$delete from public.personnel where name = 'B person'$$, 0);

-- deleting a parent removes its subtasks
select public.t_rows('A deletes parent task (cascades)',
  $$delete from public.tasks where id = 'a1000000-0000-0000-0000-000000000001'$$, 1);
select public.t_count('subtask went with its parent', $$select 1 from public.tasks where id = 'a1000000-0000-0000-0000-000000000002'$$, 0);

-- storage
select public.t_allowed('A uploads into own folder',
  $$insert into storage.objects (bucket_id, name, owner_id) values ('task-images', 'aaaaaaaa-0000-0000-0000-00000000000a/tasks/1/a.png', 'aaaaaaaa-0000-0000-0000-00000000000a')$$);
select public.t_blocked('A uploads into B''s folder',
  $$insert into storage.objects (bucket_id, name, owner_id) values ('task-images', 'bbbbbbbb-0000-0000-0000-00000000000b/tasks/1/evil.png', 'aaaaaaaa-0000-0000-0000-00000000000a')$$);
select public.t_blocked('A uploads to the root of the bucket',
  $$insert into storage.objects (bucket_id, name, owner_id) values ('task-images', 'root.png', 'aaaaaaaa-0000-0000-0000-00000000000a')$$);
select public.t_blocked('A uploads to a different bucket',
  $$insert into storage.objects (bucket_id, name, owner_id) values ('other', 'aaaaaaaa-0000-0000-0000-00000000000a/x.png', 'aaaaaaaa-0000-0000-0000-00000000000a')$$);
select public.t_count('A sees own files + own legacy file, not B''s', 'select 1 from storage.objects', 2);
select public.t_rows('A deletes B''s file',
  $$delete from storage.objects where name like 'bbbbbbbb%'$$, 0);
select public.t_blocked('A moves own file into B''s folder',
  $$update storage.objects set name = 'bbbbbbbb-0000-0000-0000-00000000000b/stolen.png' where name = 'legacy-a.png'$$);
select public.t_rows('A deletes own legacy file (owner_id)',
  $$delete from storage.objects where name = 'legacy-a.png'$$, 1);

-- ---- user B -----------------------------------------------------------
select public.t_as('bbbbbbbb-0000-0000-0000-00000000000b');

select public.t_count('B tasks', 'select 1 from public.tasks', 1);
select public.t_count('B notes', 'select 1 from public.notes', 1);
select public.t_count('B sees only their own assignment', 'select 1 from public.task_personnel', 1);
select public.t_rows('B cannot remove A''s assignment (none visible)',
  $$delete from public.task_personnel where task_id = 'a1000000-0000-0000-0000-000000000001'$$, 0);
select public.t_count('B sees only own storage files', 'select 1 from storage.objects', 1);

-- ---- signed-out visitor (anon) ---------------------------------------
select public.t_as(null);

select public.t_count('anon sees no tasks', 'select 1 from public.tasks', 0);
select public.t_count('anon sees no notes', 'select 1 from public.notes', 0);
select public.t_count('anon sees no personnel', 'select 1 from public.personnel', 0);
select public.t_count('anon sees no library', 'select 1 from public.library_items', 0);
select public.t_count('anon sees no files', 'select 1 from storage.objects', 0);
select public.t_blocked('anon cannot add a task',
  $$insert into public.tasks (user_id, text) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x')$$);

select public.t_super();
rollback;
\echo ALL RLS TESTS PASSED

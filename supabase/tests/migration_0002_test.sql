-- Checks 0002_private_images.sql on data shaped like the live legacy state:
-- a public bucket and records holding full public URLs. Runs in a
-- transaction that is rolled back.
begin;

insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-00000000000a') on conflict do nothing;
insert into storage.buckets (id, name, public) values ('task-images', 'task-images', true)
  on conflict (id) do update set public = true;

insert into public.tasks (id, user_id, text, images) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'legacy',
   array['https://abc.supabase.co/storage/v1/object/public/task-images/aaaaaaaa-0000-0000-0000-00000000000a/tasks/1/a.png',
         'https://example.com/external.png',
         'aaaaaaaa-0000-0000-0000-00000000000a/tasks/1/already-a-path.png',
         'https://abc.supabase.co/storage/v1/object/public/task-images/aaaaaaaa-0000-0000-0000-00000000000a/a%20b.png']),
  ('c1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', 'no images', '{}');
insert into public.notes (user_id, title, images) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'n',
   array['https://abc.supabase.co/storage/v1/object/sign/task-images/aaaaaaaa-0000-0000-0000-00000000000a/logs/x.webp?token=abc']);
insert into public.library_items (user_id, category, title, images) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'SHIPS', 'l',
   array['https://abc.supabase.co/storage/v1/object/public/task-images/aaaaaaaa-0000-0000-0000-00000000000a/library/i.jpg']);
insert into public.personnel (user_id, name, image_url) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'p',
   'https://abc.supabase.co/storage/v1/object/public/task-images/aaaaaaaa-0000-0000-0000-00000000000a/personnel/p.png'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'no image', null);

\i supabase/migrations/0002_private_images.sql
-- a second run must change nothing
\i supabase/migrations/0002_private_images.sql

do $$
declare u constant text := 'aaaaaaaa-0000-0000-0000-00000000000a';
begin
  assert (select public from storage.buckets where id = 'task-images') = false, 'bucket is private';
  assert (select images from public.tasks where id = 'c1000000-0000-0000-0000-000000000001') =
    array[u || '/tasks/1/a.png', 'https://example.com/external.png', u || '/tasks/1/already-a-path.png',
          'https://abc.supabase.co/storage/v1/object/public/task-images/' || u || '/a%20b.png'],
    'task URLs become paths in order; external, existing paths and %-escaped URLs untouched';
  assert (select images from public.tasks where id = 'c1000000-0000-0000-0000-000000000002') = '{}', 'empty stays empty';
  assert (select images[1] from public.notes) = u || '/logs/x.webp', 'signed URL query is dropped';
  assert (select images[1] from public.library_items) = u || '/library/i.jpg', 'library path';
  assert (select image_url from public.personnel where name = 'p') = u || '/personnel/p.png', 'personnel path';
  assert (select image_url from public.personnel where name = 'no image') is null, 'null stays null';
  raise notice 'MIGRATION 0002 TESTS PASSED';
end $$;

rollback;

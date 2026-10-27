-- =====================================================================
-- 0002: make the image bucket PRIVATE (closes risk R1)
-- =====================================================================
-- Until now 'task-images' was a public bucket: anyone with a file's URL
-- could open it, signed in or not. After this migration files are only
-- reachable through short-lived signed links that the app requests for the
-- signed-in owner (storage RLS in 0001 decides who may sign).
--
-- DEPLOY ORDER: ship the app version that understands storage paths FIRST
-- (it also still reads old public URLs), THEN run this. Running it earlier
-- breaks every image on screen until the new app is live.
--
-- Safe to re-run.
-- =====================================================================

-- 1. Close the bucket. Existing public links stop working immediately.
update storage.buckets set public = false where id = 'task-images';

-- 2. Store bare paths instead of full public URLs.
--    'https://x.supabase.co/storage/v1/object/public/task-images/<path>'
--    becomes '<path>'. Only plain paths are rewritten: anything containing a
--    '%' escape, and every external URL, is left as it is (the app reads those
--    too).
create or replace function pg_temp.to_path(v text) returns text
language sql immutable as $$
  select case
    when v ~ '^https?://[^/]+\.supabase\.co/storage/v1/object/(public|sign|authenticated)/task-images/[^?%]+(\?.*)?$'
    then split_part(regexp_replace(v, '^https?://[^/]+/storage/v1/object/[a-z]+/task-images/', ''), '?', 1)
    else v
  end
$$;

update public.tasks
   set images = (select coalesce(array_agg(pg_temp.to_path(i) order by ord), '{}')
                   from unnest(images) with ordinality as t(i, ord))
 where exists (select 1 from unnest(images) i where i is distinct from pg_temp.to_path(i));

update public.notes
   set images = (select coalesce(array_agg(pg_temp.to_path(i) order by ord), '{}')
                   from unnest(images) with ordinality as t(i, ord))
 where exists (select 1 from unnest(images) i where i is distinct from pg_temp.to_path(i));

update public.library_items
   set images = (select coalesce(array_agg(pg_temp.to_path(i) order by ord), '{}')
                   from unnest(images) with ordinality as t(i, ord))
 where exists (select 1 from unnest(images) i where i is distinct from pg_temp.to_path(i));

update public.personnel
   set image_url = pg_temp.to_path(image_url)
 where image_url is distinct from pg_temp.to_path(image_url);

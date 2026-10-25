-- =====================================================================
-- Orphaned image report (Bucket: 'task-images')
--
-- Lists files in storage that no task, log entry, Library record or
-- personnel photo references any more. Run it in the Supabase SQL editor
-- now and then. It only reads; nothing is deleted.
--
-- The app deletes files when you remove an image or delete its record, so
-- orphans should only come from before that (2026-10) or from interrupted
-- uploads/deletes (the app shows "IMAGE DELETE FAILED" when one fails).
--
-- Deleting: Supabase blocks DELETE on storage.objects from SQL, so delete
-- the listed files in Storage > task-images in the dashboard.
--
-- Files newer than a day are skipped: they may belong to an edit that
-- hasn't been saved yet.
-- =====================================================================

WITH referenced_urls AS (
    -- to_jsonb() handles both text[] and jsonb columns
    SELECT jsonb_array_elements_text(to_jsonb(images)) AS url
    FROM public.tasks WHERE images IS NOT NULL
    UNION
    SELECT jsonb_array_elements_text(to_jsonb(images))
    FROM public.notes WHERE images IS NOT NULL
    UNION
    SELECT jsonb_array_elements_text(to_jsonb(images))
    FROM public.library_items WHERE images IS NOT NULL
    UNION
    SELECT image_url
    FROM public.personnel WHERE image_url IS NOT NULL
),
referenced_paths AS (
    -- Public URL: .../storage/v1/object/public/task-images/<path>
    SELECT split_part(url, '/task-images/', 2) AS name
    FROM referenced_urls
    WHERE url LIKE '%/task-images/%'
)
SELECT
    o.name,
    o.created_at,
    pg_size_pretty((o.metadata->>'size')::bigint) AS size,
    -- Old uploads kept original file names; URLs encode characters such as
    -- spaces (%20), so these can't be matched reliably here. Check by hand.
    o.name ~ '[^A-Za-z0-9._/-]' AS check_by_hand
FROM storage.objects o
WHERE o.bucket_id = 'task-images'
  AND o.created_at < now() - interval '1 day'
  AND NOT EXISTS (SELECT 1 FROM referenced_paths r WHERE r.name = o.name)
ORDER BY o.created_at;

-- =====================================================================
-- READ-ONLY snapshot of your live database's structure and security.
-- Run in the Supabase SQL editor and copy the single result cell back to
-- Claude. It contains no row data (no tasks, notes, emails or keys): only
-- table/column definitions, policies, indexes and bucket settings.
--
-- Use it before running migrations/0001_baseline.sql (to compare), and any
-- time you want to check the live database still matches the repo (R4).
-- Look first at "tables": any row with rls_enabled = false is a hole.
-- =====================================================================
select jsonb_pretty(jsonb_build_object(
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object('table', c.relname, 'rls_enabled', c.relrowsecurity) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name, 'type', data_type,
                                        'nullable', is_nullable, 'default', column_default)
                     order by table_name, ordinal_position)
    from information_schema.columns where table_schema = 'public'), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object('on', schemaname || '.' || tablename, 'name', policyname, 'cmd', cmd,
                                        'roles', roles, 'using', qual, 'with_check', with_check)
                     order by tablename, policyname)
    from pg_policies
    where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects')), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname = 'public'), '[]'::jsonb),
  'foreign_keys', coalesce((
    select jsonb_agg(conrelid::regclass::text || ': ' || pg_get_constraintdef(oid) order by conrelid::regclass::text)
    from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace), '[]'::jsonb),
  'buckets', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'public', public) order by id) from storage.buckets), '[]'::jsonb)
)) as live_snapshot;

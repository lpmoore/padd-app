-- =====================================================================
-- Tasks schema fixes
--
-- !!! MUST BE RUN MANUALLY IN THE SUPABASE SQL EDITOR !!!
-- (The full tasks table definition isn't in the repo yet; see PLAN.md.)
-- =====================================================================

-- Deleting a task deletes its subtasks (and, via task_personnel's own
-- cascade, their assignments). Without this, deleting a parent fails with a
-- foreign key violation. App.deleteTask relies on it to clean up subtask images.
ALTER TABLE public.tasks
  DROP CONSTRAINT tasks_parent_id_fkey,
  ADD CONSTRAINT tasks_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

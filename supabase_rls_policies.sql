-- Enable Row Level Security (RLS) on all public tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_personnel ENABLE ROW LEVEL SECURITY;

-- 1. Policies for 'tasks'
DROP POLICY IF EXISTS "Users can only select their own tasks" ON public.tasks;
CREATE POLICY "Users can only select their own tasks" 
ON public.tasks FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own tasks" ON public.tasks;
CREATE POLICY "Users can only insert their own tasks" 
ON public.tasks FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own tasks" ON public.tasks;
CREATE POLICY "Users can only update their own tasks" 
ON public.tasks FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own tasks" ON public.tasks;
CREATE POLICY "Users can only delete their own tasks" 
ON public.tasks FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 2. Policies for 'notes' (Captain's Log)
DROP POLICY IF EXISTS "Users can select own notes" ON public.notes;
CREATE POLICY "Users can select own notes" 
ON public.notes FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
CREATE POLICY "Users can insert own notes" 
ON public.notes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes" 
ON public.notes FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own notes" 
ON public.notes FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 3. Policies for 'library_items'
DROP POLICY IF EXISTS "Users can select own library items" ON public.library_items;
CREATE POLICY "Users can select own library items" 
ON public.library_items FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own library items" ON public.library_items;
CREATE POLICY "Users can insert own library items" 
ON public.library_items FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own library items" ON public.library_items;
CREATE POLICY "Users can update own library items" 
ON public.library_items FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own library items" ON public.library_items;
CREATE POLICY "Users can delete own library items" 
ON public.library_items FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 4. Policies for 'personnel'
DROP POLICY IF EXISTS "Users can select own personnel" ON public.personnel;
CREATE POLICY "Users can select own personnel" 
ON public.personnel FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own personnel" ON public.personnel;
CREATE POLICY "Users can insert own personnel" 
ON public.personnel FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own personnel" ON public.personnel;
CREATE POLICY "Users can update own personnel" 
ON public.personnel FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own personnel" ON public.personnel;
CREATE POLICY "Users can delete own personnel" 
ON public.personnel FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);


-- 5. Policies for 'task_personnel' (Join Table)
DROP POLICY IF EXISTS "Users can select task assignments for their tasks" ON public.task_personnel;
CREATE POLICY "Users can select task assignments for their tasks" 
ON public.task_personnel FOR SELECT 
TO authenticated 
USING (
    task_id IN (SELECT id FROM public.tasks WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert task assignments for their tasks" ON public.task_personnel;
CREATE POLICY "Users can insert task assignments for their tasks" 
ON public.task_personnel FOR INSERT 
TO authenticated 
WITH CHECK (
    task_id IN (SELECT id FROM public.tasks WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete task assignments for their tasks" ON public.task_personnel;
CREATE POLICY "Users can delete task assignments for their tasks" 
ON public.task_personnel FOR DELETE 
TO authenticated 
USING (
    task_id IN (SELECT id FROM public.tasks WHERE user_id = auth.uid())
);


-- 6. Storage Security (Bucket: 'task-images')
-- Note: 'storage.objects' is a system table. We cannot easily 'DROP IF EXISTS' on it without risking system policies.
-- However, creating policies usually requires unique names.
-- We will attempt to Drop them first to be safe.

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'task-images' );

DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'task-images' );

DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'task-images' );

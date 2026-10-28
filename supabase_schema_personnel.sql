-- Create Personnel Table
create table public.personnel (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  rank text,
  image_url text,
  birthplace text,
  education text,
  expertise text,
  bio text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.personnel enable row level security;

-- Policies: see supabase_rls_policies.sql (section 4)

-- Create Task Assignments (Junction) Table
create table public.task_personnel (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  personnel_id uuid references public.personnel(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(task_id, personnel_id)
);

-- Enable RLS
alter table public.task_personnel enable row level security;

-- Policies: see supabase_rls_policies.sql (section 5)

-- STORAGE BUCKET POLICY for 'personnel-images' (if we separate, but we can reuse task-images or make a new one)
-- Let's stick to 'task-images' or create 'personnel-images'.
-- Let's reuse 'task-images' for simplicity or ask user to create new one?
-- Better to keep using existing bucket but organize folders.

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

-- Policies for Personnel
create policy "Users can view their own personnel"
  on public.personnel for select
  using (auth.uid() = user_id);

create policy "Users can insert their own personnel"
  on public.personnel for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own personnel"
  on public.personnel for update
  using (auth.uid() = user_id);

create policy "Users can delete their own personnel"
  on public.personnel for delete
  using (auth.uid() = user_id);

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

-- Policies for Task Personnel
-- Note: complex check but simple approach: trust if you can see the task
create policy "Users can manage assignments for their tasks"
  on public.task_personnel for all
  using (
    exists (
      select 1 from public.tasks
      where id = task_personnel.task_id
      and user_id = auth.uid()
    )
  );

-- STORAGE BUCKET POLICY for 'personnel-images' (if we separate, but we can reuse task-images or make a new one)
-- Let's stick to 'task-images' or create 'personnel-images'.
-- Let's reuse 'task-images' for simplicity or ask user to create new one?
-- Better to keep using existing bucket but organize folders.

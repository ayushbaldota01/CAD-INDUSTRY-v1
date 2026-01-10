-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- CLEANUP: Drop existing tables to ensure clean schema application
-- effectively resetting the schema to match the new requirements
drop table if exists activity_logs cascade;
drop table if exists annotations cascade;
drop table if exists files cascade;
drop table if exists profiles cascade;

-- Also drop old tables if they exist (from previous schema versions) to avoid confusion
-- (Optional: remove these lines if you want to keep old data tables like 'models')
drop table if exists snapshot_annotations cascade;
drop table if exists comments cascade;
drop table if exists snapshots cascade;
drop table if exists models cascade;
drop table if exists share_tokens cascade;
drop table if exists pdf_overlays cascade;

-- Create Enums (Drop first to allow updates)
drop type if exists file_type cascade;
drop type if exists annotation_type cascade;
drop type if exists user_role cascade;

create type file_type as enum ('glb', 'stl', 'pdf');
create type annotation_type as enum ('comment', 'bubble', 'dimension');
create type user_role as enum ('admin', 'reviewer', 'viewer');

-- 0. Table: profiles (User roles and metadata)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role user_role not null default 'viewer',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 1. Table: files
create table files (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type file_type not null,
  storage_path text not null,
  version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- 2. Table: annotations
create table annotations (
  id uuid primary key default uuid_generate_v4(),
  file_id uuid references files(id) on delete cascade not null,
  type annotation_type not null,
  position jsonb not null, -- {x,y,z} for 3D or {page,x,y} for PDF
  extra jsonb,             -- dimension points, metadata
  text text,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- 3. Table: activity_logs
create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  file_id uuid references files(id) on delete cascade,
  action text not null,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- 4. Table: share_tokens (Secure shared review links)
create table share_tokens (
  id uuid primary key default uuid_generate_v4(),
  file_id uuid references files(id) on delete cascade not null,
  token text unique not null,
  access_mode text not null check (access_mode in ('read-only', 'comment-only')),
  created_by uuid references auth.users(id),
  expires_at timestamp with time zone,
  revoked boolean default false,
  created_at timestamp with time zone default now()
);

-- 5. Table: snapshots (Camera states and images)
create table snapshots (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid references files(id) on delete cascade not null,
  camera_params jsonb not null,
  file_key text not null,
  width integer,
  height integer,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- 6. Table: snapshot_annotations (Link annotations to snapshots)
create table snapshot_annotations (
  id uuid primary key default uuid_generate_v4(),
  snapshot_id uuid references snapshots(id) on delete cascade not null,
  annotation_id uuid references annotations(id) on delete cascade not null,
  u float not null, -- Normalized 2D position X [0-1]
  v float not null, -- Normalized 2D position Y [0-1]
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;
alter table files enable row level security;
alter table annotations enable row level security;
alter table activity_logs enable row level security;
alter table share_tokens enable row level security;

-- Allow all access for now (Public Policies)
create policy "Allow all access to profiles"
  on profiles for all
  using (true)
  with check (true);

create policy "Allow all access to files"
  on files for all
  using (true)
  with check (true);

create policy "Allow all access to annotations"
  on annotations for all
  using (true)
  with check (true);

create policy "Allow all access to activity_logs"
  on activity_logs for all
  using (true)
  with check (true);

create policy "Allow all access to share_tokens"
  on share_tokens for all
  using (true)
  with check (true);

create policy "Allow all access to snapshots"
  on snapshots for all
  using (true)
  with check (true);

create policy "Allow all access to snapshot_annotations"
  on snapshot_annotations for all
  using (true)
  with check (true);

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'viewer' -- Default role
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

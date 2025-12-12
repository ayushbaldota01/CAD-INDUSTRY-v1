-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. USERS
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

-- Trigger logic needs to be careful not to double create
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing; -- Handle conflict
  return new;
end;
$$ language plpgsql security definer;

-- Triggers are harder to do IF NOT EXISTS in pure SQL without a block
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
end $$;


-- 2. MODELS
create table if not exists public.models (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  storage_key text not null,
  file_type text not null,
  width int,
  height int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_models_owner on public.models(owner_id);
alter table public.models enable row level security;


-- 3. SNAPSHOTS
create table if not exists public.snapshots (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid references public.models(id) on delete cascade not null,
  camera_params jsonb,
  file_key text,
  width int,
  height int,
  created_at timestamptz default now()
);

create index if not exists idx_snapshots_model on public.snapshots(model_id);
alter table public.snapshots enable row level security;


-- 4. ANNOTATIONS
create table if not exists public.annotations (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid references public.models(id) on delete cascade not null,
  author_id uuid references public.users(id) on delete set null,
  snapshot_id uuid references public.snapshots(id) on delete set null,
  type text check (type in ('point', 'area', 'comment')) default 'point',
  position jsonb not null,
  text text,
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_annotations_model on public.annotations(model_id);
create index if not exists idx_annotations_author on public.annotations(author_id);
alter table public.annotations enable row level security;


-- 5. SNAPSHOT_ANNOTATIONS
create table if not exists public.snapshot_annotations (
  id uuid primary key default uuid_generate_v4(),
  snapshot_id uuid references public.snapshots(id) on delete cascade not null,
  annotation_id uuid references public.annotations(id) on delete set null,
  u float not null,
  v float not null,
  created_at timestamptz default now()
);

create index if not exists idx_snapshot_annotations_snapshot on public.snapshot_annotations(snapshot_id);
alter table public.snapshot_annotations enable row level security;


-- 6. COMMENTS
create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  annotation_id uuid references public.annotations(id) on delete cascade not null,
  author_id uuid references public.users(id) on delete set null,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists idx_comments_annotation on public.comments(annotation_id);
alter table public.comments enable row level security;


-- 7. SHARE_TOKENS
create table if not exists public.share_tokens (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid references public.models(id) on delete cascade not null,
  token_hash text not null unique,
  role text default 'viewer',
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_share_tokens_model on public.share_tokens(model_id);
create index if not exists idx_share_tokens_hash on public.share_tokens(token_hash);
alter table public.share_tokens enable row level security;


-- 8. PDF OVERLAYS
create table if not exists public.pdf_overlays (
  id uuid primary key default uuid_generate_v4(),
  pdf_key text not null,
  overlay_json jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_pdf_overlays_key on public.pdf_overlays(pdf_key);
alter table public.pdf_overlays enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  hero_name text,
  hero_class text check (hero_class in ('Warrior', 'Mage', 'Rogue')),
  level int not null default 1,
  training_level text not null default 'beginner' check (training_level in ('beginner', 'intermediate', 'advanced')),
  goal text not null default 'muscle' check (goal in ('muscle', 'strength', 'fat_loss', 'general')),
  location text not null default 'gym' check (location in ('gym', 'home')),
  days_per_week int not null default 3 check (days_per_week between 2 and 6),
  equipment text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists training_level text not null default 'beginner' check (training_level in ('beginner', 'intermediate', 'advanced')),
  add column if not exists goal text not null default 'muscle' check (goal in ('muscle', 'strength', 'fat_loss', 'general')),
  add column if not exists location text not null default 'gym' check (location in ('gym', 'home')),
  add column if not exists days_per_week int not null default 3 check (days_per_week between 2 and 6),
  add column if not exists equipment text[] not null default '{}'::text[];

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  meta jsonb not null default '{}'::jsonb,
  plan jsonb not null
);

create unique index if not exists workout_plans_one_active_per_user
on public.workout_plans (user_id)
where is_active = true;

alter table public.profiles enable row level security;
alter table public.workout_plans enable row level security;

drop policy if exists "select own profile" on public.profiles;
create policy "select own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "select own workout plans" on public.workout_plans;
create policy "select own workout plans"
  on public.workout_plans
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own workout plans" on public.workout_plans;
create policy "insert own workout plans"
  on public.workout_plans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own workout plans" on public.workout_plans;
create policy "update own workout plans"
  on public.workout_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_updated_at();

drop trigger if exists set_workout_plans_updated_at on public.workout_plans;
create trigger set_workout_plans_updated_at
  before update on public.workout_plans
  for each row
  execute procedure public.set_updated_at();

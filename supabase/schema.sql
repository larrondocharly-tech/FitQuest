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

alter table public.workout_plans
  add column if not exists cycle_week int not null default 1 check (cycle_week between 1 and 4),
  add column if not exists cycle_start_date date not null default (current_date),
  add column if not exists cycle_rules jsonb not null default '{}'::jsonb;

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

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions
  add column if not exists blueprint jsonb not null default '{}'::jsonb;

create table if not exists public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  workout_date date not null,
  day_index int not null,
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  session_id uuid references public.workout_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, workout_date)
);

create table if not exists public.weekly_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  target_sessions int not null default 3,
  completed_sessions int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  day_index int not null,
  exercise_index int not null,
  exercise_name text not null,
  exercise_key text,
  equipment_type text,
  set_index int not null,
  target_reps_min int,
  target_reps_max int,
  weight_kg numeric,
  reps int not null,
  rpe numeric,
  rest_seconds int,
  created_at timestamptz not null default now()
);

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp int not null default 0,
  level int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_stats
  add column if not exists streak_current int not null default 0,
  add column if not exists streak_best int not null default 0,
  add column if not exists last_workout_date date,
  add column if not exists streak_milestones jsonb not null default '[]'::jsonb;

alter table public.exercise_logs add column if not exists exercise_key text;
alter table public.exercise_logs add column if not exists equipment_type text;

update public.exercise_logs
set exercise_key = lower(regexp_replace(exercise_name, '[^a-z0-9]+', '_', 'g'))
where exercise_key is null and exercise_name is not null;

drop index if exists exercise_logs_user_exercise_created_idx;
drop index if exists exercise_logs_user_plan_day_exercise_created_idx;

create index if not exists exercise_logs_user_exercise_key_created_idx
  on public.exercise_logs (user_id, exercise_key, created_at desc);

create index if not exists exercise_logs_user_plan_day_exercise_key_created_idx
  on public.exercise_logs (user_id, plan_id, day_index, exercise_key, created_at desc);

create index if not exists exercise_logs_user_exercise_name_created_idx
  on public.exercise_logs (user_id, exercise_name, created_at desc);

alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.user_stats enable row level security;
alter table public.weekly_quests enable row level security;
alter table public.scheduled_workouts enable row level security;

drop policy if exists "select own workout sessions" on public.workout_sessions;
create policy "select own workout sessions"
  on public.workout_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own workout sessions" on public.workout_sessions;
create policy "insert own workout sessions"
  on public.workout_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own workout sessions" on public.workout_sessions;
create policy "update own workout sessions"
  on public.workout_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own workout sessions" on public.workout_sessions;
create policy "delete own workout sessions"
  on public.workout_sessions
  for delete
  using (auth.uid() = user_id);

drop policy if exists "select own exercise logs" on public.exercise_logs;
create policy "select own exercise logs"
  on public.exercise_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own exercise logs" on public.exercise_logs;
create policy "insert own exercise logs"
  on public.exercise_logs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own exercise logs" on public.exercise_logs;
create policy "update own exercise logs"
  on public.exercise_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own exercise logs" on public.exercise_logs;
create policy "delete own exercise logs"
  on public.exercise_logs
  for delete
  using (auth.uid() = user_id);

drop policy if exists "select own user stats" on public.user_stats;
create policy "select own user stats"
  on public.user_stats
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own user stats" on public.user_stats;
create policy "insert own user stats"
  on public.user_stats
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own user stats" on public.user_stats;
create policy "update own user stats"
  on public.user_stats
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own user stats" on public.user_stats;
create policy "delete own user stats"
  on public.user_stats
  for delete
  using (auth.uid() = user_id);

drop policy if exists "select own weekly quests" on public.weekly_quests;
create policy "select own weekly quests"
  on public.weekly_quests
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own weekly quests" on public.weekly_quests;
create policy "insert own weekly quests"
  on public.weekly_quests
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own weekly quests" on public.weekly_quests;
create policy "update own weekly quests"
  on public.weekly_quests
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own weekly quests" on public.weekly_quests;
create policy "delete own weekly quests"
  on public.weekly_quests
  for delete
  using (auth.uid() = user_id);

drop policy if exists "select own scheduled workouts" on public.scheduled_workouts;
create policy "select own scheduled workouts"
  on public.scheduled_workouts
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own scheduled workouts" on public.scheduled_workouts;
create policy "insert own scheduled workouts"
  on public.scheduled_workouts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own scheduled workouts" on public.scheduled_workouts;
create policy "update own scheduled workouts"
  on public.scheduled_workouts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own scheduled workouts" on public.scheduled_workouts;
create policy "delete own scheduled workouts"
  on public.scheduled_workouts
  for delete
  using (auth.uid() = user_id);

drop trigger if exists set_user_stats_updated_at on public.user_stats;
create trigger set_user_stats_updated_at
  before update on public.user_stats
  for each row
  execute procedure public.set_updated_at();

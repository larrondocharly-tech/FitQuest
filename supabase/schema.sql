create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  hero_name text,
  hero_class text check (hero_class in ('Warrior', 'Mage', 'Rogue', 'Ninja', 'Titan', 'Ranger', 'Runner')),
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
  add column if not exists equipment text[] not null default '{}'::text[],
  add column if not exists archetype text not null default 'hypertrophy',
  add column if not exists baseline jsonb not null default '{}'::jsonb;


do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_hero_class_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_hero_class_check;
  end if;

  alter table public.profiles
    add constraint profiles_hero_class_check
    check (hero_class in ('Warrior', 'Mage', 'Rogue', 'Ninja', 'Titan', 'Ranger', 'Runner'));
exception
  when duplicate_object then null;
end;
$$;

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

create table if not exists public.plan_templates (
  id uuid primary key default gen_random_uuid(),
  archetype text not null,
  title text not null,
  description text,
  days_per_week int not null,
  location text not null,
  equipment jsonb not null default '[]'::jsonb,
  template jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_constraints (
  user_id uuid primary key references auth.users(id) on delete cascade,
  time_cap_minutes int,
  injuries jsonb not null default '[]'::jsonb,
  banned_exercises jsonb not null default '[]'::jsonb,
  preferred_exercises jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_variants (
  id uuid primary key default gen_random_uuid(),
  base_key text not null,
  variant_key text not null unique,
  name text not null,
  equipment_type text not null,
  tags jsonb not null default '[]'::jsonb,
  priority int not null default 100
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
alter table public.user_constraints enable row level security;
alter table public.plan_templates enable row level security;
alter table public.exercise_variants enable row level security;

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

drop policy if exists "select own user constraints" on public.user_constraints;
create policy "select own user constraints"
  on public.user_constraints
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own user constraints" on public.user_constraints;
create policy "insert own user constraints"
  on public.user_constraints
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own user constraints" on public.user_constraints;
create policy "update own user constraints"
  on public.user_constraints
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own user constraints" on public.user_constraints;
create policy "delete own user constraints"
  on public.user_constraints
  for delete
  using (auth.uid() = user_id);

drop policy if exists "select authenticated plan templates" on public.plan_templates;
create policy "select authenticated plan templates"
  on public.plan_templates
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "select authenticated exercise variants" on public.exercise_variants;
create policy "select authenticated exercise variants"
  on public.exercise_variants
  for select
  using (auth.role() = 'authenticated');

create unique index if not exists plan_templates_unique_catalog_idx
  on public.plan_templates (archetype, title, days_per_week, location);

create index if not exists plan_templates_archetype_days_location_idx
  on public.plan_templates (archetype, days_per_week, location);

create index if not exists exercise_variants_base_key_idx
  on public.exercise_variants (base_key);

insert into public.exercise_variants (base_key, variant_key, name, equipment_type, tags, priority)
values
  ('barbell_bench_press', 'machine_chest_press', 'Machine Chest Press', 'machine', '["shoulder_friendly","machine"]'::jsonb, 90),
  ('barbell_bench_press', 'db_flat_press', 'Dumbbell Flat Press', 'dumbbell', '["unilateral"]'::jsonb, 95),
  ('barbell_back_squat', 'goblet_squat', 'Goblet Squat', 'dumbbell', '["home"]'::jsonb, 90),
  ('barbell_back_squat', 'leg_press', 'Leg Press', 'machine', '["knee_friendly"]'::jsonb, 92),
  ('barbell_row', 'chest_supported_row', 'Chest Supported Row', 'machine', '["low_back_friendly"]'::jsonb, 90),
  ('strict_pullup', 'lat_pulldown', 'Lat Pulldown', 'machine', '["assisted"]'::jsonb, 88),
  ('interval_run', 'fartlek_run', 'Fartlek Run', 'running', '["outdoor"]'::jsonb, 96)
on conflict (variant_key) do update
set
  base_key = excluded.base_key,
  name = excluded.name,
  equipment_type = excluded.equipment_type,
  tags = excluded.tags,
  priority = excluded.priority;

insert into public.plan_templates (archetype, title, description, days_per_week, location, equipment, template)
values
  ('hypertrophy', 'Hypertrophy Full Body 3D', 'Progressive full body split with stable compounds.', 3, 'gym', '["barbell","dumbbell","machine"]'::jsonb, $$
  {"title":"Hypertrophy Full Body 3D","split":"full_body","days":[{"day":"Jour 1","focus":"Full Body A","exercises":[{"exercise_key":"barbell_back_squat","exercise_name":"Barbell Back Squat","equipment_type":"barbell","sets":"4","reps":"5-8","target_reps_min":5,"target_reps_max":8},{"exercise_key":"barbell_bench_press","exercise_name":"Barbell Bench Press","equipment_type":"barbell","sets":"4","reps":"6-10","target_reps_min":6,"target_reps_max":10},{"exercise_key":"barbell_row","exercise_name":"Barbell Row","equipment_type":"barbell","sets":"4","reps":"6-10","target_reps_min":6,"target_reps_max":10}]},{"day":"Jour 2","focus":"Full Body B","exercises":[{"exercise_key":"barbell_romanian_deadlift","exercise_name":"Barbell Romanian Deadlift","equipment_type":"barbell","sets":"4","reps":"6-10","target_reps_min":6,"target_reps_max":10},{"exercise_key":"seated_db_shoulder_press","exercise_name":"Seated Dumbbell Shoulder Press","equipment_type":"dumbbell","sets":"3","reps":"8-12","target_reps_min":8,"target_reps_max":12},{"exercise_key":"lat_pulldown","exercise_name":"Lat Pulldown","equipment_type":"machine","sets":"3","reps":"8-12","target_reps_min":8,"target_reps_max":12}]},{"day":"Jour 3","focus":"Full Body C","exercises":[{"exercise_key":"front_squat","exercise_name":"Front Squat","equipment_type":"barbell","sets":"3","reps":"6-8","target_reps_min":6,"target_reps_max":8},{"exercise_key":"incline_db_press","exercise_name":"Incline DB Press","equipment_type":"dumbbell","sets":"3","reps":"8-12","target_reps_min":8,"target_reps_max":12},{"exercise_key":"cable_row","exercise_name":"Cable Row","equipment_type":"machine","sets":"3","reps":"10-12","target_reps_min":10,"target_reps_max":12}]}],"meta":{"archetype":"hypertrophy","days_per_week":3,"location":"gym"}}
  $$::jsonb),
  ('hypertrophy', 'Upper Lower 4D', 'Upper/lower split prioritizing volume landmarks.', 4, 'gym', '["barbell","dumbbell","machine"]'::jsonb, '{"title":"Upper Lower 4D","split":"upper_lower","days":[{"day":"Jour 1","focus":"Upper","exercises":[{"exercise_key":"barbell_bench_press","exercise_name":"Barbell Bench Press","equipment_type":"barbell","sets":"4","reps":"6-10","target_reps_min":6,"target_reps_max":10}]},{"day":"Jour 2","focus":"Lower","exercises":[{"exercise_key":"barbell_back_squat","exercise_name":"Barbell Back Squat","equipment_type":"barbell","sets":"4","reps":"5-8","target_reps_min":5,"target_reps_max":8}]},{"day":"Jour 3","focus":"Upper","exercises":[{"exercise_key":"lat_pulldown","exercise_name":"Lat Pulldown","equipment_type":"machine","sets":"4","reps":"8-12","target_reps_min":8,"target_reps_max":12}]},{"day":"Jour 4","focus":"Lower","exercises":[{"exercise_key":"barbell_deadlift","exercise_name":"Barbell Deadlift","equipment_type":"barbell","sets":"3","reps":"3-5","target_reps_min":3,"target_reps_max":5}]}],"meta":{"archetype":"hypertrophy","days_per_week":4,"location":"gym"}}'::jsonb),
  ('hypertrophy', 'PPL 6D', 'Classic push pull legs high frequency.', 6, 'gym', '["barbell","dumbbell","machine"]'::jsonb, '{"title":"PPL 6D","split":"push_pull_legs","days":[{"day":"Jour 1","focus":"Push","exercises":[{"exercise_key":"barbell_bench_press","exercise_name":"Barbell Bench Press","equipment_type":"barbell","sets":"4","reps":"6-10","target_reps_min":6,"target_reps_max":10}]},{"day":"Jour 2","focus":"Pull","exercises":[{"exercise_key":"barbell_row","exercise_name":"Barbell Row","equipment_type":"barbell","sets":"4","reps":"6-10","target_reps_min":6,"target_reps_max":10}]},{"day":"Jour 3","focus":"Legs","exercises":[{"exercise_key":"barbell_back_squat","exercise_name":"Barbell Back Squat","equipment_type":"barbell","sets":"4","reps":"5-8","target_reps_min":5,"target_reps_max":8}]},{"day":"Jour 4","focus":"Push","exercises":[{"exercise_key":"seated_db_shoulder_press","exercise_name":"Seated Dumbbell Shoulder Press","equipment_type":"dumbbell","sets":"4","reps":"8-12","target_reps_min":8,"target_reps_max":12}]},{"day":"Jour 5","focus":"Pull","exercises":[{"exercise_key":"lat_pulldown","exercise_name":"Lat Pulldown","equipment_type":"machine","sets":"4","reps":"8-12","target_reps_min":8,"target_reps_max":12}]},{"day":"Jour 6","focus":"Legs","exercises":[{"exercise_key":"barbell_romanian_deadlift","exercise_name":"Barbell Romanian Deadlift","equipment_type":"barbell","sets":"4","reps":"6-10","target_reps_min":6,"target_reps_max":10}]}],"meta":{"archetype":"hypertrophy","days_per_week":6,"location":"gym"}}'::jsonb),
  ('calisthenics', 'Calisthenics Full Body Skill 3D', 'Skill + strength full body progression.', 3, 'home', '["bodyweight","band"]'::jsonb, '{"title":"Calisthenics Full Body Skill 3D","split":"full_body","days":[{"day":"Jour 1","focus":"Pull + Core","exercises":[{"exercise_key":"strict_pullup","exercise_name":"Strict Pull-Up","equipment_type":"bodyweight","sets":"4","reps":"4-8","target_reps_min":4,"target_reps_max":8}]},{"day":"Jour 2","focus":"Push + Legs","exercises":[{"exercise_key":"ring_dips","exercise_name":"Ring Dips","equipment_type":"bodyweight","sets":"4","reps":"5-10","target_reps_min":5,"target_reps_max":10}]},{"day":"Jour 3","focus":"Skill","exercises":[{"exercise_key":"handstand_practice","exercise_name":"Handstand Practice","equipment_type":"bodyweight","sets":"5","reps":"20-45","target_reps_min":20,"target_reps_max":45}]}],"meta":{"archetype":"calisthenics","days_per_week":3,"location":"home"}}'::jsonb),
  ('calisthenics', 'Calisthenics Push Pull Legs 5D', 'Bodyweight split for intermediate athletes.', 5, 'home', '["bodyweight","band"]'::jsonb, '{"title":"Calisthenics Push Pull Legs 5D","split":"push_pull_legs","days":[{"day":"Jour 1","focus":"Push","exercises":[{"exercise_key":"ring_dips","exercise_name":"Ring Dips","equipment_type":"bodyweight","sets":"5","reps":"5-10","target_reps_min":5,"target_reps_max":10}]},{"day":"Jour 2","focus":"Pull","exercises":[{"exercise_key":"strict_pullup","exercise_name":"Strict Pull-Up","equipment_type":"bodyweight","sets":"5","reps":"4-8","target_reps_min":4,"target_reps_max":8}]},{"day":"Jour 3","focus":"Legs","exercises":[{"exercise_key":"walking_lunge","exercise_name":"Walking Lunge","equipment_type":"bodyweight","sets":"4","reps":"10-15","target_reps_min":10,"target_reps_max":15}]},{"day":"Jour 4","focus":"Skill","exercises":[{"exercise_key":"handstand_practice","exercise_name":"Handstand Practice","equipment_type":"bodyweight","sets":"5","reps":"20-45","target_reps_min":20,"target_reps_max":45}]},{"day":"Jour 5","focus":"Mixed","exercises":[{"exercise_key":"hollow_body_hold","exercise_name":"Hollow Body Hold","equipment_type":"bodyweight","sets":"4","reps":"20-45","target_reps_min":20,"target_reps_max":45}]}],"meta":{"archetype":"calisthenics","days_per_week":5,"location":"home"}}'::jsonb),
  ('weightlifting', 'Weightlifting Technique 3D', 'Snatch/C&J emphasis + strength accessories.', 3, 'gym', '["barbell","plates"]'::jsonb, '{"title":"Weightlifting Technique 3D","split":"olympic","days":[{"day":"Jour 1","focus":"Snatch","exercises":[{"exercise_key":"hang_power_snatch","exercise_name":"Hang Power Snatch","equipment_type":"barbell","sets":"6","reps":"2-3","target_reps_min":2,"target_reps_max":3}]},{"day":"Jour 2","focus":"Clean and Jerk","exercises":[{"exercise_key":"hang_power_clean","exercise_name":"Hang Power Clean + Push Jerk","equipment_type":"barbell","sets":"6","reps":"2-3","target_reps_min":2,"target_reps_max":3}]},{"day":"Jour 3","focus":"Strength","exercises":[{"exercise_key":"barbell_front_squat","exercise_name":"Barbell Front Squat","equipment_type":"barbell","sets":"5","reps":"3-5","target_reps_min":3,"target_reps_max":5}]}],"meta":{"archetype":"weightlifting","days_per_week":3,"location":"gym"}}'::jsonb),
  ('weightlifting', 'Weightlifting Split 4D', '4 day split alternating snatch and C&J priority.', 4, 'gym', '["barbell","plates"]'::jsonb, '{"title":"Weightlifting Split 4D","split":"olympic_split","days":[{"day":"Jour 1","focus":"Snatch","exercises":[{"exercise_key":"power_snatch","exercise_name":"Power Snatch","equipment_type":"barbell","sets":"5","reps":"2-3","target_reps_min":2,"target_reps_max":3}]},{"day":"Jour 2","focus":"Clean & Jerk","exercises":[{"exercise_key":"power_clean_and_jerk","exercise_name":"Power Clean and Jerk","equipment_type":"barbell","sets":"5","reps":"2-3","target_reps_min":2,"target_reps_max":3}]},{"day":"Jour 3","focus":"Snatch Assist","exercises":[{"exercise_key":"snatch_pull","exercise_name":"Snatch Pull","equipment_type":"barbell","sets":"4","reps":"3-4","target_reps_min":3,"target_reps_max":4}]},{"day":"Jour 4","focus":"CJ Assist","exercises":[{"exercise_key":"clean_pull","exercise_name":"Clean Pull","equipment_type":"barbell","sets":"4","reps":"3-4","target_reps_min":3,"target_reps_max":4}]}],"meta":{"archetype":"weightlifting","days_per_week":4,"location":"gym"}}'::jsonb),
  ('running', 'Running Beginner 3D', 'Structure footing/fractionné/sortie longue.', 3, 'outdoor', '["running"]'::jsonb, '{"title":"Running Beginner 3D","split":"running_base","days":[{"day":"Jour 1","focus":"Footing facile","exercises":[{"exercise_key":"easy_run","exercise_name":"Footing facile","equipment_type":"running","kind":"run","sets":"1","reps":"1","target_reps_min":1,"target_reps_max":1,"target_duration_min":35,"target_distance_km":null,"target_intervals":null,"work_seconds":null,"rest_seconds":null,"notes":"Durée en minutes, allure facile"}]},{"day":"Jour 2","focus":"Fractionné","exercises":[{"exercise_key":"interval_run","exercise_name":"Fractionné","equipment_type":"running","kind":"run","sets":"1","reps":"1","target_reps_min":1,"target_reps_max":1,"target_duration_min":24,"target_distance_km":null,"target_intervals":6,"work_seconds":60,"rest_seconds":60,"notes":"6 x 1 min rapide / 1 min récup (Récup 1:1)"}]},{"day":"Jour 3","focus":"Sortie longue","exercises":[{"exercise_key":"long_run","exercise_name":"Sortie longue","equipment_type":"running","kind":"run","sets":"1","reps":"1","target_reps_min":1,"target_reps_max":1,"target_duration_min":60,"target_distance_km":null,"target_intervals":null,"work_seconds":null,"rest_seconds":null,"notes":"Rester en aisance respiratoire"}]}],"meta":{"archetype":"running","days_per_week":3,"location":"outdoor"}}'::jsonb),
  ('running', 'Running Intermediate 4D', 'Progression footing/tempo/fractionné/sortie longue.', 4, 'outdoor', '["running"]'::jsonb, '{"title":"Running Intermediate 4D","split":"running_progression","days":[{"day":"Jour 1","focus":"Footing facile","exercises":[{"exercise_key":"easy_run","exercise_name":"Footing facile","equipment_type":"running","kind":"run","sets":"1","reps":"1","target_reps_min":1,"target_reps_max":1,"target_duration_min":40,"target_distance_km":null,"target_intervals":null,"work_seconds":null,"rest_seconds":null,"notes":"Durée en minutes"}]},{"day":"Jour 2","focus":"Tempo","exercises":[{"exercise_key":"tempo_run","exercise_name":"Tempo","equipment_type":"running","kind":"run","sets":"1","reps":"1","target_reps_min":1,"target_reps_max":1,"target_duration_min":35,"target_distance_km":null,"target_intervals":null,"work_seconds":null,"rest_seconds":null,"notes":"Échauffement 10 min + tempo 10-20 min + retour au calme"}]},{"day":"Jour 3","focus":"Fractionné","exercises":[{"exercise_key":"interval_run","exercise_name":"Fractionné","equipment_type":"running","sets":"1","reps":"25-35","target_reps_min":25,"target_reps_max":35,"notes":"6 x 1 min rapide / 1 min récup"}]},{"day":"Jour 4","focus":"Sortie longue","exercises":[{"exercise_key":"long_run","exercise_name":"Sortie longue","equipment_type":"running","sets":"1","reps":"55-75","target_reps_min":55,"target_reps_max":75,"notes":"Rester en zone facile"}]}],"meta":{"archetype":"running","days_per_week":4,"location":"outdoor"}}'::jsonb)
on conflict (archetype, title, days_per_week, location) do update
set
  description = excluded.description,
  equipment = excluded.equipment,
  template = excluded.template;

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
  set_number integer not null default 1,
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


alter table public.exercise_logs add column if not exists duration_seconds integer;
alter table public.exercise_logs add column if not exists distance_km numeric;
alter table public.exercise_logs add column if not exists pace_sec_per_km integer;
alter table public.exercise_logs add column if not exists speed_kmh numeric;
alter table public.exercise_logs add column if not exists kind text not null default 'strength';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercise_logs_kind_check' and conrelid = 'public.exercise_logs'::regclass
  ) then
    alter table public.exercise_logs
      add constraint exercise_logs_kind_check check (kind in ('strength', 'run'));
  end if;
end;
$$;

create index if not exists exercise_logs_user_kind_created_idx
  on public.exercise_logs (user_id, kind, created_at desc);

create index if not exists exercise_logs_user_exercise_created_desc_idx
  on public.exercise_logs (user_id, exercise_key, created_at desc);

alter table public.exercise_logs add column if not exists exercise_key text;
alter table public.exercise_logs add column if not exists equipment_type text;
alter table public.exercise_logs add column if not exists set_number integer not null default 1;
alter table if exists public.exercise_logs alter column day_index set default 1;

update public.exercise_logs
set day_index = 1
where day_index is null;

update public.exercise_logs
set exercise_name = 'Exercice'
where exercise_name is null or btrim(exercise_name) = '';

alter table public.exercise_logs
  alter column exercise_name set not null;

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


drop trigger if exists set_user_constraints_updated_at on public.user_constraints;
create trigger set_user_constraints_updated_at
  before update on public.user_constraints
  for each row
  execute procedure public.set_updated_at();

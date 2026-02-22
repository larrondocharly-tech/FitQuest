-- user_program_state: plan principal par utilisateur
create table if not exists public.user_program_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_plan_id uuid references public.training_plans(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_program_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_program_state_updated_at on public.user_program_state;
create trigger user_program_state_updated_at
before update on public.user_program_state
for each row
execute function public.set_user_program_state_updated_at();

alter table public.user_program_state enable row level security;

drop policy if exists "user_program_state_select_own" on public.user_program_state;
create policy "user_program_state_select_own"
  on public.user_program_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_program_state_insert_own" on public.user_program_state;
create policy "user_program_state_insert_own"
  on public.user_program_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_program_state_update_own" on public.user_program_state;
create policy "user_program_state_update_own"
  on public.user_program_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- workout_sessions: étendre la table existante pour le flux programme personnalisé
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  week integer not null,
  day_index integer not null,
  session_json jsonb not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.workout_sessions
  add column if not exists week integer,
  add column if not exists day_index integer,
  add column if not exists session_json jsonb,
  add column if not exists status text default 'in_progress',
  add column if not exists completed_at timestamptz;

alter table public.workout_sessions
  alter column status set default 'in_progress';

update public.workout_sessions
set status = 'in_progress'
where status is null;

alter table public.workout_sessions
  alter column status set not null;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_status_check;

alter table public.workout_sessions
  add constraint workout_sessions_status_check check (status in ('in_progress', 'done', 'cancelled'));

alter table public.workout_sessions enable row level security;

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
create policy "workout_sessions_select_own"
  on public.workout_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
create policy "workout_sessions_insert_own"
  on public.workout_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
create policy "workout_sessions_update_own"
  on public.workout_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

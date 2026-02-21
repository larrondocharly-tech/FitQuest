create extension if not exists pgcrypto;

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  goal text not null,
  level text not null,
  weeks int not null,
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_plans enable row level security;

create policy "training_plans_select_own"
  on public.training_plans
  for select
  using (auth.uid() = user_id);

create policy "training_plans_insert_own"
  on public.training_plans
  for insert
  with check (auth.uid() = user_id);

create policy "training_plans_update_own"
  on public.training_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "training_plans_delete_own"
  on public.training_plans
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_training_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists training_plans_updated_at on public.training_plans;

create trigger training_plans_updated_at
before update on public.training_plans
for each row
execute function public.set_training_plans_updated_at();

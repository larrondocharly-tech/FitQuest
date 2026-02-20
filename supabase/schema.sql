create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  hero_name text,
  hero_class text check (hero_class in ('Warrior', 'Mage', 'Rogue')),
  level int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "select own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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

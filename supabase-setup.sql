-- One public price record. Visitors can read it; only the specified Auth user can change it.
create table if not exists public.upgrade_pricing (
  id smallint primary key default 1 check (id = 1),
  costs jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz
);

alter table public.upgrade_pricing enable row level security;

revoke all on table public.upgrade_pricing from anon, authenticated;
grant select on table public.upgrade_pricing to anon, authenticated;
grant insert, update on table public.upgrade_pricing to authenticated;

drop policy if exists "Anyone can read upgrade prices" on public.upgrade_pricing;
create policy "Anyone can read upgrade prices"
  on public.upgrade_pricing
  for select
  to anon, authenticated
  using (id = 1);

drop policy if exists "Configured admin can add upgrade prices" on public.upgrade_pricing;
create policy "Configured admin can add upgrade prices"
  on public.upgrade_pricing
  for insert
  to authenticated
  with check (
    id = 1
    and auth.uid() = '281830a6-a457-494e-ba93-34d7465a2cac'::uuid
  );

drop policy if exists "Configured admin can update upgrade prices" on public.upgrade_pricing;
create policy "Configured admin can update upgrade prices"
  on public.upgrade_pricing
  for update
  to authenticated
  using (
    id = 1
    and auth.uid() = '281830a6-a457-494e-ba93-34d7465a2cac'::uuid
  )
  with check (
    id = 1
    and auth.uid() = '281830a6-a457-494e-ba93-34d7465a2cac'::uuid
  );

insert into public.upgrade_pricing (id, costs, items, updated_at)
values (1, '{}'::jsonb, '[]'::jsonb, null)
on conflict (id) do nothing;

alter table public.vehicles
add column if not exists ownership_status text not null default 'own';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicles_ownership_status_check'
  ) then
    alter table public.vehicles
    add constraint vehicles_ownership_status_check
    check (ownership_status in ('own', 'owned', 'watching'));
  end if;
end $$;

create index if not exists idx_vehicles_ownership_status on public.vehicles(ownership_status);

create extension if not exists "pgcrypto";

create table if not exists public.garages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.garage_memberships (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references public.garages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  unique (garage_id, user_id)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references public.garages(id) on delete cascade,
  slug text not null unique,
  nickname text not null,
  year integer not null,
  make text not null,
  model text not null,
  trim text not null,
  vin text not null,
  powertrain text not null check (powertrain in ('gas', 'diesel', 'hybrid', 'ev')),
  image text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.telemetry_snapshots (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  captured_at timestamptz not null,
  odometer_miles integer not null,
  battery_or_fuel_percent numeric(5, 2) not null,
  latitude numeric(10, 6) not null,
  longitude numeric(10, 6) not null,
  speed_mph numeric(6, 2) not null,
  ignition_on boolean not null,
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.valuation_points (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  captured_at timestamptz not null,
  market_value_usd integer not null,
  change_usd integer not null,
  change_percent numeric(8, 2) not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  external_id text not null unique,
  title text not null,
  status text not null check (status in ('upcoming', 'due', 'overdue', 'scheduled')),
  due_date date not null,
  due_mileage integer,
  estimated_cost_usd integer not null,
  provider_recommendation text not null,
  can_schedule_online boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  external_id text not null unique,
  title text not null,
  body text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  created_at timestamptz not null,
  channel_suggestions text[] not null default '{}'
);

create table if not exists public.part_listings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  external_id text not null unique,
  query text not null,
  title text not null,
  marketplace text not null,
  price_usd numeric(10, 2) not null,
  prime_eligible boolean not null default false,
  fitment_confidence text not null check (fitment_confidence in ('low', 'medium', 'high')),
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_garage_memberships_user_id on public.garage_memberships(user_id);
create index if not exists idx_vehicles_garage_id on public.vehicles(garage_id);
create index if not exists idx_telemetry_snapshots_vehicle_id on public.telemetry_snapshots(vehicle_id, captured_at desc);
create index if not exists idx_valuation_points_vehicle_id on public.valuation_points(vehicle_id, captured_at desc);
create index if not exists idx_maintenance_tasks_vehicle_id on public.maintenance_tasks(vehicle_id);
create index if not exists idx_alerts_vehicle_id on public.alerts(vehicle_id);
create index if not exists idx_part_listings_vehicle_id on public.part_listings(vehicle_id);

alter table public.garages enable row level security;
alter table public.garage_memberships enable row level security;
alter table public.vehicles enable row level security;
alter table public.telemetry_snapshots enable row level security;
alter table public.valuation_points enable row level security;
alter table public.maintenance_tasks enable row level security;
alter table public.alerts enable row level security;
alter table public.part_listings enable row level security;

drop policy if exists "garage members can view garages" on public.garages;
create policy "garage members can view garages"
on public.garages
for select
using (
  exists (
    select 1
    from public.garage_memberships gm
    where gm.garage_id = garages.id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "users can view their memberships" on public.garage_memberships;
create policy "users can view their memberships"
on public.garage_memberships
for select
using (user_id = auth.uid());

drop policy if exists "garage members can view vehicles" on public.vehicles;
create policy "garage members can view vehicles"
on public.vehicles
for select
using (
  exists (
    select 1
    from public.garage_memberships gm
    where gm.garage_id = vehicles.garage_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "garage members can view telemetry" on public.telemetry_snapshots;
create policy "garage members can view telemetry"
on public.telemetry_snapshots
for select
using (
  exists (
    select 1
    from public.vehicles v
    join public.garage_memberships gm on gm.garage_id = v.garage_id
    where v.id = telemetry_snapshots.vehicle_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "garage members can view valuations" on public.valuation_points;
create policy "garage members can view valuations"
on public.valuation_points
for select
using (
  exists (
    select 1
    from public.vehicles v
    join public.garage_memberships gm on gm.garage_id = v.garage_id
    where v.id = valuation_points.vehicle_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "garage members can view maintenance tasks" on public.maintenance_tasks;
create policy "garage members can view maintenance tasks"
on public.maintenance_tasks
for select
using (
  exists (
    select 1
    from public.vehicles v
    join public.garage_memberships gm on gm.garage_id = v.garage_id
    where v.id = maintenance_tasks.vehicle_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "garage members can view alerts" on public.alerts;
create policy "garage members can view alerts"
on public.alerts
for select
using (
  exists (
    select 1
    from public.vehicles v
    join public.garage_memberships gm on gm.garage_id = v.garage_id
    where v.id = alerts.vehicle_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "garage members can view part listings" on public.part_listings;
create policy "garage members can view part listings"
on public.part_listings
for select
using (
  exists (
    select 1
    from public.vehicles v
    join public.garage_memberships gm on gm.garage_id = v.garage_id
    where v.id = part_listings.vehicle_id
      and gm.user_id = auth.uid()
  )
);

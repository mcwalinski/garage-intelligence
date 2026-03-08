create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references public.garages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  external_user_id text,
  access_token text not null,
  refresh_token text,
  scope text[] not null default '{}',
  status text not null default 'active',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_vehicles (
  id uuid primary key default gen_random_uuid(),
  provider_connection_id uuid not null references public.provider_connections(id) on delete cascade,
  smartcar_vehicle_id text not null,
  make text,
  model text,
  year integer,
  external_id text generated always as (provider_connection_id::text || ':' || smartcar_vehicle_id) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_connection_id, smartcar_vehicle_id)
);

create index if not exists idx_provider_connections_garage_id on public.provider_connections(garage_id);
create index if not exists idx_provider_connections_user_id on public.provider_connections(user_id);
create index if not exists idx_provider_connections_provider on public.provider_connections(provider);
create index if not exists idx_provider_vehicles_connection_id on public.provider_vehicles(provider_connection_id);

alter table public.provider_connections enable row level security;
alter table public.provider_vehicles enable row level security;

drop policy if exists "garage members can view provider connections" on public.provider_connections;
create policy "garage members can view provider connections"
on public.provider_connections
for select
using (
  exists (
    select 1
    from public.garage_memberships gm
    where gm.garage_id = provider_connections.garage_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists "garage members can view provider vehicles" on public.provider_vehicles;
create policy "garage members can view provider vehicles"
on public.provider_vehicles
for select
using (
  exists (
    select 1
    from public.provider_connections pc
    join public.garage_memberships gm on gm.garage_id = pc.garage_id
    where pc.id = provider_vehicles.provider_connection_id
      and gm.user_id = auth.uid()
  )
);

alter table public.provider_vehicles
add column if not exists linked_vehicle_id uuid references public.vehicles(id) on delete set null;

create unique index if not exists idx_provider_vehicles_linked_vehicle_id
on public.provider_vehicles(linked_vehicle_id)
where linked_vehicle_id is not null;

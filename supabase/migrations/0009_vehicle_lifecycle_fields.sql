alter table public.vehicles
add column if not exists lifecycle_notes text,
add column if not exists acquisition_date date,
add column if not exists disposition_date date,
add column if not exists purchase_price_usd numeric(12, 2),
add column if not exists sale_price_usd numeric(12, 2);

create index if not exists idx_vehicles_acquisition_date on public.vehicles(acquisition_date);
create index if not exists idx_vehicles_disposition_date on public.vehicles(disposition_date);

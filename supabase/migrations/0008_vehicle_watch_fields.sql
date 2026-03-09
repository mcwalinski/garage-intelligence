alter table public.vehicles
add column if not exists source_url text,
add column if not exists watch_notes text,
add column if not exists target_price_usd integer,
add column if not exists target_mileage integer;

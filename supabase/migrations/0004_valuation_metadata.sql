alter table public.valuation_points
add column if not exists comparable_count integer,
add column if not exists last_seen_at timestamptz;

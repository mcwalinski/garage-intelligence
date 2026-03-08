alter table public.maintenance_tasks
add column if not exists category text,
add column if not exists notes text,
add column if not exists recurrence_miles integer,
add column if not exists recurrence_days integer,
add column if not exists completed_at timestamptz,
add column if not exists completed_mileage integer,
add column if not exists auto_generated boolean not null default false;

create index if not exists idx_maintenance_tasks_vehicle_status on public.maintenance_tasks(vehicle_id, status);

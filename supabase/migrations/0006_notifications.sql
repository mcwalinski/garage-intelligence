create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  delivery_email text,
  phone_number text,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default false,
  maintenance_due_enabled boolean not null default true,
  maintenance_due_soon_enabled boolean not null default true,
  weekly_digest_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'push')),
  status text not null check (status in ('pending', 'sent', 'skipped', 'failed')),
  provider_message_id text,
  error_message text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (alert_id, user_id, channel)
);

create index if not exists idx_notification_preferences_user_id on public.notification_preferences(user_id);
create index if not exists idx_notification_deliveries_user_id on public.notification_deliveries(user_id, created_at desc);
create index if not exists idx_notification_deliveries_alert_id on public.notification_deliveries(alert_id);

alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "users can view notification preferences" on public.notification_preferences;
create policy "users can view notification preferences"
on public.notification_preferences
for select
using (user_id = auth.uid());

drop policy if exists "users can view notification deliveries" on public.notification_deliveries;
create policy "users can view notification deliveries"
on public.notification_deliveries
for select
using (user_id = auth.uid());

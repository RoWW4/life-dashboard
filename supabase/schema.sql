-- Life Dashboard · esquema de Supabase
-- Pégalo entero en Supabase → SQL Editor → New query → Run.

-- 1) Estado completo del panel (un documento JSON por usuario)
create table if not exists public.ldb_state (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.ldb_state enable row level security;
drop policy if exists "ldb_state propio" on public.ldb_state;
create policy "ldb_state propio" on public.ldb_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Movimientos del banco (los escribe el robot diario de GitHub con la service key)
create table if not exists public.bank_tx (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  account      text,
  booking_date date not null,
  amount       numeric(12,2) not null,      -- negativo = gasto
  currency     text default 'EUR',
  description  text,
  created_at   timestamptz not null default now()
);
create index if not exists bank_tx_user_created on public.bank_tx (user_id, created_at);
alter table public.bank_tx enable row level security;
drop policy if exists "bank_tx leer propio" on public.bank_tx;
create policy "bank_tx leer propio" on public.bank_tx
  for select using (auth.uid() = user_id);

-- 3) Estado de la conexión con el banco
create table if not exists public.bank_status (
  user_id     uuid primary key references auth.users on delete cascade,
  aspsp       text,
  session_id  text,
  accounts    jsonb,
  valid_until timestamptz,
  last_sync   timestamptz,
  last_error  text,
  fail_count  int not null default 0         -- fallos seguidos del banco; vuelve a 0 al sincronizar bien
);
alter table public.bank_status add column if not exists fail_count int not null default 0;
alter table public.bank_status enable row level security;
drop policy if exists "bank_status leer propio" on public.bank_status;
create policy "bank_status leer propio" on public.bank_status
  for select using (auth.uid() = user_id);

-- 3b) Movimientos aún sin confirmar (retenciones de tarjeta, bizums): el robot la rehace en cada sincronización
create table if not exists public.bank_pending (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  booking_date date not null,
  amount       numeric(12,2) not null,
  description  text
);
alter table public.bank_pending enable row level security;
drop policy if exists "bank_pending leer propio" on public.bank_pending;
create policy "bank_pending leer propio" on public.bank_pending
  for select using (auth.uid() = user_id);
grant select on public.bank_pending to authenticated;
grant all on public.bank_pending to service_role;

-- 4) Permisos de la Data API (necesarios si desactivaste "Automatically expose new tables"; inofensivos si no)
grant select, insert, update, delete on public.ldb_state to authenticated;
grant select on public.bank_tx, public.bank_status to authenticated;
grant all on public.ldb_state, public.bank_tx, public.bank_status to service_role;

-- Avisos de tareas por Telegram ya mandados (los escribe el robot de GitHub con la service key; sin acceso desde el panel)
create table if not exists public.task_reminders (
  user_id uuid not null references auth.users on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.task_reminders enable row level security;

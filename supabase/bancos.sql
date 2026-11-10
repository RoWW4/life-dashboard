-- Life Dashboard · conexiones con bancos y cuenta de ahorro (10/11/2026)
-- Se puede volver a pegar entero en Supabase → SQL Editor: no borra datos (create if not exists / create or replace).
--
--   bank_connections  una fila por conexión con Enable Banking: openbank (gastos → Finanzas) y trade-republic
--                     (ahorro → Inversiones). Permiso, última sincronización, error y saldo. La escriben los robots.
--   bank_tx, bank_pending  movimientos de Finanzas (columna conn, siempre 'openbank').
--   savings_daily     saldo de la cuenta de ahorro, uno por día.
--   savings_tx        movimientos de la cuenta de ahorro: interes | aporte | retirada | otro. Nunca van a los gastos.
-- Cada usuario solo lee sus filas (RLS); solo escriben los robots, con la service key.

create table if not exists public.bank_connections (
  id           text not null,                       -- openbank, trade-republic (CONNECTIONS en scripts/eb.mjs)
  user_id      uuid not null references auth.users on delete cascade,
  purpose      text not null check (purpose in ('gastos', 'ahorro')),
  aspsp        text,
  country      text not null default 'ES',
  session_id   text,
  accounts     jsonb,
  valid_until  timestamptz,
  last_sync    timestamptz,
  last_error   text,
  fail_count   int not null default 0,
  balance      numeric(12,2),
  balance_type text,
  balance_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.bank_connections enable row level security;
drop policy if exists "bank_connections leer propio" on public.bank_connections;
create policy "bank_connections leer propio" on public.bank_connections for select using (auth.uid() = user_id);
revoke all on public.bank_connections from anon, authenticated;
grant select on public.bank_connections to authenticated;
grant all on public.bank_connections to service_role;

create or replace function public.ldb_touch_updated() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists bank_connections_touch on public.bank_connections;
create trigger bank_connections_touch before update on public.bank_connections for each row execute function public.ldb_touch_updated();

create table if not exists public.savings_daily (
  user_id      uuid not null references auth.users on delete cascade,
  conn         text not null,
  day          date not null,
  balance      numeric(12,2) not null,
  balance_type text,
  updated_at   timestamptz not null default now(),
  primary key (user_id, conn, day)
);
alter table public.savings_daily enable row level security;
drop policy if exists "savings_daily leer propio" on public.savings_daily;
create policy "savings_daily leer propio" on public.savings_daily for select using (auth.uid() = user_id);
revoke all on public.savings_daily from anon, authenticated;
grant select on public.savings_daily to authenticated;
grant all on public.savings_daily to service_role;

create table if not exists public.savings_tx (
  id           text primary key,
  user_id      uuid not null references auth.users on delete cascade,
  conn         text not null,
  booking_date date not null,
  amount       numeric(12,2) not null,
  description  text,
  kind         text not null check (kind in ('interes', 'aporte', 'retirada', 'otro')),
  created_at   timestamptz not null default now()
);
create index if not exists savings_tx_user_conn_date on public.savings_tx (user_id, conn, booking_date);
alter table public.savings_tx enable row level security;
drop policy if exists "savings_tx leer propio" on public.savings_tx;
create policy "savings_tx leer propio" on public.savings_tx for select using (auth.uid() = user_id);
revoke all on public.savings_tx from anon, authenticated;
grant select on public.savings_tx to authenticated;
grant all on public.savings_tx to service_role;

alter table public.bank_tx add column if not exists conn text not null default 'openbank';
alter table public.bank_pending add column if not exists conn text not null default 'openbank';

-- bank_status (la tabla de antes) se guardó como bank_status_old y ahora es una vista de solo lectura de la fila
-- openbank, para las versiones antiguas de la app (10/11/2026). Solo se crea si bank_status no existe ya.
do $$ begin
  if to_regclass('public.bank_status') is null then
    create view public.bank_status with (security_invoker = true) as
      select user_id, aspsp, session_id, accounts, valid_until, last_sync, last_error, fail_count, balance, balance_type, balance_at
      from public.bank_connections where id = 'openbank';
  end if;
end $$;
revoke all on public.bank_status from anon, authenticated;
grant select on public.bank_status to authenticated, service_role;

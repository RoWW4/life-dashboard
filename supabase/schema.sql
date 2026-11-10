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

-- 3) Estado de la conexión con el banco: desde el 10/11/2026 está en bank_connections (una fila por conexión) y
--    bank_status es una vista de solo lectura de la fila openbank para las versiones antiguas de la app.
--    Todo eso está en supabase/bancos.sql (pegarlo después de este archivo).

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
grant select on public.bank_tx to authenticated;
grant all on public.ldb_state, public.bank_tx to service_role;

-- Avisos de tareas por Telegram ya mandados (los escribe el robot de GitHub con la service key; sin acceso desde el panel)
create table if not exists public.task_reminders (
  user_id uuid not null references auth.users on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.task_reminders enable row level security;

-- 5) Registro de cuándo Wallet trae cada movimiento y cuándo lo ve la sincronización (sin importes ni conceptos)
create table if not exists public.wallet_log (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,                 -- 'rec' (movimiento de Wallet) | 'run' (cada sincronización)
  booking_date date,
  wallet_created_at timestamptz,      -- cuándo lo creó Wallet al traerlo del banco
  wallet_change_at timestamptz,       -- último cambio de datos en Wallet (cabecera de la API)
  seen_at timestamptz not null default now()
);
create index if not exists wallet_log_user_kind on public.wallet_log (user_id, kind, seen_at);
alter table public.wallet_log enable row level security;
drop policy if exists "wallet_log leer propio" on public.wallet_log;
create policy "wallet_log leer propio" on public.wallet_log for select using (auth.uid() = user_id);
grant select on public.wallet_log to authenticated;
grant all on public.wallet_log to service_role;

-- 6) Historial del panel: antes de cada cambio de ldb_state se guarda aquí la versión anterior (30 días).
--    Sin acceso desde el panel; se consulta y restaura con SQL (ver DATOS.md).
create table if not exists public.ldb_state_hist (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users on delete cascade,
  data     jsonb not null,
  saved_at timestamptz not null default now()
);
create index if not exists ldb_state_hist_user_saved on public.ldb_state_hist (user_id, saved_at desc);
alter table public.ldb_state_hist enable row level security;
revoke all on public.ldb_state_hist from anon, authenticated;
grant all on public.ldb_state_hist to service_role;

create or replace function public.ldb_state_keep_old() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.data is distinct from new.data then
    insert into public.ldb_state_hist (user_id, data) values (old.user_id, old.data);
    delete from public.ldb_state_hist where user_id = old.user_id and saved_at < now() - interval '30 days';
  end if;
  return new;
end $$;
revoke all on function public.ldb_state_keep_old() from public, anon, authenticated;

drop trigger if exists ldb_state_keep_old on public.ldb_state;
create trigger ldb_state_keep_old before update on public.ldb_state
  for each row execute function public.ldb_state_keep_old();

-- Guardia (01/11/2026): la base de datos rechaza un cambio del panel que vacíe una sección con datos
-- o que pierda más de la mitad de los elementos (tareas, movimientos, facturas, documentos), venga de la app o de SQL.
-- Para hacerlo a propósito se manda "_force": true dentro de data (se quita antes de guardar).
create or replace function public.ldb_len(j jsonb) returns int language sql immutable as
$$ select case when jsonb_typeof(j) = 'array' then jsonb_array_length(j) else 0 end $$;

create or replace function public.ldb_state_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; lost text[] := '{}'; o int; n int;
begin
  if new.data ? '_force' then new.data := new.data - '_force'; return new; end if;
  foreach k in array array['tasks','tx','fixed','docs','rules','periods','localHol'] loop
    if ldb_len(old.data->k) > 0 and ldb_len(new.data->k) = 0 then lost := lost || k; end if;
  end loop;
  if ldb_len(old.data->'sav'->'snaps') > 0 and ldb_len(new.data->'sav'->'snaps') = 0 then lost := lost || 'sav'::text; end if;
  if ldb_len(old.data->'salud'->'ini') > 0 and ldb_len(new.data->'salud'->'ini') = 0 then lost := lost || 'salud'::text; end if;
  o := ldb_len(old.data->'tasks') + ldb_len(old.data->'tx') + ldb_len(old.data->'fixed') + ldb_len(old.data->'docs');
  n := ldb_len(new.data->'tasks') + ldb_len(new.data->'tx') + ldb_len(new.data->'fixed') + ldb_len(new.data->'docs');
  if o >= 10 and n < o / 2 then lost := lost || 'muchos'::text; end if;
  if array_length(lost, 1) > 0 then
    raise exception 'ldb_guard: %', array_to_string(lost, ',') using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.ldb_state_guard() from public, anon, authenticated;
-- Se ejecuta antes que ldb_state_keep_old (los triggers BEFORE van por orden alfabético).
drop trigger if exists ldb_state_guard on public.ldb_state;
create trigger ldb_state_guard before update on public.ldb_state
  for each row execute function public.ldb_state_guard();

-- La fila del panel no se puede borrar (ni desde la app ni por error).
create or replace function public.ldb_state_no_delete() returns trigger
language plpgsql as $$ begin raise exception 'ldb_guard: no se borra el panel'; end $$;
drop trigger if exists ldb_state_no_delete on public.ldb_state;
create trigger ldb_state_no_delete before delete on public.ldb_state
  for each row execute function public.ldb_state_no_delete();

-- Bot de documentos (01/11/2026): añade UN documento al panel de quien llama (auth.uid()), de forma atómica.
-- Lo usa el Google Apps Script de scripts/telegram-documentos.gs. Solo admite enlaces de Google Drive.
create or replace function public.ldb_add_doc(p_name text, p_cat text, p_url text, p_exp text default '')
returns text language plpgsql security invoker set search_path = public as $$
declare v_id text := 'dc-' || substr(md5(random()::text), 1, 8); n int;
begin
  if coalesce(trim(p_name), '') = '' or p_url !~ '^https://drive\.google\.com/' then raise exception 'ldb_add_doc: datos no válidos'; end if;
  if p_cat = 'Identidad' then p_cat := 'Personal'; end if;
  if p_cat not in ('Personal','Coche','Hogar','Salud','Finanzas','Mascotas','Trabajo','Otros') then p_cat := 'Otros'; end if;
  if coalesce(p_exp, '') !~ '^(\d{4}-\d{2}-\d{2})?$' then p_exp := ''; end if;
  update ldb_state set
    data = jsonb_set(jsonb_set(data, '{docs}', coalesce(data->'docs', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'id', v_id, 'name', left(trim(p_name), 120), 'cat', p_cat, 'url', p_url, 'notes', '', 'exp', coalesce(p_exp, ''), 'pin', false))),
           '{_ts}', to_jsonb((extract(epoch from now()) * 1000)::bigint)),
    updated_at = now()
  where user_id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then raise exception 'ldb_add_doc: sin panel'; end if;
  return v_id;
end $$;
revoke all on function public.ldb_add_doc(text, text, text, text) from public, anon;
grant execute on function public.ldb_add_doc(text, text, text, text) to authenticated;

-- Salud: pasos, kcal, sueño y pulso en reposo por día (los escribe el Apps Script scripts/google-health.gs con la cuenta del panel)
create table if not exists public.health_daily (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  day        date not null,
  steps      int,
  kcal       int,
  sleep_min  int,
  rhr        int,
  awake_min  int, light_min int, deep_min int, rem_min int,   -- fases del sueño
  bed_at     timestamptz, wake_at timestamptz,               -- hora de dormirse y de despertar
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.health_daily enable row level security;
drop policy if exists "health_daily propio" on public.health_daily;
create policy "health_daily propio" on public.health_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Estado de la sincronización y dirección de la app web para el botón «Sincronizar ahora»
create table if not exists public.health_status (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  last_sync  timestamptz,
  last_error text,
  sync_url   text
);
alter table public.health_status enable row level security;
drop policy if exists "health_status propio" on public.health_status;
create policy "health_status propio" on public.health_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.health_daily add column if not exists awake_min int, add column if not exists light_min int, add column if not exists deep_min int, add column if not exists rem_min int, add column if not exists bed_at timestamptz, add column if not exists wake_at timestamptz;
grant select, insert, update on public.health_daily, public.health_status to authenticated;
grant all on public.health_daily, public.health_status to service_role;

-- Guardado sin pisar cambios (10/11/2026): la app guarda con ldb_save y solo se acepta si la nube sigue en la versión
-- que leyó el dispositivo (p_base = su _ts). Si otro dispositivo guardó entre medias, devuelve ok=false y la app vuelve a
-- leer, junta los cambios (merge3) y guarda. Los triggers de guardia e historial siguen actuando igual.
create or replace function public.ldb_save(p_data jsonb, p_base numeric)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'ldb_save: sin sesión'; end if;
  update ldb_state set data = p_data, updated_at = now()
   where user_id = auth.uid() and coalesce((data->>'_ts')::numeric, 0) = coalesce(p_base, -1);
  get diagnostics n = row_count;
  if n = 1 then return jsonb_build_object('ok', true); end if;
  if exists (select 1 from ldb_state where user_id = auth.uid()) then return jsonb_build_object('ok', false); end if;
  insert into ldb_state (user_id, data) values (auth.uid(), p_data) on conflict (user_id) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
revoke all on function public.ldb_save(jsonb, numeric) from public, anon;
grant execute on function public.ldb_save(jsonb, numeric) to authenticated;

-- Life Dashboard · registro de errores, latido de los robots y vigilante (10/11/2026)
-- Se puede volver a pegar entero en Supabase → SQL Editor: no borra nada (create if not exists / create or replace).
-- Las tareas programadas que lo usan están en supabase/cron.sql.
--
--   ops_log     registro común de eventos (30 días): hora, nivel, pieza, función, ejecución y detalle sin datos sensibles
--   job_health  latido de cada robot: cuándo empezó, cuándo terminó bien, último error y fallos seguidos
--   ops_alerts  incidentes del vigilante: uno por pieza, un aviso al abrirse y otro al cerrarse (sin repetir)
--   ldb_job()       lo usan los robots de GitHub (service key)
--   ldb_job_user()  lo usan los Google Apps Script (con la cuenta del panel), solo para sus propios robots
--   ldb_watchdog()  el vigilante (pg_cron cada hora). Avisa por Telegram con los secretos de Vault
--                   telegram_bot_token y telegram_chat_id; sin ellos, los incidentes se ven igual en el panel.

-- 1) Registro común
create table if not exists public.ops_log (
  id       bigint generated always as identity primary key,
  ts       timestamptz not null default now(),
  user_id  uuid references auth.users on delete cascade,
  level    text not null check (level in ('INFO','WARNING','ERROR','CRITICAL')),
  source   text not null,          -- pieza: task-reminders, bank-sync, vigilante...
  process  text,                   -- proceso dentro de la pieza
  func     text,                   -- función y, si se sabe, archivo:línea
  run_id   text,                   -- identificador de la ejecución (GitHub run id)
  run_url  text,
  event    text not null,
  detail   text,                   -- ya sin datos sensibles
  stack    text
);
create index if not exists ops_log_ts on public.ops_log (ts desc);
create index if not exists ops_log_source_ts on public.ops_log (source, ts desc);
alter table public.ops_log enable row level security;
drop policy if exists "ops_log leer propio" on public.ops_log;
create policy "ops_log leer propio" on public.ops_log for select using (auth.uid() = user_id);
grant select on public.ops_log to authenticated;
grant all on public.ops_log to service_role;

-- 2) Latido de cada robot
create table if not exists public.job_health (
  job           text primary key,
  user_id       uuid references auth.users on delete cascade,
  last_start    timestamptz,
  last_ok       timestamptz,
  last_error    text,
  last_error_at timestamptz,
  fail_count    int not null default 0,
  run_id        text,
  run_url       text,
  updated_at    timestamptz not null default now()
);
alter table public.job_health enable row level security;
drop policy if exists "job_health leer propio" on public.job_health;
create policy "job_health leer propio" on public.job_health for select using (auth.uid() = user_id);
grant select on public.job_health to authenticated;
grant all on public.job_health to service_role;

-- 3) Incidentes del vigilante
create table if not exists public.ops_alerts (
  key            text primary key,
  user_id        uuid references auth.users on delete cascade,
  title          text not null,
  detail         text,
  open           boolean not null default false,
  opened_at      timestamptz,
  closed_at      timestamptz,
  notified_open  boolean not null default false,
  notified_close boolean not null default true
);
alter table public.ops_alerts enable row level security;
drop policy if exists "ops_alerts leer propio" on public.ops_alerts;
create policy "ops_alerts leer propio" on public.ops_alerts for select using (auth.uid() = user_id);
grant select on public.ops_alerts to authenticated;
grant all on public.ops_alerts to service_role;

-- 0) La dueña del panel es la primera cuenta creada (las altas nuevas están desactivadas). Los robots y el vigilante
--    solo trabajan con ella, aunque algún día existiera otra cuenta.
create or replace function public.ldb_owner() returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users order by created_at limit 1
$$;
revoke all on function public.ldb_owner() from public, anon, authenticated;

-- 4) Latido: start | ok | fail, en una sola llamada (atómica)
create or replace function public.ldb_job(p_job text, p_event text, p_error text default null, p_run_id text default null, p_run_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event not in ('start','ok','fail') then raise exception 'ldb_job: evento no válido %', p_event; end if;
  insert into job_health as j (job, user_id, last_start, last_ok, last_error, last_error_at, fail_count, run_id, run_url, updated_at)
  values (p_job, ldb_owner(),
          case when p_event = 'start' then now() end,
          case when p_event = 'ok' then now() end,
          case when p_event = 'fail' then left(p_error, 1000) end,
          case when p_event = 'fail' then now() end,
          case when p_event = 'fail' then 1 else 0 end,
          p_run_id, p_run_url, now())
  on conflict (job) do update set
    last_start    = case when p_event = 'start' then now() else j.last_start end,
    last_ok       = case when p_event = 'ok' then now() else j.last_ok end,
    last_error    = case p_event when 'fail' then left(p_error, 1000) when 'ok' then null else j.last_error end,
    last_error_at = case when p_event = 'fail' then now() else j.last_error_at end,
    fail_count    = case p_event when 'ok' then 0 when 'fail' then j.fail_count + 1 else j.fail_count end,
    run_id        = coalesce(p_run_id, j.run_id),
    run_url       = coalesce(p_run_url, j.run_url),
    updated_at    = now();
end $$;
revoke all on function public.ldb_job(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ldb_job(text, text, text, text, text) to service_role;

-- 4b) Lo mismo para los Google Apps Script, que entran con la cuenta del panel: solo sus robots, y deja un registro.
create or replace function public.ldb_job_user(p_job text, p_event text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() is distinct from ldb_owner() then raise exception 'ldb_job_user: solo la dueña del panel'; end if;
  if p_job not in ('docs-bot', 'health') then raise exception 'ldb_job_user: robot no válido %', p_job; end if;
  perform ldb_job(p_job, p_event, ldb_redact(p_error));
  if p_event = 'fail' then
    insert into ops_log (user_id, level, source, func, event, detail)
    values (auth.uid(), 'ERROR', p_job, 'Apps Script', 'Error en el robot', left(ldb_redact(p_error), 2000));
  end if;
end $$;
revoke all on function public.ldb_job_user(text, text, text) from public, anon;
grant execute on function public.ldb_job_user(text, text, text) to authenticated;

-- 5) Utilidades del vigilante
create or replace function public.ldb_ago(t timestamptz) returns text language sql stable as $$
  select case when t is null then 'nunca'
              when now() - t < interval '1 hour' then 'menos de 1 h'
              when now() - t < interval '48 hours' then floor(extract(epoch from now() - t) / 3600)::int || ' h'
              else floor(extract(epoch from now() - t) / 86400)::int || ' días' end
$$;
-- Quita identificadores largos (cuentas, sesiones, peticiones), IBAN y tokens de bot de un texto.
create or replace function public.ldb_redact(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''),
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '<id>', 'g'),
    '[A-Z]{2}[0-9]{2}(\s?[0-9A-Z]{4}){4,7}', '<iban>', 'g'),
    'bot[0-9]+:[A-Za-z0-9_-]{20,}', 'bot<token>', 'g')
$$;
revoke all on function public.ldb_ago(timestamptz) from anon;
revoke all on function public.ldb_redact(text) from anon;

-- 6) Vigilante: cada hora mira si los robots funcionan. Abre un incidente (un solo aviso) cuando algo deja de ir bien
--    y lo cierra (otro aviso) cuando se recupera. Los avisos salen directos de Supabase a Telegram: funcionan aunque
--    GitHub esté caído.
create or replace function public.ldb_watchdog() returns void
language plpgsql security definer set search_path = public as $$
declare
  u    uuid := ldb_owner();
  tok  text := (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token');
  chat text := (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_chat_id');
  r record; c record; a record; bad int; msg text;
  checks jsonb := '[]'::jsonb;
begin
  perform ldb_job('vigilante', 'start');

  -- Avisos de Telegram: se ejecutan cada 15 min. También mira si GitHub rechaza las llamadas de pg_cron (token caducado).
  select * into r from job_health where job = 'task-reminders';
  if found then
    select count(*) into bad from net._http_response
     where created > now() - interval '1 hour' and (coalesce(status_code, 0) not in (200, 204) or error_msg is not null);
    checks := checks || jsonb_build_object('key', 'avisos', 'title', 'Los avisos de Telegram',
      'failing', coalesce(r.last_ok, r.last_start) < now() - interval '1 hour' or r.fail_count >= 3,
      'detail', concat_ws(E'\n',
        'Último funcionamiento correcto: hace ' || ldb_ago(r.last_ok) || '.',
        case when r.fail_count > 0 then r.fail_count || ' fallos seguidos.' end,
        case when r.last_error is not null then 'Error: ' || left(ldb_redact(r.last_error), 200) end,
        case when bad > 0 then bad || ' llamadas a GitHub o Telegram con error en la última hora (¿token de GitHub caducado?).' end));
  end if;

  -- Banco: 4 sincronizaciones al día; de noche pasan 10 h entre una y otra.
  select * into r from bank_status where user_id = u;
  if found and r.session_id is not null then
    checks := checks || jsonb_build_object('key', 'banco', 'title', 'La sincronización del banco',
      'failing', r.last_sync is null or r.last_sync < now() - interval '12 hours' or r.fail_count >= 3,
      'detail', concat_ws(E'\n',
        'Última sincronización correcta: hace ' || ldb_ago(r.last_sync) || '.',
        case when r.fail_count > 0 then r.fail_count || ' fallos seguidos.' end,
        case when r.last_error is not null then 'Error: ' || left(ldb_redact(split_part(r.last_error, ' | ', 1)), 200) end));
  end if;

  -- Salud (Google Health): se sincroniza cada hora.
  select * into r from health_status where user_id = u;
  if found then
    checks := checks || jsonb_build_object('key', 'salud', 'title', 'La sincronización de Salud',
      'failing', r.last_sync is null or r.last_sync < now() - interval '3 hours',
      'detail', concat_ws(E'\n', 'Última sincronización: hace ' || ldb_ago(r.last_sync) || '.',
        case when r.last_error is not null then 'Aviso: ' || left(ldb_redact(r.last_error), 200) end));
  end if;

  -- Bot de documentos (Apps Script): da señal de vida cada 30 min. Solo si ya la ha dado alguna vez.
  select * into r from job_health where job = 'docs-bot';
  if found then
    checks := checks || jsonb_build_object('key', 'docs', 'title', 'El bot de documentos de Telegram',
      'failing', coalesce(r.last_ok, r.last_start) < now() - interval '2 hours' or r.fail_count >= 3,
      'detail', concat_ws(E'\n', 'Última señal correcta: hace ' || ldb_ago(r.last_ok) || '.',
        case when r.last_error is not null then 'Error: ' || left(ldb_redact(r.last_error), 200) end));
  end if;

  -- Abrir, actualizar o cerrar incidentes.
  for c in select * from jsonb_to_recordset(checks) as x(key text, title text, failing boolean, detail text) loop
    select * into a from ops_alerts where key = c.key;
    if c.failing then
      if not found or not a.open then
        insert into ops_alerts as o (key, user_id, title, detail, open, opened_at, closed_at, notified_open, notified_close)
        values (c.key, u, c.title, c.detail, true, now(), null, false, true)
        on conflict (key) do update set title = excluded.title, detail = excluded.detail, open = true, opened_at = now(),
          closed_at = null, notified_open = false, notified_close = true;
        insert into ops_log (user_id, level, source, process, func, event, detail)
        values (u, 'ERROR', 'vigilante', c.key, 'ldb_watchdog', 'Incidente abierto: ' || c.title, c.detail);
      else
        update ops_alerts set detail = c.detail where key = c.key;
      end if;
    elsif found and a.open then
      update ops_alerts set open = false, closed_at = now(), notified_close = false, detail = c.detail where key = c.key;
      insert into ops_log (user_id, level, source, process, func, event, detail)
      values (u, 'INFO', 'vigilante', c.key, 'ldb_watchdog', 'Incidente resuelto: ' || c.title, c.detail);
    end if;
  end loop;

  -- Avisos por Telegram pendientes (uno al abrir y otro al cerrar cada incidente).
  for a in select * from ops_alerts where (open and not notified_open) or (not open and not notified_close) loop
    if tok is null or chat is null then
      if not exists (select 1 from ops_log where source = 'vigilante' and event like 'Faltan los secretos%' and ts > now() - interval '1 day') then
        insert into ops_log (user_id, level, source, func, event, detail)
        values (u, 'WARNING', 'vigilante', 'ldb_watchdog', 'Faltan los secretos de Telegram en Vault',
                'Sin telegram_bot_token o telegram_chat_id no se puede avisar. Los incidentes se ven igualmente en el panel.');
      end if;
      exit;
    end if;
    msg := case when a.open
      then '⚠️ Panel: ' || a.title || ' no funciona bien (desde ' || to_char(a.opened_at at time zone 'Europe/Madrid', 'DD/MM HH24:MI') || ').' || E'\n' || coalesce(a.detail, '')
      else '✅ Panel: ' || a.title || ' vuelve a funcionar (fallaba desde ' || to_char(a.opened_at at time zone 'Europe/Madrid', 'DD/MM HH24:MI') || ').' end;
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', chat, 'text', left(msg, 4000), 'disable_web_page_preview', true),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000);
    update ops_alerts set notified_open = notified_open or open, notified_close = notified_close or not open where key = a.key;
    insert into ops_log (user_id, level, source, process, func, event)
    values (u, 'INFO', 'vigilante', a.key, 'ldb_watchdog', case when a.open then 'Aviso de incidente enviado a Telegram' else 'Aviso de recuperación enviado a Telegram' end);
  end loop;

  delete from ops_log where ts < now() - interval '30 days';
  perform ldb_job('vigilante', 'ok');
exception when others then
  -- Si el propio vigilante falla, queda apuntado (y el panel avisa si lleva más de 3 h sin ejecutarse bien).
  perform ldb_job('vigilante', 'fail', sqlerrm);
  insert into ops_log (user_id, level, source, func, event, detail) values (u, 'CRITICAL', 'vigilante', 'ldb_watchdog', 'El vigilante ha fallado', sqlerrm);
end $$;
revoke all on function public.ldb_watchdog() from public, anon, authenticated;

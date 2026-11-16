-- Coche desde Kia Connect (robot kia-km, GitHub Actions con la service key): km, estado y viajes.
-- Añade una lectura {id, d, km, src:'kia'} a data.car.km solo si los km han subido respecto a la lectura más alta
-- apuntada (a mano, de Kia o de una visita al taller). Si ya había una lectura de Kia de hoy, la sustituye.
-- No toca nada más del panel. Devuelve: ok | same | no_car | no_row | invalid.
create or replace function public.ldb_car_km(p_km int)
returns text language plpgsql security definer set search_path = public as $$
declare
  u uuid := ldb_owner();
  d jsonb;
  cur numeric;
  today text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
begin
  if p_km is null or p_km <= 0 or p_km > 2000000 then return 'invalid'; end if;
  select data into d from ldb_state where user_id = u for update;
  if d is null then return 'no_row'; end if;
  if jsonb_typeof(d->'car') is distinct from 'object' then return 'no_car'; end if;
  select max((e->>'km')::numeric) into cur
    from (select jsonb_array_elements(case when jsonb_typeof(d->'car'->'km') = 'array' then d->'car'->'km' else '[]' end) e
          union all
          select jsonb_array_elements(case when jsonb_typeof(d->'car'->'vis') = 'array' then d->'car'->'vis' else '[]' end)) x
   where (e->>'km') ~ '^\d+(\.\d+)?$';
  if cur is not null and p_km <= cur then return 'same'; end if;
  update ldb_state set
    data = jsonb_set(jsonb_set(data, '{car,km}',
             coalesce((select jsonb_agg(e) from jsonb_array_elements(
                         case when jsonb_typeof(data->'car'->'km') = 'array' then data->'car'->'km' else '[]' end) e
                       where not (e->>'src' = 'kia' and e->>'d' = today)), '[]'::jsonb)
             || jsonb_build_object('id', 'kia-' || today, 'd', today, 'km', p_km, 'src', 'kia')),
           '{_ts}', to_jsonb((extract(epoch from now()) * 1000)::bigint)),
    updated_at = now()
  where user_id = u;
  return 'ok';
end $$;
revoke all on function public.ldb_car_km(int) from public, anon, authenticated;
grant execute on function public.ldb_car_km(int) to service_role;

-- Estado del coche y viajes desde Kia Connect (mismo robot, cada 3 h). Guarda car.live tal cual (lo último que mandó el
-- coche) y junta car.trips.days (km y minutos de cada día, se guardan 400 días) y car.trips.months (por meses).
-- No toca nada más del panel. Devuelve: ok | no_car | no_row.
create or replace function public.ldb_car_live(p_live jsonb, p_days jsonb, p_months jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  u uuid := ldb_owner();
  d jsonb;
  t jsonb;
  days jsonb;
  lim text := to_char((now() at time zone 'Europe/Madrid') - interval '400 days', 'YYYY-MM-DD');
begin
  select data into d from ldb_state where user_id = u for update;
  if d is null then return 'no_row'; end if;
  if jsonb_typeof(d->'car') is distinct from 'object' then return 'no_car'; end if;
  t := case when jsonb_typeof(d->'car'->'trips') = 'object' then d->'car'->'trips' else '{}'::jsonb end;
  days := coalesce(case when jsonb_typeof(t->'days') = 'object' then t->'days' end, '{}'::jsonb) || coalesce(p_days, '{}'::jsonb);
  days := coalesce((select jsonb_object_agg(k, v) from jsonb_each(days) e(k, v) where k >= lim), '{}'::jsonb);
  t := jsonb_build_object('days', days, 'months',
         coalesce(case when jsonb_typeof(t->'months') = 'object' then t->'months' end, '{}'::jsonb) || coalesce(p_months, '{}'::jsonb));
  update ldb_state set
    data = jsonb_set(jsonb_set(jsonb_set(data, '{car,live}', coalesce(p_live, 'null'::jsonb)), '{car,trips}', t),
           '{_ts}', to_jsonb((extract(epoch from now()) * 1000)::bigint)),
    updated_at = now()
  where user_id = u;
  return 'ok';
end $$;
revoke all on function public.ldb_car_live(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ldb_car_live(jsonb, jsonb, jsonb) to service_role;

-- «Actualizar» del coche desde la app (16/11/2026): lanza el workflow kia-km por la API de GitHub, con el mismo token
-- de Vault que pg_cron. Solo la dueña del panel, y como mucho una vez cada 5 minutos (si no, devuelve la hora de la
-- última vez, para que la app espere a esa). Devuelve {st: 'lanzado'|'reciente'|'sin-token', at}.
create table if not exists public.ldb_car_refresh_at (id int primary key default 1 check (id = 1), at timestamptz not null);
alter table public.ldb_car_refresh_at enable row level security;
revoke all on public.ldb_car_refresh_at from public, anon, authenticated;

create or replace function public.ldb_car_refresh() returns jsonb
language plpgsql security definer set search_path = public as $$
declare t timestamptz;
begin
  if auth.uid() is null or auth.uid() is distinct from ldb_owner() then raise exception 'ldb_car_refresh: solo la dueña del panel'; end if;
  select at into t from ldb_car_refresh_at where id = 1;
  if t is not null and t > now() - interval '5 minutes' then return jsonb_build_object('st', 'reciente', 'at', t); end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'github_dispatch_token') then
    return jsonb_build_object('st', 'sin-token');
  end if;
  insert into ldb_car_refresh_at (id, at) values (1, now()) on conflict (id) do update set at = excluded.at;
  perform net.http_post(
    url := 'https://api.github.com/repos/RoWW4/life-dashboard/actions/workflows/kia-km.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'panel-rocio-supabase-cron',
      'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  return jsonb_build_object('st', 'lanzado', 'at', now());
end $$;
revoke all on function public.ldb_car_refresh() from public, anon;
grant execute on function public.ldb_car_refresh() to authenticated;

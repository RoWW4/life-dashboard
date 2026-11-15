-- Km del coche desde Kia Connect (robot kia-km, GitHub Actions con la service key).
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

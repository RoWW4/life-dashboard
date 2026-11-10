-- Life Dashboard · tareas programadas de Supabase (pg_cron), tal como están creadas.
-- Copia de referencia para revisarlas o volver a crearlas: cron.schedule con un nombre que ya existe la actualiza.
-- El token de GitHub no está aquí: se lee de Vault (secreto github_dispatch_token). Ver LEEME.md.
-- Para ver cómo han ido: select * from cron.job_run_details order by start_time desc limit 20;

-- Avisos de Telegram: lanza el workflow «Avisos de tareas (Telegram)» cada 15 minutos.
select cron.schedule('task-reminders', '7,22,37,52 * * * *', $$
  select net.http_post(
    url := 'https://api.github.com/repos/RoWW4/life-dashboard/actions/workflows/task-reminders.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'panel-rocio-supabase-cron',
      'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'github_dispatch_token');
$$);

-- Banco (Enable Banking): lanza «Sincronizar banco» 4 veces al día (≈ 06:43, 11:43, 15:43 y 20:43 en invierno).
-- Desde el 10/11/2026; antes lo lanzaba el «schedule» de GitHub, que se retrasaba horas.
select cron.schedule('bank-sync', '43 5,10,14,19 * * *', $$
  select net.http_post(
    url := 'https://api.github.com/repos/RoWW4/life-dashboard/actions/workflows/bank-sync.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'panel-rocio-supabase-cron',
      'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'github_dispatch_token');
$$);

-- Wallet: desactivada desde el 04/11/2026 (el banco entra por Enable Banking). Reactivar: select cron.alter_job(1, active := true);
select cron.schedule('sync-wallet', '17 5,9,13,17,21 * * *', $$
  select net.http_post(
    url := 'https://api.github.com/repos/RoWW4/life-dashboard/actions/workflows/wallet-sync.yml/dispatches',
    body := '{"ref":"main","inputs":{"auto":"true"}}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'panel-rocio-supabase-cron',
      'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'github_dispatch_token');
$$);
select cron.alter_job((select jobid from cron.job where jobname = 'sync-wallet'), active := false);

-- Vigilante de errores (supabase/observabilidad.sql): cada hora, al minuto 41. Autorizado el 09/11/2026.
select cron.schedule('vigilante', '41 * * * *', 'select public.ldb_watchdog();');

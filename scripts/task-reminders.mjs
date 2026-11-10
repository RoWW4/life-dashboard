// Avisos de las tareas por Telegram (hora de España):
//  · aviso a la fecha y hora elegidas en la tarea (t.rem) o, si no tiene, 1 día antes (24 h antes de la hora de la tarea;
//    si no tiene hora, como si fuera a las 9:00);
//  · resumen a las 7:00 con las tareas de hoy, las atrasadas y los cumpleaños (si no hay nada, no se manda);
//  · Salud (3 días antes) y documentos que caducan (ver apartados 3 y 4).
// La lanza Supabase cada 15 minutos (pg_cron, tarea «task-reminders»). Lo ya avisado se apunta en la tabla
// task_reminders para no repetirlo.
import { env, sb, uid, summary } from './eb.mjs';
import { log, job, guard } from './log.mjs';
import { telegram } from './telegram.mjs';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Previsión de Salud: el mismo archivo que usa la app (js/salud-calculo.js), para que los avisos coincidan con lo que se ve.
const SAL = vm.runInNewContext(readFileSync(new URL('../js/salud-calculo.js', import.meta.url), 'utf8') + '\n;({ salPrevision });');

// Registro y latido (ver scripts/log.mjs): cualquier error que corte la ejecución queda apuntado en ops_log y job_health.
guard('task-reminders');
await job('task-reminders', 'start');

const TZ = 'Europe/Madrid', HOUR = 7, DEF_TM = '09:00', DAY = 864e5;
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const p2 = n => String(n).padStart(2, '0');
const fd = s => s.split('-').reverse().join('/').slice(0, 5);

// Fecha y hora de España como si fueran UTC: basta para restar horas entre «ahora» y la tarea.
const P = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(new Date()).map(p => [p.type, p.value]));
const today = `${P.year}-${P.month}-${P.day}`, nowL = Date.UTC(+P.year, P.month - 1, +P.day, +P.hour, +P.minute);
const at = (d, tm) => { const [y, m, dd] = d.split('-'), [h, mi] = tm.split(':'); return Date.UTC(+y, m - 1, +dd, +h, +mi); };
const iso = t => new Date(t).toISOString().slice(0, 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const row = (await sb(`ldb_state?user_id=eq.${uid()}&select=data`))[0];
const tasks = ((row && row.data && row.data.tasks) || []).filter(t => !t.done && t.due && t.title);
const sent = new Set((await sb(`task_reminders?user_id=eq.${uid()}&select=key`)).map(r => r.key));
const out = [];
const mark = key => sb('task_reminders', { method: 'POST', body: { user_id: uid(), key }, prefer: 'resolution=ignore-duplicates,return=minimal' });
const fails = [], msgIds = [];

/* Manda un aviso y lo apunta como enviado. Si un aviso falla, se registra el motivo y se sigue con los demás:
   como no queda apuntado, se vuelve a intentar en la siguiente pasada. El apunte se reintenta para no repetir avisos. */
async function send(key, text, kind) {
  let ids;
  try { ids = await telegram(text); }
  catch (e) { fails.push(e.message); await log('ERROR', 'task-reminders', `No se pudo mandar un aviso (${kind})`, { process: kind, func: 'telegram', err: e }); return false; }
  for (let i = 1; ; i++) {
    try { await mark(key); break; }
    catch (e) {
      if (i < 3) { await sleep(2000); continue; }
      await log('CRITICAL', 'task-reminders', 'Aviso mandado pero sin apuntar: puede repetirse', { process: kind, func: 'mark', err: e, detail: 'message_id ' + ids.join(',') });
      break;
    }
  }
  out.push(kind); msgIds.push(...ids);
  return true;
}
/* Un aviso cuya hora ya pasó sin que se mandara (por ejemplo, si GitHub no ejecutó los robots): se registra una vez. */
async function lost(key, kind, why) {
  if (sent.has('lost:' + key)) return;
  await log('WARNING', 'task-reminders', `Aviso no enviado a tiempo (${kind})`, { process: kind, func: 'lost', detail: why });
  await mark('lost:' + key).catch(e => log('ERROR', 'task-reminders', 'No se pudo apuntar un aviso perdido', { func: 'lost', err: e }));
}

// 0) Aviso elegido en la tarea (t.rem = 'AAAA-MM-DDTHH:MM', hora de España): se manda en cuanto llega la hora
//    (si la ejecución se retrasa, hasta 6 h después). Sustituye al aviso de 1 día antes.
const REM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
for (const t of ((row && row.data && row.data.tasks) || []).filter(t => !t.done && t.title && REM.test(t.rem || ''))) {
  const w = at(t.rem.slice(0, 10), t.rem.slice(11, 16)), key = `tr:${t.id}:${t.rem}`;
  if (w > nowL || sent.has(key)) continue;
  if (nowL - w > 6 * 36e5) { if (nowL - w < 7 * DAY) await lost(key, 'Aviso elegido', 'pasaron más de 6 h desde la hora elegida'); continue; }
  const hm = /^\d{1,2}:\d{2}$/.test(t.tm || '') ? t.tm : '', due = /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : '';
  const cuando = !due ? '' : (due === today ? 'hoy' : due === iso(nowL + DAY) ? 'mañana' : `el ${DOW[new Date(at(due, '12:00')).getUTCDay()]} ${fd(due)}`) + (hm ? ' a las ' + hm : '');
  await send(key, `🔔 ${t.title}${cuando ? ' · ' + cuando : ''}`, 'Aviso elegido');
}

// 1) Aviso 24 h antes (o en cuanto se crea, si ya falta menos). Las tareas sin hora cuentan como a las 9:00.
for (const t of tasks.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.due) && !REM.test(t.rem || ''))) {
  const hm = /^\d{1,2}:\d{2}$/.test(t.tm || '') ? t.tm : '', tm = hm || DEF_TM;
  const w = at(t.due, tm), key = `tk:${t.id}:${t.due}T${tm}`;
  if (w <= nowL || w - nowL > DAY || sent.has(key)) continue;
  const cuando = t.due === today ? 'Hoy' : t.due === iso(nowL + DAY) ? 'Mañana' : `El ${DOW[new Date(w).getUTCDay()]} ${fd(t.due)}`;
  await send(key, `${t.area === 'Cumpleaños' ? '🎂' : '⏰'} ${cuando}${hm ? ' a las ' + hm : ''}: ${t.title}`, 'Aviso de tarea');
}

// 2) Resumen de la mañana (desde las 7:00 hasta mediodía, una vez al día).
const sk = 'sum:' + today;
if (+P.hour >= HOUR && +P.hour < 12 && !sent.has(sk)) {
  const byTm = (a, b) => (a.tm || '').localeCompare(b.tm || '');
  const hoy = tasks.filter(t => t.due === today).sort(byTm), atr = tasks.filter(t => t.due < today).sort((a, b) => a.due.localeCompare(b.due));
  const li = t => `• ${t.area === 'Cumpleaños' ? '🎂 ' : ''}${t.tm ? t.tm + ' ' : ''}${t.title}`;
  const L = [];
  if (hoy.length) L.push(`☀️ Hoy, ${DOW[new Date(nowL).getUTCDay()]} ${fd(today)}:`, ...hoy.map(li));
  if (atr.length) L.push(...(L.length ? [''] : []), '⚠️ Atrasadas:', ...atr.map(t => `${li(t)} (desde ${fd(t.due)})`));
  if (L.length) await send(sk, L.join('\n'), 'Resumen');
  else await mark(sk).catch(e => log('ERROR', 'task-reminders', 'No se pudo apuntar el resumen', { func: 'mark', err: e }));
} else if (+P.hour >= 12 && !sent.has(sk)) await lost(sk, 'Resumen', 'no hubo ninguna pasada correcta entre las 7:00 y las 12:00');

// 3) Sección Salud: aviso 3 días antes del próximo inicio previsto (desde las 9:00). El cálculo es el mismo archivo que usa la app.
const sal = row && row.data && row.data.salud;
if (sal && Array.isArray(sal.ini) && sal.ini.length && +P.hour >= 9) {
  const { avg, next } = SAL.salPrevision(sal.ini, sal.len), dd = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
  const left = dd(next, today), key = 'sal:' + next;
  if (left >= 0 && left <= 3 && !sent.has(key)) {
    await send(key, `🩺 Salud: el próximo inicio previsto es el ${DOW[new Date(next).getUTCDay()]} ${fd(next)} (${left === 0 ? 'hoy' : left === 1 ? 'mañana' : 'en ' + left + ' días'}).`, 'Aviso de seguimiento');
  }
}

// 4) Documentos con fecha «Vence»: aviso 30 días antes (60 los de Personal, p. ej. el DNI, que suelen pedir cita), 7 días antes,
//    el mismo día y, si sigue caducado, una vez por semana durante un mes (desde las 9:00). Una sola vez por aviso.
const docs = ((row && row.data && row.data.docs) || []).filter(d => d.exp && /^\d{4}-\d{2}-\d{2}$/.test(d.exp) && d.name);
if (+P.hour >= 9) for (const d of docs) {
  const left = Math.round((Date.parse(d.exp) - Date.parse(today)) / DAY);
  if (left < -34) continue;
  const st = [(d.cat === 'Personal' || d.cat === 'Identidad') ? 60 : 30, 7, 0, -7, -14, -21, -28].filter(t => left <= t).pop();
  if (st === undefined) continue;
  const key = `doc:${d.id || d.name}:${d.exp}:${st}`;
  if (sent.has(key)) continue;
  const fecha = `${DOW[new Date(d.exp).getUTCDay()]} ${d.exp.split('-').reverse().join('/')}`;
  await send(key, left > 0 ? `📄 «${d.name}» caduca el ${fecha} (en ${left} día${left === 1 ? '' : 's'}).`
    : left === 0 ? `📄 «${d.name}» caduca hoy.`
    : `📄 «${d.name}» caducó el ${fecha} (hace ${-left} días). Cuando lo renueves, cambia la fecha en el panel.`, 'Aviso de documento');
}

// Limpieza: lo avisado hace más de 60 días ya no hace falta.
await sb(`task_reminders?user_id=eq.${uid()}&sent_at=lt.${new Date(Date.now() - 60 * DAY).toISOString()}`, { method: 'DELETE' });
// El registro de GitHub es público: solo qué tipo de aviso y cuántos, nunca títulos ni nombres.
const cnt = out.reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {});
await log(fails.length ? 'ERROR' : 'INFO', 'task-reminders', fails.length ? `Pasada con ${fails.length} aviso(s) sin mandar` : out.length ? `Avisos enviados: ${out.length}` : 'Nada que avisar',
  { func: 'main', detail: [Object.entries(cnt).map(([s, n]) => `${s}: ${n}`).join(', '), msgIds.length ? 'message_id ' + msgIds.join(',') : ''].filter(Boolean).join(' · ') });
// Si algún aviso falla, el latido queda en «fallo» con el motivo (el vigilante avisa si se repite), pero la ejecución
// acaba bien: así GitHub no manda un correo cada 15 minutos.
await job('task-reminders', fails.length ? 'fail' : 'ok', fails.length ? fails.join(' | ') : undefined);
summary((out.length ? Object.entries(cnt).map(([s, n]) => `- ${s}: ${n}`).join('\n') : 'Nada que avisar.') + (fails.length ? `\n\n⚠️ ${fails.length} aviso(s) sin mandar: se reintentan en la siguiente pasada.` : ''));

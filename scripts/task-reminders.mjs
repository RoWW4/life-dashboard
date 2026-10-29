// Avisos de las tareas por Telegram (hora de España):
//  · aviso 1 día antes (24 h antes de la hora de la tarea; si no tiene hora, como si fuera a las 9:00);
//  · resumen a las 7:00 con las tareas de hoy, las atrasadas y los cumpleaños (si no hay nada, no se manda);
//  · Salud (3 días antes) y documentos que caducan (ver apartados 3 y 4).
// La lanza Supabase cada 15 minutos (pg_cron, tarea «task-reminders»). Lo ya avisado se apunta en la tabla
// task_reminders para no repetirlo.
import { env, sb, uid, summary } from './eb.mjs';

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

async function telegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_TOKEN')}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env('TELEGRAM_CHAT_ID'), text, disable_web_page_preview: true })
  });
  if (!r.ok) throw new Error(`Telegram → ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

const row = (await sb(`ldb_state?user_id=eq.${uid()}&select=data`))[0];
const tasks = ((row && row.data && row.data.tasks) || []).filter(t => !t.done && t.due && t.title);
const sent = new Set((await sb(`task_reminders?user_id=eq.${uid()}&select=key`)).map(r => r.key));
const out = [];
const mark = key => sb('task_reminders', { method: 'POST', body: { user_id: uid(), key }, prefer: 'resolution=ignore-duplicates,return=minimal' });

// 1) Aviso 24 h antes (o en cuanto se crea, si ya falta menos). Las tareas sin hora cuentan como a las 9:00.
for (const t of tasks.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.due))) {
  const hm = /^\d{1,2}:\d{2}$/.test(t.tm || '') ? t.tm : '', tm = hm || DEF_TM;
  const w = at(t.due, tm), key = `tk:${t.id}:${t.due}T${tm}`;
  if (w <= nowL || w - nowL > DAY || sent.has(key)) continue;
  const cuando = t.due === today ? 'Hoy' : t.due === iso(nowL + DAY) ? 'Mañana' : `El ${DOW[new Date(w).getUTCDay()]} ${fd(t.due)}`;
  await telegram(`${t.area === 'Cumpleaños' ? '🎂' : '⏰'} ${cuando}${hm ? ' a las ' + hm : ''}: ${t.title}`);
  await mark(key); out.push('Aviso de tarea');
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
  if (L.length) { await telegram(L.join('\n')); out.push(`Resumen: ${hoy.length} hoy, ${atr.length} atrasadas`); }
  await mark(sk);
}

// 3) Sección Salud: aviso 3 días antes del próximo inicio previsto (desde las 9:00). Mismo cálculo que js/vistas/salud.js.
const sal = row && row.data && row.data.salud;
if (sal && Array.isArray(sal.ini) && sal.ini.length && +P.hour >= 9) {
  const L = [...new Set(sal.ini)].sort(), dd = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);
  const gaps = L.slice(1).map((d, i) => dd(d, L[i])).filter(g => g >= 15 && g <= 60).slice(-6);
  const avg = gaps.length ? Math.round(gaps.reduce((a, g) => a + g, 0) / gaps.length) : (sal.len || 28);
  const next = iso(Date.parse(L[L.length - 1]) + avg * DAY), left = dd(next, today), key = 'sal:' + next;
  if (left >= 0 && left <= 3 && !sent.has(key)) {
    await telegram(`🩺 Salud: el próximo inicio previsto es el ${DOW[new Date(next).getUTCDay()]} ${fd(next)} (${left === 0 ? 'hoy' : left === 1 ? 'mañana' : 'en ' + left + ' días'}).`);
    await mark(key); out.push('Aviso de seguimiento');
  }
}

// 4) Documentos con fecha «Vence»: aviso 30 días antes (60 los de Identidad, que suelen pedir cita), 7 días antes,
//    el mismo día y, si sigue caducado, una vez por semana durante un mes (desde las 9:00). Una sola vez por aviso.
const docs = ((row && row.data && row.data.docs) || []).filter(d => d.exp && /^\d{4}-\d{2}-\d{2}$/.test(d.exp) && d.name);
if (+P.hour >= 9) for (const d of docs) {
  const left = Math.round((Date.parse(d.exp) - Date.parse(today)) / DAY);
  if (left < -34) continue;
  const st = [d.cat === 'Identidad' ? 60 : 30, 7, 0, -7, -14, -21, -28].filter(t => left <= t).pop();
  if (st === undefined) continue;
  const key = `doc:${d.id || d.name}:${d.exp}:${st}`;
  if (sent.has(key)) continue;
  const fecha = `${DOW[new Date(d.exp).getUTCDay()]} ${d.exp.split('-').reverse().join('/')}`;
  await telegram(left > 0 ? `📄 «${d.name}» caduca el ${fecha} (en ${left} día${left === 1 ? '' : 's'}).`
    : left === 0 ? `📄 «${d.name}» caduca hoy.`
    : `📄 «${d.name}» caducó el ${fecha} (hace ${-left} días). Cuando lo renueves, cambia la fecha en el panel.`);
  await mark(key); out.push('Aviso de documento');
}

// Limpieza: lo avisado hace más de 60 días ya no hace falta.
await sb(`task_reminders?user_id=eq.${uid()}&sent_at=lt.${new Date(Date.now() - 60 * DAY).toISOString()}`, { method: 'DELETE' });
// El registro de GitHub es público: solo qué tipo de aviso y cuántos, nunca títulos ni nombres.
const cnt = out.reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {});
summary(out.length ? Object.entries(cnt).map(([s, n]) => `- ${s}: ${n}`).join('\n') : 'Nada que avisar.');

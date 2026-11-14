// Pruebas del robot de avisos (scripts/task-reminders.mjs) sin conexión: Supabase y Telegram se simulan con un
// servidor local. Datos de prueba inventados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

/* Hora de España dentro de m minutos, en el formato de t.rem ('AAAA-MM-DDTHH:MM'). */
const madrid = m => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(Date.now() + m * 6e4)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

/* Lanza el robot contra un Supabase y un Telegram simulados. tg(texto, intento) decide la respuesta de Telegram. */
async function run(tasks, tg, extra = {}) {
  const calls = [], tries = {};
  const srv = createServer((q, r) => {
    let b = ''; q.on('data', c => b += c); q.on('end', () => {
      const body = b ? JSON.parse(b) : null; calls.push({ m: q.method, u: q.url, body });
      const json = (code, v) => { r.writeHead(code, { 'content-type': 'application/json' }); r.end(v === undefined ? '' : JSON.stringify(v)); };
      if (q.url.startsWith('/botTEST/sendMessage')) {
        const n = tries[body.text] = (tries[body.text] || 0) + 1, [code, v] = tg(body.text, n);
        return json(code, v);
      }
      if (q.method === 'GET' && q.url.startsWith('/rest/v1/ldb_state')) return json(200, [{ data: { tasks, ...extra } }]);
      if (q.method === 'GET' && q.url.startsWith('/rest/v1/task_reminders')) return json(200, []);
      json(q.method === 'POST' ? 201 : 204);
    });
  });
  await new Promise(r => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}`;
  const code = await new Promise(res => spawn(process.execPath, ['scripts/task-reminders.mjs'], { env: { ...process.env,
    SUPABASE_URL: url, SUPABASE_SERVICE_KEY: 'clave-de-prueba', LDB_USER_ID: '00000000-0000-0000-0000-000000000000', TELEGRAM_TOKEN: 'TEST',
    TELEGRAM_CHAT_ID: '1', TELEGRAM_API: url, GITHUB_RUN_ID: '7', GITHUB_STEP_SUMMARY: '' } }).on('exit', res));
  srv.close();
  return { code, calls };
}
// Sin tareas con fecha, el resumen de la mañana solo se apunta (o se registra como no enviado, según la hora): no cuenta aquí.
const marks = calls => calls.filter(c => c.m === 'POST' && c.u.startsWith('/rest/v1/task_reminders')).map(c => c.body.key).filter(k => !/^(lost:)?sum:/.test(k));
const jobs = calls => calls.filter(c => c.u === '/rest/v1/rpc/ldb_job').map(c => c.body);
const logs = calls => calls.filter(c => c.u.startsWith('/rest/v1/ops_log')).map(c => c.body);

test('si un aviso falla, los demás se mandan igual y el fallo queda registrado', async () => {
  const rem = madrid(-30);
  const { code, calls } = await run([{ id: 'a', title: 'Tarea A', rem }, { id: 'b', title: 'Tarea B', rem }],
    text => text.includes('Tarea A') ? [400, { ok: false, description: 'Bad Request: chat not found' }] : [200, { ok: true, result: { message_id: 55 } }]);
  assert.equal(code, 0, 'la ejecución acaba bien (sin correo de GitHub cada 15 min)');
  assert.deepEqual(marks(calls), [`tr:b:${rem}`], 'solo se apunta el aviso que sí se mandó');
  const err = logs(calls).find(l => l.level === 'ERROR' && /No se pudo mandar/.test(l.event));
  assert.ok(err, 'queda un ERROR con el motivo');
  assert.match(err.detail, /chat not found/);
  assert.ok(!JSON.stringify(logs(calls)).includes('Tarea'), 'los títulos de las tareas no van al registro');
  const j = jobs(calls);
  assert.deepEqual(j.map(x => x.p_event), ['start', 'fail']);
  assert.match(j[1].p_error, /chat not found/);
  assert.equal(j[1].p_run_id, '7');
});

test('si Telegram pide esperar (429), se reintenta y el aviso llega', async () => {
  const rem = madrid(-10);
  const { code, calls } = await run([{ id: 'c', title: 'Tarea C', rem }],
    (text, n) => n === 1 ? [429, { ok: false, description: 'Too Many Requests', parameters: { retry_after: 1 } }] : [200, { ok: true, result: { message_id: 9 } }]);
  assert.equal(code, 0);
  assert.deepEqual(marks(calls), [`tr:c:${rem}`]);
  assert.deepEqual(jobs(calls).map(x => x.p_event), ['start', 'ok']);
  assert.match(logs(calls).at(-1).detail, /message_id 9/);
});

test('un aviso que se pasó de hora sin mandarse queda registrado una vez y no se manda', async () => {
  const rem = madrid(-8 * 60);
  const { calls } = await run([{ id: 'd', title: 'Tarea D', rem }], () => [200, { ok: true, result: { message_id: 1 } }]);
  assert.ok(!calls.some(c => c.u.startsWith('/botTEST/')), 'no se manda tarde');
  assert.deepEqual(marks(calls), [`lost:tr:d:${rem}`]);
  assert.ok(logs(calls).some(l => l.level === 'WARNING' && /no enviado a tiempo \(Aviso elegido\)/.test(l.event)));
});

test('coche: avisa 7 días antes de una fecha de «Lo próximo» y no si falta más de un mes', async () => {
  const d = n => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
  const car = { mt: [{ id: 'itv', n: 'Prueba ITV', nd: d(5) }, { id: 'rev', n: 'Prueba revisión', m: 12, ld: d(-300) }] };
  const { code, calls } = await run([], () => [200, { ok: true, result: { message_id: 9 } }], { car });
  assert.equal(code, 0);
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
  const k = marks(calls).filter(x => x.startsWith('car:'));
  if (h >= 9) assert.deepEqual(k, [`car:itv:${d(5)}:7`], 'solo la fecha que está a menos de 7 días');
  else assert.deepEqual(k, [], 'antes de las 9:00 no avisa');
  const msg = calls.find(c => c.u.startsWith('/botTEST/sendMessage') && /Coche/.test(c.body.text));
  if (h >= 9) assert.match(msg.body.text, /Prueba ITV/);
});

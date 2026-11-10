// Conecta (o renueva) el permiso con un banco. Dos pasos:
//   1) Sin código  → genera el enlace para autorizar en el banco de la conexión elegida.
//   2) Con código  → crea la sesión y la guarda en Supabase (bank_connections, fila de esa conexión).
// Conexiones: las de CONNECTIONS en eb.mjs (openbank, trade-republic). «lista» solo consulta qué bancos hay.
import crypto from 'node:crypto';
import { eb, env, setStatus, summary, CONNECTIONS } from './eb.mjs';
import { log, guard, redact } from './log.mjs';

guard('bank-link');

const code = (process.env.EB_CODE || '').trim();
const id = (process.env.EB_CONN || 'openbank').trim().toLowerCase();
const isList = /^(lista|\?)$/.test(id);
if (!isList && !CONNECTIONS[id]) {
  summary(`## ❌ Conexión desconocida «${id}»\n\nEscribe una de estas: ${Object.keys(CONNECTIONS).join(', ')} (o «lista»).`);
  process.exit(1);
}
const C = CONNECTIONS[id] || {}, bank = C.aspsp;

try {
  // «lista» en el campo conexion: solo consulta qué bancos ofrece Enable Banking (España y Alemania), sin conectar ni cambiar nada.
  if (isList) {
    const out = [];
    for (const c of ['ES', 'DE']) {
      const { aspsps = [] } = await eb(`/aspsps?country=${c}&psu_type=personal`);
      const tr = aspsps.filter(a => /trade\s*republic/i.test(a.name)).map(a => a.name);
      out.push(`${c}: ${aspsps.length} bancos · Trade Republic: ${tr.length ? tr.join(', ') : 'no'}`);
      summary(`## Bancos de ${c} en Enable Banking (${aspsps.length})\n\n${aspsps.map(a => '- ' + a.name).join('\n')}\n`);
    }
    await log('INFO', 'bank-link', 'Lista de bancos consultada', { func: 'lista', detail: out.join(' | ') });
    process.exit(0);
  }
  if (!code) {
    const { aspsps = [] } = await eb(`/aspsps?country=${C.country}&psu_type=personal`);
    const found = aspsps.filter(a => a.name.toLowerCase().includes(bank.toLowerCase()));
    if (!found.length) {
      summary(`## ❌ No encuentro «${bank}» en Enable Banking\n\nBancos disponibles (${C.country}):\n\n${aspsps.map(a => '- ' + a.name).join('\n')}\n\nHay que corregir el nombre en CONNECTIONS (scripts/eb.mjs).`);
      process.exit(1);
    }
    const a = found.find(x => x.name.toLowerCase() === bank.toLowerCase()) || found[0];
    const secs = Math.min(a.maximum_consent_validity || 90 * 86400, 180 * 86400);
    const validUntil = new Date(Date.now() + secs * 1000 - 3600e3).toISOString();
    const r = await eb('/auth', {
      method: 'POST',
      body: { access: { valid_until: validUntil }, aspsp: { name: a.name, country: C.country }, state: crypto.randomUUID(), redirect_url: env('APP_URL'), psu_type: 'personal' }
    });
    await setStatus({ aspsp: a.name }, id);
    summary([
      '## 🏦 Paso 1 de 2 · Autoriza el acceso en tu banco',
      '',
      `Banco: **${a.name}** · permiso de ${Math.round(secs / 86400)} días.`,
      '',
      `👉 **[Abrir la autorización de ${a.name}](${r.url})**`,
      '',
      'Entra con tus claves en la web o la app de tu banco (no en GitHub). Al terminar volverás a tu panel, que te mostrará un **código**.',
      `Cópialo, vuelve a ejecutar este workflow («Conectar banco») con la conexión **${id}** y pégalo en el campo **code**. Tienes unos minutos.`
    ].join('\n'));
  } else {
    const s = await eb('/sessions', { method: 'POST', body: { code } });
    const accounts = (s.accounts || []).map(x => (typeof x === 'string' ? x : x.uid)).filter(Boolean);
    const vu = (s.access && s.access.valid_until) || null;
    await setStatus({ session_id: s.session_id, accounts, valid_until: vu, last_error: null, fail_count: 0 }, id);
    summary(`## ✅ ${bank} conectado\n\n${accounts.length} cuenta(s) vinculada(s). Permiso válido hasta **${vu ? vu.slice(0, 10).split('-').reverse().join('/') : '—'}**.\n\nAhora ejecuta ${C.purpose === 'ahorro' ? '«Sincronizar ahorro»' : '«Sincronizar banco»'} para traer los primeros datos (o espera a la próxima ejecución automática).`);
  }
} catch (e) {
  // Cada código del banco sirve una sola vez: si se lanza otra vez con el mismo, el banco ya quedó conectado antes.
  if (code && /ALREADY_AUTHORIZED/.test(e.body || e.message)) {
    await log('INFO', 'bank-link', 'Código ya usado: el banco ya estaba conectado', { func: 'main', detail: id });
    summary('## ✅ Este código ya se había usado\n\nEl banco quedó conectado en la ejecución anterior con este mismo código. No hace falta repetirlo.\n\nSi aun así quieres renovar el permiso, empieza de nuevo con el campo **code** vacío.');
    process.exit(0);
  }
  await log('ERROR', 'bank-link', 'Error al conectar el banco', { func: 'main', detail: id, err: e });
  summary('## ❌ Error\n\n```\n' + redact(e.message) + '\n```');
  process.exit(1);
}

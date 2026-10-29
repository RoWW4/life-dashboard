// Conecta (o renueva) el permiso con el banco. Dos pasos:
//   1) Sin código  → genera el enlace para autorizar en Openbank.
//   2) Con código  → crea la sesión y la guarda en Supabase (bank_status).
import crypto from 'node:crypto';
import { eb, env, setStatus, summary } from './eb.mjs';

const code = (process.env.EB_CODE || '').trim();
const bank = (process.env.EB_BANK || 'Openbank').trim();

try {
  if (!code) {
    const { aspsps = [] } = await eb('/aspsps?country=ES&psu_type=personal');
    const found = aspsps.filter(a => a.name.toLowerCase().includes(bank.toLowerCase()));
    if (!found.length) {
      summary(`## ❌ No encuentro «${bank}» en Enable Banking\n\nBancos de España disponibles:\n\n${aspsps.map(a => '- ' + a.name).join('\n')}\n\nVuelve a ejecutar indicando el nombre exacto en «bank».`);
      process.exit(1);
    }
    const a = found.find(x => x.name.toLowerCase() === bank.toLowerCase()) || found[0];
    const secs = Math.min(a.maximum_consent_validity || 90 * 86400, 180 * 86400);
    const validUntil = new Date(Date.now() + secs * 1000 - 3600e3).toISOString();
    const r = await eb('/auth', {
      method: 'POST',
      body: { access: { valid_until: validUntil }, aspsp: { name: a.name, country: 'ES' }, state: crypto.randomUUID(), redirect_url: env('APP_URL'), psu_type: 'personal' }
    });
    await setStatus({ aspsp: a.name });
    summary([
      '## 🏦 Paso 1 de 2 · Autoriza el acceso en tu banco',
      '',
      `Banco: **${a.name}** · permiso de ${Math.round(secs / 86400)} días.`,
      '',
      `👉 **[Abrir la autorización de ${a.name}](${r.url})**`,
      '',
      'Entra con tus claves en la web de tu banco (no en GitHub). Al terminar volverás a tu panel, que te mostrará un **código**.',
      'Cópialo, vuelve a ejecutar este workflow («Conectar banco») y pégalo en el campo **code**. Tienes unos minutos.'
    ].join('\n'));
  } else {
    const s = await eb('/sessions', { method: 'POST', body: { code } });
    const accounts = (s.accounts || []).map(x => (typeof x === 'string' ? x : x.uid)).filter(Boolean);
    const vu = (s.access && s.access.valid_until) || null;
    await setStatus({ session_id: s.session_id, accounts, valid_until: vu, last_error: null });
    summary(`## ✅ Banco conectado\n\n${accounts.length} cuenta(s) vinculada(s). Permiso válido hasta **${vu ? vu.slice(0, 10).split('-').reverse().join('/') : '—'}**.\n\nAhora ejecuta «Sincronizar banco» para traer los primeros movimientos (o espera a la próxima ejecución automática).`);
  }
} catch (e) {
  summary('## ❌ Error\n\n```\n' + e.message + '\n```');
  process.exit(1);
}

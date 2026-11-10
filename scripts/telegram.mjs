// Envío por Telegram compartido por los robots (avisos de tareas y Wallet). Ver telegram() abajo.
import { env } from './eb.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Envía por Telegram. Los mensajes de más de 4.000 caracteres se parten por líneas. Si Telegram pide esperar (429)
   o falla la red o el servidor, se reintenta hasta 2 veces. Devuelve los message_id de Telegram (para la trazabilidad). */
export async function telegram(text) {
  const parts = [];
  for (const line of String(text).split('\n')) {
    const last = parts.length ? parts[parts.length - 1] : null;
    if (last !== null && (last + '\n' + line).length <= 4000) parts[parts.length - 1] = last + '\n' + line; else parts.push(line);
  }
  const ids = [];
  for (const part of parts) {
    for (let i = 0; ; i++) {
      let r, j = {};
      try {
        r = await fetch(`${process.env.TELEGRAM_API || 'https://api.telegram.org'}/bot${env('TELEGRAM_TOKEN')}/sendMessage`, { // TELEGRAM_API solo en las pruebas
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ chat_id: env('TELEGRAM_CHAT_ID'), text: part.slice(0, 4096), disable_web_page_preview: true })
        });
        j = await r.json().catch(() => ({}));
      } catch (e) { r = { ok: false, status: 0 }; j = { description: 'Fallo de red: ' + e.message }; }
      if (r.ok && j.ok !== false) { ids.push(j.result && j.result.message_id); break; }
      const wait = r.status === 429 ? Math.min(+((j.parameters || {}).retry_after) || 5, 30) : (r.status === 0 || r.status >= 500) ? 5 : 0;
      if (wait && i < 2) { await sleep(wait * 1000); continue; }
      throw Object.assign(new Error(`Telegram → ${r.status}: ${String(j.description || '').slice(0, 200)}`), { status: r.status });
    }
  }
  return ids;
}

// Registro común de los robots (GitHub Actions): cada evento va a la tabla ops_log de Supabase con hora, nivel,
// pieza, función, ejecución (run_id) y detalle ya limpio de datos sensibles. El latido de cada robot va a job_health
// (función ldb_job), que es lo que mira el vigilante de Supabase cada hora.
// Nunca lanza errores: si Supabase no responde, se escribe en la consola de GitHub y el robot sigue.
import { sb } from './eb.mjs';

export const RUN_ID = process.env.GITHUB_RUN_ID || '';
export const RUN_URL = RUN_ID && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${RUN_ID}` : '';
const LEVELS = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];

/* Quita lo que nunca debe quedar registrado: tokens, claves, identificadores de cuentas y sesiones, IBAN, tarjetas,
   importes y correos. Se usa para ops_log y para todo lo que se escribe en el resumen público de GitHub. */
export function redact(v) {
  return String(v ?? '')
    .replace(/bot\d+:[A-Za-z0-9_-]{20,}/g, 'bot<token>')
    .replace(/\b(Bearer|apikey|token|key|secret|password|code)(["']?\s*[:=]\s*["']?|\s+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1$2<oculto>')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '<jwt>')
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '<clave privada>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[0-9A-Z]{4}){4,7}\b/g, '<iban>')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '<número>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<correo>')
    .replace(/-?\d{1,3}(?:\.\d{3})*,\d{2}\s?€|-?\d+(?:[.,]\d{1,2})?\s?(?:€|EUR)\b/g, '<importe>')
    .replace(/[?&](code|state|token)=[^&\s"]+/gi, (m, k) => m[0] + k + '=<oculto>');
}

/* Primera línea de la pila que apunta a nuestro código: «archivo:línea». */
export function where(err) {
  const l = String((err && err.stack) || '').split('\n').find(s => /scripts\/[\w-]+\.mjs:\d+/.test(s));
  const m = l && l.match(/scripts\/([\w-]+\.mjs:\d+)/);
  return m ? m[1] : '';
}

export async function log(level, source, event, { process: proc, func, detail, err } = {}) {
  if (!LEVELS.includes(level)) level = 'ERROR';
  const det = redact([detail, err && err.message].filter(Boolean).join(' · ')).slice(0, 2000);
  const stack = err && err.stack ? redact(err.stack).slice(0, 4000) : null;
  console.log(`[${new Date().toISOString()}] ${level} ${source}${proc ? '/' + proc : ''}${func ? ' ' + func : ''}: ${redact(event)}${det ? ' — ' + det : ''}`);
  try {
    await sb('ops_log', { method: 'POST', prefer: 'return=minimal', body: {
      user_id: process.env.LDB_USER_ID ? process.env.LDB_USER_ID.trim() : null, level, source, process: proc || null,
      func: [func, err && where(err)].filter(Boolean).join(' @ ') || null, run_id: RUN_ID || null, run_url: RUN_URL || null,
      event: redact(event).slice(0, 300), detail: det || null, stack } });
  } catch (e) { console.log('(no se pudo guardar en ops_log: ' + redact(e.message).slice(0, 200) + ')'); }
}

/* Latido del robot: start al empezar, ok al terminar bien, fail con el motivo. */
export async function job(name, event, error) {
  try {
    await sb('rpc/ldb_job', { method: 'POST', body: {
      p_job: name, p_event: event, p_error: error ? redact(error).slice(0, 1000) : null, p_run_id: RUN_ID || null, p_run_url: RUN_URL || null } });
  } catch (e) { console.log(`(no se pudo apuntar el latido ${name}/${event}: ${redact(e.message).slice(0, 200)})`); }
}

/* Red de seguridad: cualquier error que se escape (también de un await de primer nivel) queda registrado como CRITICAL,
   el latido como fallido, y la ejecución termina con error (GitHub la marca en rojo). */
export function guard(source) {
  let done = false;
  const fin = async (err) => {
    if (done) return; done = true;
    await log('CRITICAL', source, 'Error no controlado', { func: 'guard', err });
    await job(source, 'fail', err && err.message);
    process.exit(1);
  };
  process.on('uncaughtException', fin);
  process.on('unhandledRejection', fin);
}

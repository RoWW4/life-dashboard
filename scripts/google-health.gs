/**
 * Salud del panel (Google Apps Script, en la cuenta de Google de la dueña del panel).
 *
 * Cada hora (y cuando el panel pulsa «Sincronizar ahora») lee de Google Health los últimos días:
 *   pasos y kcal (dailyRollUp), sueño (sesiones, sin siestas) y pulso en reposo,
 * y los deja en Supabase: tabla health_daily (un día por fila) y health_status (hora, error y la dirección
 * de esta app web, que el panel usa para el botón «Sincronizar ahora»).
 *
 * Necesita un proyecto de Google Cloud propio con «Google Health API» habilitada y la pantalla de consentimiento
 * «En producción» (si se queda en «Prueba», el permiso caduca cada 7 días). El manifiesto es scripts/google-health-appsscript.json.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script), NUNCA en el código:
 *   EMAIL / PASSWORD · cuenta del panel
 * Instalar: pegar este archivo y el manifiesto, rellenar las propiedades, implementar como «Aplicación web»
 * (ejecutar como: yo · acceso: cualquier usuario) y ejecutar UNA vez la función instalar().
 */
const SB_URL = 'https://lvsjvdpxnuydtwajlvsv.supabase.co';
const SB_KEY = 'sb_publishable_9XIhDkRWUeUjFY0qvk7Jhg_hgBc93wo'; // clave pública del panel (la misma que usa la web)
const GH = 'https://health.googleapis.com/v4/users/me/dataTypes/';
const DIAS = 10; // días que se vuelven a leer en cada sincronización (las kcal admiten como mucho 14)

const P = () => PropertiesService.getScriptProperties();
const prop = k => { const v = P().getProperty(k); if (!v) throw new Error('Falta la propiedad del script ' + k); return v.trim(); };
const zona = () => Session.getScriptTimeZone();
const dia = d => Utilities.formatDate(d, zona(), 'yyyy-MM-dd');
const sumar = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dia(new Date(y, m - 1, d + n, 12)); };
const civil = s => { const [y, m, d] = s.split('-').map(Number); return { date: { year: y, month: m, day: d } }; };
const deCivil = c => c && c.date ? c.date.year + '-' + ('0' + c.date.month).slice(-2) + '-' + ('0' + c.date.day).slice(-2) : '';

/* ---------- Google Health ---------- */
function gh(ruta, opciones) {
  const r = UrlFetchApp.fetch(GH + ruta, Object.assign({
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, contentType: 'application/json', muteHttpExceptions: true }, opciones || {}));
  if (r.getResponseCode() !== 200) throw new Error(ruta.split('/')[0] + ' → ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText() || '{}');
}
/* Busca dentro de un punto el objeto que lleva el valor (p. ej. {steps:{countSum:'9037'}} → 9037). */
function valor(punto, campo) {
  for (const k in punto) { const v = punto[k]; if (v && typeof v === 'object' && v[campo] != null) return Number(v[campo]); }
  return null;
}
/* Totales por día de un tipo «sumable» (steps → countSum, total-calories → kcalSum). */
function porDia(tipo, campo, desde, hasta) {
  const out = {}; let tok = '';
  do {
    const cuerpo = { range: { start: civil(desde), end: civil(hasta) }, windowSizeDays: 1 };
    if (tok) cuerpo.pageToken = tok;
    const j = gh(tipo + '/dataPoints:dailyRollUp', { method: 'post', payload: JSON.stringify(cuerpo) });
    (j.rollupDataPoints || []).forEach(p => { const d = deCivil(p.civilStartTime), v = valor(p, campo); if (d && v != null) out[d] = Math.round(v); });
    tok = j.nextPageToken || '';
  } while (tok);
  return out;
}
/* Lista de puntos con filtro, siguiendo las páginas. */
function lista(tipo, filtro) {
  const out = []; let tok = '';
  do {
    const j = gh(tipo + '/dataPoints?filter=' + encodeURIComponent(filtro) + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''));
    out.push(...(j.dataPoints || []));
    tok = j.nextPageToken || '';
  } while (tok);
  return out;
}
/* Minutos dormidos por día (el día en que te despiertas), sin contar siestas. */
function sueno(desde) {
  const out = {};
  lista('sleep', 'sleep.interval.civil_end_time >= "' + desde + 'T00:00:00"').forEach(p => {
    const s = p.sleep || {}, fin = s.interval && s.interval.endTime, min = s.summary && s.summary.minutesAsleep;
    if (!fin || min == null || (s.metadata && s.metadata.nap)) return;
    const d = dia(new Date(fin)); out[d] = (out[d] || 0) + Number(min);
  });
  return out;
}
/* Pulso en reposo de cada día. */
function pulso(desde) {
  const out = {};
  lista('daily-resting-heart-rate', 'daily_resting_heart_rate.date >= "' + desde + '"').forEach(p => {
    for (const k in p) { const v = p[k]; if (v && v.date && v.beatsPerMinute != null) out[deCivil(v)] = Math.round(Number(v.beatsPerMinute)); }
  });
  return out;
}

/* ---------- Supabase ---------- */
function entrar() {
  const r = UrlFetchApp.fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'post', contentType: 'application/json', headers: { apikey: SB_KEY },
    payload: JSON.stringify({ email: prop('EMAIL'), password: prop('PASSWORD') }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('no he podido entrar en el panel (revisa EMAIL y PASSWORD)');
  return JSON.parse(r.getContentText()).access_token;
}
function guardar(token, tabla, filas, clave) {
  const r = UrlFetchApp.fetch(SB_URL + '/rest/v1/' + tabla + '?on_conflict=' + clave, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token, Prefer: 'resolution=merge-duplicates,return=minimal' },
    payload: JSON.stringify(filas) });
  if (r.getResponseCode() >= 300) throw new Error('no he podido guardar en ' + tabla + ': ' + r.getContentText().slice(0, 300));
}

/* ---------- Sincronizar ---------- */
function sincronizar() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return 'ocupado';
  try {
    const hoy = dia(new Date()), desde = sumar(hoy, -(DIAS - 1)), hasta = sumar(hoy, 1), avisos = [], datos = {};
    // Cada tipo por separado: si uno falla, los demás se guardan igual y esa columna no se toca.
    const tipos = {
      steps: () => porDia('steps', 'countSum', desde, hasta),
      kcal: () => porDia('total-calories', 'kcalSum', desde, hasta),
      sleep_min: () => sueno(sumar(desde, -1)),
      rhr: () => pulso(desde),
    };
    for (const col in tipos) { try { datos[col] = tipos[col](); } catch (e) { avisos.push(col + ': ' + e.message); } }
    const cols = Object.keys(datos), token = entrar(), ahora = new Date().toISOString();
    const dias = [...new Set(cols.flatMap(c => Object.keys(datos[c])))].filter(d => d >= desde && d <= hoy).sort();
    if (dias.length && cols.length) guardar(token, 'health_daily', dias.map(d => {
      const f = { day: d, updated_at: ahora }; cols.forEach(c => { f[c] = datos[c][d] != null ? datos[c][d] : null; }); return f; }), 'user_id,day');
    let url = ''; try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
    const estado = { last_sync: ahora, last_error: avisos.length ? avisos.join(' · ').slice(0, 500) : null };
    if (url) estado.sync_url = url;
    guardar(token, 'health_status', [estado], 'user_id');
    if (avisos.length) console.warn(avisos.join('\n'));
    return avisos.length ? 'con avisos' : 'ok';
  } finally { lock.releaseLock(); }
}

/* El botón «Sincronizar ahora» del panel abre esta dirección. */
function doGet() {
  let res; try { res = { ok: true, estado: sincronizar() }; } catch (e) { res = { ok: false, error: String(e.message || e) }; }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar UNA vez (después de implementar la app web): pide los permisos, sincroniza y deja la sincronización cada hora. */
function instalar() {
  ['EMAIL', 'PASSWORD'].forEach(prop);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sincronizar').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sincronizar').timeBased().everyHours(1).create();
  console.log('Primera sincronización: ' + sincronizar());
}

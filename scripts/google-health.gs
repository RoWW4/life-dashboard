/**
 * Salud del panel (Google Apps Script, en la cuenta de Google de la dueña del panel).
 *
 * Cada hora (y cuando el panel pulsa «Sincronizar ahora») lee de Google Health los últimos días:
 *   pasos y kcal (dailyRollUp), sueño (sesiones, sin siestas: minutos, fases y horas) y pulso en reposo,
 * y los deja en Supabase: tabla health_daily (un día por fila) y health_status (hora, error y la dirección
 * de esta app web, que el panel usa para el botón «Sincronizar ahora»).
 *
 * Necesita un proyecto de Google Cloud propio con «Google Health API» habilitada y la pantalla de consentimiento
 * «En producción» (si se queda en «Prueba», el permiso caduca cada 7 días). El manifiesto es scripts/google-health-appsscript.json.
 * Google Health rechaza el token propio de Apps Script (lleva otros permisos), así que el script pide uno aparte, solo
 * con los permisos de salud, con un cliente OAuth «Aplicación web» del proyecto cuya URI de redirección es la de esta app web.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script), NUNCA en el código:
 *   EMAIL / PASSWORD · cuenta del panel     CLIENT_ID / CLIENT_SECRET · cliente OAuth del proyecto de Google Cloud
 *   APP_URL · URL de la app web (la que acaba en /exec)
 *   (REFRESH y STATE las escribe el propio script)
 * Instalar: pegar este archivo y el manifiesto, rellenar las propiedades, implementar como «Aplicación web»
 * (ejecutar como: yo · acceso: cualquier usuario), ejecutar conectar() y abrir el enlace del registro, y luego instalar().
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

/* ---------- Permiso de Google Health (OAuth aparte, solo con estos permisos) ---------- */
const SCOPES = ['activity_and_fitness', 'sleep', 'health_metrics_and_measurements']
  .map(s => 'https://www.googleapis.com/auth/googlehealth.' + s + '.readonly').join(' ');
// Dirección /exec de la app web. Desde el editor getUrl() da la de pruebas (/dev), que solo vale con la sesión
// de Google abierta, así que se guarda la buena en la propiedad APP_URL.
const urlApp = () => (P().getProperty('APP_URL') || '').trim() || ScriptApp.getService().getUrl();
function pedirToken(datos) {
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true,
    payload: Object.assign({ client_id: prop('CLIENT_ID'), client_secret: prop('CLIENT_SECRET') }, datos) });
  const j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200) throw new Error('permiso de Google: ' + (j.error_description || j.error || r.getResponseCode()));
  return j;
}
function token() {
  const c = CacheService.getScriptCache(), t = c.get('AT'); if (t) return t;
  const rt = P().getProperty('REFRESH');
  if (!rt) throw new Error('falta conectar con Google Health: ejecuta conectar() y abre el enlace');
  const j = pedirToken({ grant_type: 'refresh_token', refresh_token: rt });
  c.put('AT', j.access_token, Math.max(60, Math.min(3000, (j.expires_in || 3600) - 300)));
  return j.access_token;
}
/** Ejecutar desde el editor: escribe en el registro la URI de redirección (para el cliente OAuth) y el enlace para dar permiso. */
function conectar() {
  prop('CLIENT_ID'); prop('CLIENT_SECRET');
  if (!/\/exec$/.test(urlApp())) throw new Error('Falta la propiedad APP_URL con la URL de la app web (la que acaba en /exec)');
  const st = Utilities.getUuid(); P().setProperty('STATE', st);
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + [['client_id', prop('CLIENT_ID')], ['redirect_uri', urlApp()],
    ['response_type', 'code'], ['scope', SCOPES], ['access_type', 'offline'], ['prompt', 'consent'], ['state', st]]
    .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  console.log('1) URI de redirección del cliente OAuth:\n' + urlApp());
  console.log('2) Abre este enlace y da permiso:\n' + url);
}
function recibirPermiso(p) {
  const pag = t => HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width"><p style="font:18px system-ui;padding:24px">' + t + '</p>');
  if (p.error) return pag('❌ Google no ha dado el permiso: ' + p.error);
  if (!p.state || p.state !== P().getProperty('STATE')) return pag('❌ Enlace caducado: vuelve a ejecutar conectar().');
  const j = pedirToken({ grant_type: 'authorization_code', code: p.code, redirect_uri: urlApp() });
  if (!j.refresh_token) return pag('❌ Google no ha mandado el permiso permanente. Quita el acceso de «Panel salud» en tu cuenta de Google y repite conectar().');
  P().setProperty('REFRESH', j.refresh_token); P().deleteProperty('STATE');
  CacheService.getScriptCache().put('AT', j.access_token, 3000);
  let r = ''; try { r = sincronizar(); } catch (e) { r = 'error: ' + e.message; }
  return pag('✅ Conectado con Google Health. Primera sincronización: ' + r + '.<br>Ya puedes cerrar esta pestaña.');
}

/* ---------- Google Health ---------- */
function gh(ruta, opciones) {
  const r = UrlFetchApp.fetch(GH + ruta, Object.assign({
    headers: { Authorization: 'Bearer ' + token() }, contentType: 'application/json', muteHttpExceptions: true }, opciones || {}));
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
/* Sueño por día (el día en que te despiertas), sin contar siestas: minutos dormidos, minutos de cada fase
   (despierta, ligero, profundo, REM) y hora de dormirte y de despertar. Si hay varias sesiones, se suman las fases
   y se toma la primera hora de inicio y la última de fin. */
const FASES = { AWAKE: 'awake_min', LIGHT: 'light_min', DEEP: 'deep_min', REM: 'rem_min' };
function sueno(desde, hasta) {
  const out = { sleep_min: {}, awake_min: {}, light_min: {}, deep_min: {}, rem_min: {}, bed_at: {}, wake_at: {} };
  lista('sleep', 'sleep.interval.civil_end_time >= "' + desde + 'T00:00:00" AND sleep.interval.civil_end_time < "' + hasta + 'T00:00:00"').forEach(p => {
    const s = p.sleep || {}, iv = s.interval || {}, fin = iv.endTime, sm = s.summary || {};
    if (!fin || sm.minutesAsleep == null || (s.metadata && s.metadata.nap)) return;
    const d = dia(new Date(fin)), suma = (c, v) => { out[c][d] = (out[c][d] || 0) + Number(v); };
    suma('sleep_min', sm.minutesAsleep);
    (sm.stagesSummary || []).forEach(f => { const c = FASES[String(f.type || '').toUpperCase()]; if (c && f.minutes != null) suma(c, f.minutes); });
    if (iv.startTime && (!out.bed_at[d] || iv.startTime < out.bed_at[d])) out.bed_at[d] = iv.startTime;
    if (!out.wake_at[d] || fin > out.wake_at[d]) out.wake_at[d] = fin;
  });
  return out;
}
/* Pulso en reposo de cada día. */
function pulso(desde, hasta) {
  const out = {};
  lista('daily-resting-heart-rate', 'daily_resting_heart_rate.date >= "' + desde + '" AND daily_resting_heart_rate.date < "' + hasta + '"').forEach(p => {
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
/* Lee todos los datos de [desde, hasta) y los guarda. Cada tipo por separado: si uno falla, los demás se guardan
   igual y esa columna no se toca. Devuelve los avisos. */
function leerYGuardar(token, desde, hasta) {
  const avisos = [], datos = {}, ahora = new Date().toISOString();
  const tipos = { // cada lectura devuelve {columna: {día: valor}}
    pasos: () => ({ steps: porDia('steps', 'countSum', desde, hasta) }),
    kcal: () => ({ kcal: porDia('total-calories', 'kcalSum', desde, hasta) }),
    sueño: () => sueno(desde, hasta),
    pulso: () => ({ rhr: pulso(desde, hasta) }),
  };
  for (const t in tipos) { try { Object.assign(datos, tipos[t]()); } catch (e) { avisos.push(t + ': ' + e.message); } }
  const cols = Object.keys(datos);
  const dias = [...new Set(cols.flatMap(c => Object.keys(datos[c])))].filter(d => d >= desde && d < hasta).sort();
  if (dias.length && cols.length) guardar(token, 'health_daily', dias.map(d => {
    const f = { day: d, updated_at: ahora }; cols.forEach(c => { f[c] = datos[c][d] != null ? datos[c][d] : null; }); return f; }), 'user_id,day');
  return avisos;
}
function sincronizar() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return 'ocupado';
  try {
    const hoy = dia(new Date()), token = entrar();
    const avisos = leerYGuardar(token, sumar(hoy, -(DIAS - 1)), sumar(hoy, 1));
    let url = ''; try { url = urlApp() || ''; } catch (e) {}
    if (/\/dev$/.test(url)) url = '';
    const estado = { last_sync: new Date().toISOString(), last_error: avisos.length ? avisos.join(' · ').slice(0, 500) : null };
    if (url) estado.sync_url = url;
    guardar(token, 'health_status', [estado], 'user_id');
    if (avisos.length) console.warn(avisos.join('\n'));
    return avisos.length ? 'con avisos' : 'ok';
  } finally { lock.releaseLock(); }
}
/** Ejecutar UNA vez desde el editor: trae el histórico de Google Health (por defecto el último año) en tramos de 14 días. */
function historico(dias) {
  dias = dias || 365;
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return console.log('Hay otra sincronización en marcha; prueba en un minuto.');
  try {
    const hoy = dia(new Date()), token = entrar(), avisos = [];
    for (let fin = sumar(hoy, -(DIAS - 1)), n = 0; n < dias; n += 14) {
      const ini = sumar(fin, -14);
      leerYGuardar(token, ini, fin).forEach(a => avisos.push(ini + ' · ' + a));
      console.log('Hecho hasta el ' + ini);
      fin = ini;
    }
    console.log(avisos.length ? 'Terminado con avisos:\n' + avisos.join('\n') : 'Histórico terminado sin errores.');
  } finally { lock.releaseLock(); }
}

/* El botón «Sincronizar ahora» del panel abre esta dirección; Google vuelve aquí también al dar el permiso (?code=…). */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.code || p.error) return recibirPermiso(p);
  let res; try { res = { ok: true, estado: sincronizar() }; } catch (e) { res = { ok: false, error: String(e.message || e) }; }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar UNA vez (después de implementar la app web): pide los permisos, sincroniza y deja la sincronización cada hora. */
function instalar() {
  ['EMAIL', 'PASSWORD', 'CLIENT_ID', 'CLIENT_SECRET', 'REFRESH'].forEach(prop);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sincronizar').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sincronizar').timeBased().everyHours(1).create();
  console.log('Primera sincronización: ' + sincronizar());
}

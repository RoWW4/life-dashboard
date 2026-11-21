/**
 * Copia diaria del panel en Google Drive (Google Apps Script de la cuenta personal, proyecto «Copia del panel»).
 * Cada noche entra en Supabase con la cuenta del panel, descarga el panel y las tablas de apoyo
 * y guarda un archivo .json en la carpeta «Copias del panel» de Drive (se guardan 60 días).
 * Si falla, Google manda un correo avisando.
 *
 * El correo y la contraseña NO van aquí: se guardan en
 * Configuración del proyecto (rueda dentada) → Propiedades del script → EMAIL y PASSWORD.
 * Al cambiar este código hay que pegarlo de nuevo en Apps Script.
 */
const SB_URL = 'https://lvsjvdpxnuydtwajlvsv.supabase.co';
const SB_KEY = 'sb_publishable_9XIhDkRWUeUjFY0qvk7Jhg_hgBc93wo'; // clave pública del panel (la misma que usa la web)
const CARPETA = 'Copias del panel';
const DIAS = 60;
// Tablas de apoyo que se copian además del panel, con el orden para leerlas por páginas.
const TABLAS = {
  bank_tx: 'id',
  bank_pending: 'id',
  bank_connections: 'id',
  savings_tx: 'id',
  savings_daily: 'day,conn',
  health_daily: 'day',
  health_status: 'user_id',
  wallet_log: 'id',
  job_health: 'job',
  ops_alerts: 'key',
  ops_log: 'id'
};

function copiaDiaria() {
  const p = PropertiesService.getScriptProperties();
  const email = p.getProperty('EMAIL'), password = p.getProperty('PASSWORD');
  if (!email || !password) throw new Error('Faltan EMAIL y PASSWORD en las propiedades del script');

  // 1) Entrar con la cuenta del panel
  const login = UrlFetchApp.fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'post', contentType: 'application/json', headers: { apikey: SB_KEY },
    payload: JSON.stringify({ email: email, password: password }), muteHttpExceptions: true
  });
  if (login.getResponseCode() !== 200) throw new Error('No se pudo entrar en Supabase: ' + login.getContentText());
  const token = JSON.parse(login.getContentText()).access_token;
  const get = (ruta) => {
    const r = UrlFetchApp.fetch(SB_URL + '/rest/v1/' + ruta, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token }, muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) throw new Error('Error al leer ' + ruta + ': ' + r.getContentText());
    return JSON.parse(r.getContentText());
  };
  // Lee una tabla entera de 1000 en 1000 (Supabase no devuelve más de 1000 filas de una vez).
  const getTodo = (tabla, orden) => {
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      const pag = get(tabla + '?select=*&order=' + orden + '&limit=1000&offset=' + desde);
      filas.push.apply(filas, pag);
      if (pag.length < 1000) return filas;
    }
  };

  // 2) Leer los datos: el panel es obligatorio; si falla una tabla de apoyo, se apunta y se sigue.
  const estado = get('ldb_state?select=updated_at,data');
  if (!estado.length || !estado[0].data) throw new Error('La copia ha salido vacía: revisa el panel');
  const copia = { copia: new Date().toISOString(), ldb_state: estado, errores: {} };
  Object.keys(TABLAS).forEach(t => {
    try { copia[t] = getTodo(t, TABLAS[t]); } catch (e) { copia.errores[t] = String(e.message || e); }
  });

  // 3) Guardar en Drive
  const it = DriveApp.getFoldersByName(CARPETA);
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
  const fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  carpeta.createFile('panel-' + fecha + '.json', JSON.stringify(copia), 'application/json');

  // 4) Borrar las copias de hace más de 60 días
  const limite = Date.now() - DIAS * 86400000;
  const fs = carpeta.getFiles();
  while (fs.hasNext()) { const f = fs.next(); if (/^panel-.*\.json$/.test(f.getName()) && f.getDateCreated().getTime() < limite) f.setTrashed(true); }

  const d = estado[0].data;
  console.log('Copia guardada: ' + (d.tasks || []).length + ' tareas, ' + (d.tx || []).length + ' movimientos; ' +
    Object.keys(TABLAS).filter(t => copia[t]).map(t => t + ' ' + copia[t].length).join(', '));
  const fallos = Object.keys(copia.errores);
  if (fallos.length) throw new Error('Copia guardada, pero no se pudieron copiar: ' + fallos.join(', ') + ' (detalle dentro del archivo)');
}

/** Ejecutar UNA vez: programa la copia cada noche (entre las 3 y las 4) y hace la primera ahora. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('copiaDiaria').timeBased().everyDays(1).atHour(3).inTimezone('Europe/Madrid').create();
  copiaDiaria();
}

/**
 * Bot de documentos del panel (Google Apps Script, en la cuenta de Google de la dueña del panel).
 *
 * Mandas al bot de Telegram una o varias fotos/PDF (opcional: un texto con el nombre y «caduca DD/MM/AAAA»).
 * El bot pregunta la carpeta con botones, guarda los archivos en Drive (carpeta «Documentos» → subcarpeta)
 * y añade el documento a la sección Documentos del panel (función ldb_add_doc de Supabase).
 * Si mandas varios archivos antes de elegir carpeta, se guardan juntos como UN documento (en una subcarpeta propia).
 *
 * Sin dirección pública: cada minuto el script pregunta a Telegram si hay mensajes nuevos (getUpdates).
 * Solo atiende al chat de CHAT_ID; el resto se ignora.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script), NUNCA en el código:
 *   TELEGRAM_TOKEN · token del bot          CHAT_ID · tu chat con el bot (el mismo de los avisos)
 *   EMAIL / PASSWORD · cuenta del panel     DOCS_FOLDER · id de la carpeta «Documentos» de Drive
 * Instalar: pegar este archivo, rellenar las propiedades y ejecutar UNA vez la función instalar().
 */
const SB_URL = 'https://lvsjvdpxnuydtwajlvsv.supabase.co';
const SB_KEY = 'sb_publishable_9XIhDkRWUeUjFY0qvk7Jhg_hgBc93wo'; // clave pública del panel (la misma que usa la web)
// Carpeta del panel → subcarpeta de Drive dentro de «Documentos» ('' = la propia carpeta). Si no existe, se crea.
const CARPETAS = { Personal: '01 Personal', Coche: '02 Coche', Trabajo: '03 Trabajo', Mascotas: '06 Mascotas',
  Salud: '07 Salud y deporte', Hogar: '09 Hogar', Finanzas: '10 Finanzas', Otros: '' };
const ORDEN = ['Personal', 'Coche', 'Hogar', 'Salud', 'Finanzas', 'Mascotas', 'Trabajo', 'Otros'];
const MAX_ARCHIVOS = 10;

const P = () => PropertiesService.getScriptProperties();
const prop = k => { const v = P().getProperty(k); if (!v) throw new Error('Falta la propiedad del script ' + k); return v.trim(); };

/* ---------- Telegram ---------- */
function tg(metodo, datos) {
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + prop('TELEGRAM_TOKEN') + '/' + metodo, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(datos || {}), muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText());
  if (!j.ok) console.warn(metodo + ': ' + r.getContentText());
  return j.result;
}
const decir = (texto, extra) => tg('sendMessage', Object.assign({ chat_id: prop('CHAT_ID'), text: texto, disable_web_page_preview: true }, extra || {}));
const botones = filas => ({ reply_markup: { inline_keyboard: filas } });
const tecladoCarpetas = () => {
  const f = []; for (let i = 0; i < ORDEN.length; i += 2) f.push(ORDEN.slice(i, i + 2).map(c => ({ text: c, callback_data: 'c:' + c })));
  f.push([{ text: '❌ Cancelar', callback_data: 'x' }]); return botones(f);
};

/* ---------- Lote pendiente (lo que has mandado y aún no se ha guardado) ---------- */
const leerLote = () => { try { return JSON.parse(P().getProperty('LOTE') || 'null'); } catch (e) { return null; } };
const guardarLote = l => l ? P().setProperty('LOTE', JSON.stringify(l)) : P().deleteProperty('LOTE');
const resumen = l => `📎 ${l.files.length} archivo${l.files.length === 1 ? '' : 's'}${l.files.length > 1 ? ' (se guardarán juntos como un documento)' : ''}.\n¿En qué carpeta lo guardo?`;

/* «Seguro coche · caduca 01/02/2027» → {name:'Seguro coche', exp:'2027-02-01'} */
function leerTexto(t) {
  // Fuera las líneas que son solo un nombre de archivo («Contrato.pdf») y las líneas se juntan en una.
  t = String(t || '').split(/\n+/).map(x => x.trim()).filter(x => x && !/^[^\s\/]+\.(pdf|jpe?g|png|heic|webp|docx?|xlsx?)$/i.test(x)).join(' ').trim(); let exp = '';
  const m = t.match(/(?:caduca|vence|caducidad)\s*:?\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; exp = y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); t = t.replace(m[0], ''); }
  return { name: t.replace(/[·\-–,]+\s*$/, '').replace(/^\s*[·\-–,]+/, '').trim(), exp };
}

/* ---------- Bucle: cada minuto ---------- */
function revisar() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return;
  try {
    const offset = +(P().getProperty('OFFSET') || 0);
    const ups = tg('getUpdates', { offset, timeout: 0, allowed_updates: ['message', 'callback_query'] }) || [];
    for (const u of ups) {
      if (u.update_id < offset) continue;
      P().setProperty('OFFSET', String(u.update_id + 1));   // antes de procesar: nunca se repite un mensaje
      console.log('update ' + u.update_id + ': ' + (u.callback_query ? 'botón ' + u.callback_query.data : u.message ? (u.message.document ? 'archivo' : u.message.photo ? 'foto' : 'texto') : '?'));
      try { atender(u); } catch (e) { console.error(e); decir('⚠️ No he podido terminar: ' + e.message + '\nVuelve a intentarlo o mándalo otra vez.'); }
    }
  } finally { lock.releaseLock(); }
}

function atender(u) {
  const chat = String(prop('CHAT_ID'));
  const m = u.message, q = u.callback_query;
  if (m && String(m.chat.id) !== chat) return;                 // solo tu chat
  if (q && String(q.message.chat.id) !== chat) return;

  if (m && (m.document || m.photo)) {
    const l = leerLote() || { files: [], text: '' };
    const uid = m.document ? m.document.file_unique_id : m.photo[m.photo.length - 1].file_unique_id;
    // El mismo archivo dos veces (reenviado o repetido): no se duplica ni se vuelve a preguntar.
    if (uid && (l.files.some(f => f.u === uid) || recientes().includes(uid))) return decir('Ese archivo ya lo tengo; no lo duplico.');
    if (l.files.length >= MAX_ARCHIVOS) return decir(`Máximo ${MAX_ARCHIVOS} archivos por documento. Elige carpeta o cancela.`);
    if (m.document) l.files.push({ id: m.document.file_id, u: uid, name: m.document.file_name || 'documento', size: m.document.file_size || 0 });
    else { const ph = m.photo[m.photo.length - 1]; l.files.push({ id: ph.file_id, u: uid, name: 'foto-' + (l.files.length + 1) + '.jpg', size: ph.file_size || 0 }); }
    if (m.caption) l.text = m.caption;
    if (l.ask) tg('editMessageText', Object.assign({ chat_id: chat, message_id: l.ask, text: resumen(l) }, tecladoCarpetas()));
    else l.ask = decir(resumen(l), tecladoCarpetas()).message_id;
    l.step = 'cat'; return guardarLote(l);
  }

  if (q) {
    const l = leerLote();
    // Botón de una pregunta ya contestada (p. ej. pulsado dos veces): solo un aviso pequeño, sin mensaje nuevo.
    if (!l || (l.ask && q.message.message_id !== l.ask && q.data !== 'n')) return tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Eso ya está hecho 👍' });
    tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Guardando…' });
    if (q.data === 'x') { guardarLote(null); return tg('editMessageText', { chat_id: chat, message_id: q.message.message_id, text: '❌ Cancelado: no se ha guardado nada.' }); }
    if (q.data.startsWith('c:')) {
      l.cat = ORDEN.includes(q.data.slice(2)) ? q.data.slice(2) : 'Otros';
      tg('editMessageText', { chat_id: chat, message_id: q.message.message_id, text: resumen(l).split('\n')[0] + '\n📁 ' + l.cat });
      const t = leerTexto(l.text);
      if (t.name) { l.name = t.name; l.exp = t.exp; guardarLote(l); return terminar(); }
      l.step = 'name'; guardarLote(l);
      return decir('¿Cómo lo llamo? Escribe el nombre (puedes añadir «caduca 01/02/2027» para que te avise).',
        botones([[{ text: 'Usar «' + sinExt(l.files[0].name) + '»', callback_data: 'n' }], [{ text: '❌ Cancelar', callback_data: 'x' }]]));
    }
    if (q.data === 'n') { l.name = sinExt(l.files[0].name); l.exp = ''; guardarLote(l); return terminar(); }
    return;
  }

  if (m && m.text) {
    const l = leerLote();
    if (l && l.step === 'name') { const t = leerTexto(m.text); if (!t.name) return decir('Escribe un nombre, por favor.'); l.name = t.name; l.exp = t.exp; guardarLote(l); return terminar(); }
    if (l && l.step === 'cat') return decir('Elige la carpeta con los botones de arriba (o ❌ Cancelar).');
    return decir('Mándame una foto o un PDF (o varios seguidos si son del mismo documento) y te pregunto dónde guardarlo.');
  }
}
const recientes = () => { try { return JSON.parse(P().getProperty('RECIENTES') || '[]'); } catch (e) { return []; } };
const sinExt = n => String(n).replace(/\.[^.]+$/, '');
const ext = n => (String(n).match(/\.[^.]+$/) || [''])[0];

/* ---------- Guardar en Drive y en el panel ---------- */
function carpetaDe(cat) {
  const raiz = DriveApp.getFolderById(prop('DOCS_FOLDER')), nombre = CARPETAS[cat] || '';
  if (!nombre) return raiz;
  const it = raiz.getFoldersByName(nombre); return it.hasNext() ? it.next() : raiz.createFolder(nombre);
}
function descargar(f) {
  if (f.size > 20 * 1024 * 1024) throw new Error('«' + f.name + '» pesa más de 20 MB (límite de Telegram)');
  const info = tg('getFile', { file_id: f.id });
  if (!info || !info.file_path) throw new Error('Telegram no me deja descargar «' + f.name + '»');
  return UrlFetchApp.fetch('https://api.telegram.org/file/bot' + prop('TELEGRAM_TOKEN') + '/' + info.file_path).getBlob();
}
function terminar() {
  const l = leerLote(); if (!l || !l.cat || !l.name) return;
  const destino = carpetaDe(l.cat);
  let url;
  if (l.files.length === 1) {
    url = destino.createFile(descargar(l.files[0]).setName(l.name + ext(l.files[0].name))).getUrl();
  } else {
    const sub = destino.createFolder(l.name);
    l.files.forEach((f, i) => sub.createFile(descargar(f).setName(l.name + ' (' + (i + 1) + ')' + ext(f.name))));
    url = sub.getUrl();
  }
  anadirAlPanel(l.name, l.cat, url, l.exp || '');
  P().setProperty('RECIENTES', JSON.stringify([...l.files.map(f => f.u).filter(Boolean), ...recientes()].slice(0, 30)));
  guardarLote(null);
  decir(`✅ Guardado «${l.name}» en ${l.cat}${l.files.length > 1 ? ' (' + l.files.length + ' archivos)' : ''}${l.exp ? ' · te aviso antes del ' + l.exp.split('-').reverse().join('/') : ''}.\nYa está en Documentos del panel.\n${url}`);
}
function anadirAlPanel(name, cat, url, exp) {
  const login = UrlFetchApp.fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'post', contentType: 'application/json', headers: { apikey: SB_KEY },
    payload: JSON.stringify({ email: prop('EMAIL'), password: prop('PASSWORD') }), muteHttpExceptions: true });
  if (login.getResponseCode() !== 200) throw new Error('no he podido entrar en el panel (el archivo sí está en Drive: ' + url + ')');
  const token = JSON.parse(login.getContentText()).access_token;
  const r = UrlFetchApp.fetch(SB_URL + '/rest/v1/rpc/ldb_add_doc', {
    method: 'post', contentType: 'application/json', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ p_name: name, p_cat: cat, p_url: url.replace(/\?.*$/, ''), p_exp: exp }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('no he podido añadirlo al panel (el archivo sí está en Drive: ' + url + '): ' + r.getContentText());
}

/** Ejecutar UNA vez: comprueba las propiedades, deja el bot en modo «preguntar cada minuto» y manda un mensaje de prueba. */
function instalar() {
  ['TELEGRAM_TOKEN', 'CHAT_ID', 'EMAIL', 'PASSWORD', 'DOCS_FOLDER'].forEach(prop);
  DriveApp.getFolderById(prop('DOCS_FOLDER'));             // pide el permiso de Drive y comprueba la carpeta
  tg('deleteWebhook', { drop_pending_updates: false });
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'revisar').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('revisar').timeBased().everyMinutes(1).create();
  decir('📂 Bot de documentos listo. Mándame una foto o un PDF (o varios seguidos si son del mismo documento) y te pregunto la carpeta.');
}

/** Si no sabes tu CHAT_ID: escribe «hola» al bot, ejecuta esta función y mira el registro de ejecución. */
function verMiChat() {
  (tg('getUpdates', { timeout: 0 }) || []).forEach(u => { const m = u.message || (u.callback_query || {}).message; if (m) console.log('CHAT_ID = ' + m.chat.id + ' (' + (m.chat.first_name || m.chat.title || '') + ')'); });
}

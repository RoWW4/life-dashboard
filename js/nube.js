'use strict';
/* Sincronización con Supabase (estado del panel y movimientos que deja el robot del banco). */
/* ---------- nube (Supabase) ---------- */
let sb = null, user = null, cloudOK = false, pushT = 0, BANK = null, PEND = [], syncTxt = '', cloudN = 0;
const cloudCfg = () => !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const localMode = () => { try { return localStorage.getItem('ldb-local')==='1'; } catch(e) { return false; } };
function setSync(t){ syncTxt = t; const e = $('#syncst'); if (e) e.textContent = t; }

/* Protección: no se sube a la nube una versión con menos de la mitad de elementos que la de la nube (p. ej. un
   navegador con datos de prueba o vacío), salvo que se confirme. cloudN = elementos de la última versión vista en la nube. */
const nItems = d => ['tasks','tx','fixed','docs','shop'].reduce((a,k) => a + (Array.isArray(d&&d[k]) ? d[k].length : 0), 0);
/* Además, ninguna sección con datos en la nube puede quedarse vacía sin confirmar (Inversiones, festivos, vacaciones, salud, reglas…). La compra no cuenta: se vacía a menudo. */
const SECS = {tasks:'Tareas', tx:'Movimientos', fixed:'Facturas', docs:'Documentos', rules:'Reglas', periods:'Vacaciones', localHol:'Festivos', sav:'Inversiones', salud:'Salud'};
const secOn = (d,k) => { const v = d && d[k]; return k==='sav' ? !!(v && (v.snaps||[]).length) : k==='salud' ? !!(v && (v.ini||[]).length) : Array.isArray(v) && v.length > 0; };
let cloudSec = [];
const lostSecs = () => cloudSec.filter(k => !secOn(S,k)).map(k => SECS[k]);
const tooSmall = () => (cloudN >= 10 && nItems(S) < cloudN/2) || lostSecs().length > 0;

function save(){
  S._ts = Date.now();
  try { localStorage.setItem(K, JSON.stringify(S)); } catch(e) { toast('No se pudo guardar en este dispositivo'); }
  if (cloudOK) { clearTimeout(pushT); setSync('Guardando…'); pushT = setTimeout(push, 900); }
}
/* Para no pisar cambios hechos en otro dispositivo (o directamente en Supabase):
   BASE = última versión de la nube con la que este dispositivo estaba al día (se guarda en el dispositivo).
   Antes de subir se mira la nube: si cambió desde BASE, se juntan los cambios de los dos lados (merge3) en vez de sustituir. */
const KB = 'ldb-base';
let BASE = (() => { try { return JSON.parse(localStorage.getItem(KB)); } catch(e) { return null; } })();
const setBase = d => { BASE = d; try { localStorage.setItem(KB, JSON.stringify(d)); } catch(e) {} };
const dirty = () => !BASE || (S._ts||0) !== (BASE._ts||0);
/* JSON con las claves ordenadas: Supabase (jsonb) devuelve las claves en otro orden. */
const cj = v => JSON.stringify(v, (k,x) => x && typeof x==='object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o,y) => (o[y] = x[y], o), {}) : x);
const isObj = v => !!v && typeof v==='object' && !Array.isArray(v);
/* Junta tres versiones: b (la común), m (este dispositivo) y t (la nube). Lo que solo cambió un lado se queda;
   en las listas se compara elemento a elemento (por id, o por contenido si no tienen id); si los dos cambiaron lo mismo, gana este dispositivo. */
function merge3(b, m, t){
  if (cj(m) === cj(b)) return t;
  if (cj(t) === cj(b) || cj(t) === cj(m)) return m;
  if (Array.isArray(m) && Array.isArray(t)) return mergeArr(Array.isArray(b) ? b : [], m, t);
  if (isObj(m) && isObj(t)) {
    const bb = isObj(b) ? b : {}, o = {};
    new Set([...Object.keys(t), ...Object.keys(m)]).forEach(k => {
      const v = k in m ? (k in t ? merge3(bb[k], m[k], t[k]) : (k in bb && cj(m[k]) === cj(bb[k]) ? undefined : m[k]))
                       : (k in bb && cj(t[k]) === cj(bb[k]) ? undefined : t[k]);
      if (v !== undefined) o[k] = v;
    });
    return o;
  }
  return m;
}
function mergeArr(b, m, t){
  const all = [...b, ...m, ...t], byId = all.length > 0 && all.every(x => isObj(x) && x.id != null),
    key = x => byId ? 'i:'+x.id : cj(x), map = a => new Map(a.map(x => [key(x), x])), B = map(b), M = map(m), T = map(t), out = [];
  t.forEach(x => { const k = key(x);
    if (M.has(k)) out.push(B.has(k) ? merge3(B.get(k), M.get(k), x) : M.get(k));
    else if (!(B.has(k) && cj(B.get(k)) === cj(x))) out.push(x); });          // borrado aquí y sin tocar en la nube → fuera
  m.forEach(x => { const k = key(x); if (T.has(k)) return;
    if (!(B.has(k) && cj(B.get(k)) === cj(x))) out.push(x); });               // nuevo aquí, o cambiado aquí aunque la nube lo borrara
  return out;
}
/* Junta lo de este dispositivo con la versión de la nube y lo deja guardado en el dispositivo. */
function mergeInto(remote){
  const before = cj(S);
  S = normalize(merge3(BASE || {}, S, remote)); S._ts = Math.max(Date.now(), (remote._ts||0) + 1);
  try { localStorage.setItem(K, JSON.stringify(S)); } catch(e) {}
  return cj(S) !== before;
}
async function push(force){
  pushT = 0;
  if (!sb || !user || !cloudOK) return;
  // 1) ¿Ha cambiado la nube desde la última vez? Entonces se juntan los cambios antes de subir.
  const cur = await sb.from('ldb_state').select('data').eq('user_id', user.id).maybeSingle();
  if (cur.error) { setSync('⚠️ Error al sincronizar'); return; }
  const remote = cur.data && cur.data.data;
  if (remote) {
    cloudN = nItems(remote); cloudSec = Object.keys(SECS).filter(k => secOn(remote,k));
    if ((remote._ts||0) === (S._ts||0)) { setBase(remote); setSync('☁️ Sincronizado'); return; }
    if (!BASE || (remote._ts||0) !== (BASE._ts||0)) { mergeInto(remote); render(); toast('Había cambios de otro dispositivo: se han juntado con los tuyos'); }
  }
  // 2) Protección: no vaciar secciones ni perder muchos datos sin confirmar.
  if (!force && tooSmall()) { setSync('⚠️ Sin subir'); const ls = lostSecs(); return CF(ls.length ? `En este dispositivo está vacío lo que en la nube tiene datos: ${ls.join(', ')}. ¿Subirlo y borrar eso de la nube?` : `Este dispositivo tiene muchos menos datos que la nube (${nItems(S)} frente a ${cloudN} elementos). ¿Subirlos y sustituir los de la nube?`, () => push(true)); }
  // 3) Se sube una copia fija (si se edita mientras sube, ese cambio se subirá en la siguiente vuelta).
  const snap = JSON.parse(JSON.stringify(S));
  const { error } = await sb.from('ldb_state').upsert({user_id:user.id, data: force ? {...snap, _force:true} : snap, updated_at:new Date().toISOString()});
  if (error && /ldb_guard/.test(error.message||'')) { setSync('⚠️ Sin subir'); return CF('La nube no ha aceptado el cambio porque vaciaría una sección o borraría muchos datos. ¿Seguro que quieres hacerlo?', () => push(true)); }
  if (!error) { setBase(snap); cloudN = nItems(snap); cloudSec = Object.keys(SECS).filter(k => secOn(snap,k)); if (dirty() && cloudOK && !pushT) pushT = setTimeout(push, 900); }
  setSync(error ? '⚠️ Error al sincronizar' : '☁️ Sincronizado');
}
async function cloudInit(){
  if (!cloudCfg() || localMode()) { setSync('📱 Solo este dispositivo'); return 'local'; }
  if (!window.supabase) { setSync('⚠️ Sin conexión'); return 'offline'; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const { data } = await sb.auth.getSession();
  if (!data.session) return 'login';
  user = data.session.user;
  await pull();
  return 'ok';
}
/* Trae el estado de la nube. Si este dispositivo no tiene cambios sin subir, se queda con la nube;
   si los tiene, push() los junta con lo de la nube y sube el resultado. */
async function pull(){
  if (!sb || !user || pushT) return false;
  try {
    const { data, error } = await sb.from('ldb_state').select('data').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const remote = data && data.data; let changed = false;
    if (remote) { cloudN = nItems(remote); cloudSec = Object.keys(SECS).filter(k => secOn(remote,k)); }
    const wasOK = cloudOK; cloudOK = true;
    if (!remote) await push();
    else if ((remote._ts||0) === (S._ts||0)) setBase(remote);
    else if (!dirty() || (!BASE && (remote._ts||0) > (S._ts||0))) { S = normalize(remote); localStorage.setItem(K, JSON.stringify(S)); setBase(remote); changed = true; }
    else { await push(); changed = true; }
    if (await pullBank()) changed = true;
    setSync('☁️ Sincronizado');
    return changed || !wasOK;
  } catch(e) { cloudOK = false; setSync('⚠️ Sin sincronizar'); return false; }
}
/* Movimientos que el robot diario ha dejado en bank_tx y aún no hemos incorporado. */
async function pullBank(){
  let q = sb.from('bank_tx').select('id,booking_date,amount,description,created_at').order('created_at',{ascending:true}).limit(1000);
  if (S.bankLast) q = q.gt('created_at', S.bankLast);
  const { data, error } = await q;
  const st = await sb.from('bank_status').select('valid_until,last_sync,last_error,session_id,fail_count,balance,balance_at').eq('user_id', user.id).maybeSingle();
  BANK = st.data || null;
  // Retenciones y bizums que el banco aún no ha confirmado: se muestran aparte y no se guardan en S.tx.
  const pd = await sb.from('bank_pending').select('id,booking_date,amount,description').order('booking_date',{ascending:false});
  const np = pd.error ? PEND : (pd.data||[]).map(p => ({...p, amount:+p.amount})), pc = JSON.stringify(np) !== JSON.stringify(PEND); PEND = np;
  if (error || !data || !data.length) return pc;
  const r = ingest(data.map(d => ({id:d.id, date:d.booking_date, amt:+d.amount, desc:d.description||''})), 'bank');
  S.bankLast = data[data.length-1].created_at; save();
  if (r.add || r.link) toast(`🏦 Banco: ${r.add} nuevos · ${r.link} enlazados con fijos o facturas`);
  return true;
}


'use strict';
/* Sincronización con Supabase (estado del panel y movimientos que deja el robot del banco). */
/* ---------- nube (Supabase) ---------- */
let sb = null, user = null, cloudOK = false, pushT = 0, BANK = null, PEND = [], syncTxt = '';
const cloudCfg = () => !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const localMode = () => { try { return localStorage.getItem('ldb-local')==='1'; } catch(e) { return false; } };
function setSync(t){ syncTxt = t; const e = $('#syncst'); if (e) e.textContent = t; }

function save(){
  S._ts = Date.now();
  try { localStorage.setItem(K, JSON.stringify(S)); } catch(e) { toast('No se pudo guardar en este dispositivo'); }
  if (cloudOK) { clearTimeout(pushT); setSync('Guardando…'); pushT = setTimeout(push, 900); }
}
async function push(){
  pushT = 0;
  if (!sb || !user || !cloudOK) return;
  const { error } = await sb.from('ldb_state').upsert({user_id:user.id, data:S, updated_at:new Date().toISOString()});
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
/* Trae el estado de la nube; gana la versión más reciente (_ts). */
async function pull(){
  if (!sb || !user || pushT) return false;
  try {
    const { data, error } = await sb.from('ldb_state').select('data').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const remote = data && data.data; let changed = false;
    if (remote && (remote._ts||0) > (S._ts||0)) { S = normalize(remote); localStorage.setItem(K, JSON.stringify(S)); changed = true; }
    const wasOK = cloudOK; cloudOK = true;
    if (!remote || (S._ts||0) > (remote._ts||0)) await push();
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
  const st = await sb.from('bank_status').select('valid_until,last_sync,last_error,session_id,fail_count').eq('user_id', user.id).maybeSingle();
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


'use strict';
/* Entrada rápida y por voz: interpreta frases como tareas, compras, gastos o vacaciones. */
/* ---------- entrada rápida / voz ---------- */
function addShop(txt){
  let n = 0;
  String(txt||'').split(/,|;| y | más /i).map(x => x.trim()).filter(Boolean).forEach(x => {
    const m = x.match(/^(\d+|un|una|uno|dos|tres|cuatro|cinco|seis)\s+(.+)/i), q = m ? (+m[1] || NW[m[1].toLowerCase()]) : 1, name = cap(m ? m[2] : x);
    if (!S.shop.some(y => !y.done && y.name.toLowerCase()===name.toLowerCase())) { S.shop.push({id:id(), name, qty:q, price:0, done:false}); n++; }
  });
  return n;
}
/* Intérprete de frases habladas o escritas.
   «añádeme una tarea para descargar las nóminas y subirlas a Drive para la semana que viene en la categoría finanzas»
   → tarea «Descargar las nóminas y subirlas a Drive» · Finanzas · lunes siguiente. */
const DOW = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const NUMW = {un:1,una:1,uno:1,primero:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiun:21,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,'treinta y uno':31};
const num = s => +s || NUMW[nt(s).trim()] || 0;
/* Día del mes dicho con número o con letras («30», «treinta», «treinta y uno»). */
const DW = String.raw`(\d{1,2}|treinta\s+y\s+uno|primero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veinti[uú]no?|veintid[oó]s|veintitr[eé]s|veinticuatro|veinticinco|veintis[eé]is|veintisiete|veintiocho|veintinueve|treinta)`;
const AREA_SYN = [['Mascotas',/^(mascotas?|gatos?|perros?)\b/],['Salud y bienestar',/^(salud( y bienestar)?|bienestar|deporte)\b/],['Familia y amigos',/^(familia( y amigos)?|amigos)\b/],['Hogar',/^(hogar|casa)\b/],['Finanzas',/^(finanzas|dinero|papeles|banco)\b/],['Cumpleaños',/^cumpleanos\b/],['Coche',/^coches?\b/],['Ocio',/^ocio\b/],['Trabajo',/^trabajo\b/],['Personal',/^personal\b/],['Otros',/^otros?\b/]];
const PRE = String.raw`(?:(?:para|antes\s+del?|de\s+cara\s+a|hasta|como\s+muy\s+tarde)\s+)?`;
const dlabel = d => cap(new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'short'}).format(new Date(d+'T00:00')));

function parseTask(src){
  let t = ' ' + String(src).replace(/[.!?¿¡"«»]+/g,' ').replace(/\s+/g,' ').trim() + ' ', m, due = '', tm = '', pr = 'Media', area = '';
  const cut = re => { const r = t.match(re); if (r) t = t.slice(0, r.index) + ' ' + t.slice(r.index + r[0].length); return r; };
  const today = new Date(), dow = today.getDay();
  // 1) Frases de petición: «añádeme», «recuérdame que», «crea una tarea para»…
  for (let k = 0; k < 3; k++) t = ' ' + t
    .replace(/^\s*(?:por\s+favor,?\s*)?(?:a[ñn][aá]d[ei]r?|crea[r]?|cr[eé]a|p[oó]n(?:er)?|ap[uú]nta[r]?|an[oó]ta[r]?|recu[eé]rda|recordar|necesito|tengo\s+que|hay\s+que|quiero|me\s+gustar[ií]a)(?:me|nos)?(?:\s+que)?\s+/i, '')
    .replace(/^\s*(?:una?\s+)?(?:nueva\s+)?(?:tarea|recordatorio|nota)\b\s*(?:para|de|que|:|,)?\s*/i, '')
    .trim() + ' ';
  // 2) Prioridad
  if (cut(/\s(?:(?:es|que\s+es)\s+)?(?:muy\s+)?urgente\b/i)) pr = 'Urgente';
  else if (cut(/\s(?:(?:es|que\s+es)\s+)?(?:muy\s+)?importante\b|\scon\s+prioridad\s+alta\b|\sprioridad\s+alta\b/i)) pr = 'Alta';
  // 3) Categoría dicha: «en la categoría finanzas», «en el área de mascotas»
  const am = t.match(/\s(?:(?:en|a|para|dentro\s+de)\s+)?(?:(?:la|el)\s+)?(?:categor[ií]a|[aá]rea|lista|secci[oó]n)\s+(?:de\s+)?/i);
  if (am) { const rest = t.slice(am.index + am[0].length), nr = nt(rest).trim();
    for (const [a, re] of AREA_SYN) { const mm = nr.match(re); if (mm) { area = a; t = t.slice(0, am.index) + ' ' + rest.trim().split(/\s+/).slice(mm[0].trim().split(' ').length).join(' ') + ' '; break; } } }
  // 4) Hora: «a las 10», «a la una y media de la tarde», «por la mañana»
  if ((m = cut(/\s(?:a|sobre|hacia)\s+(?:eso\s+de\s+)?las?\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:[:.h](\d{2}))?(\s+y\s+media|\s+y\s+cuarto|\s+menos\s+cuarto)?(?:\s+(?:en\s+punto))?(?:\s+(?:de\s+la|por\s+la)\s+(mañana|tarde|noche))?/i))) {
    let hh = num(m[1]), mi = +(m[2]||0); if (/media/.test(m[3]||'')) mi = 30; else if (/y cuarto/.test(m[3]||'')) mi = 15; else if (/menos/.test(m[3]||'')) { hh--; mi = 45; }
    if ((m[4] && /tarde|noche/i.test(m[4]) && hh < 12) || (!m[4] && hh >= 1 && hh <= 7)) hh += 12;
    tm = p2(hh % 24)+':'+p2(mi);
  }
  if ((m = cut(/\s(?:por\s+la|de\s+la|a\s+media)\s+(mañana|tarde|noche)\b|\sa\s+mediod[ií]a\b/i)) && !tm) tm = /mañana/i.test(m[0]) ? '09:00' : /mediod/i.test(m[0]) ? '14:00' : /tarde/i.test(m[0]) ? '17:00' : '21:00';
  // 5) Fecha
  const D = (re, fn) => { if (due) return; const r = cut(new RegExp('\\s' + PRE + re, 'i')); if (r) due = fn(r); };
  D(String.raw`pasado\s+mañana\b`, () => addD(TD(),2));
  D(String.raw`mañana\b`, () => addD(TD(),1));
  D(String.raw`(?:hoy|esta\s+(tarde|noche))\b`, r => { if (r[1] && !tm) tm = /tarde/i.test(r[1]) ? '17:00' : '21:00'; return TD(); });
  D(String.raw`(?:(?:en|durante)\s+)?(?:la\s+)?(?:semana\s+que\s+viene|pr[oó]xima\s+semana|semana\s+pr[oó]xima)\b`, () => addD(TD(), (1 - dow + 7) % 7 || 7));
  D(String.raw`(?:este\s+|el\s+)?(?:fin\s+de\s+semana|finde)\b`, () => addD(TD(), (6 - dow + 7) % 7));
  D(String.raw`(?:el\s+)?(?:mes\s+que\s+viene|pr[oó]ximo\s+mes)\b`, () => iso(new Date(today.getFullYear(), today.getMonth()+1, 1)));
  D(String.raw`a\s+final(?:es)?\s+de(?:l)?\s+mes\b`, () => iso(new Date(today.getFullYear(), today.getMonth()+1, 0)));
  D(String.raw`(?:en|dentro\s+de)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte)\s+(d[ií]as?|semanas?|mes(?:es)?)\b`, r => /mes/i.test(r[2]) ? addM(TD(), num(r[1])) : addD(TD(), num(r[1]) * (/seman/i.test(r[2]) ? 7 : 1)));
  D(String.raw`(?:el\s+)?(?:pr[oó]ximo\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?:\s+(?:que\s+viene|pr[oó]ximo))?\b`, r => addD(TD(), (DOW.indexOf(nt(r[1]).trim()) - dow + 7) % 7 || 7));
  D(String.raw`(?:el\s+)?(?:d[ií]a\s+)?${DW}\s+de\s+(${MESES.join('|')})(?:\s+(?:de|del)\s+(\d{4}))?\b`, r => { let d = (r[3]||today.getFullYear())+'-'+p2(MESES.indexOf(r[2].toLowerCase())+1)+'-'+p2(num(r[1])); if (!r[3] && d < TD()) d = addM(d,12); return d; });
  D(String.raw`(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b`, r => { let d = (r[3] ? (r[3].length===2 ? '20'+r[3] : r[3]) : today.getFullYear())+'-'+p2(r[2])+'-'+p2(r[1]); if (!r[3] && d < TD()) d = addM(d,12); return d; });
  D(String.raw`(?:el\s+(?:d[ií]a\s+)?|d[ií]a\s+)${DW}\b`, r => { let d = MN(today)+'-'+p2(num(r[1])); if (d < TD()) d = addM(d,1); return d; });
  // 6) Título limpio
  t = t.replace(/\s+/g,' ').trim().replace(/^(?:y|de|que|para|a)\s+/i,'');
  for (let k = 0; k < 3; k++) t = t.replace(/[\s,;:]+$/,'').replace(/\s+(?:y|para|de|del|el|la|a|en|antes|como)$/i,'');
  return {title:cap(shorten(t)), due, tm, pr, area: area || guessArea(t)};
}
/* Convierte frases habladas en títulos cortos:
   «me voy de viaje a Olvera con la familia» → «Viaje a Olvera con familia»,
   «he quedado con Ana para cenar» → «Quedar con Ana para cenar», «tengo que llamar al taller» → «Llamar al taller». */
function shorten(t){
  const R = [
    [/^(?:yo\s+)?(?:me|nos)\s+(?:voy|vamos|iré|iremos|marcho|marchamos)\s+de\s+(viaje|vacaciones|excursi[oó]n|escapada|ruta)\s+(?:a|al|hacia|por)\s+/i, (m,k) => cap(k.toLowerCase())+' a '],
    [/^(?:yo\s+)?(?:me|nos)\s+(?:voy|vamos|iré|iremos)\s+(?:a|al)\s+/i, m => /al\s+$/i.test(m) ? 'Ir al ' : 'Ir a '],
    [/^(?:yo\s+)?(?:he|hemos)\s+quedado\s+con\s+/i, 'Quedar con '],
    [/^(?:yo\s+)?(?:tengo|tenemos)\s+(?:una?\s+)?(cita|reuni[oó]n|examen|revisi[oó]n|entrevista)\b/i, (m,k) => cap(k.toLowerCase())],
    [/^(?:yo\s+)?(?:tengo|tenemos|hay)\s+que\s+/i, ''],
    [/^(?:yo\s+)?(?:debo|debemos|necesito|necesitamos|quiero|queremos)\s+/i, ''],
    [/^(?:me|nos)\s+toca\s+/i, '']
  ];
  for (const [re, to] of R) if (re.test(t)) { t = t.replace(re, to); break; }
  return t.replace(/\s+con\s+(?:la|el|los|las)\s+/gi, ' con ').replace(/\s+/g,' ').trim();
}

/* Decide si la frase es compra, gasto/ingreso o tarea (sin guardar nada). */
/* Sustituye palabras completas según el diccionario (sin distinguir mayúsculas ni tildes en lo dicho). */
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const deacc = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'');
function fixText(s){
  for (const f of S.fixes) {
    if (!f.from || !f.to) continue;
    const pat = deacc(f.from).split('').map(c => /[a-z]/i.test(c) ? `${c}[\\u0300-\\u036f]?` : reEsc(c)).join('');
    s = s.normalize('NFD').replace(new RegExp(`(^|[^\\p{L}\\u0300-\\u036f])${pat}(?=$|[^\\p{L}\\u0300-\\u036f])`, 'giu'), (m,p) => p + f.to).normalize('NFC');
  }
  return s;
}
function interpret(src){
  const t = fixText(String(src).trim().replace(/[.!?]+$/,'')); let m;
  if ((m = t.match(/^(?:a[ñn][aá]de(?:me)?|ap[uú]nta(?:me)?|p[oó]n(?:me)?)\s+(.+?)\s+(?:a|en)\s+la\s+(?:lista\s+de\s+la\s+)?compra$/i))) return {k:'shop', items:m[1]};
  if ((m = t.match(/^(?:(?:a[ñn][aá]de(?:me)?|ap[uú]nta(?:me)?|p[oó]n(?:me)?)\s+)?(?:(?:a|en)\s+)?(?:la\s+)?(?:lista\s+de\s+la\s+compra|compra)[:,]?\s+(.+)/i))) return {k:'shop', items:m[1]};
  if ((m = t.match(/^(?:(?:a[ñn][aá]de(?:me)?|ap[uú]nta(?:me)?|an[oó]ta(?:me)?)\s+)?(?:un\s+)?(gasto|he\s+gastado|gast[eé]|pagu[eé]|ingreso|cobr[eé]|me\s+han\s+pagado)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:euros?|€)?\s*(?:en|de|por|del?)?\s*(.*)/i))) {
    const ty = /ingreso|cobr|pagado/i.test(m[1]) ? 'i' : 'g', desc = cap(m[3].trim()) || (ty==='i'?'Ingreso':'Gasto');
    return {k:'tx', ty, amt:pnum(m[2]), desc, cat: classify(desc, ty==='i'?'i':undefined)};
  }
  const vac = vacation(t); if (vac) return vac;
  return {k:'task', ...parseTask(t)};
}
/* «vacaciones el 30 de noviembre», «día libre el viernes», «vacaciones del 22 de diciembre al 6 de enero»
   → periodo de vacaciones (fondo verde en el calendario) en vez de tarea. */
function vacation(t){
  const n = nt(t); if (!/\b(vacaciones|dias?\s+libres?|puente)\b/.test(n) || /\ba\s+las?\s+\d/.test(n)) return null;
  const name = /\bpuente\b/.test(n) ? 'Puente' : /\blibres?\b/.test(n) ? (/\bdias\b/.test(n) ? 'Días libres' : 'Día libre') : 'Vacaciones';
  const M = `(${MESES.join('|')})`, Y = String.raw`(?:\s+(?:de|del)\s+(\d{4}))?`, mi = s => p2(MESES.indexOf(s.toLowerCase())+1);
  const fix = (d, y) => !y && d < TD() ? addM(d,12) : d;
  let m = t.match(new RegExp(String.raw`(?:del?|desde\s+el)\s+(?:d[ií]a\s+)?${DW}(?:\s+de\s+${M}${Y})?\s+(?:al|hasta\s+el|a)\s+(?:d[ií]a\s+)?${DW}\s+de\s+${M}${Y}`, 'i')), from, to;
  if (m) { const y = new Date().getFullYear();
    from = fix((m[3]||y)+'-'+mi(m[2]||m[5])+'-'+p2(num(m[1])), m[3]);
    to = (m[6]||from.slice(0,4))+'-'+mi(m[5])+'-'+p2(num(m[4])); if (to < from) to = addM(to,12); }
  else if ((m = t.match(/(?:del?|desde\s+el)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(?:al|hasta\s+el|a)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i))) {
    const yy = s => s ? (s.length===2 ? '20'+s : s) : '', y = new Date().getFullYear();
    from = fix((yy(m[3])||y)+'-'+p2(m[2])+'-'+p2(m[1]), m[3]);
    to = (yy(m[6])||from.slice(0,4))+'-'+p2(m[5])+'-'+p2(m[4]); if (to < from) to = addM(to,12); }
  else { from = to = parseTask(t).due; }
  return from ? {k:'vac', name, from, to} : null;
}
function preview(src){
  if (!String(src).trim()) return '';
  const r = interpret(src), c = (ic,txt,cls='') => `<span class="chip ${cls}">${I(ic,'sm')} ${esc(txt)}</span>`;
  if (r.k==='shop') return c('shopping-cart','Compra','ac') + ' ' + esc(r.items);
  if (r.k==='tx') return c(r.ty==='i'?'arrow-up-right':'arrow-down-left', r.ty==='i'?'Ingreso':'Gasto', r.ty==='i'?'ok':'er') + c(CI[r.cat]||'package', r.cat) + ` <b>${eur(r.amt)}</b> · ${esc(r.desc)}`;
  if (r.k==='vac') return c('sun', r.name, 'ok') + c('calendar-days', r.from===r.to ? dlabel(r.from) : fd(r.from)+' → '+fd(r.to));
  return c('list-checks','Tarea','ac') + c(AI[r.area]||'pin', r.area) + c('calendar-days', r.due ? dlabel(r.due)+(r.tm?' · '+r.tm:'') : 'Sin fecha', r.due?'':'wa') + (r.pr!=='Media' ? c('triangle-alert', r.pr, 'er') : '') + `<div class="vpt">${esc(r.title || '…')}</div>`;
}
function voice(src){
  const r = interpret(src);
  if (r.k==='shop') { const n = addShop(r.items); ch(); return toast('🛒 '+n+' producto(s) añadidos'); }
  if (r.k==='tx') { if (!(r.amt>0)) return toast('No he entendido el importe'); S.tx.push({id:id(), t:r.ty, amt:r.amt, cat:r.cat, date:TD(), desc:r.desc}); ch(); return toast(`💶 ${r.ty==='i'?'Ingreso':'Gasto'} de ${eur(r.amt)} en ${r.cat}`); }
  if (r.k==='vac') return addVac(r.name, r.from, r.to);
  if (!r.title) return toast('No he entendido la tarea');
  S.tasks.push({id:id(), title:r.title, due:r.due, tm:r.tm, pr:r.pr, area:r.area, rep:'', done:false}); ch();
  toast(`✅ Tarea en ${r.area}` + (r.due ? ' · ' + dlabel(r.due) + (r.tm ? ' ' + r.tm : '') : ' · sin fecha'));
}
function guessArea(t){
  const d = nt(t);
  const R = [['Coche',/coche|itv|taller|gasolin|rueda|neumatic/],['Mascotas',/gato|perro|mascota|arena|pienso|veterinar/],['Salud y bienestar',/medic|gimnas|gym|dentist|bici|correr|farmacia|cita medica|analitica/],['Cumpleaños',/cumple/],['Finanzas',/banco|pagar|factura|hacienda|renta|nomina|irpf|recibo|transferencia|seguro|prestamo|declaracion/],['Ocio',/cine|concierto|viaje|teatro|serie|entradas/],['Trabajo',/trabajo|reunion|cliente|oficina|pixerama/],['Hogar',/casa|limpiar|lavadora|compra|fontanero|luz|agua/],['Familia y amigos',/mama|papa|abuel|herman|amig|tita|primo/]];
  return (R.find(([,r]) => r.test(d)) || ['Personal'])[0];
}


'use strict';
/* Panel de Rocío (Life Dashboard) · lógica de la app
   Datos: objeto S (mismo modelo que la versión artifact, clave localStorage 'ldb-v1').
   Nube opcional: Supabase (tabla ldb_state con el JSON completo + bank_tx con movimientos del banco). */

const CFG = window.LDB_CONFIG || {};
const K = 'ldb-v1';
const APP = 'Panel de Rocío';
/* Los iconos son nombres de Lucide (ver icons.js) */
const CATS = ['Vivienda','Alimentación','Transporte','Restaurantes','Ocio','Suscripciones','Salud','Mascotas','Compras','Viajes','Préstamos','Otros','Traspasos','Nómina'];
/* Traspasos: dinero que mueves entre tus propias cuentas. Se ve en la lista pero no cuenta como gasto ni ingreso. */
const NOCNT = 'Traspasos', EXMIN = 300; // desde este importe un gasto ofrece marcarse como extraordinario
const CI = {Traspasos:'arrow-left-right',Vivienda:'house',Alimentación:'shopping-basket',Transporte:'fuel',Restaurantes:'utensils',Ocio:'clapperboard',Suscripciones:'tv',Salud:'heart-pulse',Mascotas:'paw-print',Compras:'shopping-bag',Viajes:'plane',Préstamos:'hand-coins',Otros:'package',Nómina:'briefcase'};
const PAL = {Traspasos:'#64748b',Vivienda:'#0099ff',Alimentación:'#2fcf7a',Transporte:'#f5a524',Restaurantes:'#ff6b6b',Ocio:'#a78bfa',Suscripciones:'#22d3ee',Salud:'#f472b6',Mascotas:'#c08457',Compras:'#d946ef',Viajes:'#84cc16',Préstamos:'#facc15',Otros:'#94a3b8',Nómina:'#2fcf7a'};
const AREAS = ['Coche','Mascotas','Salud y bienestar','Ocio','Personal','Hogar','Trabajo','Finanzas','Familia y amigos','Otros','Cumpleaños'];
const AI = {Personal:'user',Hogar:'house',Trabajo:'briefcase','Salud y bienestar':'dumbbell',Finanzas:'piggy-bank','Familia y amigos':'users',Cumpleaños:'cake',Coche:'car',Mascotas:'paw-print',Ocio:'gamepad-2',Otros:'pin'};
const AC = {Personal:'#0099ff',Hogar:'#38bdf8',Trabajo:'#94a3b8','Salud y bienestar':'#2fcf7a',Finanzas:'#facc15','Familia y amigos':'#f472b6',Cumpleaños:'#e879f9',Coche:'#f5a524',Mascotas:'#c08457',Ocio:'#a78bfa',Otros:'#94a3b8'};
const PR = ['Baja','Media','Alta','Urgente'], REP = ['Diaria','Semanal','Mensual','Anual'];
const FQ = {Única:0,Mensual:1,Trimestral:3,Semestral:6,Anual:12};
const DC = ['Identidad','Coche','Hogar','Salud','Finanzas','Mascotas','Trabajo','Otros'];
const DI = {Identidad:'id-card',Coche:'car',Hogar:'house',Salud:'stethoscope',Finanzas:'landmark',Mascotas:'paw-print',Trabajo:'briefcase',Otros:'file-text'};
const DCOL = {Identidad:'#0099ff',Coche:'#f5a524',Hogar:'#38bdf8',Salud:'#f472b6',Finanzas:'#facc15',Mascotas:'#c08457',Trabajo:'#94a3b8',Otros:'#94a3b8'};
const DIA = ['shop','prox','cal','fact','gasto','docs'];
/* Orden inicial de los paneles movibles de cada sección (cada uno se puede reordenar y se guarda en S.order). */
const FIN = ['gasto','sinc','mov','cats','bank','reglas'];
const AJ = ['cuenta','apar','bank','copias','fest','dict','avz'];
const SEC = [['dia','house','Mi día','Hoy'],['tareas','list-checks','Tareas','Tareas'],['compra','shopping-cart','Compra','Compra'],['fin','wallet','Finanzas','Dinero'],['fact','receipt','Facturas','Facturas'],['docs','folder-open','Documentos','Docs'],['inv','trending-up','Inversiones','Inversión'],['salud','heart-pulse','Salud','Salud'],['ajus','settings','Ajustes','Ajustes']];
/* En el móvil la barra inferior muestra solo estas; el resto va en «Más». */
// Pestañas fijas de la barra inferior en el móvil (el resto va en «Más»); se eligen en Ajustes.
const BAR0 = ['dia','tareas','fin','inv'], BARMAX = 4;
const FAILMAX = 3; // fallos seguidos del banco antes de avisar (y de que GitHub mande correo)
const bar = () => S.bar && S.bar.length ? S.bar : BAR0;
const secs = () => ord('nav', SEC.map(x => x[0])).map(k => SEC.find(x => x[0]===k)); // secciones en el orden elegido (en el ordenador se arrastran en el menú)
const MS = ['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const KW = [[/cumplea/i,'cake'],[/vacun/i,'syringe'],[/comida|arena/i,'shopping-basket'],[/itv|revisi/i,'wrench'],[/seguro|p[oó]liza/i,'shield-check'],[/document/i,'file-text'],[/gym|gimnas/i,'dumbbell'],[/bici|carrera/i,'bike'],[/cine|pel[ií]cula/i,'clapperboard'],[/black friday|oferta/i,'tag'],[/llamar|tel[eé]fono/i,'phone'],[/m[eé]dico|cita/i,'stethoscope']];
const NW = {un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6};

/* Palabras clave para clasificar movimientos del banco (las reglas propias tienen prioridad). */
const KWC = [
  ['Nómina',[' nomina']],
  ['Préstamos',[' prestamo',' financiacion']],
  ['Mascotas',[' veterinari',' kiwoko',' tiendanimal',' zooplus',' mascota',' piensos',' animalia']],
  ['Vivienda',[' alquiler',' comunidad de prop',' ibi ',' endesa',' iberdrola',' naturgy',' holaluz',' totalenergies',' aguas ',' canal de isabel',' emasesa',' seguro hogar',' butano']],
  ['Suscripciones',[' netflix',' spotify',' hbo',' disney',' prime video',' amazon prime',' google ',' apple com',' icloud',' youtube',' lastpass',' openai',' chatgpt',' anthropic',' claude',' movistar',' vodafone',' orange ',' digi ',' pepephone',' masmovil',' lowi',' o2 ',' simyo']],
  ['Alimentación',[' mercadona',' carrefour',' lidl',' aldi',' alcampo',' eroski',' consum',' hipercor',' ahorramas',' supermerc',' dia ',' supersol',' coviran',' spar ',' panaderia',' fruteria',' carniceria',' mas y mas']],
  ['Restaurantes',[' restaurante',' bar ',' ramen',' cafe',' burger',' mcdonald',' kfc',' telepizza',' domino',' just eat',' glovo',' uber eats',' pita',' sushi',' pizz',' tapas',' cerveceria',' taberna',' starbucks',' foster',' vips',' montaditos',' goiko',' tgb ']],
  ['Transporte',[' repsol',' e s ',' cepsa',' galp',' bp ',' shell',' gasolinera',' petronor',' ballenoil',' plenoil',' petroprix',' parking',' aparcamiento',' renfe',' metro ',' emt ',' taxi',' cabify',' uber ',' bolt ',' autopista',' peaje',' itv',' taller',' neumatic',' mapfre',' linea directa',' mutua madrilena']],
  ['Salud',[' farmacia',' gimnasio',' gym',' basic fit',' altafit',' clinica',' dentist',' dental',' hospital',' optica',' fisio',' sanitas',' adeslas',' dkv ']],
  ['Ocio',[' cine',' yelmo',' cinesa',' kinepolis',' teatro',' concierto',' entradas',' ticketmaster',' steam',' playstation',' nintendo',' museo']],
  ['Viajes',[' hotel',' booking',' airbnb',' ryanair',' vueling',' iberia',' easyjet',' aena',' alsa ',' blablacar',' expedia']],
  ['Compras',[' amazon',' amzn',' aliexpress',' zara',' primark',' decathlon',' ikea',' corte ingles',' mediamarkt',' fnac',' shein',' leroy merlin',' pccomponentes',' action ']]
];

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const id = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2,8);
const p2 = n => String(n).padStart(2,'0');
const iso = d => d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const TD = () => iso(new Date());
const MN = d => iso(d).slice(0,7), mon = s => s.slice(0,7);
const fd = s => s ? s.split('-').reverse().join('/') : '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = n => new Intl.NumberFormat('es-ES',{style:'currency',currency:S.cur||'EUR',useGrouping:'always'}).format(n||0);
const pnum = v => { const s = String(v ?? '').replace(/[\s€]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'); return parseFloat(s); };
const addM = (s,n) => { const [y,m,d] = s.split('-').map(Number), r = new Date(y,m-1+n,1); r.setDate(Math.min(d,new Date(r.getFullYear(),r.getMonth()+1,0).getDate())); return iso(r); };
const addD = (s,n) => { const [y,m,d] = s.split('-').map(Number); return iso(new Date(y,m-1,d+n)); };
const dd = (a,b) => Math.round((new Date(a+'T00:00') - new Date(b+'T00:00'))/864e5);
const dayDiff = s => dd(s, TD());
const nt = s => ' ' + String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim() + ' ';
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const opts = (arr,sel) => arr.map(x => `<option ${x===sel?'selected':''}>${esc(x)}</option>`).join('');
const hash = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i=0;i<s.length;i++){ const c=s.charCodeAt(i); h1=Math.imul(h1^c,2654435761); h2=Math.imul(h2^c,1597334677); } h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909); return (4294967296*(2097151&h2)+(h1>>>0)).toString(36); };
const rel = d => { if(!d) return 'sin fecha'; const n = dayDiff(d); return n<-1 ? 'hace '+(-n)+' d' : n===-1 ? 'ayer' : n===0 ? 'hoy' : n===1 ? 'mañana' : n<7 ? new Intl.DateTimeFormat('es-ES',{weekday:'long'}).format(new Date(d+'T00:00')) : n<31 ? 'en '+n+' d' : fd(d); };
const ago = t => { if(!t) return 'nunca'; const m = Math.round((Date.now()-new Date(t))/6e4); return m<2?'ahora mismo':m<60?'hace '+m+' min':m<1440?'hace '+Math.round(m/60)+' h':'hace '+Math.round(m/1440)+' d'; };


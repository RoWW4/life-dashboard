'use strict';
/* Secciones «Finanzas» e «Inversiones»: banco, ahorro, reglas, movimientos y bandeja «Sin clasificar». */
function bankCard(v) {
  let st;
  if (!cloudCfg())
    st =
      '<div class="mu">Para que los movimientos lleguen solos cada día, conecta la nube (Supabase) y el banco siguiendo la guía <b>LEEME.md</b>. Mientras tanto, puedes importar el archivo de Openbank.</div>';
  else if (!user) st = '<div class="mu">Modo local: inicia sesión para recibir los movimientos del banco.</div>';
  else if (!BANK || !BANK.session_id)
    st = '<div class="mu">Banco aún no conectado. Sigue la guía (paso 6) para activar la sincronización diaria.</div>';
  else {
    const vu = BANK.valid_until ? BANK.valid_until.slice(0, 10) : '',
      n = vu ? dayDiff(vu) : 999;
    st = `<div class="row"><span class="g">Última sincronización</span><span class="mu">${ago(BANK.last_sync)}</span></div><div class="row"><span class="g">Permiso del banco</span><span class="chip ${n < 0 ? 'er' : n <= 14 ? 'wa' : 'ok'}">${vu ? (n < 0 ? 'Caducado' : 'Hasta ' + fd(vu)) : '—'}</span></div>${BANK.last_error ? errFold('La última sincronización dio error', BANK.last_error) : ''}<div class="mu" style="margin-top:6px">El panel recoge los movimientos directamente del banco 4 veces al día (hacia las 6:43, 11:43, 15:43 y 20:43) y la app los muestra al abrirla. Para recogerlos en este momento: «Sincronizar ahora en GitHub» → <i>Run workflow</i>.</div>`;
  }
  if (user && BANKERR)
    st =
      `<div class="mu wa" style="margin-bottom:8px">${I('triangle-alert', 'sm')} No se ha podido comprobar el banco ahora (${esc(BANKERR)}). Lo de abajo puede no estar al día.</div>` +
      st;
  return panel(
    v,
    'bank',
    `${I('landmark')} Banco (Openbank)`,
    `${st}<div class="f" style="margin:12px 0 0"><label class="btn ghost" style="flex:none">${I('upload')} Importar movimientos (.xls de cuenta o prepago, o PDF de cuenta)<input type="file" id="bankfile" accept=".xls,.xlsx,.csv,.html,.htm,.txt,.pdf,application/pdf" hidden></label>${user ? `<a class="btn ghost" style="flex:none" href="https://github.com/RoWW4/life-dashboard/actions/workflows/bank-sync.yml" target="_blank" rel="noopener noreferrer">${I('external-link')} Sincronizar ahora en GitHub</a><a class="btn${BANK && BANK.session_id && !BANK.last_error && !(BANK.valid_until && dayDiff(BANK.valid_until.slice(0, 10)) < 0) ? ' ghost' : ''}" style="flex:none" href="https://github.com/RoWW4/life-dashboard/actions/workflows/bank-link.yml" target="_blank" rel="noopener noreferrer">${I('external-link')} Conectar con el banco</a>` : ''}</div>${user ? '<div class="mu" style="margin-top:6px">Si sincronizar falla o el permiso caduca: «Conectar con el banco» → <i>Run workflow</i> con el código vacío, entra en el banco con el enlace que aparece en el resultado, y vuelve a lanzarlo pegando el código que te muestra el panel.</div>' : ''}`
  );
}
/* Cuenta de ahorro (p. ej. una cuenta remunerada): aparte de los gastos, solo para consultar.
   S.sav = {name, rate (% anual bruto), tax (% de impuestos sobre intereses), snaps:[{id, d, bal, dep}]}
   y, si el banco avisa de un cambio, rate2 (% nuevo) y from2 (fecha desde la que se aplica).
   Cada apunte es el saldo en una fecha; dep = dinero que metiste (+) o sacaste (−) ese día.
   Lo ganado es el saldo menos lo aportado, así que los intereses netos salen solos. */
const SAV_TAX = 19;
const pct = n => n.toFixed(2).replace('.', ',').replace(/,?0+$/, '') + ' %';
const money = v => `<span class="money">${v}</span>`;
/* Estimación como la calcula la cuenta: interés diario (saldo × % anual / 365) que se acumula durante el mes;
   el día 1 se abona lo del mes anterior menos los impuestos (redondeados al céntimo). Se parte del último saldo real apuntado.
   El primer mes cuenta desde el día del primer apunte (apertura); los demás, desde el día 1. */
/* Apuntes con los que se calcula Inversiones: los manuales anteriores al primer saldo automático (savings_daily) y,
   desde ahí, el último saldo automático de cada mes (el del mes en curso es el más reciente). Las aportaciones y
   retiradas que trae el banco (savings_tx) se suman al apunte siguiente; los intereses no, porque son lo ganado.
   Si no hay apuntes a mano, se empieza por el primer saldo automático, que cuenta como aportado. Los automáticos llevan auto: true. */
function savSnaps(manual = (S.sav && S.sav.snaps) || [], daily = SAVD, tx = SAVT) {
  const M = [...manual].sort((a, b) => a.d.localeCompare(b.d));
  if (!daily.length) return M;
  const D = [...daily].sort((a, b) => a.d.localeCompare(b.d)),
    a0 = D[0].d,
    out = M.filter(x => x.d < a0),
    last = {};
  D.forEach(x => (last[x.d.slice(0, 7)] = x));
  const moves = tx.filter(t => t.kind === 'aporte' || t.kind === 'retirada'),
    L = Object.values(last);
  // Sin apuntes a mano se empieza por el primer día automático (como si fuera la apertura).
  if (!out.length && L[0] !== D[0]) L.unshift(D[0]);
  let prev = out.length ? out[out.length - 1].d : null;
  L.forEach(x => {
    const dep = prev === null ? x.bal : moves.filter(t => t.d > prev && t.d <= x.d).reduce((a, t) => a + t.amt, 0);
    out.push({ id: 'auto:' + x.d, d: x.d, bal: x.bal, dep: Math.round(dep * 100) / 100, auto: true });
    prev = x.d;
  });
  return out;
}
/* % anual bruto que se aplica un día concreto (el nuevo desde from2, si lo hay). */
const savRate = (s, d) => (s.rate2 != null && s.from2 && d >= s.from2 ? s.rate2 : s.rate || 0) / 100;
/* Suma de los tipos diarios (rate/365) de n días seguidos desde d: interés bruto = saldo × esto. */
const savDays = (s, d, n) => {
  let t = 0;
  for (let i = 0; i < n; i++) t += savRate(s, addD(d, i)) / 365;
  return t;
};
function savStats() {
  const s = S.sav,
    L = savSnaps();
  if (!L.length) return null;
  const last = L[L.length - 1],
    dep = L.reduce((a, x) => a + (x.dep || 0), 0),
    td = TD();
  const rate = savRate(s, TD()),
    tx = (s.tax ?? SAV_TAX) / 100,
    net = rate * (1 - tx),
    m1 = d => d.slice(0, 8) + '01',
    r2 = v => Math.round(v * 100) / 100,
    dim = d => new Date(+d.slice(0, 4), +d.slice(5, 7), 0).getDate(),
    st0 = last.d === L[0].d ? last.d : m1(last.d),
    // abonos de los días 1 desde el último apunte: [{d, bal, int (neto)}]
    pay = [];
  {
    let bal = last.bal,
      from = st0;
    for (let k = 0; k < 400 && pay.length < 30; k++) {
      const nd = addM(m1(from), 1),
        days = dim(from) - +from.slice(8) + 1,
        g = r2(bal * savDays(s, from, days)),
        n = r2(g - r2(g * tx));
      bal = r2(bal + n);
      pay.push({ d: nd, bal, int: n });
      from = nd;
    }
  }
  const at = d => {
    let b = last.bal;
    for (const p of pay) if (p.d <= d) b = p.bal;
    return b;
  };
  const now = at(td),
    est = pay.some(p => p.d <= td),
    next = addM(m1(td), 1),
    days = dd(td, L[0].d);
  // Interés que se va generando este mes, como lo enseña el banco: bruto y por días ya terminados (hasta ayer).
  // accG = bruto; acc = neto (lo que se cobrará el día 1 del siguiente, ya sin impuestos).
  const from = td.slice(0, 7) === st0.slice(0, 7) ? st0 : m1(td),
    accG = now * savDays(s, from, Math.max(0, dd(td, from))),
    acc = accG * (1 - tx);
  const proj = pay.filter(p => p.d > td).slice(0, 12);
  const y1 = at(addM(td, 12));
  return {
    L,
    last,
    dep,
    now,
    est,
    acc,
    accG,
    next,
    gain: now - dep,
    net,
    proj,
    y1,
    real: days >= 28 && dep > 0 ? ((((now - dep) / dep) * 365) / days) * 100 : null
  };
}
/* Barras de intereses netos por el mes en que se ganan (se cobran el día 1 del mes siguiente):
   cobrado (según los saldos apuntados), generado este mes aún sin cobrar y previsto. */
function savChart(st) {
  const M = {},
    add = (m, k, v) => {
      (M[m] = M[m] || { r: 0, g: 0, p: 0 })[k] += v;
    },
    cm = MN(new Date());
  st.L.forEach((x, i) => {
    if (!i) return;
    const a = st.L[i - 1],
      ms = [];
    // la subida entre dos apuntes viene de los abonos de los días 1 entre ellos; cada uno es el interés del mes anterior
    for (let m = mAdd(mon(a.d), 1); m <= mon(x.d); m = mAdd(m, 1)) ms.push(mAdd(m, -1));
    const v = x.bal - a.bal - (x.dep || 0);
    ms.forEach(m => add(m, 'r', v / ms.length));
  });
  st.proj.forEach(p => {
    const m = mAdd(mon(p.d), -1);
    if (m === cm) {
      add(m, 'g', Math.min(st.acc, p.int));
      add(m, 'p', Math.max(0, p.int - st.acc));
    } else add(m, 'p', p.int);
  });
  const keys = [];
  for (let m = mon(st.L[0].d), end = st.proj.length ? mAdd(mon(st.proj[st.proj.length - 1].d), -1) : cm; m <= end; m = mAdd(m, 1))
    keys.push(m);
  const K = keys.slice(-13),
    mx = Math.max(1, ...K.map(k => (M[k] ? M[k].r + M[k].g + M[k].p : 0)));
  return `<div class="savbars" role="img" aria-label="Intereses netos por mes">${K.map(k => {
    const v = M[k] || { r: 0, g: 0, p: 0 },
      t = Math.max(0, v.r + v.g + v.p),
      tip = [v.r && eur(v.r) + ' cobrado', v.g && eur(v.g) + ' generado hasta hoy', v.p && eur(v.p) + ' previsto']
        .filter(Boolean)
        .join(' + ');
    return `<div class="${k === cm ? 'now' : ''}" title="${mLabel(k)}: ${tip || eur(0)}"><em>${t ? t.toFixed(2).replace('.', ',') + ' €' : ''}</em><i style="height:${(t / mx) * 100}%">${v.g ? `<b class="g" style="height:${(v.g / t) * 100}%"></b>` : ''}<b style="height:${t ? (Math.max(0, v.r) / t) * 100 : 0}%"></b></i><span>${cap(MS[+k.slice(5)])}</span></div>`;
  }).join('')}</div>
    <div class="savlg"><span><i></i>Cobrado</span><span><i class="g"></i>Generado este mes</span><span><i class="p"></i>Previsto</span><span class="mu">Interés neto de cada mes; se cobra el día 1 del siguiente</span></div>`;
}
/* «¿Cuánto ganaría si lo mantengo?»: desde el saldo de hoy, mes a mes como la cuenta (interés diario con el tipo de
   cada día, abono neto el día 1 que vuelve a generar intereses) más lo que se meta cada mes (simulación, no se guarda).
   Solo cuenta el interés desde hoy. Devuelve, por cada plazo en años, {g bruto, n neto, put metido, bal saldo final}. */
let savAp = 0,
  savSel = 5;
function savPlazos(st, ap, P) {
  const s = S.sav,
    tx = (s.tax ?? SAV_TAX) / 100,
    r2 = v => Math.round(v * 100) / 100,
    td = TD(),
    end = P.map(y => addM(td, 12 * y)),
    out = {};
  let bal = st.now,
    from = td,
    g = 0,
    n = 0,
    put = 0;
  for (let k = 0; k <= 12 * Math.max(...P) + 1; k++) {
    const nd = addM(from.slice(0, 8) + '01', 1),
      days = dd(nd, from),
      gi = r2(bal * savDays(s, from, days)),
      ni = r2(gi - r2(gi * tx));
    P.forEach((y, i) => {
      if (!out[y] && nd > end[i]) out[y] = { g, n, put, bal };
    });
    g += gi;
    n += ni;
    bal = r2(bal + ni + ap);
    put += ap;
    from = nd;
  }
  return out;
}
function savPz(st) {
  const P = exp.savy20 ? [1, 3, 5, 10, 20] : [1, 3, 5, 10],
    R = savPlazos(st, savAp, P),
    tax = S.sav.tax ?? SAV_TAX,
    // sin céntimos: son previsiones a años vista
    e0 = v =>
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: S.cur || 'EUR',
        maximumFractionDigits: 0,
        useGrouping: 'always'
      }).format(Math.round(v || 0));
  return `<div class="pzhd"><span>Plazo</span><span>Ganado neto</span><span>Saldo final</span></div><div class="pz">${P.map(y => {
    const r = R[y],
      on = y === savSel;
    return `<div class="pzr${on ? ' on' : ''}" role="button" tabindex="0" data-a="savsel" data-i="${y}" aria-expanded="${on}"><div class="pzh"><span>${y} año${y > 1 ? 's' : ''}</span><b>${money('+' + e0(r.n))}</b><i>${money(e0(r.bal))}</i></div>${
      on
        ? `<div class="pzd"><span>Intereses brutos</span><b>${money(e0(r.g))}</b><span>Impuestos (${tax} %)</span><b>${money('−' + e0(r.g - r.n))}</b><span>Intereses netos</span><b class="ok">${money('+' + e0(r.n))}</b>${r.put ? `<span>Lo que habrías metido (${e0(savAp)} al mes)</span><b>${money(e0(r.put))}</b>` : ''}<span>Saldo de hoy</span><b>${money(e0(st.now))}</b></div>`
        : ''
    }</div>`;
  }).join('')}</div><button class="chip pzmas" data-a="xp" data-i="savy20">${exp.savy20 ? 'Quitar 20 años' : '+ Ver 20 años'}</button>`;
}
/* Al escribir en la casilla solo se repinta la tabla, para no perder el cursor. */
function savPzRefresh() {
  const el = document.getElementById('savpz'),
    st = el && savStats();
  if (st) el.innerHTML = savPz(st);
}
function savCard() {
  const s = S.sav;
  if (!s)
    return panel(
      'inv',
      'ahorro',
      `${I('piggy-bank')} Ahorros`,
      `<div class="mu" style="margin-bottom:10px">Sigue aquí tu cuenta de ahorro (por ejemplo una cuenta remunerada): saldo, intereses y evolución, sin mezclarlo con tus gastos.</div><button class="btn" data-a="savcfg">${I('plus')} Configurar cuenta de ahorro</button>`,
      'wide'
    );
  const st = savStats(),
    tax = s.tax ?? SAV_TAX;
  const body = st
    ? `<div class="savk">
      <div class="bal">${finDeco()}<span>Saldo hoy${st.est ? ' (estimado)' : ''}</span><b>${money(eur(st.now))}</b><em>${st.last.auto ? 'Saldo del banco del' : 'Último saldo real apuntado:'} ${fd(st.last.d)}</em></div>
      <div class="up"><span>Ganado este mes</span><b>${money('+' + eur(st.acc))}</b><em>Neto hasta ayer · Se abona el ${fd(st.next)}</em><em>${money(eur(st.accG))} brutos (lo que enseña el banco)</em><em>Total cobrado desde ${fd(st.L[0].d)}: ${money('+' + eur(st.gain))}</em></div>
      <div class="hi"><span>Rentabilidad anual</span><b>${pct(st.net * 100)}</b><em>${pct(savRate(s, TD()) * 100)} bruto − ${tax} % impuestos</em>${s.rate2 != null && s.from2 > TD() ? `<em>Desde el ${fd(s.from2)}: ${pct(s.rate2)} bruto</em>` : ''}</div>
      <div class="up"><span>En 12 meses</span><b>${money('+' + eur(st.y1 - st.now))}</b><em class="fin">Saldo final ≈ ${money(eur(st.y1))}</em></div>
    </div>
    ${savChart(st)}
    <h4 class="savh">Previsión mes a mes</h4>
    ${fold(
      'savp',
      st.proj.map(
        p =>
          `<div class="row">${tile('calendar-clock', 'var(--ok)')}<span class="g">Abono ${fd(p.d)}</span><span class="amt ok">${money('+' + eur(p.int))}</span><b class="amt">${money(eur(p.bal))}</b></div>`
      ),
      3
    )}
    <h4 class="savh">¿Cuánto ganaría si lo mantengo?</h4>
    <div class="pzap"><span>Si además meto</span><span class="pzin"><button class="ib" data-a="savap" data-i="-50" aria-label="50 € menos">${I('minus')}</button><input id="savap" inputmode="decimal" value="${savAp || ''}" placeholder="0" aria-label="Euros que meto al mes"><button class="ib" data-a="savap" data-i="50" aria-label="50 € más">${I('plus')}</button></span><span>€ al mes</span></div>
    <div id="savpz">${savPz(st)}</div>
    <div class="mu pznota">Con ${pct(savRate(s, TD()) * 100)} bruto${s.rate2 != null && s.from2 > TD() ? ` hasta el ${fd(s.from2)} y ${pct(s.rate2)} desde ahí` : ''}, menos ${tax} % de impuestos. Los intereses se cobran cada mes y vuelven a generar intereses. Lo que pongas al mes es solo para el cálculo: no se guarda.</div>
    ${st.real !== null ? `<div class="mu" style="margin:8px 0">Rentabilidad real con lo apuntado hasta hoy: ≈ ${pct(st.real)} anual. La previsión se recalcula cada vez que apuntas el saldo real.</div>` : ''}
    <h4 class="savh">Apuntes</h4>
    ${fold(
      'sav',
      [...st.L]
        .reverse()
        .map(
          x =>
            `<div class="row">${x.dep ? tile(x.dep > 0 ? 'arrow-down-left' : 'arrow-up-right', x.dep > 0 ? 'var(--ok)' : 'var(--wa)') : tile(x.auto ? 'landmark' : 'pencil', 'var(--ac)')}<span class="g">${fd(x.d)}${x.dep ? ` <span class="chip">${x.dep > 0 ? 'Aportación +' : 'Retirada −'}${money(eur(Math.abs(x.dep)))}</span>` : ''}</span><b class="amt">${money(eur(x.bal))}</b>${x.auto ? `<span class="ib" title="Del banco">${I('landmark', 'sm')}</span>` : `<button class="ib" data-a="savdel" data-i="${x.id}" aria-label="Eliminar apunte">${I('x')}</button>`}</div>`
        ),
      2
    )}`
    : empty('Aún no hay apuntes.');
  const auto = !!(SAVC && SAVD.length),
    conn = SAVC
      ? `<div class="mu" style="margin-bottom:10px">${I('landmark', 'sm')} Conectada con ${esc(SAVC.aspsp || 'el banco')} · Última sincronización ${ago(SAVC.last_sync)}${SAVC.valid_until ? ` · Permiso hasta ${fd(SAVC.valid_until.slice(0, 10))}` : ''}${SAVC.last_error && (SAVC.fail_count || 0) >= FAILMAX ? errFold('La última sincronización dio error', SAVC.last_error) : ''}</div>`
      : '';
  return panel(
    'inv',
    'ahorro',
    `${I('piggy-bank')} ${esc(s.name)} <span class="cnt">· Ahorro</span> <button class="ib" data-a="money" aria-label="${showMoney ? 'Ocultar importes' : 'Mostrar importes'}" title="${showMoney ? 'Ocultar importes' : 'Mostrar importes'}">${I(showMoney ? 'eye' : 'eye-off')}</button><button class="ib" data-a="savcfg" aria-label="Editar cuenta">${I('pencil')}</button>`,
    conn +
      `<div class="${showMoney ? '' : 'priv'}">${body}</div>` +
      (auto
        ? '<div class="mu" style="margin-top:10px">El saldo y los movimientos llegan solos del banco una vez al día.</div>'
        : `<div class="f" style="margin:10px 0 0"><input id="sv1" type="date" value="${TD()}" aria-label="Fecha"><input id="sv2" inputmode="decimal" placeholder="Saldo real (€)"><input id="sv3" inputmode="decimal" placeholder="Metido (+) o sacado (−)" title="Opcional: dinero que metiste o sacaste ese día"><button class="btn" data-a="savadd">Apuntar saldo real</button></div>`),
    'wide'
  );
}
/* Marcas que puede poner una regla además de la categoría (ver classifyX en banco.js). */
const RFL = { dev: ['Devolución', 'arrow-down-left'], ex: ['Extraordinario', 'sparkles'], enc: ['Encargo', 'hand-coins'] };
function rulesCard() {
  return panel(
    'fin',
    'reglas',
    `${I('tags')} Reglas de clasificación <span class="cnt">· ${S.rules.length}</span>`,
    `<div class="mu" style="margin-bottom:8px">Si el concepto del banco contiene la palabra, se asigna esa categoría. Se crean solas al cambiar la categoría de un movimiento del banco. Toca una para editarla. Una regla de devolución vale para dinero que te llega (p. ej. «bizum de»).</div>${fold(
      'reglas',
      S.rules.map(
        (r, i) =>
          `<div class="row"><button class="g link" data-a="er" data-i="${i}" title="Editar regla">«${esc(r.k)}»<span class="meta">${RFL[r.fl] ? `<span class="chip ${r.fl === 'dev' ? 'ok' : r.fl === 'ex' ? 'wa' : ''}">${I(RFL[r.fl][1], 'sm')} ${RFL[r.fl][0]}</span>` : ''}<span class="chip" style="color:${r.cat === DEVC ? 'var(--tx2)' : col(r.cat)}">${I(r.cat === DEVC ? 'file-text' : CI[r.cat] || 'package', 'sm')} ${esc(r.cat)}</span></span></button><button class="ib" data-a="dr" data-i="${i}" aria-label="Eliminar regla">${I('x')}</button></div>`
      ),
      3
    )}
  <div class="f" style="margin:10px 0 0"><input id="r1" placeholder="Palabra (ej. mercadona)"><select id="r3" aria-label="Tipo de regla"><option value="">Normal</option>${Object.entries(
    RFL
  )
    .map(([k, [n]]) => `<option value="${k}">${n}</option>`)
    .join(
      ''
    )}</select><select id="r2" aria-label="Categoría">${opts([...CATS, DEVC], 'Supermercado')}</select><button class="btn" data-a="ar">Añadir</button></div>`
  );
}
/* Mes que se está viendo en Finanzas y utilidades del desglose */
const finMonth = () => {
  const n = new Date();
  return MN(new Date(n.getFullYear(), n.getMonth() + finOff, 1));
};
const mAdd = (m, n) => MN(new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1));
const mLabel = m => cap(new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(m + '-01T00:00')));
const concept = x =>
  String(x.desc || x.cat)
    .split(' · ')[0]
    .trim();
const yearly = f => (f.once ? 0 : f.amt * (f.month ? 1 : f.every ? 12 / f.every : 12 * (f.days ? f.days.length : 1)));
let txf = { q: '', cat: '', per: 'mes', t: '' };
/* Movimientos: 5 al principio; «Ver más» añade una tanda (10 en el móvil, 40 en el ordenador). Se vuelve a empezar al cambiar filtros o mes. */
let txN = 0,
  txK = '';
/* Todos / Gastos / Ingresos: en el ordenador va en la cabecera del panel (txs1), junto al título; en el móvil, con los filtros (txs2). */
const txSeg = c =>
  `<div class="seg ${c}">${[
    ['', 'Todos'],
    ['g', 'Gastos'],
    ['i', 'Ingresos']
  ]
    .map(([k, n]) => `<button class="${txf.t === k ? 'on' : ''}" data-a="txft" data-i="${k}">${n}</button>`)
    .join('')}</div>`;
function txMore(rows) {
  const step = matchMedia('(max-width:760px)').matches ? 10 : 40,
    k = JSON.stringify(txf) + finMonth();
  if (k !== txK || !txN) {
    txK = k;
    txN = 5;
  }
  const more = rows.length - txN;
  return (
    rows.slice(0, txN).join('') +
    (more > 0
      ? `<button class="morebtn" data-a="txm">${I('chevron-down')}Ver ${Math.min(step, more)} más${more > step ? ` <span class="mu">· Quedan ${more}</span>` : ''}</button>`
      : '')
  );
}

/* Desglose de una compra dividida dentro de una categoría: total y cada parte (la de esta categoría resaltada),
   para que se vea qué es tuyo y qué es encargo. */
const splitBreak = (o, c) =>
  `<div class="cdsp"><span class="cdsp0">Compra de ${eur(o.amt)}${S.tx.filter(y => isSplit(y) && mon(y.date) === mon(o.date) && concept(y) === concept(o)).length > 1 ? ` · ${fd(o.date)}` : ''}</span>${o.parts
    .map(
      p =>
        `<span class="cdsp1${!p.enc && p.cat === c ? ' on' : ''}"><i style="background:${col(p.cat)}"></i>${esc(p.cat)}${p.enc ? ` <span class="chip ok">${I('hand-coins', 'sm')} Encargo</span>` : ''}<b>${eur(+p.amt)}</b></span>`
    )
    .join('')}</div>`;
/* Desglose de una categoría: por concepto, evolución de 6 meses y gastos recurrentes (para revisar bajas). */
/* sel: mes elegido tocando una barra (las 6 barras se mantienen; cambia el mes seleccionado y sus datos). */
function catDetail(c, sel) {
  const base = finMonth(),
    m = sel || base,
    // los encargos (enteros o la parte de un gasto dividido) no son gasto tuyo: no cuentan aquí
    L = TXP().filter(x => ((x.t === 'g' && !x.enc) || isDev(x)) && x.cat === c && mon(x.date) === m),
    sg = x => (x.t === 'g' ? x.amt : -x.amt),
    tot = L.reduce((a, x) => a + sg(x), 0),
    all = spent(m);
  const g = {};
  L.forEach(x => {
    // Las devoluciones van en su propio grupo aunque compartan concepto con un gasto.
    const k = (x.t === 'i' ? 'i' : 'g') + nt(concept(x));
    const e = (g[k] = g[k] || { n: concept(x), dev: x.t === 'i', s: 0, c: 0, last: '', fx: false, bank: false, of: 0, ofs: [] });
    e.s += sg(x);
    e.c++;
    if (x.of) {
      e.of = x.of.amt;
      if (!e.ofs.includes(x.of)) e.ofs.push(x.of);
    }
    if (x.date > e.last) e.last = x.date;
    if (x.fid) e.fx = true;
    if (fromBank(x)) e.bank = true;
  });
  // Primero los gastos (de mayor a menor) y después las devoluciones (de mayor a menor).
  const rows = Object.values(g).sort((a, b) => a.dev - b.dev || Math.abs(b.s) - Math.abs(a.s)),
    gst = L.filter(x => x.t === 'g').reduce((a, x) => a + x.amt, 0),
    dvt = Math.round((gst - tot) * 100) / 100;
  const ms = [-5, -4, -3, -2, -1, 0].map(i => mAdd(base, i)),
    hv = ms.map(k =>
      Math.max(
        0,
        TXP()
          .filter(x => x.cat === c && mon(x.date) === k)
          .reduce((a, x) => a + gAmt(x), 0)
      )
    ),
    hmax = Math.max(1, ...hv);
  const rec = S.fixed
    .filter(f => f.t === 'g' && f.cat === c && fxLive(f) && !f.once)
    .map(f => ({ n: f.name, y: yearly(f), d: fxWhen(f) }))
    .sort((a, b) => b.y - a.y);
  const ry = rec.reduce((a, r) => a + r.y, 0);
  const o =
    modal(`<div class="cdw" style="--cc:${col(c)}"><h3 class="cdh">${tile(CI[c] || 'package', col(c))}<span>${esc(c)}<span class="mu">${mLabel(m)}</span></span></h3>
    <div class="cdk"><div><b>${eur(tot)}</b><span>${dvt > 0 ? 'Te ha costado' : m === MN(new Date()) ? 'Este mes' : 'En ' + MS[+m.slice(5)]}</span></div><div><b>${all ? Math.round((tot / all) * 100) : 0}%</b><span>De tu gasto</span></div><div><b>${L.length}</b><span>Movimientos</span></div></div>
    <div class="hist">${ms.map((k, i) => `<button class="hb ${k === m ? 'on' : ''}" data-m="${k}" title="${mLabel(k)}: ${eur(hv[i])}" aria-label="Ver ${mLabel(k)}"><i style="height:${Math.max(3, (hv[i] / hmax) * 100)}%;background:${k === m ? col(c) : 'var(--bd2)'}"></i><span>${cap(MS[+k.slice(5)])}</span></button>`).join('')}</div>
    ${dvt > 0 ? `<div class="cdsum"><div><span>Gastado</span><b>${eur(gst)}</b></div><div class="ok"><span>Te han devuelto</span><b>− ${eur(dvt)}</b></div><div class="t"><span>Te ha costado a ti</span><b>${eur(tot)}</b></div></div>` : ''}
    <h4>Por concepto</h4>${rows.length ? rows.map(r => `<div class="row cdr${r.dev ? ' dev' : ''}"><span class="g">${esc(r.n)}<span class="meta">${r.c > 1 ? `<span class="mu">${r.c} veces</span>` : ''}${r.of ? `<span class="chip" title="Es solo una parte de un movimiento dividido">${I('split', 'sm')} Compra dividida</span>` : ''}<span class="mu">${fd(r.last)}</span>${r.fx ? `<span class="chip">${I('repeat', 'sm')} Fijo</span>` : ''}${r.dev ? `<span class="chip ok" title="Te devuelven parte de un gasto: resta de esta categoría">${I('arrow-down-left', 'sm')} Te devuelven</span>` : r.bank ? `<span class="chip">${I('landmark', 'sm')} Banco</span>` : ''}</span></span><b class="amt">${r.dev ? '+' + eur(-r.s) : eur(r.s)}</b>${r.ofs.map(o => splitBreak(o, c)).join('')}</div>`).join('') : empty('Sin gastos este mes.')}
    ${rec.length ? `<h4>Recurrentes · ${eur(ry)}/año <span class="mu">(≈ ${eur(ry / 12)}/mes)</span></h4><div class="mu" style="margin-bottom:4px">¿Sigues usando todas? Dar de baja una te ahorra su coste anual.</div>${rec.map(r => `<div class="row cdr"><span class="g">${esc(r.n)}<span class="meta"><span class="mu">${r.d}</span></span></span><span class="amt">${eur(r.y)}<span class="mu">/año</span></span></div>`).join('')}` : ''}
    <div class="acts" style="margin-top:14px"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button><button class="btn" id="ok">${I('list-checks')} Ver movimientos</button></div></div>`);
  o.querySelectorAll('.hb').forEach(
    b =>
      (b.onclick = () => {
        if (b.dataset.m !== m) catDetail(c, b.dataset.m);
      })
  );
  o.querySelector('#ok').onclick = () => {
    const n = new Date();
    finOff = +m.slice(0, 4) * 12 + +m.slice(5, 7) - (n.getFullYear() * 12 + n.getMonth() + 1);
    txf = { ...txf, cat: c, t: 'g', q: '' };
    o.remove();
    render();
    const e = $('#txcard');
    if (e) e.scrollIntoView({ behavior: 'smooth' });
  };
}

/* Desglose de una categoría en un año (desde «Resumen del año»): total, mes a mes, comparado con el año anterior
   (mismo periodo) y por concepto. «Ver movimientos» abre la lista con esa categoría y ese año. */
function catYear(c, Y) {
  const now = new Date(),
    cur = Y === now.getFullYear(),
    md = cur ? TD().slice(5) : '12-31',
    inY = (x, y) => x.date.slice(0, 4) === String(y) && x.date.slice(5) <= md,
    L = TXP().filter(x => ((x.t === 'g' && !x.enc) || isDev(x)) && x.cat === c && inY(x, Y) && !x.ex),
    sg = x => (x.t === 'g' ? x.amt : -x.amt),
    tot = L.reduce((a, x) => a + sg(x), 0),
    sumY = y =>
      TXP()
        .filter(x => x.cat === c && inY(x, y))
        .reduce((a, x) => a + gAmt(x), 0),
    prev = sumY(Y - 1),
    first = S.tx.reduce((a, x) => (x.date < a ? x.date : a), TD()),
    cmp = first <= Y - 1 + '-01-31' && prev > 0,
    all = [...Array(cur ? now.getMonth() + 1 : 12)].reduce(
      (a, _, i) => a + spent(Y + '-' + p2(i + 1), cur && i === now.getMonth() ? now.getDate() : 31),
      0
    );
  const mv = [...Array(12)].map((_, i) =>
      Math.max(
        0,
        TXP()
          .filter(x => x.cat === c && mon(x.date) === Y + '-' + p2(i + 1) && inY(x, Y))
          .reduce((a, x) => a + gAmt(x), 0)
      )
    ),
    hmax = Math.max(1, ...mv),
    nm = cur ? now.getMonth() + 1 : 12;
  const g = {};
  L.forEach(x => {
    const k = (x.t === 'i' ? 'i' : 'g') + nt(concept(x));
    const e = (g[k] = g[k] || { n: concept(x), dev: x.t === 'i', s: 0, c: 0, last: '', fx: false });
    e.s += sg(x);
    e.c++;
    if (x.date > e.last) e.last = x.date;
    if (x.fid) e.fx = true;
  });
  const rows = Object.values(g).sort((a, b) => a.dev - b.dev || Math.abs(b.s) - Math.abs(a.s)),
    rowH = rows.map(
      r =>
        `<div class="row cdr${r.dev ? ' dev' : ''}"><span class="g">${esc(r.n)}<span class="meta">${r.c > 1 ? `<span class="mu">${r.c} veces</span>` : ''}<span class="mu">${r.c > 1 ? '· ' : ''}Último: ${fd(r.last)}</span>${r.fx ? `<span class="chip">${I('repeat', 'sm')} Fijo</span>` : ''}${r.dev ? `<span class="chip ok">${I('arrow-down-left', 'sm')} Te devuelven</span>` : ''}</span></span><b class="amt">${r.dev ? '+' + eur(-r.s) : eur(r.s)}</b></div>`
    );
  const d = cmp ? Math.round(((tot - prev) / prev) * 100) : null;
  const o =
    modal(`<div class="cdw" style="--cc:${col(c)}"><h3 class="cdh">${tile(CI[c] || 'package', col(c))}<span>${esc(c)}<span class="mu">${cur ? 'En lo que va de ' + Y : 'Año ' + Y}</span></span></h3>
    <div class="cdk"><div><b>${eurR(tot)}</b><span>${eur(tot / nm)}/mes</span></div><div><b>${all ? Math.round((tot / all) * 100) : 0}%</b><span>De tu gasto</span></div><div><b>${L.length}</b><span>Movimientos</span></div></div>
    ${cmp ? `<div class="mu" style="margin:-4px 0 10px">${d > 0 ? `<span class="wa">${I('trending-up', 'sm')} ${d} % más</span>` : d < 0 ? `<span class="ok">${I('trending-down', 'sm')} ${-d} % menos</span>` : 'Lo mismo'} que ${cur ? 'en lo mismo de ' : 'en '}${Y - 1} (${eur(prev)})</div>` : ''}
    <div class="hist yrh">${mv.map((v, i) => `<button class="hb${i < nm && v ? '' : ' off'}" data-m="${Y}-${p2(i + 1)}" title="${cap(mLabel(Y + '-' + p2(i + 1)))}: ${eur(v)}" aria-label="Ver ${mLabel(Y + '-' + p2(i + 1))}" ${i < nm ? '' : 'disabled'}><i style="height:${i < nm ? Math.max(v ? 3 : 0, (v / hmax) * 100) : 0}%;background:${col(c)}"></i><span>${MS[i + 1].slice(0, 1).toUpperCase()}</span></button>`).join('')}</div>
    <div class="mu" style="font-size:12px;margin:-4px 0 6px">Toca un mes para ver su detalle</div>
    <h4>Por concepto</h4>${rowH.length ? fold('cyr', rowH, 10) : empty('Sin gastos este año.')}
    <div class="acts" style="margin-top:14px"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button><button class="btn" id="ok">${I('list-checks')} Ver movimientos</button></div></div>`);
  o.querySelectorAll('.hb:not([disabled])').forEach(
    b =>
      (b.onclick = () => {
        const n = new Date(),
          m = b.dataset.m;
        o.remove();
        finOff = +m.slice(0, 4) * 12 + +m.slice(5, 7) - (n.getFullYear() * 12 + n.getMonth() + 1);
        render();
        catDetail(c, m);
      })
  );
  o.querySelector('#ok').onclick = () => {
    const n = new Date();
    finOff = cur ? 0 : Y * 12 + 12 - (n.getFullYear() * 12 + n.getMonth() + 1);
    txf = { ...txf, cat: c, t: 'g', q: '', per: 'anio' };
    o.remove();
    render();
    const e = $('#txcard');
    if (e) e.scrollIntoView({ behavior: 'smooth' });
  };
}

/* Más recientes primero. El banco solo da la fecha (sin hora), así que dentro del mismo día se usa el orden de llegada:
   - del .xls o el PDF, el orden del archivo (viene del más nuevo al más antiguo, igual que en el banco);
   - del robot del banco, el último que llegó primero (los guarda del más antiguo al más nuevo). */
const txNewest = () => {
  const pos = new Map(S.tx.map((x, i) => [x.id, i])),
    file = x => !!(x.xls || x.card);
  return (a, b) => b.date.localeCompare(a.date) || (file(a) && file(b) ? pos.get(a.id) - pos.get(b.id) : pos.get(b.id) - pos.get(a.id));
};
/* Lista de movimientos con filtros (texto, categoría, periodo y tipo) */
function txListHTML() {
  // Cada movimiento va al mes al que cuenta (la nómina que llega desde el día 25, al mes siguiente, como en Ingresos).
  // Al buscar por texto se mira en todos los meses.
  const m = finMonth(),
    q = nt(txf.q).trim(),
    qa = /^\s*\d+([.,]\d{1,2})?\s*€?\s*$/.test(txf.q) ? pnum(txf.q) : null,
    per = q ? 'todo' : txf.per,
    from = { mes: m, '3m': mAdd(m, -2), anio: m.slice(0, 4) + '-01', todo: '' }[per],
    to = per === 'todo' ? '9999' : per === 'anio' ? m.slice(0, 4) + '-12' : m;
  const L = S.tx
    .filter(
      x =>
        incMon(x) >= from &&
        incMon(x) <= to &&
        (!txf.cat || txp(x).some(p => p.cat === txf.cat)) &&
        (!txf.t || x.t === txf.t) &&
        (!q ||
          nt((x.desc || x.cat) + ' ' + (x.note || '')).includes(q) ||
          (qa != null &&
            txp(x)
              .concat(x)
              .some(p => Math.abs(p.amt - qa) < 0.005)))
    )
    .sort(txNewest());
  // Posible duplicado (mismo importe y tipo): uno apuntado a mano y otro del banco con hasta 3 días de diferencia (el banco suele
  // tardar 1-2 días), o dos a mano el mismo día con el mismo concepto. Dos que vienen los dos del banco son filas distintas: no se avisan.
  const dupG = {};
  S.tx.forEach(x => {
    const k = x.amt + '|' + x.t;
    (dupG[k] = dupG[k] || []).push(x);
  });
  const isDup = x =>
    !x.notDup &&
    (dupG[x.amt + '|' + x.t] || []).some(
      y =>
        y !== x &&
        !y.notDup &&
        (fromBank(x) !== fromBank(y)
          ? Math.abs(dd(x.date, y.date)) <= DUPD
          : !fromBank(x) && y.date === x.date && nt(x.desc || '') === nt(y.desc || ''))
    );
  // Mismo criterio que «Gastos»: no cuentan traspasos, extraordinarios ni encargos, y las devoluciones restan.
  const g = L.flatMap(txp)
      .filter(p => !txf.cat || p.cat === txf.cat)
      .reduce((a, x) => a + gAmt(x), 0),
    i = L.filter(x => x.t === 'i' && x.cat !== NOCNT && !isDev(x) && !x.pdev).reduce((a, x) => a + x.amt, 0);
  const on = txf.q || txf.cat || txf.t || txf.per !== 'mes';
  let lastD = '';
  const rows = L.map(x => {
    const h = x.date !== lastD ? `<div class="dh">${x.date === TD() ? 'Hoy' : fdc(x.date)}</div>` : '';
    lastD = x.date;
    const sp = isSplit(x);
    return (
      h +
      `<div class="row txrow${sp ? ' has-parts' : ''}">${sp ? tile('split') : tile(CI[x.cat] || 'package', col(x.cat))}<button class="g link txg" data-a="etx" data-i="${x.id}" title="Editar: categoría, nota, Facturas o eliminar"><span class="tt">${esc(x.desc || x.cat)}</span><span class="meta"><span class="mu">${sp ? 'Dividido en ' + x.parts.length : esc(x.cat)}</span>${x.card ? `<span class="mu">· ${I('credit-card', 'sm')} Prepago</span>` : ''}${x.note ? `<span class="mu">· ${I('file-text', 'sm')} ${esc(cap(x.note))}</span>` : ''}</span></button><span class="txr"><span class="txc">${isDev(x) ? `<span class="chip ok" title="Te devuelven parte de un gasto: resta de «${esc(x.cat)}» y no cuenta como ingreso">${I('arrow-down-left', 'sm')} Devolución</span>` : ''}${incMon(x) !== mon(x.date) ? `<span class="chip" title="Llegó a final de mes: cuenta como ingreso del mes siguiente">Cuenta para ${MS[+incMon(x).slice(5)]}</span>` : ''}${x.billId ? '<span class="chip">Factura</span>' : x.fid ? `<span class="chip">${I('repeat', 'sm')} Fijo</span>` : ''}${x.t !== 'g' || (sp && !x.ex) ? '' : x.enc && !sp ? `<button class="chip ok" data-a="txen" data-i="${x.id}" title="Encargo para otra persona: no cuenta como gasto tuyo · Toca para que cuente">${I('hand-coins', 'sm')} Encargo</button>` : x.ex ? `<button class="chip wa" data-a="txex" data-i="${x.id}" title="Se ve, pero no cuenta en el gasto del mes ni en las comparaciones · Toca para que cuente">${I('sparkles', 'sm')} Extraordinario</button>` : x.amt >= EXMIN && x.cat !== NOCNT && !x.fid && !x.billId ? `<button class="chip" data-a="txex" data-i="${x.id}" title="Marcar como gasto extraordinario: se verá, pero no contará en el gasto del mes ni en las comparaciones">¿Extraordinario?</button>` : ''}${isDup(x) ? `<button class="chip wa" data-a="nodup" data-i="${x.id}" title="Toca si no es un duplicado para quitar el aviso">${I('triangle-alert', 'sm')} ¿Duplicado?</button>` : ''}</span><span class="txb"><span class="amt ${x.t === 'i' ? 'ok' : 'neg'}">${x.t === 'i' ? '+' : '−'}${eur(x.amt)}</span>${sp && x.parts.some(p => p.enc) ? `<span class="txmine">Tuyo: ${eur(x.parts.filter(p => !p.enc).reduce((a, p) => a + +p.amt, 0))}</span>` : ''}</span></span></div>${
        sp
          ? `<div class="txparts">${txp(x)
              .map(
                p =>
                  `<button class="txpart${txf.cat && !p.enc && p.cat === txf.cat ? ' on' : ''}" data-a="etx" data-i="${x.id}" title="Parte del movimiento · Toca para cambiar la división"><i style="background:${col(p.cat)}"></i><span>${esc(p.cat)}${p.enc ? ` <span class="chip ok">${I('hand-coins', 'sm')} Encargo</span>` : ''}</span><span class="amt mu">${eur(p.amt)}</span></button>`
              )
              .join('')}</div>`
          : ''
      }`
    );
  });
  const pl = finOff || on ? [] : pendList();
  const prow = pl
    .map(
      p =>
        `<div class="row is-pend">${tile('clock', 'var(--mu)')}<span class="g">${esc(cleanDesc(p.description))}<span class="meta"><span class="mu">${fd(p.booking_date)}</span><span class="chip wa">${I('clock', 'sm')} Pendiente en el banco</span></span></span><span class="amt ${p.amount > 0 ? 'ok' : 'neg'}">${p.amount > 0 ? '+' : '−'}${eur(Math.abs(p.amount))}</span></div>`
    )
    .join('');
  return (
    `<div class="txsum"><span>${L.length} movimiento${L.length === 1 ? '' : 's'}${q && txf.per !== 'todo' ? ' <span class="mu">· En todos los meses</span>' : ''}</span>${g > 0 ? `<b class="neg">−${eur(g)}</b>` : g < 0 ? `<b class="ok" title="Devoluciones: te devuelven parte de un gasto y restan de su categoría">+${eur(-g)} devuelto</b>` : ''}${i ? `<b class="ok">+${eur(i)}</b>` : ''}${on ? `<a href="#" data-a="txr">Quitar filtros</a>` : ''}</div>` +
    (prow ? `<div class="dh">Pendientes de confirmar · Se añadirán solos cuando el banco los cierre</div>${prow}` : '') +
    (rows.length ? txMore(rows) : empty('No hay movimientos con estos filtros.'))
  );
}
/* Pendientes del banco que no estén ya apuntados a mano o como fijo (mismo importe, ±4 días). */
const pendList = () =>
  PEND.filter(
    p =>
      !S.tx.some(
        x =>
          !fromBank(x) &&
          x.t === (p.amount < 0 ? 'g' : 'i') &&
          Math.abs(x.amt - Math.abs(p.amount)) < 0.01 &&
          Math.abs(dd(x.date, p.booking_date)) <= 4
      )
  );
const txRefresh = () => {
  const e = $('#txlist');
  if (e) e.innerHTML = txListHTML();
};

/* Bandeja «Sin clasificar»: gastos en «Otros» (de cualquier mes) para ponerles categoría de uno en uno.
   También las devoluciones a las que una regla no pudo poner categoría (x.pdev).
   «Dejar en Otros» (x.keep) y «Encargo» (x.enc) los sacan de la bandeja. Sin pendientes, la tarjeta no se muestra. */
const sincL = () => S.tx.filter(x => (x.t === 'g' || x.pdev) && x.cat === 'Otros' && !x.keep && !x.enc && !isSplit(x)).sort(txNewest());
function sincCard() {
  const L = sincL();
  if (!L.length) return '';
  return panel(
    'fin',
    'sinc',
    `${I('inbox')} Sin clasificar <span class="cnt">· ${L.length}</span>`,
    `<div class="mu" style="margin-bottom:8px">Gastos en «Otros» y devoluciones sin categoría. Elige su categoría (en un gasto, te propondrá crear una regla) o déjalos en «Otros».</div>` +
      fold(
        'sinc',
        L.map(
          x =>
            `<div class="row">${tile(CI.Otros || 'package', col('Otros'))}<span class="g">${esc(x.desc || 'Sin concepto')}<span class="meta"><span class="mu">${fd(x.date)}</span><select class="sel" data-a="txc" data-i="${x.id}" aria-label="Categoría">${opts(
              GCATS,
              x.cat
            )}</select><button class="chip" data-a="txk" data-i="${x.id}" title="Está bien en «Otros»: quitar de esta bandeja">Dejar en Otros</button>${x.pdev ? `<span class="chip ok" title="Te devuelven parte de un gasto: elige de qué categoría">${I('arrow-down-left', 'sm')} Devolución</span>` : `<button class="chip" data-a="txen" data-i="${x.id}" title="Compra para otra persona que te paga en mano: no cuenta como gasto tuyo">${I('hand-coins', 'sm')} Encargo</button>`}</span></span>${x.pdev ? `<span class="amt ok">+${eur(x.amt)}</span>` : `<span class="amt neg">−${eur(x.amt)}</span>`}</div>`
        ),
        5
      )
  );
}

/* Saldo de la cuenta: S.acct = {bal, d, seen, t}. Se apunta solo al importar el extracto de la cuenta (PDF o .xls) o a mano con el lápiz
   (t = cuándo). Si la sincronización con el banco ha traído un saldo real más nuevo (BANK.balance), se enseña ese tal cual. */
/* Saldo de hoy de la cuenta: {v, bank, d}; v = null si aún no hay ninguno. Lo usan la tarjeta del saldo y las metas de ahorro. */
function acctBal() {
  // Al saldo apuntado se le suman los movimientos de la cuenta que han llegado al panel después (banco o importados), sin la prepago ni los apuntes a mano.
  // Solo los de fecha posterior al saldo: los de ese mismo día o antes ya están dentro de él aunque lleguen más tarde.
  const a = S.acct;
  if (BANK && BANK.balance != null && BANK.balance_at && (!a || !a.t || new Date(BANK.balance_at).getTime() > a.t))
    return { v: +BANK.balance, bank: true, d: BANK.balance_at };
  if (!a) return { v: null };
  const later = new Set(a.seen != null ? S.bankSeen.slice(a.seen) : []),
    nx = S.tx.filter(x => (x.bank || x.xls) && !x.card && later.has(x.bank || x.xls) && x.date > a.d);
  return {
    v: Math.round((a.bal + nx.reduce((s, x) => s + (x.t === 'i' ? x.amt : -x.amt), 0)) * 100) / 100,
    d: nx.reduce((m, x) => (x.date > m ? x.date : m), a.d)
  };
}
/* Dibujos de fondo de los saldos (Finanzas e Inversiones), muy suaves, como en la cabecera de Mascotas. */
const finDeco = () =>
  `<span class="fdeco" aria-hidden="true">${I('coins')}<i>€</i>${I('piggy-bank')}${I('trending-up')}<i>€</i>${I('banknote')}</span>`;
function acctHTML() {
  const b = acctBal(),
    eye = `<button class="ib" data-a="money" aria-label="${showMoney ? 'Ocultar saldo' : 'Mostrar saldo'}" title="${showMoney ? 'Ocultar saldo' : 'Mostrar saldo'}">${I(showMoney ? 'eye' : 'eye-off')}</button>`;
  return (
    `<div class="acct ${showMoney ? '' : 'priv'}">${finDeco()}<div class="k">${I('landmark')} Saldo de la cuenta <span class="bk">(Openbank)</span>${eye}<button class="ib" data-a="accedit" aria-label="Cambiar saldo" title="Cambiar saldo a mano">${I('pencil')}</button></div>` +
    (b.v === null
      ? `<b>—</b>`
      : `<b>${money(eur(b.v))}</b><span class="d">${b.bank ? 'Del banco · ' + ago(b.d) : 'Actualizado a ' + fd(b.d)}</span>`) +
    `</div>`
  );
}

/* Metas de ahorro: el saldo de la cuenta se reparte en «huchas» con nombre (no se mueve dinero de verdad).
   S.goals = [{id, n (nombre), obj (objetivo €), amt (apartado €), d ('AAAA-MM', mes objetivo; '' sin fecha), c (color), c0 (creada, AAAA-MM-DD), a0 (apartado al crearla)}].
   Lo que no está en ninguna meta sale como «Sin asignar». Con fecha: cuánto apartar al mes y si vas bien
   (lo apartado desde que se creó frente a lo que tocaría a estas alturas, en línea recta hasta la fecha). */
const GCOL = ['#2f9bff', '#3ccf82', '#f2b13d', '#9b6dff', '#ee8fb6', '#22c3b4', '#ff7a59'];
const mDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
function goalSt(g) {
  const td = TD(),
    left = Math.max(0, g.obj - g.amt);
  if (g.amt >= g.obj) return { k: 'ok', t: 'Conseguida', left, mo: 0 };
  if (!g.d) return { k: 'mu', t: 'Sin fecha', left, mo: 0 };
  const months = mDiff(td, g.d);
  if (months < 0) return { k: 'er', t: 'Fecha pasada', left, mo: 0 };
  const mo = left / Math.max(1, months),
    tot = Math.max(1, mDiff(g.c0 || td, g.d)),
    gone = Math.min(tot, Math.max(0, mDiff(g.c0 || td, td))),
    a0 = g.a0 || 0,
    want = a0 + ((g.obj - a0) * gone) / tot;
  return g.amt + 0.5 >= want ? { k: 'ok', t: 'Vas bien', left, mo } : { k: 'wa', t: 'Te retrasas', left, mo };
}
/* Icono de cada meta según su nombre (si no encaja ninguno, la diana). */
const GOAL_IC = [
  [/\b(viaje|vuelo|escapada|turismo)/, 'plane'],
  [/\b(vacacion|playa|verano)/, 'tree-palm'],
  [/\b(coche|auto|carnet|itv|seguro del coche)/, 'car'],
  [/\b(moto|bici)/, 'bike'],
  [/\b(casa|piso|hipoteca|entrada|alquiler|fianza|mudanza|hogar)/, 'house'],
  [/\b(mueble|sofa|cocina|reforma|obra|decoracion)/, 'sofa'],
  [/\b(emergencia|imprevisto|colchon|seguridad|fondo)/, 'umbrella'],
  [/\b(regalo|navidad|reyes|cumple)/, 'gift'],
  [/\b(boda|anillo|joya|aniversario)/, 'gem'],
  [/\b(estudio|curso|master|universidad|formacion|oposicion|idioma)/, 'graduation-cap'],
  [/\b(ordenador|portatil|pc|tablet|ipad)/, 'laptop'],
  [/\b(movil|telefono|iphone)/, 'smartphone'],
  [/\b(bebe|hijo|nacimiento)/, 'baby'],
  [/\b(mascota|perro|gato|veterinario)/, 'paw-print'],
  [/\b(salud|dentista|medico|gafas|tratamiento)/, 'heart-pulse'],
  [/\b(gimnasio|deporte)/, 'dumbbell'],
  [/\b(ahorro|hucha|inversion)/, 'piggy-bank'],
  [/\b(deuda|prestamo|credito|tarjeta)/, 'credit-card']
];
function goalsCard() {
  const L = S.goals,
    b = acctBal(),
    asg = L.reduce((s, g) => s + (+g.amt || 0), 0),
    free = b.v === null ? null : Math.round((b.v - asg) * 100) / 100;
  const rows = L.map(g => {
    const st = goalSt(g),
      p = g.obj > 0 ? Math.min(100, (g.amt / g.obj) * 100) : 0,
      when = g.d ? cap(mLabel(g.d)) : '';
    return `<div class="goal${st.t === 'Conseguida' ? ' done' : ''}" style="--gc:${g.c || 'var(--ac)'}"><div class="gt">${tile(pickIco(GOAL_IC, g.n, [0, 'target'])[1], g.c || 'var(--ac)')}<button class="link g" data-a="goaled" data-i="${g.id}" title="Editar meta"><b>${esc(g.n)}</b></button><span class="chip ${st.k}">${st.t}</span><button class="ib" data-a="goalmv" data-i="${g.id}" aria-label="Apartar o sacar dinero de «${esc(g.n)}»" title="Apartar o sacar">${I('arrow-left-right')}</button></div><div class="gbar" role="img" aria-label="${Math.round(p)} % de la meta"><i style="width:${p.toFixed(1)}%"></i></div><div class="gd"><span>${eur(g.amt)} de ${eur(g.obj)} · ${Math.round(p)} %</span><span>${when}${st.mo ? ' · Aparta ' + eur(Math.ceil(st.mo)) + '/mes' : ''}</span></div></div>`;
  });
  return panel(
    'fin',
    'metas',
    `${I('target')} Metas de ahorro <span class="cnt">· ${L.length}</span>`,
    (L.length
      ? `<div class="goals">${rows.join('')}</div>`
      : empty('Aún no hay metas. Crea una y apártale dinero del saldo de la cuenta.')) +
      `<div class="gfoot">${free === null ? '<span class="mu">Sin saldo de la cuenta todavía</span>' : free < 0 ? `<span class="er">Has apartado ${eur(-free)} más de lo que hay en la cuenta</span>` : `<span class="mu">Sin asignar: <b>${eur(free)}</b> de ${eur(b.v)}</span>`}<button class="btn sm" data-a="goaladd">${I('plus', 'sm')} Meta</button></div>`
  );
}

/* ---------- Resumen del año ----------
   Lo gastado (con el mismo criterio que «Gastos»: sin traspasos, extraordinarios ni encargos, y las devoluciones restan),
   lo ingresado y lo ahorrado en el año, mes a mes y por categoría, comparado con el mismo periodo del año anterior
   (solo si de ese periodo hay movimientos desde el principio). */
let yrOff = 0; // 0 = este año, -1 = el anterior…
/* Euros sin céntimos (para las cifras grandes del resumen, que en el móvil no caben). */
const eurR = n =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: S.cur || 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(
    n || 0
  );
function yearCard() {
  const now = new Date(),
    Y = now.getFullYear() + yrOff,
    cur = yrOff === 0,
    first = S.tx.reduce((a, x) => (x.date < a ? x.date : a), TD()),
    fy = +first.slice(0, 4);
  if (!S.tx.length) return '';
  const lastM = cur ? now.getMonth() + 1 : 12,
    md = cur ? TD().slice(5) : '12-31', // hasta qué día del año se cuenta (para comparar el mismo periodo)
    ms = y => [...Array(lastM)].map((_, i) => y + '-' + p2(i + 1)),
    spM = (y, m, i) => spent(m, cur && i === lastM - 1 ? now.getDate() : 31),
    G = ms(Y).map((m, i) => spM(Y, m, i)),
    P = ms(Y - 1).map((m, i) => spM(Y - 1, m, i)),
    P12 = [...Array(12)].map((_, i) => spent(Y - 1 + '-' + p2(i + 1))),
    tot = G.reduce((a, v) => a + v, 0),
    ptot = P.reduce((a, v) => a + v, 0),
    // Comparar solo si hay movimientos desde el principio del periodo del año anterior.
    cmp = first <= Y - 1 + '-01-31' && ptot > 0,
    inc = ms(Y).reduce((a, m) => a + income(m).reduce((b, x) => b + x.amt, 0), 0),
    sav = inc - tot;
  const inY = (x, y) => x.date >= y + '-01-01' && x.date.slice(0, 4) === String(y) && x.date.slice(5) <= md,
    catsOf = y => {
      const o = {};
      TXP()
        .filter(x => inY(x, y) && gAmt(x))
        .forEach(x => (o[x.cat] = (o[x.cat] || 0) + gAmt(x)));
      return o;
    },
    C = catsOf(Y),
    PC = catsOf(Y - 1),
    cats = Object.entries(C)
      .filter(([, v]) => v > 0.005)
      .sort((a, b) => b[1] - a[1]),
    cs = cats.reduce((a, c) => a + c[1], 0) || 1,
    mx = Math.max(1, ...cats.map(c => c[1]));
  // Meses con movimientos (el primer año puede empezar a mitad) para la media.
  const live = G.map((v, i) => [v, ms(Y)[i]]).filter(([, m]) => m >= first.slice(0, 7)),
    avg = live.length ? live.reduce((a, [v]) => a + v, 0) / live.length : 0,
    full = live.filter(([, m]) => !cur || m < MN(now)),
    hi = full.length ? full.reduce((a, b) => (b[0] > a[0] ? b : a)) : null,
    lo = full.length ? full.reduce((a, b) => (b[0] < a[0] ? b : a)) : null;
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0),
    delta = (a, b, up = 'wa') => {
      const d = pct(a, b);
      return `<span class="yrd ${d > 0 ? up : d < 0 ? (up === 'wa' ? 'ok' : 'wa') : ''}">${I(d > 0 ? 'trending-up' : d < 0 ? 'trending-down' : 'minus', 'sm')} ${d > 0 ? '+' : ''}${d} %</span>`;
    };
  const per = cur ? `del 1 de enero al ${fd(TD())}` : 'todo el año';
  const ex = S.tx.filter(x => x.ex && x.t === 'g' && x.date.slice(0, 4) === String(Y) && x.date.slice(5) <= md);
  const bmx = Math.max(1, ...G, ...(cmp ? P12 : []));
  const bars = [...Array(12)]
    .map((_, i) => {
      const m = Y + '-' + p2(i + 1),
        v = i < lastM ? G[i] : null,
        pv = cmp ? P12[i] : 0,
        tip = `${cap(mLabel(m))}: ${v == null ? 'aún no ha llegado' : eur(v)}${cmp ? ` · ${Y - 1}: ${eur(pv)}` : ''}`;
      return `<div class="yrb${cur && i === lastM - 1 ? ' on' : ''}${hi && hi[1] === m ? ' hi' : ''}" title="${tip}" aria-label="${tip}"><div class="tr">${cmp ? `<i class="pv" style="height:${((pv / bmx) * 100).toFixed(1)}%"></i>` : ''}${v != null ? `<i style="height:${Math.max(v ? 2 : 0, (v / bmx) * 100).toFixed(1)}%"></i>` : ''}</div><em>${MS[i + 1].slice(0, 1).toUpperCase()}</em></div>`;
    })
    .join('');
  const rows = cats.map(([c, v]) => {
    const pv = PC[c] || 0;
    return `<button class="yrc" data-a="cy" data-i="${esc(c)}" data-y="${Y}" title="Ver el detalle de ${esc(c)} en ${Y}">${tile(CI[c] || 'package', col(c))}<span class="g"><span>${c}</span><span class="mu">${Math.round((v / cs) * 100)} % del gasto · ${eur(v / Math.max(1, live.length))}/mes</span></span><span class="yrv"><b>${eur(v)}</b>${cmp ? (pv ? delta(v, pv) : '<span class="yrd mu">Nuevo</span>') : ''}</span>${I('chevron-right', 'cr')}<div class="bar"><div style="width:${((v / mx) * 100).toFixed(1)}%;background:${col(c)}"></div></div></button>`;
  });
  const hdr = `<div class="calh"><button class="ib" data-a="yr" data-i="-1" aria-label="Año anterior" ${Y <= fy ? 'disabled style="opacity:.4"' : ''}>${I('chevron-left')}</button><b>${Y}</b><button class="ib" data-a="yr" data-i="1" aria-label="Año siguiente" ${cur ? 'disabled style="opacity:.4"' : ''}>${I('chevron-right')}</button></div>`;
  return panel(
    'fin',
    'anio',
    `${I('calendar-days')} Resumen del año`,
    hdr +
      `<div class="mu yrp">${cap(per)}${cmp ? ` · comparado con lo mismo de ${Y - 1}` : Y - 1 >= fy ? ` · sin datos completos de ${Y - 1} para comparar` : ''}</div>
    <div class="yrk"><div><span class="mu">Gastado</span><b>${eurR(tot)}</b>${cmp ? delta(tot, ptot) : ''}</div><div><span class="mu">Ingresado</span><b class="ok">${eurR(inc)}</b></div><div><span class="mu">Ahorrado</span><b class="${sav < 0 ? 'er' : 'ok'}">${eurR(sav)}</b>${inc > 0 ? `<span class="mu">${Math.round((sav / inc) * 100)} % de lo ingresado</span>` : ''}</div></div>
    <div class="yrbars" role="img" aria-label="Gasto de cada mes de ${Y}">${bars}</div>
    <div class="yrl"><span><i></i>${Y}</span>${cmp ? `<span><i class="pv"></i>${Y - 1}</span>` : ''}</div>
    <div class="yrs"><span>Media al mes <b>${eur(avg)}</b></span>${hi && full.length > 1 ? `<span>Mes más caro <b>${MS[+hi[1].slice(5)]} · ${eur(hi[0])}</b></span><span>Más barato <b>${MS[+lo[1].slice(5)]} · ${eur(lo[0])}</b></span>` : ''}</div>
    ${rows.length ? `<div class="yrcs">${fold('yrc', rows, 6)}</div>` : '<div class="mu">Sin gastos este año.</div>'}
    ${ex.length ? `<div class="mu yrx">${I('sparkles', 'sm')} No cuentan ${ex.length} gasto${ex.length === 1 ? '' : 's'} extraordinario${ex.length === 1 ? '' : 's'} (${eur(ex.reduce((a, x) => a + x.amt, 0))})</div>` : ''}`,
    'wide'
  );
}

function vFin() {
  const now = new Date(),
    base = new Date(now.getFullYear(), now.getMonth() + finOff, 1),
    m = MN(base),
    pm = MN(new Date(base.getFullYear(), base.getMonth() - 1, 1));
  const incL = income(m),
    inc = incL.reduce((a, x) => a + x.amt, 0),
    sp = spent(m),
    cur = m === MN(now),
    ps = spent(pm, cur ? now.getDate() : 31);
  const ml = mLabel(m);
  return `<div class="hdr finh"><div><h2>Finanzas</h2><div class="sub help">${user && BANK && BANK.session_id ? `${I('landmark', 'sm')} Conectado al banco · ${cap(ago(BANK.last_sync))}` : 'Movimientos manuales, fijos e importados'}</div></div><div class="hact"><button class="btn ghost sm ico" data-a="fm" data-i="-1" aria-label="Mes anterior">${I('chevron-left')}</button><b style="min-width:130px;text-align:center">${ml}</b><button class="btn ghost sm ico" data-a="fm" data-i="1" aria-label="Mes siguiente" ${finOff >= 0 ? 'disabled style="opacity:.4"' : ''}>${I('chevron-right')}</button></div></div>
  <div class="fintop">${acctHTML()}
  <div class="kpis">
    <div class="kpi" style="--c:var(--ok)"><span class="k"><span class="hico">${I('arrow-up-right')}</span>Ingresos</span><span class="v ok">${eur(inc)}</span><span class="d">${incL.length} movimiento${incL.length === 1 ? '' : 's'}</span></div>
    <div class="kpi" style="--c:var(--er)"><span class="k"><span class="hico">${I('arrow-down-left')}</span>Gastos</span><span class="v">${eur(sp)}</span><span class="d ${sp > ps ? 'wa' : 'ok'}">${I(sp > ps ? 'trending-up' : 'trending-down', 'sm')} ${eur(Math.abs(sp - ps))} ${cur ? `vs ${MS[+pm.slice(5)]} a día ${now.getDate()}` : 'vs mes anterior'}</span></div>
    <div class="kpi" style="--c:var(--ac)"><span class="k"><span class="hico">${I('scale')}</span>Balance</span><span class="v ${inc - sp < 0 ? 'er' : 'ok'}">${eur(inc - sp)}</span><span class="d">Ingresos − gastos</span></div>
    <div class="kpi" style="--c:#22c3b4"><span class="k"><span class="hico">${I('target')}</span>Tope mensual</span><span class="v">${eur(S.budget)}</span>${S.budget ? `<span class="kbar ${sp >= S.budget ? 'over' : sp >= S.budget * 0.8 ? 'near' : ''}" title="Gastado ${Math.round((sp / S.budget) * 100)} % del tope"><i style="width:${Math.min(100, (sp / S.budget) * 100).toFixed(1)}%"></i></span>` : ''}<span class="d"><a href="#" data-a="eb2">Cambiar</a></span></div>
  </div></div>
  ${(() => {
    const C = {
      gasto: panel('fin', 'gasto', `${I('wallet')} Gasto del mes`, gastoHTML(m, 'fm'), 'wide'),
      anio: yearCard(),
      mov: panel(
        'fin',
        'mov',
        `${I('list-checks')} Movimientos <button class="btn sm movadd" data-a="nx" aria-label="Añadir movimiento" title="Añadir movimiento">${I('plus', 'sm')} Añadir</button>${txSeg('txs1')}`,
        `<span id="txcard"></span>
    <div class="txf"><input id="txq" class="in" type="search" placeholder="Buscar concepto, nota o importe…" value="${esc(txf.q)}" aria-label="Buscar en movimientos"><select class="in" data-a="txfc" aria-label="Categoría"><option value="">Todas las categorías</option>${CATS.map(c => `<option ${txf.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select><select class="in" data-a="txfp" aria-label="Periodo">${(() => {
      const ms = [...new Set([...Array(3)].map((_, j) => MN(new Date(now.getFullYear(), now.getMonth() - j, 1))).concat(m))]
        .sort()
        .reverse();
      return (
        ms.map(x => `<option value="m:${x}" ${txf.per === 'mes' && x === m ? 'selected' : ''}>${mLabel(x)}</option>`).join('') +
        [
          ['3m', 'Último trimestre'],
          ['anio', 'Año ' + m.slice(0, 4)],
          ['todo', 'Todo']
        ]
          .map(([k, n]) => `<option value="${k}" ${txf.per === k ? 'selected' : ''}>${n}</option>`)
          .join('')
      );
    })()}</select>${txSeg('txs2')}</div>
    <div id="txlist">${txListHTML()}</div>`,
        'wide'
      ),
      reglas: rulesCard(),
      sinc: sincCard(),
      metas: goalsCard()
    };
    // La tarjeta del banco (última sincronización…) solo está en Ajustes.
    VIS.fin = ord(
      'fin',
      FIN.filter(k => C[k])
    );
    return `<div class="grid">${VIS.fin.map(k => C[k]).join('')}</div>`;
  })()}`;
}

function vInv() {
  const C = { ahorro: savCard() };
  VIS.inv = ord('inv', ['ahorro']);
  return `<div class="hdr"><div><h2>Inversiones</h2><div class="sub help">Tus ahorros y lo que rinden · Los importes se muestran con el ojo</div></div></div>
  <div class="grid">${VIS.inv.map(k => C[k]).join('')}</div>`;
}

'use strict';
/* Sección «Inversiones»: la cuenta de ahorro, lo que rinde y cuánto ganarías. */
/* Cuenta de ahorro (p. ej. una cuenta remunerada): aparte de los gastos, solo para consultar.
   S.sav = {name, rate (% anual bruto), tax (% de impuestos sobre intereses), snaps:[{id, d, bal, dep}]}
   y, si el banco avisa de un cambio, rate2 (% nuevo) y from2 (fecha desde la que se aplica).
   Cada apunte es el saldo en una fecha; dep = dinero que metiste (+) o sacaste (−) ese día.
   Lo ganado es el saldo menos lo aportado, así que los intereses netos salen solos. */
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
function vInv() {
  const C = { ahorro: savCard(), plan: planCard() }; // «Plan de ahorro» (del mes en curso) está en finanzas.js
  VIS.inv = ord('inv', ['ahorro', 'plan']);
  return `<div class="hdr"><div><h2>Inversiones</h2><div class="sub help">Tus ahorros y lo que rinden · Los importes se muestran con el ojo</div></div></div>
  <div class="grid">${VIS.inv.map(k => C[k]).join('')}</div>`;
}

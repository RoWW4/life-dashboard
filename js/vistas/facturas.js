'use strict';
/* Sección «Facturas»: pagos e ingresos que se repiten. */
/* Una fila de Facturas: estado del último cobro y acciones. Etiquetas: pagado/cobrado (verde) · próximo (aún no toca; naranja si es un pago de esta semana) ·
   pendiente (pasó la fecha hace ≤5 días: el banco suele tardar) · vencido (más de 5 días) · terminado (ya no hay más cobros). */
/* Pago con fecha de fin: hasta qué mes y cuántos cobros quedan desde el próximo. */
const fxEnd = (f, next) => {
  if (!f.until) return '';
  const n = next ? fxOcc(f, next, f.until).length : 0;
  return ` · Hasta ${MS[+f.until.slice(5, 7)]}${f.until.slice(0, 4) === TD().slice(0, 4) ? '' : ' ' + f.until.slice(0, 4)}${n ? ` · Quedan ${n} pago${n === 1 ? '' : 's'}` : ''}`;
};
const fxItem = f => {
  if (f.var) return fxVarItem(f);
  const s0 = fxState(f),
    late = s0.due && s0.due === s0.prev,
    // Cobro de este mes que aún no ha llegado: no se enseña el pago del mes anterior.
    pm = !late && s0.next && mon(s0.next) === MN(new Date()) && !(s0.paid && Math.abs(dd(s0.paid.date, s0.next)) <= 10),
    s = pm ? { ...s0, paid: null } : s0,
    ag = late ? dd(TD(), s.prev) : 0;
  const chip = late
    ? `<span class="chip ${ag > 5 ? 'er' : 'wa'}">${ag > 5 ? 'Vencido' : 'Pendiente'} ${fdc(s.prev)}</span>`
    : s.paid
      ? `<span class="chip ok">${f.t === 'i' ? 'Cobrado' : 'Pagado'} ${fdc(s.paid.date)}</span>`
      : s.next
        ? `<span class="chip${f.t === 'g' && dayDiff(s.next) <= 7 ? ' wa' : ''}">Próximo ${fdc(s.next)}</span>`
        : '<span class="chip">Terminado</span>';
  return `<div class="row brow">${tile(CI[f.cat] || 'receipt', col(f.cat))}<span class="g"><button class="link tt fxn" data-a="fxinf" data-i="${f.id}" title="Ver lo que cuesta al año">${esc(f.name)}</button><span class="mu">${fxFreq(f)}${fxEnd(f, s.next)}${s.paid ? (fromBank(s.paid) ? ' · Llegó del banco' : ' · Apuntado en el panel, aún sin cargo del banco') + (s.next && Math.abs(dd(s.paid.date, s.next)) > 10 ? ' · Próximo ' + fdc(s.next) : '') : ''}</span></span>${chip}<span class="amt ${f.t === 'i' ? 'ok' : ''}">${eur(f.amt)}</span><button class="ib" data-a="ef" data-i="${f.id}" aria-label="Editar">${I('pencil')}</button></div>`;
};
/* Fila de un pago en pausa (p. ej. lo paga otra persona por ahora): no cuenta; botón para quitar la pausa. */
const fxPauseItem = f =>
  `<div class="row brow fxpz">${tile(CI[f.cat] || 'receipt', col(f.cat))}<span class="g"><button class="link tt fxn" data-a="fxinf" data-i="${f.id}" title="Ver lo que cuesta al año">${esc(f.name)}</button><span class="mu">${fxFreq(f)} · No cuenta mientras esté en pausa</span></span><button class="btn sm ghost" data-a="fxp" data-i="${f.id}" title="Empezar a contarlo en tus pagos">Reanudar</button><span class="amt">${eur(f.amt)}</span><button class="ib" data-a="ef" data-i="${f.id}" aria-label="Editar">${I('pencil')}</button></div>`;
/* Ficha de un pago o ingreso (al tocar su nombre): cuánto supone al año y al mes, lo pagado este año y los últimos cargos. */
/* Ficha de un pago o ingreso (al tocar su nombre), con el color de su categoría: cuánto supone al año y al mes,
   lo pagado este año (barra frente a lo previsto) y los últimos cargos. */
function fxInfo(f) {
  const y = TD().slice(0, 4),
    G = f.t === 'g',
    c = col(f.cat),
    L = S.tx.filter(x => x.fid === f.id).sort((a, b) => b.date.localeCompare(a.date)),
    LY = L.filter(x => x.date.startsWith(y)),
    hy = LY.reduce((a, x) => a + x.amt, 0),
    an = f.var ? f.amt * 12 : yearly(f),
    p = an ? Math.min(100, (hy / an) * 100) : 0;
  const o = modal(
    `<div class="fxinf" style="--c:${c}"><div class="fxhero">${tile(CI[f.cat] || 'receipt', c)}<h3>${esc(f.name)}</h3><span class="mu">${esc(f.cat || '')} · ${fxWhen(f)}</span>${
      f.once
        ? `<b>${eur(f.amt)}</b><small>Una sola vez</small>`
        : `<span class="fxhk">${G ? 'Te cuesta al año' : 'Te entra al año'}</span><b>${eur(an)}</b><small>${f.var ? 'Previsto: ' : ''}${eur(an / 12)} al mes</small>`
    }</div>
    <div class="fxprog"><div class="fxpt"><span>${G ? 'Pagado' : 'Cobrado'} en ${y}</span><b>${eur(hy)}</b></div>${f.once ? '' : `<div class="fxpb"><i style="width:${p.toFixed(0)}%"></i></div>`}<div class="mu">${LY.length} cargo${LY.length === 1 ? '' : 's'}${an && !f.once ? ' · ' + Math.round(p) + ' % de lo previsto en el año' : ''}</div></div>
    ${G && !f.once ? `<div class="mu" style="margin:10px 0 4px">¿Lo sigues usando? Darlo de baja te ahorra ${eur(an)} al año.</div>` : ''}
    ${
      L.length
        ? `<div class="dh" style="margin-top:12px">Últimos cargos</div>${L.slice(0, 6)
            .map(
              x =>
                `<div class="row"><span class="g">${fd(x.date)}${fromBank(x) ? '<span class="mu"> · Del banco</span>' : ''}</span><span class="amt">${eur(x.amt)}</span></div>`
            )
            .join('')}`
        : ''
    }</div>
    <div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button><button class="btn" id="fxe">${I('pencil', 'sm')} Editar</button></div>`
  );
  o.querySelector('#fxe').onclick = () => {
    o.remove();
    fixedForm(f);
  };
}
/* Fila de un pago variable: lo que lleva este mes frente a lo previsto. */
const fxVarItem = f => {
  const v = fxVar(f, MN(new Date()));
  return `<div class="row brow">${tile(CI[f.cat] || 'receipt', col(f.cat))}<span class="g"><button class="link tt fxn" data-a="fxinf" data-i="${f.id}" title="Ver lo que cuesta al año">${esc(f.name)}</button><span class="mu">${fxFreq(f)}${fxEnd(f)} · ${v.n} cargo${v.n === 1 ? '' : 's'} este mes</span></span><span class="chip ${v.s >= f.amt ? 'ok' : ''}">Llevas ${eur(v.s)}</span><span class="amt">≈ ${eur(f.amt)}</span><button class="ib" data-a="ef" data-i="${f.id}" aria-label="Editar">${I('pencil')}</button></div>`;
};
/* Pagos de Facturas de este mes: total previsto (lo real si ya llegó), lo pagado y la lista (incluye lo atrasado del mes anterior). */
function fxMonth() {
  const now = new Date(),
    m = MN(now),
    a = m + '-01',
    b = m + '-' + p2(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  let tot = 0,
    paid = 0;
  const cur = S.fixed
    .filter(f => f.t === 'g' && fxLive(f))
    .filter(f => {
      // Variable: cuenta lo previsto o lo cobrado si ya se ha pasado; falta lo que quede hasta lo previsto.
      if (f.var) {
        if (f.from && f.from > m) return false;
        const v = fxVar(f, m);
        tot += Math.max(f.amt, v.s);
        paid += v.s;
        return true;
      }
      const oc = fxOcc(f, a, b),
        d = fxState(f).due;
      oc.forEach(d => {
        const x = S.tx.find(x => x.fid === f.id && Math.abs(dd(x.date, d)) <= 10);
        tot += x ? x.amt : f.amt;
        if (x) paid += x.amt;
      });
      return oc.length || (d && d < a);
    });
  return { tot, paid, cur };
}
/* Lo que aún falta por cobrarse de Facturas este mes: se descuenta del «Disponible». */
const fxLeft = () => {
  const o = fxMonth();
  return Math.max(0, o.tot - o.paid);
};
function vFact() {
  const act = S.fixed.filter(fxLive),
    now = new Date(),
    m = MN(now),
    a = m + '-01',
    b = m + '-' + p2(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  const by = (L, key) =>
    L.map(f => [key(f) || '9999', f])
      .sort((p, q) => p[0].localeCompare(q[0]))
      .map(x => fxItem(x[1]))
      .join('');
  const pays = act.filter(f => f.t === 'g'),
    ings = act.filter(f => f.t === 'i'),
    det = fxDetect().filter(o => !o.f);
  // Este mes: lo que se cobra en el mes (pagado o no) y lo atrasado del mes anterior que no llegó.
  const { tot, paid, cur } = fxMonth();
  const rest = pays.filter(f => !cur.includes(f));
  const paus = S.fixed.filter(f => f.pause);
  const mes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(now),
    ingm = ings.reduce(
      (q, f) =>
        q +
        fxOcc(f, a, b).reduce((s, d) => {
          const x = S.tx.find(x => x.fid === f.id && Math.abs(dd(x.date, d)) <= 10);
          return s + (x ? x.amt : f.amt);
        }, 0),
      0
    );
  const pag =
    `<div class="mu">Pagado ${eur(paid)} · Falta ${eur(tot - paid)}</div>${tot ? `<div class="bar fxbar" role="img" aria-label="Pagado el ${Math.round((paid / tot) * 100)} % de los pagos del mes"><div style="width:${Math.min(100, (paid / tot) * 100)}%;background:var(--ok)"></div></div>` : ''}` +
    (cur.length ? `<div class="dh">Este mes</div>${by(cur, f => fxOcc(f, a, b)[0] || fxState(f).due)}` : '') +
    (rest.length ? `<div class="dh">Próximos</div>${by(rest, f => fxState(f).next)}` : '') +
    (paus.length ? `<div class="dh">En pausa</div>${paus.map(fxPauseItem).join('')}` : '');
  const C = {
    det:
      det.length &&
      panel(
        'fact',
        'det',
        `${I('sparkles')} Detectados en el banco <span class="cnt">· Se repiten cada mes</span>`,
        det
          .map(
            o =>
              `<div class="row brow">${tile(CI[o.x.cat] || 'receipt', col(o.x.cat))}<span class="g"><span class="tt">${esc(concept(o.x))}</span><br><span class="mu">${o.n} meses seguidos · Último ${fdc(o.x.date)} · ${esc(o.x.cat)}</span></span><span class="amt">${eur(o.x.amt)}</span><button class="btn sm" data-a="fxa" data-i="${esc(o.k)}">Añadir</button><button class="btn sm ghost" data-a="fxi" data-i="${esc(o.k)}">Ignorar</button></div>`
          )
          .join(''),
        'wide'
      ),
    ing:
      ings.length &&
      panel(
        'fact',
        'ing',
        `${I('wallet')} Ingresos`,
        by(ings, f => fxState(f).due) +
          `<div class="mu" style="margin-top:8px">En ${mes} quedan libres <b class="${ingm - tot < 0 ? 'er' : 'ok'}">${eur(ingm - tot)}</b> (ingresos ${eur(ingm)} − pagos ${eur(tot)})</div>`,
        'wide'
      ),
    pag: panel(
      'fact',
      'pag',
      `${I('receipt')} Pagos <span class="cnt">· ${cap(mes)}: ${eur(tot)}</span>`,
      pays.length || paus.length ? pag : empty('Sin pagos todavía.'),
      'wide'
    )
  };
  VIS.fact = ord(
    'fact',
    ['det', 'ing', 'pag'].filter(k => C[k])
  );
  return `<div class="hdr"><div><h2>Facturas</h2><div class="sub help">Pagos e ingresos que se repiten. Se marcan como pagados solos cuando llega el cargo del banco; la app ya no apunta gastos por su cuenta.</div></div><div class="hact"><button class="btn" data-a="fxn">${I('plus')} Añadir</button></div></div>
  <div class="grid">${VIS.fact.map(k => C[k]).join('')}</div>`;
}

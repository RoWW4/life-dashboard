'use strict';
/* Ventanas de Facturas: alta y edición de pagos e ingresos, y llevar un movimiento a Facturas (ver vistas/facturas.js). */
/* Alta y edición de un pago o ingreso de Facturas. */
/* Mes de inicio como AAAA-MM. Acepta AAAA-MM o una fecha escrita (01/11/27, 11/2027…); '' si está vacío, null si no se entiende. */
const ymOf = s => {
  s = (s || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})$/),
    y,
    mo;
  if (m) {
    y = +m[1];
    mo = +m[2];
  } else {
    const p = s
      .split(/[^\d]+/)
      .filter(Boolean)
      .map(Number);
    if (p.length < 2) return null;
    y = p[p.length - 1];
    mo = p[p.length - 2];
    if (y < 100) y += 2000;
  }
  return mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100 ? y + '-' + p2(mo) : null;
};
function fixedForm(f, isNew) {
  const fq = fxFq(f),
    opt = (L, v) => L.map(([k, n]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${n}</option>`).join('');
  const o =
    modal(`<h3>${isNew ? 'Nueva factura o pago' : 'Editar'}</h3><div class="fs"><label>Nombre<input id="ff1" value="${esc(f.name)}" placeholder="Ej. Gimnasio, Seguro coche…"></label>
    <div class="two"><label>Importe (€)<input id="ff2" inputmode="decimal" value="${f.amt || ''}"></label><label>Tipo<select id="ff0">${opt(
      [
        ['g', 'Gasto'],
        ['i', 'Ingreso']
      ],
      f.t
    )}</select></label></div>
    <div class="two"><label>Se repite<select id="ff6">${opts(['Mensual', 'Trimestral', 'Semestral', 'Anual', 'Única', 'Variable'], fq)}</select></label><label>Categoría<select id="ff4">${opts(CATS, f.cat)}</select></label></div>
    <div class="two"><label class="r-d">Día del mes<input id="ff3" value="${f.days ? f.days.join(', ') : f.day || 1}"></label><label class="r-m">Mes<select id="ff7">${opt(
      MS.slice(1).map((n, i) => [i + 1, n]),
      f.month || +TD().slice(5, 7)
    )}</select></label><label class="r-o">Fecha<input id="ff8" type="date" value="${f.once || ''}"></label></div>
    <div class="mu r-v">Variable: varios cargos al mes sin día fijo (p. ej. gasolina). Pon en Importe lo que sueles gastar al mes; se juntan todos los cargos del banco con este nombre.</div>
    <label class="r-v">También reconoce (palabras separadas por comas)<input id="ff9" value="${esc((f.kx || []).join(', '))}" placeholder="Ej. gasolina, repsol"></label>
    <div class="two r-f"><label>Empieza en<input id="ff5" type="month" value="${f.from || ''}"></label><label>Termina en (opcional)<input id="ff10" type="month" value="${(f.until || '').slice(0, 7)}"></label></div>
    <label>Nota (opcional)<input id="ff12" value="${esc(isNew ? '' : fxNote(f))}" placeholder="De qué es, p. ej. lo que se compró a plazos"></label>
    <div class="mu">Mientras no llegue el mes de inicio sale como previsto y no cuenta como gasto. Vacío = ya se está cobrando. «Termina en» es el último mes que se paga; vacío = sin fin. Cuando llega el cargo del banco se marca como pagado solo.</div><div class="chkr"><label class="chk"><input type="checkbox" id="ff11" ${f.pause ? 'checked' : ''}> En pausa</label><button type="button" class="ib inf" aria-label="Qué es en pausa" aria-expanded="false">${I('info', 'sm')}</button></div><div class="infx mu" hidden>Se queda guardado en Facturas pero no cuenta en los pagos, el disponible ni los avisos. Quita la pausa cuando empieces a pagarlo tú.</div></div><div class="acts">${isNew ? '' : `<button class="btn ghost danger" data-a="df" data-i="${f.id}">${I('trash-2', 'sm')} Quitar</button>`}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
  const v = s => o.querySelector(s).value.trim(),
    sh = () => {
      const q = v('#ff6');
      o.querySelector('.r-d').hidden = q === 'Única' || q === 'Variable';
      o.querySelector('.r-m').hidden = q !== 'Anual';
      o.querySelector('.r-o').hidden = q !== 'Única';
      o.querySelector('.r-f').hidden = q === 'Única';
      o.querySelectorAll('.r-v').forEach(e => (e.hidden = q !== 'Variable'));
      o.querySelector('.r-v').hidden = q !== 'Variable';
    };
  o.querySelector('#ff6').onchange = sh;
  sh();
  o.querySelector('.inf').onclick = e => {
    const b = e.currentTarget,
      t = b.parentElement.nextElementSibling;
    t.hidden = !t.hidden;
    b.setAttribute('aria-expanded', !t.hidden);
  };
  o.querySelectorAll('[data-a="df"]').forEach(b => b.addEventListener('click', () => o.remove()));
  o.querySelector('#ok').onclick = () => {
    const q = v('#ff6'),
      n = v('#ff1'),
      a = pnum(v('#ff2')),
      ds = v('#ff3')
        .split(/[^\d]+/)
        .map(Number)
        .filter(d => d >= 1 && d <= 31),
      fr = q === 'Única' ? '' : ymOf(v('#ff5')),
      un = q === 'Única' ? '' : ymOf(v('#ff10'));
    if (!n || !(a > 0)) return toast('Indica nombre e importe');
    // «Empieza en» no válido (p. ej. una fecha escrita que el móvil no entiende): avisar en vez de guardarlo vacío.
    if (q !== 'Única' && (fr === null || o.querySelector('#ff5').validity.badInput))
      return toast('«Empieza en» no es válido: elige el mes y el año (p. ej. noviembre de 2027)');
    if (q !== 'Única' && (un === null || o.querySelector('#ff10').validity.badInput))
      return toast('«Termina en» no es válido: elige el mes y el año (p. ej. diciembre de 2028)');
    if (un && fr && un < fr) return toast('«Termina en» no puede ser antes de «Empieza en»');
    if (q !== 'Variable' && (q === 'Única' ? !v('#ff8') : !ds.length))
      return toast(q === 'Única' ? 'Indica la fecha' : 'Indica el día del mes');
    // Movimientos apuntados a mano antes del nuevo inicio (los del banco no se tocan).
    const old = fr && !isNew ? S.tx.filter(x => x.fid === f.id && !fromBank(x) && mon(x.date) < fr) : [];
    const done = () => {
      ['day', 'days', 'month', 'every', 'once', 'from', 'until', 'var', 'kx'].forEach(k => delete f[k]);
      Object.assign(f, { name: n, amt: a, t: v('#ff0'), cat: v('#ff4') });
      const nt0 = v('#ff12'),
        nt1 = isNew ? '' : fxNote(f);
      if (nt0 !== nt1)
        S.tx.forEach(x => {
          if (x.fid === f.id && x.note === nt1) delete x.note;
        });
      if (nt0) f.note = nt0;
      else delete f.note;
      if (o.querySelector('#ff11').checked) f.pause = true;
      else delete f.pause;
      if (q === 'Variable') {
        f.var = true;
        if (fr) f.from = fr;
        if (!f.k) f.k = nt(n).trim();
        const kx = v('#ff9')
          .split(',')
          .map(w => nt(w).trim())
          .filter(w => w && w !== f.k);
        if (kx.length) f.kx = kx;
        // Los cargos de los últimos meses con alguna de esas palabras quedan enlazados (del banco o apuntados a mano).
        S.tx.forEach(x => {
          if (!x.fid && !x.billId && x.t === f.t && x.date >= mAdd(MN(new Date()), -5) + '-01' && fxHas(f, nt(concept(x)))) x.fid = f.id;
        });
      } else if (q === 'Única') {
        f.once = v('#ff8');
        f.from = mon(f.once);
      } else {
        if (ds.length > 1) f.days = ds;
        else f.day = ds[0];
        if (q === 'Anual') f.month = +v('#ff7');
        if (FQ[q] === 3 || FQ[q] === 6) f.every = FQ[q];
        const st = fr || (f.every ? MN(new Date()) : '');
        if (st) f.from = st;
      }
      // Fecha de fin: el último día de ese mes (los cobros de ese mes aún cuentan).
      if (un) f.until = un + '-' + p2(new Date(+un.slice(0, 4), +un.slice(5, 7), 0).getDate());
      if (old.length) {
        const ids = new Set(old.map(x => x.id));
        S.tx = S.tx.filter(x => !ids.has(x.id));
      }
      if (isNew) S.fixed.push(f);
      o.remove();
      ch();
    };
    if (old.length)
      CF(
        `Se quitarán ${old.length} pago${old.length > 1 ? 's' : ''} de «${f.name}» anterior${old.length > 1 ? 'es' : ''} a ${MS[+fr.slice(5)]} ${fr.slice(0, 4)} que marcaste a mano (${eur(old.reduce((q, x) => q + x.amt, 0))}). ¿Seguir?`,
        done
      );
    else done();
  };
  o.querySelector('#ff1').focus();
}
/* Lleva un movimiento a Facturas: los anteriores con el mismo concepto quedan enlazados y los siguientes
   del banco se enlazarán solos. */
function makeFixed(x) {
  // Pago a plazos («Paypal · Pago 3 plazos»): empieza en el cargo más antiguo con ese concepto y se propone como fin el mes del último plazo.
  const pz = +((concept(x).match(/(\d+)\s*plazos/i) || [])[1] || 0),
    k0 = nt(concept(x)).trim(),
    m0 = !pz
      ? mon(x.date)
      : S.tx.reduce((m, y) => (!y.fid && y.t === x.t && nt(concept(y)).trim() === k0 && mon(y.date) < m ? mon(y.date) : m), mon(x.date));
  const o = modal(
    `<h3>Añadir a Facturas</h3><div class="fs"><label>Nombre<input id="mf1" value="${esc(concept(x))}"></label><div class="two"><label>Importe (€)<input id="mf2" inputmode="decimal" value="${x.amt}"></label><label>Día del mes<input id="mf3" type="number" min="1" max="31" value="${+x.date.slice(8)}"></label></div><label>Se repite<select id="mf4"><option value="m">Cada mes</option><option value="a">Cada año (en ${MS[+x.date.slice(5, 7)]})</option></select></label><label>Termina en (opcional)<input id="mf5" type="month" value="${pz ? mAdd(m0, pz - 1) : ''}"></label><div class="mu">Saldrá en Facturas. Cuando llegue el próximo cargo del banco se marcará como pagado solo. «Termina en» es el último mes que se paga; vacío = sin fin.${pz ? ` Rellenado con los ${pz} plazos del concepto, contando desde el primer cargo que hay en el panel.` : ''}</div></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const n = o.querySelector('#mf1').value.trim(),
      a = pnum(o.querySelector('#mf2').value),
      d = Math.min(31, Math.max(1, +o.querySelector('#mf3').value || 1)),
      an = o.querySelector('#mf4').value === 'a',
      un = o.querySelector('#mf5').value;
    if (!n || !(a > 0)) return toast('Indica nombre e importe');
    if (un && un < m0) return toast('«Termina en» no puede ser antes del primer cargo');
    const k = nt(concept(x)).trim(),
      f = {
        id: 'fx-' + id(),
        name: n,
        t: x.t,
        amt: a,
        cat: x.cat,
        day: d,
        from: m0,
        k,
        ...(an ? { month: +x.date.slice(5, 7) } : {}),
        ...(un ? { until: un + '-' + p2(new Date(+un.slice(0, 4), +un.slice(5, 7), 0).getDate()) } : {})
      };
    S.tx.forEach(y => {
      if (y === x || (!y.fid && y.t === x.t && nt(concept(y)).trim() === k)) y.fid = f.id;
    });
    S.fixed.push(f);
    o.remove();
    ch();
    toast('🔁 Añadido a Facturas');
  };
  o.querySelector('#mf1').focus();
}

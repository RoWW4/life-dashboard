'use strict';
/* Ventanas para añadir y editar: tareas, movimientos, compra, Facturas, vacaciones y documentos. */
/* ---------- formularios en modal ---------- */
function taskForm(t, pre) {
  const n = !t;
  t = t || { title: '', due: '', tm: '', pr: 'Normal', area: 'Personal', rep: '', ...pre };
  const o = modal(
    `<h3>${n ? (t.area === 'Cumpleaños' ? 'Nuevo cumpleaños' : 'Nueva tarea') : 'Editar tarea'}</h3><div class="fs"><label>Título<input id="ft1" value="${esc(t.title)}" placeholder="${t.area === 'Cumpleaños' ? 'Ej. Cumpleaños de …' : '¿Qué hay que hacer?'}"></label><div class="two"><label>Fecha<input id="ft2" type="date" value="${t.due || ''}"></label><label>Hora<input id="ft3" type="time" value="${t.tm || ''}"></label></div><div class="two"><label>Prioridad<select id="ft4">${opts(PR, t.pr)}</select></label><label>Área<select id="ft5">${opts(AREAS, t.area)}</select></label></div><label>Repetir<select id="ft6"><option value="">No se repite</option>${opts(REP, t.rep)}</select></label><label>Aviso por Telegram<input id="ft7" type="datetime-local" value="${t.rem || ''}"></label><div class="mu" style="margin-top:-4px">Vacío: te avisa 1 día antes (a las 9:00 si la tarea no tiene hora). Puede llegar hasta unos 15 min tarde.</div><div class="notes"><h4>${I('message-square', 'sm')} Notas y enlaces</h4><div id="fnl"></div><div class="nadd"><input id="fn1" class="in" placeholder="Escribe una nota o pega un enlace"><button class="btn sm" id="fn2" aria-label="Añadir nota">${I('plus', 'sm')}</button></div></div></div><div class="acts">${n ? '' : '<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Añadir' : 'Guardar'}</button></div>`
  );
  const v = i => o.querySelector(i).value.trim();
  /* Notas: en una tarea ya creada se guardan al momento; en una nueva, al pulsar «Añadir». */
  let nl = [...(t.notes || [])];
  const cur = () => S.tasks.find(x => x.id === t.id) || t; // por si la nube ha cambiado el objeto mientras la ventana estaba abierta
  const keep = () => {
    if (n) return;
    const c = cur();
    if (nl.length) c.notes = nl;
    else delete c.notes;
    ch();
  };
  const drawN = () => {
    o.querySelector('#fnl').innerHTML = nl.length
      ? nl
          .map(
            x =>
              `<div class="note"><div class="g"><span class="nt">${linkify(x.tx)}</span><span class="nd">${fd(x.at)}</span></div><button class="ib" data-e="${x.id}" aria-label="Editar nota">${I('pencil', 'sm')}</button><button class="ib" data-n="${x.id}" aria-label="Borrar nota">${I('x', 'sm')}</button></div>`
          )
          .join('')
      : '<div class="mu nd">Aún no hay notas.</div>';
    o.querySelectorAll('#fnl [data-n]').forEach(
      b =>
        (b.onclick = () => {
          nl = nl.filter(x => x.id !== b.dataset.n);
          keep();
          drawN();
          toast('Nota borrada');
        })
    );
    o.querySelectorAll('#fnl [data-e]').forEach(b => (b.onclick = () => editN(b.closest('.note'), b.dataset.e)));
  };
  /* Editar una nota en su sitio: Intro o ✓ guarda, Escape o ✕ cancela. */
  const editN = (row, k) => {
    const x = nl.find(y => y.id === k);
    if (!x) return;
    row.innerHTML = `<input class="in g" value="${esc(x.tx)}" aria-label="Editar nota"><button class="ib" data-s aria-label="Guardar nota">${I('check', 'sm')}</button><button class="ib" data-c aria-label="Cancelar">${I('x', 'sm')}</button>`;
    const e = row.querySelector('input'),
      ok = () => {
        const tx = e.value.trim();
        if (!tx) return toast('La nota está vacía');
        nl = nl.map(y => (y.id === k ? { ...y, tx } : y));
        keep();
        drawN();
        toast('Nota guardada');
      };
    row.querySelector('[data-s]').onclick = ok;
    row.querySelector('[data-c]').onclick = drawN;
    e.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        ok();
      } else if (ev.key === 'Escape') {
        ev.stopPropagation();
        drawN();
      }
    });
    e.focus();
    e.setSelectionRange(e.value.length, e.value.length);
  };
  const addN = () => {
    const e = o.querySelector('#fn1'),
      tx = e.value.trim();
    if (!tx) return;
    nl = [...nl, { id: id(), at: TD(), tx }];
    e.value = '';
    keep();
    drawN();
    e.focus();
  };
  o.querySelector('#fn2').onclick = addN;
  o.querySelector('#fn1').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      addN();
    }
  });
  drawN();
  o.querySelector('#ok').onclick = () => {
    const d = { title: v('#ft1'), due: v('#ft2'), tm: v('#ft3'), pr: v('#ft4'), area: v('#ft5'), rep: v('#ft6') };
    if (!d.title) return toast('Escribe un título');
    if (d.area === 'Cumpleaños' && !d.rep) d.rep = 'Anual'; // los cumpleaños se repiten cada año
    // Aviso por Telegram a una fecha y hora concretas (t.rem = 'AAAA-MM-DDTHH:MM'); sustituye al aviso de 1 día antes.
    const rem = v('#ft7');
    if (rem && rem !== (t.rem || '') && rem < TD() + 'T' + new Date().toTimeString().slice(0, 5))
      return toast('La hora del aviso ya ha pasado');
    if (rem) d.rem = rem;
    else if (!n) delete cur().rem;
    const pend = v('#fn1');
    if (pend) nl = [...nl, { id: id(), at: TD(), tx: pend }]; // nota escrita sin pulsar +
    if (nl.length) d.notes = nl;
    else if (!n) delete cur().notes;
    if (n) {
      if (S.tasks.some(x => !x.done && x.title.toLowerCase() === d.title.toLowerCase() && x.due === d.due))
        return toast('Ya existe esa tarea');
      S.tasks.push({ id: id(), ...d, done: false });
    } else Object.assign(cur(), d);
    o.remove();
    ch();
    toast(n ? '✅ Tarea añadida' : 'Guardado');
  };
  const del = o.querySelector('#fdel');
  if (del)
    del.onclick = () => {
      o.remove();
      A.dt(t.id);
    };
  o.querySelector('#ft1').focus();
}
function txForm() {
  const o = modal(
    `<h3>Nuevo movimiento</h3><div class="fs"><div class="seg" id="ftt"><button class="on" data-t="g">${I('arrow-down-left', 'sm')} Gasto</button><button data-t="i">${I('arrow-up-right', 'sm')} Ingreso</button></div><div class="two"><label>Importe (€)<input id="fx2" inputmode="decimal" placeholder="0,00"></label><label>Fecha<input id="fx4" type="date" value="${TD()}"></label></div><label>Descripción<input id="fx5" placeholder="Ej. Mercadona"></label><label>Categoría<select id="fx3">${opts(GCATS, 'Otros')}</select></label><div class="mu" id="fxh" style="margin-top:-4px" hidden></div></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Añadir</button></div>`
  );
  let t = 'g',
    touched = false;
  // En un ingreso, la misma frase que al editarlo: devolución, ingreso o no cuenta.
  const h = o.querySelector('#fxh'),
    hUpd = () => {
      h.hidden = t !== 'i';
      if (t === 'i')
        h.innerHTML = txHint(
          o.querySelector('#fx3').value,
          pnum(o.querySelector('#fx2').value) || 0,
          o.querySelector('#fx4').value || TD()
        );
    };
  o.querySelectorAll('#ftt button').forEach(
    b =>
      (b.onclick = () => {
        t = b.dataset.t;
        o.querySelectorAll('#ftt button').forEach(x => x.classList.toggle('on', x === b));
        const sc = o.querySelector('#fx3'),
          v = sc.value;
        sc.innerHTML = opts(t === 'i' ? ICATS : GCATS, v); // en un gasto no sale Nómina
        if (!touched) sc.value = t === 'i' ? 'Nómina' : classify(o.querySelector('#fx5').value);
        hUpd();
      })
  );
  o.querySelector('#fx3').onchange = () => {
    touched = true;
    hUpd();
  };
  o.querySelector('#fx5').oninput = e => {
    if (!touched) o.querySelector('#fx3').value = classify(e.target.value, t);
    hUpd();
  };
  ['#fx2', '#fx4'].forEach(i => o.querySelector(i).addEventListener('input', hUpd));
  o.querySelector('#ok').onclick = () => {
    const a = pnum(o.querySelector('#fx2').value),
      dt = o.querySelector('#fx4').value;
    if (!(a > 0) || !dt) return toast('Introduce un importe válido y una fecha');
    S.tx.push({ id: id(), t, amt: a, cat: o.querySelector('#fx3').value, date: dt, desc: o.querySelector('#fx5').value.trim() });
    o.remove();
    ch();
    toast('💶 Movimiento añadido');
  };
  o.querySelector('#fx2').focus();
}
/* Frase bajo la categoría de un ingreso: qué hará la categoría elegida (devolución, ingreso o no cuenta). */
const txHint = (c, a, date) => {
  const y = { t: 'i', cat: c, date };
  return c === NOCNT
    ? 'No cuenta: dinero entre tus cuentas o el pago de un encargo.'
    : isDev(y)
      ? `${I('arrow-down-left', 'sm')} Devolución: resta ${eur(a)} de «${esc(c)}» y no cuenta como ingreso.`
      : `Cuenta como ingreso${incMon(y) !== mon(date) ? ' del mes siguiente (llega a final de mes)' : ' del mes'}.`;
};
/* Ficha de un movimiento: descripción, categoría, nota y «extraordinario». Los del banco no dejan cambiar importe, fecha ni tipo.
   dr: lo escrito antes de cambiar entre gasto e ingreso (la ventana se vuelve a abrir con el otro tipo). */
function txEdit(x, dr) {
  const bk = fromBank(x),
    sp = isSplit(x),
    d = { t: x.t, desc: x.desc || '', amt: (+x.amt).toFixed(2).replace('.', ','), date: x.date, cat: x.cat, note: x.note || '', ...dr },
    gi = d.t === 'g';
  const cats = gi ? GCATS : ICATS;
  const o = modal(
    `<h3>Editar ${gi ? 'gasto' : 'ingreso'}</h3><div class="fs">${bk || sp ? '' : `<div class="seg" id="ext"><button class="${gi ? 'on' : ''}" data-t="g">${I('arrow-down-left', 'sm')} Gasto</button><button class="${gi ? '' : 'on'}" data-t="i">${I('arrow-up-right', 'sm')} Ingreso</button></div>`}<label>Descripción<input id="ex1" value="${esc(d.desc)}"></label><div class="two"><label>Importe (€)<input id="ex2" inputmode="decimal" value="${esc(d.amt)}" ${bk ? 'disabled' : ''}></label><label>Fecha<input id="ex3" type="date" value="${d.date}" ${bk ? 'disabled' : ''}></label></div>${bk ? `<div class="mu" style="margin-top:-4px">${I('landmark', 'sm')} Viene del banco: el importe, la fecha y el tipo no se pueden cambiar.</div>` : ''}${
      sp
        ? `<div class="mu">${I('split', 'sm')} Dividido: ${txp(x)
            .map(p => (p.enc ? 'encargo' : esc(p.cat)) + ' ' + eur(p.amt))
            .join(' · ')}</div>`
        : `<label>Categoría<select id="ex4">${opts(cats, d.cat)}</select></label>${gi ? '' : '<div class="mu" id="exh" style="margin-top:-4px"></div>'}`
    }<label>Nota<input id="ex5" value="${esc(d.note)}" placeholder="Opcional"></label>${gi ? `<div class="chkr"><label class="chk"><input type="checkbox" id="ex6" ${x.ex ? 'checked' : ''}> Gasto extraordinario</label><button type="button" class="ib inf" aria-label="Qué es un gasto extraordinario" aria-expanded="false">${I('info', 'sm')}</button></div><div class="infx mu" hidden>Se ve en la lista, pero no cuenta en el gasto del mes ni en las comparaciones (p. ej. un pago grande y puntual).</div>${sp ? '' : `<div class="chkr"><label class="chk"><input type="checkbox" id="ex7" ${x.enc ? 'checked' : ''}> Encargo</label><button type="button" class="ib inf" aria-label="Qué es un encargo" aria-expanded="false">${I('info', 'sm')}</button></div><div class="infx mu" hidden>Compra para otra persona que te paga en mano: no cuenta como gasto tuyo. Si solo una parte es encargo, usa «Dividir».</div>`}` : ''}</div><div class="acts"><button class="btn ghost danger" id="fdel">Eliminar</button>${gi && x.t === 'g' ? `<button class="btn ghost" id="fspl" title="Repartir el importe en varias categorías o separar la parte que es encargo">${I('split', 'sm')} ${sp ? 'Cambiar división' : 'Dividir'}</button>` : ''}${x.billId || d.t !== x.t ? '' : `<button class="btn ghost" id="fmkf">${I('repeat', 'sm')} ${x.fid ? 'Quitar de Facturas' : 'Añadir a Facturas'}</button>`}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  const v = i => o.querySelector(i).value.trim();
  // Gasto ↔ ingreso (solo apuntados a mano): se vuelve a abrir la ficha con el otro tipo, sin perder lo escrito.
  o.querySelectorAll('#ext button').forEach(
    b =>
      (b.onclick = () => {
        if (b.dataset.t === d.t) return;
        const t = b.dataset.t,
          desc = v('#ex1');
        o.remove();
        txEdit(x, {
          t,
          desc,
          amt: v('#ex2'),
          date: v('#ex3'),
          note: v('#ex5'),
          cat: t === x.t ? x.cat : t === 'i' ? 'Otros' : classify(desc, 'g')
        });
      })
  );
  // En un ingreso, una frase dice qué hará la categoría elegida: devolución (resta de ese gasto), ingreso o no cuenta.
  const hint = o.querySelector('#exh'),
    hintUpd = () => {
      hint.innerHTML = txHint(v('#ex4'), pnum(v('#ex2')) || 0, v('#ex3') || x.date);
    };
  if (hint) {
    ['#ex2', '#ex3', '#ex4'].forEach(i => o.querySelector(i).addEventListener(i === '#ex4' ? 'change' : 'input', hintUpd));
    hintUpd();
  }
  // Iconos «i»: muestran u ocultan la explicación de cada casilla.
  o.querySelectorAll('.inf').forEach(
    b =>
      (b.onclick = () => {
        const t = b.parentElement.nextElementSibling;
        t.hidden = !t.hidden;
        b.setAttribute('aria-expanded', !t.hidden);
      })
  );
  o.querySelector('#ok').onclick = () => {
    const a = pnum(v('#ex2')),
      dt = v('#ex3'),
      cat = sp ? x.cat : v('#ex4');
    if (sp && !bk && Math.abs(a - x.amt) >= 0.01) return toast('Está dividido: quita la división antes de cambiar el importe');
    if (!bk && (!(a > 0) || !dt)) return toast('Introduce un importe válido y una fecha');
    x.desc = v('#ex1');
    if (!bk) {
      x.amt = a;
      x.date = dt;
    }
    const nt0 = v('#ex5');
    if (nt0) x.note = nt0;
    else delete x.note;
    if (d.t !== x.t) {
      x.t = d.t;
      ['ex', 'enc', 'parts', 'fid', 'notDup'].forEach(k => delete x[k]);
    } // cambia de tipo: fuera lo que solo vale para el otro
    const ex = o.querySelector('#ex6');
    if (ex && ex.checked) x.ex = true;
    else delete x.ex;
    const en = o.querySelector('#ex7');
    if (en) {
      if (en.checked) x.enc = true;
      else delete x.enc;
    }
    o.remove();
    if (cat !== x.cat) A.txc(x.id, { value: cat });
    else ch();
    toast('Guardado');
  };
  o.querySelector('#fdel').onclick = () => {
    o.remove();
    A.dx(x.id);
  };
  const spb = o.querySelector('#fspl');
  if (spb)
    spb.onclick = () => {
      o.remove();
      splitForm(x);
    };
  // Añadir a Facturas (se repite cada mes) o quitarlo: antes era un botón en cada fila de Movimientos.
  const mk = o.querySelector('#fmkf');
  if (mk)
    mk.onclick = () => {
      o.remove();
      A.mkf(x.id);
    };
  o.querySelector('#ex1').focus();
}
/* Dividir un gasto: cada parte con su importe y su categoría, o «Encargo» (para otra persona, no cuenta como gasto tuyo).
   La última parte es lo que falta hasta el total, así siempre cuadra. Se guarda en x.parts (ver isSplit en interfaz.js). */
function splitForm(x) {
  const ENC = '__enc',
    cats = GCATS,
    r2 = n => Math.round(n * 100) / 100;
  let P = isSplit(x)
    ? x.parts.map(p => ({ amt: (+p.amt).toFixed(2).replace('.', ','), cat: p.enc ? ENC : p.cat }))
    : [
        { amt: '', cat: x.cat },
        { amt: '', cat: x.cat }
      ];
  const o = modal(
    `<h3>Dividir gasto</h3><div class="mu" style="margin:-4px 0 12px">${esc(x.desc || x.cat)} · ${eur(x.amt)}. Pon cuánto es de cada cosa; la última parte se calcula sola.</div><div class="fs" id="spl"></div><div class="acts">${isSplit(x) ? `<button class="btn ghost danger" id="sno">Quitar división</button>` : ''}<button class="btn ghost" id="sadd">${I('plus', 'sm')} Añadir parte</button><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  const box = o.querySelector('#spl'),
    last = () => P.length - 1;
  const rest = () => r2(x.amt - P.slice(0, -1).reduce((a, p) => a + (pnum(p.amt) || 0), 0));
  const read = () =>
    box.querySelectorAll('.spl').forEach((r, i) => {
      const a = r.querySelector('input');
      if (a) P[i].amt = a.value;
      P[i].cat = r.querySelector('select').value;
    });
  const showRest = () => {
    const e = box.querySelector('.rest'),
      v = rest();
    e.textContent = eur(v);
    e.style.color = v > 0.005 ? '' : 'var(--er)';
  };
  const draw = () => {
    box.innerHTML = P.map(
      (p, i) =>
        `<div class="spl">${i < last() ? `<input inputmode="decimal" placeholder="Importe" value="${esc(p.amt)}" aria-label="Importe de la parte ${i + 1}">` : `<span class="rest" title="Lo que falta hasta el total"></span>`}<select aria-label="Categoría de la parte ${i + 1}"><option value="${ENC}" ${p.cat === ENC ? 'selected' : ''}>Encargo</option>${opts(cats, p.cat)}</select>${P.length > 2 ? `<button type="button" class="ib" data-k="${i}" aria-label="Quitar esta parte">${I('x', 'sm')}</button>` : '<span></span>'}</div>`
    ).join('');
    box.querySelectorAll('input').forEach(
      a =>
        (a.oninput = () => {
          read();
          showRest();
        })
    );
    box.querySelectorAll('[data-k]').forEach(
      b =>
        (b.onclick = () => {
          read();
          P.splice(+b.dataset.k, 1);
          draw();
        })
    );
    showRest();
  };
  draw();
  o.querySelector('#sadd').onclick = () => {
    read();
    P.splice(last(), 0, { amt: '', cat: x.cat });
    draw();
    const a = box.querySelectorAll('input');
    if (a[last() - 1]) a[last() - 1].focus();
  };
  const no = o.querySelector('#sno');
  if (no)
    no.onclick = () => {
      delete x.parts;
      o.remove();
      ch();
      toast('Ya no está dividido: cuenta entero en «' + x.cat + '»');
    };
  o.querySelector('#ok').onclick = () => {
    read();
    if (P.slice(0, -1).some(p => !(pnum(p.amt) > 0))) return toast('Pon un importe en cada parte');
    if (!(rest() > 0.005)) return toast('Las partes suman más que el total (' + eur(x.amt) + ')');
    x.parts = P.map((p, i) => ({
      amt: i < last() ? r2(pnum(p.amt)) : rest(),
      cat: p.cat === ENC ? x.cat : p.cat,
      ...(p.cat === ENC ? { enc: true } : {})
    }));
    delete x.enc;
    o.remove();
    ch();
    toast('Gasto dividido en ' + P.length + ' partes');
  };
  const a0 = box.querySelector('input');
  if (a0) a0.focus();
}
function shopForm() {
  const o = modal(
    `<h3>Añadir a la compra</h3><div class="fs"><label>Productos (separa con comas)<input id="sh1" placeholder="leche, 2 pan, tomates"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Añadir</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const n = addShop(o.querySelector('#sh1').value);
    o.remove();
    ch();
    toast('🛒 ' + n + ' producto(s) añadidos');
  };
  o.querySelector('#sh1').focus();
}
function shopEdit(s) {
  const o = modal(
    `<h3>Editar producto</h3><div class="fs"><label>Nombre<input id="se1" value="${esc(s.name)}"></label><div class="two"><label>Cantidad<input id="se2" type="number" min="1" value="${s.qty || 1}"></label><label>Precio/ud (€)<input id="se3" inputmode="decimal" value="${s.price || ''}" placeholder="Opcional"></label></div></div><div class="acts"><button class="btn ghost danger" id="fdel">Eliminar</button><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const n = o.querySelector('#se1').value.trim();
    if (!n) return toast('Escribe el nombre');
    Object.assign(s, {
      name: cap(n),
      qty: Math.max(1, +o.querySelector('#se2').value || 1),
      price: pnum(o.querySelector('#se3').value) || 0
    });
    o.remove();
    ch();
  };
  o.querySelector('#fdel').onclick = () => {
    o.remove();
    A.ds(s.id);
  };
  o.querySelector('#se1').focus();
}
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
    <div class="mu">Mientras no llegue el mes de inicio sale como previsto y no cuenta como gasto. Vacío = ya se está cobrando. «Termina en» es el último mes que se paga; vacío = sin fin. Cuando llega el cargo del banco se marca como pagado solo.</div></div><div class="acts">${isNew ? '' : `<button class="btn ghost" data-a="df" data-i="${f.id}">${I('trash-2')} Quitar</button>`}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`);
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
  const o = modal(
    `<h3>Añadir a Facturas</h3><div class="fs"><label>Nombre<input id="mf1" value="${esc(concept(x))}"></label><div class="two"><label>Importe (€)<input id="mf2" inputmode="decimal" value="${x.amt}"></label><label>Día del mes<input id="mf3" type="number" min="1" max="31" value="${+x.date.slice(8)}"></label></div><label>Se repite<select id="mf4"><option value="m">Cada mes</option><option value="a">Cada año (en ${MS[+x.date.slice(5, 7)]})</option></select></label><div class="mu">Saldrá en Facturas. Cuando llegue el próximo cargo del banco se marcará como pagado solo.</div></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const n = o.querySelector('#mf1').value.trim(),
      a = pnum(o.querySelector('#mf2').value),
      d = Math.min(31, Math.max(1, +o.querySelector('#mf3').value || 1)),
      an = o.querySelector('#mf4').value === 'a';
    if (!n || !(a > 0)) return toast('Indica nombre e importe');
    const k = nt(concept(x)).trim(),
      f = {
        id: 'fx-' + id(),
        name: n,
        t: x.t,
        amt: a,
        cat: x.cat,
        day: d,
        from: mon(x.date),
        k,
        ...(an ? { month: +x.date.slice(5, 7) } : {})
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
function addPicker() {
  const o = modal(
    `<h3>¿Qué quieres añadir?</h3><div class="pick"><button data-k="t">${tile('list-checks', '#0099ff')}Tarea</button><button data-k="x">${tile('wallet', '#2fcf7a')}Movimiento</button><button data-k="s">${tile('shopping-cart', '#f5a524')}Compra</button><button data-k="d">${tile('file-text', '#a78bfa')}Documento</button><button data-k="v">${tile('sun', '#2fcf7a')}Vacaciones</button></div>`
  );
  o.querySelectorAll('.pick button').forEach(
    b => (b.onclick = () => ({ t: () => taskForm(), x: txForm, s: shopForm, d: () => docForm(), v: vacForm })[b.dataset.k]())
  );
}
/* Vacaciones o días libres: se ven con fondo verde en el calendario (S.periods). */
function addVac(name, from, to) {
  if (S.periods.some(p => p.from === from && p.to === to)) return toast('Ese periodo ya está apuntado');
  S.periods.push({ id: id(), name, from, to });
  ch();
  toast('🌴 ' + name + (from === to ? ' · ' + dlabel(from) : ' · ' + fd(from) + ' → ' + fd(to)));
}
function vacForm() {
  const o = modal(
    `<h3>Vacaciones o días libres</h3><div class="fs"><label>Nombre<input id="fv1" value="Vacaciones"></label><div class="two"><label>Desde<input id="fv2" type="date" value="${TD()}"></label><label>Hasta<input id="fv3" type="date" value="${TD()}"></label></div><div class="mu">Para un solo día, pon la misma fecha en los dos. Se marcarán en verde en el calendario.</div></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Añadir</button></div>`
  );
  const v = i => o.querySelector(i).value.trim(),
    a = o.querySelector('#fv2'),
    b = o.querySelector('#fv3');
  a.onchange = () => {
    if (!b.value || b.value < a.value) b.value = a.value;
  };
  o.querySelector('#ok').onclick = () => {
    if (!v('#fv1') || !v('#fv2') || !v('#fv3')) return toast('Indica nombre, desde y hasta');
    if (v('#fv3') < v('#fv2')) return toast('La fecha final es anterior a la inicial');
    o.remove();
    addVac(v('#fv1'), v('#fv2'), v('#fv3'));
  };
}
function docForm(d, pre) {
  const n = !d;
  d = d || { name: '', cat: 'Otros', url: '', notes: '', exp: '', ...pre };
  const o = modal(
    `<h3>${n ? 'Nuevo documento' : 'Editar documento'}</h3><div class="fs"><label>Nombre<input id="fd1" value="${esc(d.name)}" placeholder="Ej. Póliza seguro coche"></label><div class="two"><label>Carpeta<select id="fd2">${opts(DC, d.cat)}</select></label><label>Vence<input id="fd4" type="date" value="${d.exp || ''}"></label></div><label>Enlace (Drive: Compartir → Copiar enlace)<input id="fd3" value="${esc(d.url)}" placeholder="https://drive.google.com/…" inputmode="url"></label><label>Notas<input id="fd5" value="${esc(d.notes)}" placeholder="Aseguradora, dónde está el original…"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Añadir' : 'Guardar'}</button></div>`
  );
  const v = i => o.querySelector(i).value.trim();
  o.querySelector('#ok').onclick = () => {
    let u = v('#fd3');
    if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
    const x = { name: v('#fd1'), cat: v('#fd2'), url: u, notes: v('#fd5'), exp: v('#fd4') };
    if (!x.name) return toast('Indica el nombre');
    if (n) S.docs.push({ id: id(), ...x, pin: true });
    else Object.assign(d, x);
    o.remove();
    ch();
    toast(n ? 'Documento añadido' : 'Guardado');
  };
  o.querySelector(!n && !d.url ? '#fd3' : '#fd1').focus();
}

/* Meta de ahorro (ver goalsCard en vistas/finanzas.js): nombre, objetivo, lo apartado, mes y color. */
function goalForm(g) {
  const n = !g;
  g = g || { n: '', obj: 0, amt: 0, d: '', c: GCOL[S.goals.length % GCOL.length] };
  const num = v => (v ? String(v).replace('.', ',') : '');
  const o = modal(
    `<h3>${n ? 'Nueva meta de ahorro' : 'Editar meta'}</h3><div class="fs"><label>Nombre<input id="fg1" value="${esc(g.n)}" placeholder="Ej. Viaje, colchón, ordenador…"></label><div class="two"><label>Objetivo (€)<input id="fg2" inputmode="decimal" value="${num(g.obj)}" placeholder="0,00"></label><label>Ya apartado (€)<input id="fg3" inputmode="decimal" value="${num(g.amt)}" placeholder="0,00"></label></div><label>Para cuándo (opcional)<input id="fg4" type="month" value="${g.d || ''}"></label><div class="gcols" role="radiogroup" aria-label="Color">${GCOL.map(c => `<button type="button" role="radio" aria-checked="${c === g.c}" aria-label="Color ${c}" data-c="${c}" style="--gc:${c}"></button>`).join('')}</div><div class="mu">Es un reparto del saldo de la cuenta dentro del panel: no se mueve dinero en el banco.</div></div><div class="acts">${n ? '' : '<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Crear' : 'Guardar'}</button></div>`
  );
  let c = g.c;
  o.querySelectorAll('.gcols button').forEach(b =>
    b.addEventListener('click', () => {
      c = b.dataset.c;
      o.querySelectorAll('.gcols button').forEach(x => x.setAttribute('aria-checked', x === b));
    })
  );
  o.querySelector('#ok').onclick = () => {
    const nm = o.querySelector('#fg1').value.trim(),
      obj = pnum(o.querySelector('#fg2').value),
      v3 = o.querySelector('#fg3').value.trim(),
      amt = v3 ? pnum(v3) : 0,
      d = o.querySelector('#fg4').value;
    if (!nm) return toast('Ponle un nombre');
    if (!(obj > 0)) return toast('Indica cuánto quieres juntar');
    if (!(amt >= 0)) return toast('Revisa lo apartado');
    const was = !n && g.amt >= g.obj;
    if (n) S.goals.push({ id: id(), n: nm, obj, amt, d, c, c0: TD(), a0: amt });
    else Object.assign(g, { n: nm, obj, amt, d, c });
    if (!n && !was && amt >= obj) setTimeout(confeti, 150);
    o.remove();
    ch();
    toast(n ? '🎯 Meta creada' : 'Guardado');
  };
  const del = o.querySelector('#fdel');
  if (del)
    del.onclick = () => {
      o.remove();
      CF(`¿Eliminar la meta «${g.n}»? Lo apartado vuelve a «Sin asignar».`, () => {
        S.goals = S.goals.filter(x => x.id !== g.id);
        ch();
      });
    };
  o.querySelector('#fg1').focus();
}
/* Apartar (+) o sacar (−) dinero de una meta. */
function goalMove(g) {
  const o = modal(
    `<h3>${esc(g.n)}</h3><div class="mu" style="margin:-4px 0 12px">Apartado ${eur(g.amt)} de ${eur(g.obj)}</div><div class="fs"><div class="seg" id="fgt"><button class="on" data-s="1">${I('plus', 'sm')} Apartar</button><button data-s="-1">${I('minus', 'sm')} Sacar</button></div><label>Cantidad (€)<input id="fm1" inputmode="decimal" placeholder="0,00"></label></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  let sg = 1;
  o.querySelectorAll('#fgt button').forEach(b =>
    b.addEventListener('click', () => {
      sg = +b.dataset.s;
      o.querySelectorAll('#fgt button').forEach(x => x.classList.toggle('on', x === b));
    })
  );
  o.querySelector('#ok').onclick = () => {
    const v = pnum(o.querySelector('#fm1').value);
    if (!(v > 0)) return toast('Indica la cantidad');
    const was = g.amt >= g.obj;
    g.amt = Math.max(0, Math.round((g.amt + sg * v) * 100) / 100);
    o.remove();
    ch();
    toast(!was && g.amt >= g.obj ? '🎉 ¡Meta conseguida!' : sg > 0 ? 'Apartado' : 'Sacado');
    if (!was && g.amt >= g.obj) setTimeout(confeti, 150);
  };
  o.querySelector('#fm1').focus();
}

/* ---------- Compartir al panel ----------
   El móvil (Android, con el panel instalado) manda lo compartido (título, texto y enlace) al service worker (sw.js), que lo guarda
   en la caché «ldb-share» y abre el panel con ?compartir=1. Aquí se lee y se pregunta qué es: tarea, compra, enlace o gasto.
   Las fotos y los PDF no: los documentos se guardan con el bot de Telegram. */
async function shareRead() {
  if (!('caches' in window)) return null;
  const c = await caches.open('ldb-share'),
    r = await c.match('share/meta');
  if (!r) return null;
  const m = await r.json();
  await Promise.all((await c.keys()).map(k => c.delete(k)));
  return m;
}
async function shareOpen() {
  let m;
  try {
    m = await shareRead();
  } catch (e) {
    logErr('compartir', e, 'leer');
  }
  if (!m) return toast('No ha llegado nada para compartir');
  const urlIn = (m.url || (m.text.match(/https?:\/\/\S+/) || [''])[0]).trim(),
    txt = [m.title, m.text.replace(urlIn, '')]
      .map(x => (x || '').trim())
      .filter((x, i, a) => x && a.indexOf(x) === i)
      .join('\n'),
    lines = txt
      .split(/\n+/)
      .map(x => x.replace(/^[\s•\-*·\d.)]+/, '').trim())
      .filter(Boolean),
    first = lines[0] || '';
  if (!txt && !urlIn) return toast('Solo se pueden compartir textos y enlaces; los documentos, por el bot de Telegram');
  const OPT = [
    ['tarea', 'list-checks', 'Tarea'],
    ['compra', 'shopping-cart', 'Compra'],
    ...(urlIn ? [['enlace', 'link', 'Enlace']] : []),
    ['gasto', 'wallet', 'Gasto']
  ];
  const o = modal(
    `<h3>${I('inbox')} Compartido con el panel</h3><div class="shtx">${esc(txt || urlIn).replace(/\n/g, '<br>')}${txt && urlIn ? `<br><span class="mu">${esc(urlIn)}</span>` : ''}</div><div class="mu" style="margin:12px 0 6px">¿Qué es?</div><div class="seg shseg">${OPT.map(([k, ic, n], i) => `<button class="${i ? '' : 'on'}" data-k="${k}">${I(ic, 'sm')} ${n}</button>`).join('')}</div><div id="shb" class="fs" style="margin-top:12px"></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Seguir</button></div>`
  );
  let k = OPT[0][0];
  const body = o.querySelector('#shb'),
    okb = o.querySelector('#ok');
  const draw = () => {
    okb.textContent = {
      gasto: 'Seguir con el gasto',
      tarea: 'Seguir con la tarea',
      compra: 'Añadir a la compra',
      enlace: 'Seguir con el enlace'
    }[k];
    body.innerHTML =
      k === 'compra'
        ? `<div class="mu">Una cosa por línea. Quita las que no quieras.</div>${(lines.length ? lines : [first || urlIn]).map((x, i) => `<label class="shck"><input type="checkbox" class="ck" data-l="${i}" checked> <span>${esc(x)}</span></label>`).join('')}`
        : `<div class="mu">${k === 'gasto' ? 'Se abre la ventana de nuevo movimiento con lo que se pueda rellenar.' : k === 'tarea' ? 'Se abre la ventana de nueva tarea' + (urlIn ? ', con el enlace en sus notas.' : '.') : 'Se guarda en Documentos con el enlace y queda fijado en Mi día.'}</div>`;
  };
  o.querySelectorAll('.shseg button').forEach(b =>
    b.addEventListener('click', () => {
      k = b.dataset.k;
      o.querySelectorAll('.shseg button').forEach(x => x.classList.toggle('on', x === b));
      draw();
    })
  );
  draw();
  okb.onclick = () => {
    if (k === 'gasto') {
      o.remove();
      txForm();
      const f = $('.ov'),
        amt = (txt.match(/(\d+(?:[.,]\d{1,2})?)\s*€/) || [])[1];
      if (f) {
        if (first && f.querySelector('#fx5')) f.querySelector('#fx5').value = first.slice(0, 60);
        if (amt && f.querySelector('#fx2')) f.querySelector('#fx2').value = amt;
      }
      return;
    }
    if (k === 'tarea') {
      o.remove();
      return taskForm(null, { title: (first || urlIn).slice(0, 120), ...(urlIn ? { notes: [{ id: id(), at: TD(), tx: urlIn }] } : {}) });
    }
    if (k === 'enlace') {
      o.remove();
      let h = urlIn;
      try {
        h = new URL(urlIn).hostname.replace(/^www\./, '');
      } catch (e) {}
      return docForm(null, { name: (first || h).slice(0, 120), url: urlIn });
    }
    const L = (lines.length ? lines : [first || urlIn]).filter((_, i) => (o.querySelector(`[data-l="${i}"]`) || {}).checked);
    if (!L.length) return toast('No hay nada marcado');
    L.forEach(x => shopAdd(x.slice(0, 80)));
    o.remove();
    ch();
    toast(`🛒 ${L.length} cosa${L.length === 1 ? '' : 's'} en la compra`);
  };
}

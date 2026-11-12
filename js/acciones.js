'use strict';
/* Acciones de los botones (data-a) de toda la app. */
/* ---------- acciones ---------- */
const V = i => {
  const e = document.getElementById(i);
  return e ? e.value.trim() : '';
};
const A = {
  go: i => {
    view = i;
    render();
  },
  sd: i => {
    selD = i;
    render();
  },
  pm: i => {
    cm = new Date(cm.getFullYear(), cm.getMonth() + +i, 1);
    render();
  },
  fm: i => {
    finOff = Math.min(0, finOff + +i);
    render();
  },
  gm: i => {
    gOff = Math.min(0, gOff + +i);
    render();
  },
  mv: i => {
    const [v, k, d] = i.split('|'),
      keys = [...(VIS[v] || [])],
      j = keys.indexOf(k),
      n = j + +d;
    if (j < 0 || n < 0 || n >= keys.length) return;
    keys.splice(j, 1);
    keys.splice(n, 0, k);
    S.order[v] = keys;
    ch();
  },
  gp: i => {
    grp = i;
    render();
  },
  fl: i => {
    flt = i;
    render();
  },
  xp: i => {
    exp[i] = !exp[i];
    if (i === 'tx') txRefresh();
    else render();
  },
  // Ancho del panel: pasa al siguiente (1/3 → 1/2 → 2/3 → completo → 1/3) partiendo del que tiene ahora en pantalla.
  sz: (i, b) => {
    const c = b.closest('.card'),
      now = +(getComputedStyle(c).gridColumnStart.match(/\d+/) || [12])[0],
      W = [4, 6, 8, 12],
      n = W.find(w => w > now) || 4;
    SZ[i] = n;
    try {
      localStorage.setItem('ldb-size', JSON.stringify(SZ));
    } catch (e) {
      logErr('almacenamiento', e, 'ancho');
    }
    render();
    toast('Ancho del panel: ' + SZN[n]);
  },
  cust: () => {
    cust = !cust;
    render();
  },
  txm: () => {
    txN += matchMedia('(max-width:760px)').matches ? 10 : 40;
    txRefresh();
  },
  cd: i => {
    if (view !== 'fin') {
      view = 'fin';
      finOff = 0;
      render();
    }
    catDetail(i);
  },
  txfc: (i, el) => {
    txf.cat = el.value;
    txRefresh();
  },
  // Un mes concreto («m:AAAA-MM») mueve toda la sección a ese mes; el resto son periodos alrededor del mes que se ve.
  txfp: (i, el) => {
    const v = el.value;
    if (v.startsWith('m:')) {
      const n = new Date();
      finOff = +v.slice(2, 6) * 12 + +v.slice(7, 9) - (n.getFullYear() * 12 + n.getMonth() + 1);
      txf.per = 'mes';
      render();
    } else {
      txf.per = v;
      txRefresh();
    }
  },
  txft: i => {
    txf.t = i;
    render();
  },
  txr: () => {
    txf = { q: '', cat: '', per: 'mes', t: '' };
    render();
  },
  add: () => addPicker(),
  nt: () => taskForm(),
  nc: () => taskForm(null, { area: 'Cumpleaños', rep: 'Anual' }),
  nx: () => txForm(),
  et: i => taskForm(S.tasks.find(x => x.id === i)),
  tt: i => {
    const t = S.tasks.find(x => x.id === i);
    t.done = !t.done;
    // Confeti si con esta ya no queda nada para hoy (ni atrasado).
    const td = TD();
    if (t.done && t.due && t.due <= td && !S.tasks.some(x => !x.done && x.due && x.due <= td)) setTimeout(confeti, 150);
    if (t.done) t.doneAt = TD();
    else delete t.doneAt;
    if (t.done && t.rep && t.due) {
      const nd = nextDue(t.due, t.rep);
      if (!S.tasks.some(x => !x.done && x.title === t.title && x.due === nd)) {
        S.tasks.push({
          id: id(),
          title: t.title,
          due: nd,
          pr: t.pr,
          area: t.area,
          rep: t.rep,
          tm: t.tm || '',
          done: false,
          ...(t.rem ? { rem: addD(nd, dd(t.rem.slice(0, 10), t.due)) + t.rem.slice(10) } : {})
        });
        toast('🔁 Próxima: ' + fd(nd));
      }
    }
    ch();
  },
  dt: i =>
    CF('¿Eliminar esta tarea definitivamente?', () => {
      S.tasks = S.tasks.filter(x => x.id !== i);
      ch();
    }),
  as: () => {
    if (!V('s1')) return toast('Escribe un producto');
    shopAdd(V('s1'), Math.max(1, +V('s2') || 1), pnum(V('s3')) || 0);
    ch();
    $('#s1') && $('#s1').focus();
  },
  sq: i => {
    const o = S.shopN[i];
    if (!o) return;
    if (shopQEdit) {
      delete S.shopN[i];
      return ch();
    }
    if (S.shop.some(x => !x.done && shopKey(x.name) === i)) return toast('Ya está en la lista');
    shopAdd(o.n, 1, o.p || 0);
    ch();
    toast('🛒 ' + o.n + ' añadido');
  },
  sqe: () => {
    shopQEdit = !shopQEdit;
    render();
  },
  ts: i => {
    const s = S.shop.find(x => x.id === i);
    s.done = !s.done;
    ch();
  },
  es: i => shopEdit(S.shop.find(x => x.id === i)),
  ds: i => {
    S.shop = S.shop.filter(x => x.id !== i);
    ch();
  },
  cs: () =>
    CF('¿Quitar los productos comprados?', () => {
      S.shop = S.shop.filter(x => !x.done);
      ch();
    }),
  hs: () => {
    const n = addShop(V('hs'));
    if (!n) return toast('Escribe un producto nuevo');
    ch();
    $('#hs') && $('#hs').focus();
  },
  vs: () =>
    listen(t => {
      const n = addShop(t.replace(/^(?:a la compra|compra)[:,]?\s*/i, ''));
      ch();
      toast('🛒 ' + n + ' producto(s) añadidos');
    }, 'Di los productos, por ejemplo: «leche, dos de pan y tomates».'),
  vm: () =>
    listen(
      voice,
      'Por ejemplo: «compra leche y pan», «gasto 12 en farmacia», «recuérdame llamar al taller el viernes a las 10 en la categoría coche» o «vacaciones del 22 al 26 de diciembre».',
      preview
    ),
  dx: i => {
    CF('¿Eliminar este movimiento?', () => {
      S.tx = S.tx.filter(y => y.id !== i);
      ch();
    });
  },
  txc: (i, el) => {
    const x = S.tx.find(y => y.id === i);
    x.cat = el.value;
    ch();
    if (fromBank(x) && x.t === 'g') {
      const w =
        nt(x.desc)
          .trim()
          .split(' ')
          .filter(s => s.length >= 3 && !/^(compra|pago|tarjeta|recibo|transferencia|bizum|con|del|las|los)$/.test(s))[0] || '';
      CF(
        `¿Clasificar siempre como «${x.cat}» los movimientos que contengan esta palabra?`,
        k => {
          k = (k || '').trim();
          if (!k) return;
          S.rules = S.rules.filter(r => nt(r.k) !== nt(k));
          S.rules.push({ k, cat: x.cat });
          let c = 0;
          S.tx.forEach(y => {
            if (fromBank(y) && y.cat === 'Otros' && y.t === x.t && nt(y.desc).includes(nt(k).trim())) {
              y.cat = x.cat;
              c++;
            }
          });
          ch();
          toast('🏷️ Regla guardada' + (c ? ' · ' + c + ' movimientos reclasificados' : ''));
        },
        w
      );
    }
  },
  ar: () => {
    const k = V('r1');
    if (!k) return toast('Escribe una palabra');
    S.rules.push({ k, cat: V('r2') });
    ch();
  },
  dr: i => {
    S.rules.splice(+i, 1);
    ch();
  },
  afx: () => {
    const a = V('fx_a'),
      b = V('fx_b');
    if (!a || !b) return toast('Escribe la palabra mal entendida y la correcta');
    S.fixes = S.fixes.filter(f => nt(f.from) !== nt(a));
    S.fixes.push({ from: a, to: b });
    ch();
    toast('Corrección guardada');
  },
  dfx: i => {
    S.fixes.splice(+i, 1);
    ch();
  },
  rg: (i, el) => {
    S.region = el.value;
    ch();
  },
  alh: () => {
    const n = V('lh1'),
      d = V('lh2');
    if (!n || !d) return toast('Indica el nombre y la fecha');
    S.localHol = S.localHol.filter(h => h.d !== d);
    S.localHol.push({ d, n });
    ch();
  },
  dlh: i => {
    S.localHol = S.localHol.filter(h => h.d !== i);
    ch();
  },
  ape: () => {
    const n = V('pe1'),
      a = V('pe2'),
      b = V('pe3');
    if (!n || !a || !b) return toast('Indica nombre, desde y hasta');
    if (b < a) return toast('La fecha final es anterior a la inicial');
    S.periods.push({ id: id(), name: n, from: a, to: b });
    ch();
  },
  sai: () => {
    const d = V('sa1') || TD();
    if (d > TD()) return toast('La fecha no puede ser futura');
    const s = (S.salud = S.salud || { ini: [], len: SAL_LEN });
    if (s.ini.includes(d)) return toast('Ese día ya está apuntado');
    s.ini.push(d);
    s.ini.sort();
    ch();
    toast('Apuntado');
  },
  sad: i =>
    CF('¿Quitar esta fecha?', () => {
      S.salud.ini = S.salud.ini.filter(d => d !== i);
      ch();
    }),
  sah: () => {
    const R = salStats().L.slice().reverse();
    modal(
      `<h3>Histórico · ${R.length}</h3><div class="shist">${R.map((d, i) => `<span>${fd(d)}${R[i + 1] ? ` <i>${dd(d, R[i + 1])} d</i>` : ''}</span>`).join('')}</div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button></div>`
    );
  },
  hls: () => hlSync(true),
  hlx: () => hlxOpen(),
  hlxm: k => {
    hlx.m = k;
    hlx.s = null;
    const e = document.getElementById('hlx');
    if (e) e.innerHTML = hlxHTML();
  },
  hlxd: k => {
    hlx.d = +k;
    hlx.s = null;
    const e = document.getElementById('hlx');
    if (e) e.innerHTML = hlxHTML();
  },
  hlxs: k => {
    hlx.s = hlx.s === +k ? null : +k;
    const e = document.getElementById('hlx');
    if (e) e.innerHTML = hlxHTML();
  },
  hlm: k => {
    const M = hlMeta(),
      P = k === 'pasos';
    CF(
      P ? 'Objetivo de pasos al día' : 'Objetivo de sueño (horas, por ejemplo 7,5)',
      v => {
        const n = pnum(v);
        if (!(n > 0)) return toast('Número no válido');
        if (P ? !(n >= 1000 && n <= 50000) : !(n >= 4 && n <= 12))
          return toast(P ? 'Pon entre 1.000 y 50.000 pasos' : 'Pon entre 4 y 12 horas');
        S.salud = { ini: [], len: SAL_LEN, ...(S.salud || {}), [k]: P ? Math.round(n) : Math.round(n * 60) };
        ch();
        toast('Objetivo guardado');
      },
      P ? String(M.pasos) : String(M.sueno / 60).replace('.', ',')
    );
  },
  sal: () => {
    const n = Math.round(+V('sa2')),
      m = Math.round(+V('sa3'));
    if (!(n >= 15 && n <= 60)) return toast('Pon un número de días entre 15 y 60');
    if (!(m >= 1 && m <= 10)) return toast('Los días marcados van de 1 a 10');
    S.salud = { ini: [], ...(S.salud || {}), len: n, dur: m };
    ch();
    toast('Guardado');
  },
  dpe: i =>
    CF('¿Eliminar este periodo?', () => {
      S.periods = S.periods.filter(p => p.id !== i);
      ch();
    }),
  eb2: () =>
    CF(
      'Tope de gasto mensual (€)',
      v => {
        const a = pnum(v);
        if (!(a >= 0)) return toast('Importe no válido');
        S.budget = a;
        ch();
      },
      String(S.budget || '')
    ),
  ef: i => fixedForm(S.fixed.find(x => x.id === i)),
  goaladd: () => goalForm(),
  goaled: i => {
    const g = S.goals.find(x => x.id === i);
    if (g) goalForm(g);
  },
  goalmv: i => {
    const g = S.goals.find(x => x.id === i);
    if (g) goalMove(g);
  },
  savcfg: () => {
    const s = S.sav || { name: 'Cuenta de ahorro', rate: 3, tax: SAV_TAX, snaps: [] };
    const o = modal(
      `<h3>Cuenta de ahorro</h3><div class="fs"><label>Nombre<input id="sc1" value="${esc(s.name)}"></label><div class="two"><label>Interés anual (%)<input id="sc2" inputmode="decimal" value="${String(s.rate).replace('.', ',')}"></label><label>Impuestos sobre intereses (%)<input id="sc3" inputmode="decimal" value="${s.tax ?? SAV_TAX}"></label></div><div class="mu">En España los intereses tributan al 19 % (hasta 6.000 € al año).</div><div class="two"><label>Nuevo interés (%)<input id="sc4" inputmode="decimal" placeholder="Si el banco lo cambia" value="${s.rate2 != null ? String(s.rate2).replace('.', ',') : ''}"></label><label>A partir del<input id="sc5" type="date" value="${s.from2 || ''}"></label></div></div><div class="acts">${S.sav ? '<button class="btn ghost danger" id="fdel">Quitar</button>' : ''}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
    );
    o.querySelector('#ok').onclick = () => {
      const n = o.querySelector('#sc1').value.trim(),
        r = pnum(o.querySelector('#sc2').value),
        t = pnum(o.querySelector('#sc3').value),
        v2 = o.querySelector('#sc4').value.trim(),
        r2 = v2 ? pnum(v2) : null,
        f2 = o.querySelector('#sc5').value;
      if (!n || !(r >= 0) || !(t >= 0)) return toast('Revisa nombre, interés e impuestos');
      if (v2 && (!(r2 >= 0) || !f2)) return toast('Pon el nuevo interés y la fecha desde la que se aplica');
      S.sav = { ...s, name: n, rate: r, tax: t };
      if (v2) Object.assign(S.sav, { rate2: r2, from2: f2 });
      else (delete S.sav.rate2, delete S.sav.from2);
      o.remove();
      ch();
    };
    const del = o.querySelector('#fdel');
    if (del)
      del.onclick = () => {
        o.remove();
        CF('¿Quitar la tarjeta de ahorros y sus apuntes?', () => {
          S.sav = null;
          ch();
        });
      };
  },
  savadd: () => {
    const d = V('sv1'),
      b = pnum(V('sv2')),
      dep = V('sv3') ? pnum(V('sv3')) : 0;
    if (!d || !(b >= 0) || isNaN(dep)) return toast('Indica la fecha y el saldo');
    S.sav.snaps = (S.sav.snaps || []).filter(x => x.d !== d);
    S.sav.snaps.push({ id: id(), d, bal: b, dep });
    ch();
    toast('🐷 Saldo actualizado');
  },
  money: togMoney,
  accedit: () =>
    CF(
      'Saldo actual de la cuenta (€)',
      v => {
        const b = pnum(v);
        if (isNaN(b)) return toast('Escribe un importe');
        S.acct = { bal: b, d: TD(), seen: S.bankSeen.length, t: Date.now() };
        ch();
        toast('Saldo actualizado');
      },
      S.acct ? String(S.acct.bal).replace('.', ',') : ''
    ),
  savdel: i =>
    CF('¿Eliminar este apunte?', () => {
      S.sav.snaps = S.sav.snaps.filter(x => x.id !== i);
      ch();
    }),
  mkf: i => {
    const x = S.tx.find(y => y.id === i);
    const f = x.fid && S.fixed.find(y => y.id === x.fid);
    if (!f) {
      delete x.fid;
      return makeFixed(x);
    }
    CF(`«${f.name}» está en Facturas. ¿Quitarlo de la lista? Los movimientos se conservan.`, () => {
      S.fixed = S.fixed.filter(y => y.id !== f.id);
      S.tx.forEach(y => {
        if (y.fid === f.id) delete y.fid;
      });
      ch();
    });
  },
  df: i => {
    const f = S.fixed.find(x => x.id === i);
    CF(`¿Quitar «${f.name}» de Facturas? Los movimientos se conservan.`, () => {
      S.fixed = S.fixed.filter(x => x.id !== i);
      S.tx.forEach(x => {
        if (x.fid === i) delete x.fid;
      });
      ch();
    });
  },
  fxn: () => fixedForm({ id: 'fx-' + id(), name: '', t: 'g', amt: 0, cat: 'Otros', day: +TD().slice(8) }, true),
  fxa: k => {
    const o = fxDetect().find(y => y.k === k);
    if (!o) return;
    const x = o.x;
    const f = {
      id: 'fx-' + id(),
      name: concept(x),
      t: 'g',
      amt: x.amt,
      cat: x.cat,
      day: +x.date.slice(8),
      k,
      from: o.L.reduce((m, y) => (mon(y.date) < m ? mon(y.date) : m), mon(x.date))
    };
    o.L.forEach(y => (y.fid = f.id));
    S.fixed.push(f);
    ch();
    toast('Añadido a Facturas');
  },
  fxi: k => {
    S.fxIgn.push(k);
    ch();
  },
  nd: () => docForm(),
  ed: i => docForm(S.docs.find(x => x.id === i)),
  pd: i => {
    const d = S.docs.find(x => x.id === i);
    if (!d.pin && S.docs.filter(x => x.pin).length >= PINMAX)
      return toast(`Ya tienes ${PINMAX} documentos a mano: quita la estrella a otro primero`);
    d.pin = !d.pin;
    ch();
  },
  dd: i =>
    CF('¿Quitar este documento de la lista? (No se borra ningún archivo)', () => {
      S.docs = S.docs.filter(x => x.id !== i);
      ch();
    }),
  th: i => {
    S.theme = i;
    ch();
  },
  wxd: i => {
    const t = wxDia(i);
    if (t) toast(t);
  },
  wxo: i => {
    if (i === '1') S.wxOff = true;
    else delete S.wxOff;
    ch();
  },
  wxc: () =>
    CF(
      '¿De qué ciudad quieres ver el tiempo? (déjalo vacío para quitarlo)',
      v => {
        v = (v || '').trim();
        if (!v) {
          delete S.wx;
          ch();
          return;
        }
        fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=es&name=' + encodeURIComponent(v))
          .then(r => r.json())
          .then(j => {
            const r = j.results && j.results[0];
            if (!r) return toast('No encuentro esa ciudad: prueba a escribirla de otra forma');
            S.wx = { n: r.name, lat: +r.latitude.toFixed(3), lon: +r.longitude.toFixed(3) };
            ch();
            toast('Tiempo de ' + r.name + (r.admin1 ? ' (' + r.admin1 + ')' : ''));
          })
          .catch(() => toast('Sin conexión: inténtalo más tarde'));
      },
      S.wx ? S.wx.n : ''
    ),
  bg: i => {
    BG.k = i;
    bgSave();
    render();
  },
  bga: i => {
    BG.all = i === '1';
    bgSave();
    render();
  },
  nm: () =>
    CF(
      '¿Cómo quieres que te salude el panel?',
      v => {
        S.name = (v || '').trim().slice(0, 30);
        ch();
      },
      S.name || ''
    ),
  cu: (i, el) => {
    S.cur = el.value;
    ch();
  },
  // «No es duplicado»: quita el aviso a todo el grupo (mismo importe y tipo, con hasta DUPD días de diferencia).
  etx: i => {
    const x = S.tx.find(y => y.id === i);
    if (x) txEdit(x);
  },
  txk: i => {
    const x = S.tx.find(y => y.id === i);
    if (!x) return;
    x.keep = true;
    ch();
    toast('Se queda en «Otros»');
  },
  txen: i => {
    const x = S.tx.find(y => y.id === i);
    if (!x) return;
    x.enc = !x.enc;
    if (!x.enc) delete x.enc;
    ch();
    toast(x.enc ? 'Marcado como encargo: no cuenta como gasto tuyo' : 'Vuelve a contar en el gasto del mes');
  },
  txex: i => {
    const x = S.tx.find(y => y.id === i);
    if (!x) return;
    x.ex = !x.ex;
    if (!x.ex) delete x.ex;
    ch();
    toast(x.ex ? 'Marcado como extraordinario: ya no cuenta en el gasto del mes' : 'Vuelve a contar en el gasto del mes');
  },
  nodup: i => {
    const x = S.tx.find(y => y.id === i);
    if (!x) return;
    S.tx.forEach(y => {
      if (y.amt === x.amt && y.t === x.t && Math.abs(dd(y.date, x.date)) <= DUPD) y.notDup = true;
    });
    ch();
    toast('Aviso quitado: no es un duplicado');
  },
  ex: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = 'life-dashboard-' + TD() + '.json';
    a.click();
  },
  rs: () =>
    CF('¿Borrar TODOS los datos? No se puede deshacer.', () => {
      S = def();
      ch();
    }),
  bsync: async () => {
    setSync('Comprobando…');
    const c = await pull();
    render();
    toast(c ? 'Actualizado' : 'No hay movimientos nuevos');
  },
  login: async () => {
    const email = V('le'),
      password = $('#lp').value;
    if (!email || !password) return toast('Escribe email y contraseña');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return toast('Email o contraseña incorrectos');
    user = data.user;
    $('#m').innerHTML = '<div class="loading">Sincronizando…</div>';
    // Al entrar con la cuenta manda siempre la nube: lo que hubiera en este navegador (p. ej. datos de prueba) no se sube.
    S._ts = 0;
    setBase(null);
    await pull();
    afterLoad();
  },
  // Registro de errores de este dispositivo (Ajustes → Estado de los robots)
  errcp: () => {
    const t = JSON.stringify(errLog(), null, 1);
    navigator.clipboard
      .writeText(t)
      .then(() => toast('Errores copiados: pégalos en el chat con Claude'))
      .catch(() => toast('No se pudo copiar'));
  },
  errdel: () => {
    try {
      localStorage.removeItem(KERR);
    } catch (e) {}
    render();
    toast('Lista de errores borrada');
  },
  local: () => {
    try {
      localStorage.setItem('ldb-local', '1');
    } catch (e) {
      logErr('almacenamiento', e, 'modo local');
    }
    setSync('📱 Solo este dispositivo');
    afterLoad();
  },
  cloud: () => {
    try {
      localStorage.removeItem('ldb-local');
      localStorage.removeItem(K);
    } catch (e) {}
    location.reload();
  },
  // Al cerrar sesión se borra la copia de este dispositivo (los datos siguen en la nube), para que no quede nada tuyo
  // en un ordenador ajeno. Antes se sube lo pendiente; si no se puede, no se borra nada y se avisa.
  logout: () =>
    CF('¿Cerrar sesión? Tus datos siguen en la nube y se borran de este dispositivo.', async () => {
      setSync('Subiendo lo pendiente…');
      for (let i = 0; i < 6 && cloudOK && (dirty() || pushT || pushing); i++) {
        if (!pushing) {
          clearTimeout(pushT);
          pushT = 0;
          await push();
        }
        if (dirty() || pushT || pushing) await new Promise(r => setTimeout(r, 700));
      }
      if (!cloudOK || dirty())
        return CF(
          'Hay cambios que aún no están en la nube. Para no perderlos, no se ha cerrado la sesión: vuelve a intentarlo cuando haya conexión.',
          () => {},
          undefined,
          true
        );
      await sb.auth.signOut();
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('ldb-'))
          .forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
      } catch (e) {
        logErr('almacenamiento', e, 'cerrar sesión');
      }
      location.reload();
    })
};

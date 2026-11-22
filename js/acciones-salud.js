'use strict';
/* Botones (data-a) de Salud (vistas/salud.js). Se añaden a A, que está en acciones.js. */
Object.assign(A, {
  sls: i => {
    salSec = i === 'salud' ? 'salud' : 'act';
    try {
      localStorage.setItem('ldb-salsec', salSec);
    } catch (e) {}
    render();
    scrollTo(0, 0);
  },
  alh: () => {
    const n = V('lh1'),
      d = V('lh2');
    if (!n || !d) return toast('Indica el nombre y la fecha');
    S.localHol = S.localHol.filter(h => h.d !== d);
    S.localHol.push({ d, n });
    ch();
  },
  dlhc: i =>
    CF('¿Eliminar este festivo?', () => {
      S.localHol = S.localHol.filter(h => h.d !== i);
      ch();
    }),
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
  /* Calendario: último día de esa vez, en un día de los marcados o poco después. */
  dmf: d => {
    document.querySelectorAll('.ov').forEach(o => o.remove());
    const i = salIni(d);
    if (!i) return;
    S.salud.fin = { ...(S.salud.fin || {}), [i]: d };
    ch();
    toast('Ajustado: ' + (dd(d, i) + 1) + ' días');
  },
  sad: i =>
    CF('¿Quitar esta fecha?', () => {
      S.salud.ini = S.salud.ini.filter(d => d !== i);
      if (S.salud.fin && S.salud.fin[i]) {
        const f = { ...S.salud.fin };
        delete f[i];
        S.salud.fin = f;
      }
      ch();
    }),
  sah: () => {
    const R = salStats().L.slice().reverse();
    modal(
      `<h3>Histórico · ${R.length}</h3><div class="shist">${R.map((d, i) => {
        const f = (S.salud.fin || {})[d];
        return `<span>${fd(d)}${f ? ` <i>duró ${dd(f, d) + 1} d</i>` : ''}${R[i + 1] ? ` <i>${dd(d, R[i + 1])} d</i>` : ''}</span>`;
      }).join('')}</div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cerrar</button></div>`
    );
  },
  hls: () => hlSync(true),
  hlx: () => hlxOpen(),
  fitw: k => {
    fitW = Math.min(0, fitW + +k);
    const e = document.getElementById('hlbox');
    if (e) e.innerHTML = hlHTML();
  },
  fitm: () => fitMOpen(),
  fitmm: k => {
    const [y, m] = fitM.m.split('-').map(Number),
      x = new Date(y, m - 1 + +k, 1);
    fitM = { m: x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), d: null };
    const e = document.getElementById('fitm');
    if (e) e.innerHTML = fitMHTML();
  },
  fitmd: k => {
    fitM.d = fitM.d === k ? null : k;
    const e = document.getElementById('fitm');
    if (e) e.innerHTML = fitMHTML();
  },
  hlb: k => {
    hlSel = hlSel === k ? null : k;
    const e = document.getElementById('hlbox');
    if (e) e.innerHTML = hlHTML();
  },
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
  }
});

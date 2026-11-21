'use strict';
/* Ventanas de Coche: km, visitas al taller, mantenimientos y ficha (ver vistas/coche.js). */
const carNum = v => (hasN(v) ? String(v).replace('.', ',') : '');
const carDel = (o, L, x, what) =>
  CF(`¿Eliminar ${what}?`, () => {
    const i = L.indexOf(x);
    if (i >= 0) L.splice(i, 1);
    o.remove();
    ch();
    toast('Eliminado');
  });
/* Km que marca el coche hoy (u otro día). */
function carKmForm() {
  const K = carKm();
  const o = modal(
    `<h3>Kilómetros</h3><div class="fs"><div class="two"><label>Km del coche<input id="ck1" inputmode="numeric" placeholder="${K.cur !== null ? kmf(K.cur) : 'Ej. 48.215'}"></label><label>Fecha<input id="ck2" type="date" value="${TD()}"></label></div>${K.cur !== null ? `<div class="mu">Último dato: ${kmf(K.cur)} km (${rel(K.d)}).</div>` : ''}</div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const km = Math.round(pnum(o.querySelector('#ck1').value)),
      d = o.querySelector('#ck2').value || TD();
    if (!(km > 0)) return toast('Indica los km');
    const c = carS();
    c.km.push({ id: id(), d, km });
    o.remove();
    ch();
    toast(K.cur !== null && km < K.cur ? 'Guardado (es menos que el último dato: revísalo si no es de otra fecha)' : 'Km guardados');
  };
  o.querySelector('#ck1').focus();
}
/* Lo que se le hizo al coche: título, detalle (una cosa por línea), km, taller e importe, y qué mantenimientos quedan hechos
   (su «última vez» pasa a ser esta). */
function carVisForm(v, pre) {
  const n = !v,
    c = carS();
  v = v || { d: TD(), km: '', what: '', det: '', where: '', amt: '', mt: [], ...pre };
  const o = modal(
    `<h3>${n ? 'Mantenimiento hecho' : 'Editar'}</h3><div class="fs"><label>Qué fue<input id="cv1" value="${esc(v.what)}" placeholder="Ej. Revisión anual, cambio de ruedas…"></label><label>Detalle (una cosa por línea)<textarea id="cv6" rows="4" placeholder="Cambio de aceite&#10;Filtro de aire&#10;…">${esc(v.det || v.note || '')}</textarea></label><div class="two"><label>Fecha<input id="cv2" type="date" value="${v.d}"></label><label>Km del coche<input id="cv3" inputmode="numeric" value="${hasN(v.km) ? kmf(v.km) : ''}" placeholder="Ej. 48.215"></label></div><div class="two"><label>Taller<input id="cv4" value="${esc(v.where)}" placeholder="Opcional"></label><label>Importe<input id="cv5" inputmode="decimal" value="${carNum(v.amt)}" placeholder="Opcional"></label></div>${c.mt.length ? `<div><div class="mu" style="margin-bottom:6px">¿Qué mantenimientos quedan hechos?</div>${c.mt.map(x => `<label class="chk"><input type="checkbox" class="ck" data-m="${esc(x.id)}" ${(v.mt || []).includes(x.id) ? 'checked' : ''}> ${esc(x.n)}</label>`).join('')}</div>` : ''}</div><div class="acts">${n ? '' : '<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Añadir' : 'Guardar'}</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const g = k => o.querySelector(k).value.trim(),
      x = {
        what: g('#cv1'),
        d: g('#cv2') || TD(),
        km: g('#cv3') ? Math.round(pnum(g('#cv3'))) : '',
        where: g('#cv4'),
        amt: g('#cv5') ? pnum(g('#cv5')) : '',
        det: o.querySelector('#cv6').value.trim(),
        mt: [...o.querySelectorAll('[data-m]')].filter(b => b.checked).map(b => b.dataset.m)
      };
    if (!x.what && !x.mt.length) return toast('Indica qué se hizo');
    if (!x.what)
      x.what = c.mt
        .filter(m => x.mt.includes(m.id))
        .map(m => m.n)
        .join(', ');
    if ([x.km, x.amt].some(y => y !== '' && !(y > 0))) return toast('Revisa los números');
    if (n) c.vis.push({ id: id(), ...x });
    else {
      delete v.note;
      Object.assign(v, x);
    }
    // Los mantenimientos marcados toman esta visita como última vez (si es más reciente que la que tenían) y pierden
    // su fecha fija: la próxima sale del periodo. Los de una sola vez (sin periodo, p. ej. una revisión antes de la ITV)
    // ya están hechos: salen de la lista (quedan en el historial).
    c.mt
      .filter(m => x.mt.includes(m.id) && (!m.ld || m.ld <= x.d))
      .forEach(m => {
        m.ld = x.d;
        if (hasN(x.km)) m.lk = x.km;
        delete m.nd;
      });
    c.mt = c.mt.filter(m => !(x.mt.includes(m.id) && !+m.m && !+m.km));
    o.remove();
    ch();
    toast(n ? 'Apuntado' : 'Guardado');
  };
  if (!n) o.querySelector('#fdel').onclick = () => carDel(o, c.vis, v, 'esto del historial');
  o.querySelector('#cv1').focus();
}
/* Mantenimiento: cada cuánto (km, meses o los dos) y la última vez; o una próxima fecha fija (p. ej. la primera ITV). */
function carMtForm(x) {
  const n = !x,
    c = carS();
  x = x || { n: '', km: '', m: '', ld: '', lk: '', nd: '' };
  const o = modal(
    `<h3>${n ? 'Nuevo mantenimiento' : esc(x.n)}</h3><div class="fs"><label>Nombre<input id="cm1" value="${esc(x.n)}" placeholder="Ej. Pastillas de freno, batería…"></label><div class="two"><label>Cada (km)<input id="cm2" inputmode="numeric" value="${hasN(x.km) ? kmf(x.km) : ''}" placeholder="Ej. 15.000"></label><label>Cada (meses)<input id="cm3" inputmode="numeric" value="${x.m || ''}" placeholder="Ej. 12"></label></div><div class="mu">Si pones los dos, avisa con lo que llegue antes.</div><div class="two"><label>Última vez<input id="cm4" type="date" value="${x.ld || ''}"></label><label>A los (km)<input id="cm5" inputmode="numeric" value="${hasN(x.lk) ? kmf(x.lk) : ''}" placeholder="Opcional"></label></div><label>Próxima fecha fija (opcional)<input id="cm6" type="date" value="${x.nd || ''}"></label><div class="mu">${
      CAR_ITV.test(x.n || '') && (c.info || {}).reg
        ? 'Para la ITV y la revisión pre-ITV la fecha sale sola de la matriculación (Ficha): la primera ITV a los 4 años, luego cada 2 y desde los 10 años cada año; la pre-ITV, un mes antes.'
        : 'Para cuando la fecha no sale del periodo, como la primera ITV.'
    }</div>${
      n
        ? ''
        : `<button class="btn done" id="fdone">${I('circle-check', 'sm')} Ya está hecho</button><div class="mu">Se apunta en el historial${+x.m || +x.km ? ' y la próxima vez se cuenta desde ese día' : ' y se quita de Lo próximo'}.</div>`
    }</div><div class="acts">${n ? '' : '<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Añadir' : 'Guardar'}</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const g = k => o.querySelector(k).value.trim(),
      y = {
        n: g('#cm1'),
        km: g('#cm2') ? Math.round(pnum(g('#cm2'))) : '',
        m: g('#cm3') ? Math.round(pnum(g('#cm3'))) : '',
        ld: g('#cm4'),
        lk: g('#cm5') ? Math.round(pnum(g('#cm5'))) : '',
        nd: g('#cm6')
      };
    if (!y.n) return toast('Indica el nombre');
    if ([y.km, y.m, y.lk].some(v => v !== '' && !(v > 0))) return toast('Revisa los números');
    if (!y.km && !y.m && !y.nd) return toast('Indica cada cuánto (km o meses) o una próxima fecha');
    Object.keys(y).forEach(k => y[k] === '' && k !== 'n' && delete y[k]);
    if (n) c.mt.push({ id: id(), ...y });
    else {
      ['km', 'm', 'ld', 'lk', 'nd'].forEach(k => delete x[k]);
      Object.assign(x, y);
    }
    o.remove();
    ch();
    toast(n ? 'Mantenimiento añadido' : 'Guardado');
  };
  if (!n) {
    o.querySelector('#fdel').onclick = () => carDel(o, c.mt, x, '«' + x.n + '»');
    // «Ya está hecho»: abre «Mantenimiento hecho» con este marcado, hoy y los km actuales (se puede añadir taller e importe).
    o.querySelector('#fdone').onclick = () => {
      const K = carKm();
      o.remove();
      carVisForm(null, { what: x.n, mt: [x.id], km: K.cur !== null ? K.cur : '' });
    };
  }
  o.querySelector(n ? '#cm1' : x.ld ? '#cm2' : '#cm4').focus();
}
/* Ficha del coche. */
function carInfoForm() {
  const c = carS(),
    i = c.info,
    F = [
      ['Vehículo'],
      ['model', 'Marca y modelo', 'Ej. marca y modelo'],
      ['ver', 'Versión', ''],
      ['plate', 'Matrícula', ''],
      ['vin', 'Bastidor (VIN)', 'Está en el permiso de circulación'],
      ['reg', 'Primera matriculación', '', 'date'],
      ['buy', 'Fecha de compra', '', 'date'],
      ['Motor'],
      ['fuelT', 'Combustible', 'Gasolina, diésel, híbrido…'],
      ['eng', 'Motor', 'Cilindrada…'],
      ['pw', 'Potencia', 'Ej. 100 CV'],
      ['gear', 'Cambio', 'Manual, automático…'],
      ['dgt', 'Etiqueta DGT', '0, ECO, C, B…'],
      ['bat', 'Batería', ''],
      ['tyr', 'Medida de neumáticos', 'Ej. 205/55 R16'],
      ['oil', 'Aceite', 'Tipo y cantidad'],
      ['Seguro'],
      ['ins', 'Compañía', ''],
      ['pol', 'Nº de póliza', ''],
      ['asis', 'Teléfono de asistencia', '', 'tel'],
      ['agent', 'Agente', 'Nombre y teléfono'],
      ['notes', 'Notas', '']
    ];
  const o = modal(
    `<h3>Ficha del coche</h3><div class="fs">${F.map(([k, l, ph, t]) =>
      l === undefined
        ? `<div class="dh" style="padding:4px 0 0">${k}</div>`
        : `<label>${l}<input data-k="${k}" ${t ? `type="${t}"` : ''} value="${esc(i[k] || '')}" placeholder="${esc(ph || '')}"></label>`
    ).join(
      ''
    )}<div class="mu">Se guarda en tu nube privada. Los papeles van en Documentos, carpeta Coche.</div></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    o.querySelectorAll('[data-k]').forEach(e => {
      const v = e.value.trim();
      if (v) i[e.dataset.k] = v;
      else delete i[e.dataset.k];
    });
    o.remove();
    ch();
    toast('Ficha guardada');
  };
  o.querySelector('[data-k]').focus();
}

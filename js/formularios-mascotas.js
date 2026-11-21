'use strict';
/* Ventanas de Mascotas: ficha, vacunas, historial médico y grupos (ver vistas/mascotas.js). */
const petOf = (k, vid) => petsR().find(p => (p[k] || []).some(v => v.id === vid));
/* Ficha de la mascota (también para añadir una nueva), con su foto. */
function petForm(p, sp) {
  const n = !p;
  p = p || {
    n: '',
    sp: sp || (petGrps()[0] || {}).id || 'gato',
    sex: '',
    born: '',
    raza: '',
    col: '',
    chip: '',
    ster: '',
    kg: '',
    vet: '',
    notes: ''
  };
  let photo = p.photo || '';
  const sel = (idf, L, v) =>
    `<select id="${idf}">${L.map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const o = modal(
    `<h3>${n ? 'Nueva mascota' : 'Ficha'}</h3><div class="fs"><div class="pff"><label class="pphoto" title="Elegir foto"><span class="pav lg" id="pfav">${photo ? `<img src="${esc(photo)}" alt="">` : I('paw-print')}</span><span class="pcam">${I('upload', 'sm')}</span><input type="file" id="pff" accept="image/*" hidden></label><label style="flex:1">Nombre<input id="pf1" value="${esc(p.n)}" placeholder="Su nombre"></label></div><div class="two"><label>Pestaña${sel(
      'pf2',
      petGrps().map(g => [g.id, esc(g.n)]),
      p.sp
    )}</label><label>Sexo${sel(
      'pf3',
      [
        ['', '—'],
        ['m', 'Macho'],
        ['h', 'Hembra']
      ],
      p.sex
    )}</label></div><label>Nacimiento<input id="pf4" type="date" value="${p.born || ''}"></label><div class="two"><label>Raza<input id="pf11" value="${esc(p.raza)}" placeholder="Ej. Europeo común"></label><label>Color<input id="pf5" value="${esc(p.col)}" placeholder="Ej. Naranja, atigrado…"></label></div><div class="two"><label>Microchip<input id="pf6" value="${esc(p.chip)}" inputmode="numeric" placeholder="Opcional"></label><label>Esterilizado${sel(
      'pf7',
      [
        ['', '—'],
        ['Sí', 'Sí'],
        ['No', 'No']
      ],
      p.ster
    )}</label></div><div class="two"><label>Peso (kg)<input id="pf8" value="${hasN(p.kg) ? carNum(p.kg) : ''}" inputmode="decimal" placeholder="Opcional"></label><label>Veterinario<input id="pf9" value="${esc(p.vet)}" placeholder="Clínica y teléfono"></label></div><label>Notas<input id="pf10" value="${esc(p.notes)}" placeholder="Comida, alergias, cuidados…"></label></div><div class="acts">${n ? '' : '<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Añadir' : 'Guardar'}</button></div>`
  );
  o.querySelector('#pff').onchange = e =>
    e.target.files[0] &&
    petPhoto(e.target.files[0], src => {
      photo = src;
      o.querySelector('#pfav').innerHTML = `<img src="${src}" alt="">`;
    });
  o.querySelector('#ok').onclick = () => {
    const g = k => o.querySelector(k).value.trim(),
      x = {
        n: g('#pf1'),
        sp: g('#pf2'),
        sex: g('#pf3'),
        born: g('#pf4'),
        raza: g('#pf11'),
        col: g('#pf5'),
        chip: g('#pf6'),
        ster: g('#pf7'),
        kg: g('#pf8') ? pnum(g('#pf8')) : '',
        vet: g('#pf9'),
        notes: g('#pf10'),
        photo
      };
    if (!x.n) return toast('Indica el nombre');
    if (x.kg !== '' && !(x.kg > 0)) return toast('Revisa el peso');
    Object.keys(x).forEach(k => {
      if (x[k] === '') {
        delete x[k];
        delete p[k];
      }
    });
    if (n) {
      const q = petFix({ id: id(), ...x });
      petsS().push(q);
      petSel = q.id;
    } else Object.assign(p, x);
    o.remove();
    ch();
    toast(n ? 'Mascota añadida' : 'Ficha guardada');
  };
  if (!n)
    o.querySelector('#fdel').onclick = () =>
      CF(`¿Eliminar a ${p.n || 'esta mascota'} con sus vacunas e historial?`, () => {
        S.pets = petsS().filter(x => x !== p);
        petSel = '';
        o.remove();
        ch();
        toast('Eliminado');
      });
  o.querySelector('#pf1').focus();
}
/* Vacuna o desparasitación: qué, cuándo se puso y cuándo toca la siguiente. «Ya está puesta» apunta la siguiente dosis
   con hoy y el mismo intervalo. */
function petVacForm(v, pre) {
  const n = !v,
    p = n ? petCur() : petOf('vac', v.id);
  if (!p) return;
  petFix(p);
  v = v || { n: '', d: TD(), nx: '', ...pre };
  const o = modal(
    `<h3>${n ? 'Vacuna o desparasitación' : esc(v.n)}</h3><div class="fs"><label>Qué<input id="pv1" list="pvl" value="${esc(v.n)}" placeholder="Ej. Trivalente, rabia, pipeta…"><datalist id="pvl">${PET_VAC.map(x => `<option value="${x}">`).join('')}</datalist></label><div class="two"><label>Puesta el<input id="pv2" type="date" value="${v.d || ''}"></label><label>Próxima<input id="pv3" type="date" value="${v.nx || ''}"></label></div><div class="seg pvq" aria-label="Próxima dentro de">${[
      [1, '1 mes'],
      [3, '3 meses'],
      [6, '6 meses'],
      [12, '1 año'],
      [36, '3 años']
    ]
      .map(([m, l]) => `<button type="button" data-m="${m}">${l}</button>`)
      .join('')}</div><div class="mu">Con la próxima fecha, te avisa en Mi día un mes antes.</div>${
      n ? '' : `<button class="btn done" id="fdone">${I('circle-check', 'sm')} Ya está puesta la siguiente</button>`
    }</div><div class="acts">${n ? '' : '<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Añadir' : 'Guardar'}</button></div>`
  );
  o.querySelectorAll('[data-m]').forEach(
    b => (b.onclick = () => (o.querySelector('#pv3').value = addM(o.querySelector('#pv2').value || TD(), +b.dataset.m)))
  );
  o.querySelector('#ok').onclick = () => {
    const g = k => o.querySelector(k).value.trim(),
      x = { n: g('#pv1'), d: g('#pv2'), nx: g('#pv3') };
    if (!x.n) return toast('Indica qué se puso');
    if (!x.nx) delete v.nx;
    if (!x.nx) delete x.nx;
    if (n) p.vac.push({ id: id(), ...x });
    else Object.assign(v, x);
    o.remove();
    ch();
    toast(n ? 'Apuntado' : 'Guardado');
  };
  if (!n) {
    // Si hay más dosis del mismo tipo, al quitar esta saldría la anterior: se puede quitar solo esta o todo el tipo.
    o.querySelector('#fdel').onclick = () => {
      const k = nt(v.n || '').trim(),
        same = p.vac.filter(x => nt(x.n || '').trim() === k);
      if (same.length < 2) return carDel(o, p.vac, v, 'esta dosis');
      const q = modal(
        `<p style="color:var(--tx)">¿Qué quieres eliminar?</p><div class="mu" style="margin-bottom:14px">Hay ${same.length} dosis de «${esc(v.n)}». Si quitas solo esta, en la lista saldrá la anterior.</div><div class="acts"><button class="btn ghost" data-close>Cancelar</button><span class="sp"></span><button class="btn ghost danger" id="d1">Solo esta dosis</button><button class="btn danger" id="dall">Todas (${same.length})</button></div>`
      );
      q.querySelector('#d1').onclick = () => {
        p.vac.splice(p.vac.indexOf(v), 1);
        q.remove();
        ch();
        toast('Dosis eliminada');
      };
      q.querySelector('#dall').onclick = () => {
        p.vac = p.vac.filter(x => !same.includes(x));
        q.remove();
        ch();
        toast('«' + v.n + '» eliminado');
      };
    };
    o.querySelector('#fdone').onclick = () => {
      const m = v.d && v.nx ? Math.max(1, Math.round(dd(v.nx, v.d) / 30.44)) : 12;
      o.remove();
      petVacForm(null, { n: v.n, d: TD(), nx: addM(TD(), m) });
    };
  }
  o.querySelector('#pv1').focus();
}
/* Historial médico: qué pasó, detalle, veterinario y si se destaca en la ficha. */
function petMedForm(v) {
  const n = !v,
    p = n ? petCur() : petOf('med', v.id);
  if (!p) return;
  petFix(p);
  v = v || { d: TD(), what: '', det: '', vet: '', imp: false };
  const o = modal(
    `<h3>${n ? 'Historial médico' : 'Editar'}</h3><div class="fs"><label>Qué fue<input id="pm1" value="${esc(v.what)}" placeholder="Ej. Revisión, operación, infección…"></label><label>Detalle (una cosa por línea)<textarea id="pm2" rows="4" placeholder="Diagnóstico&#10;Tratamiento&#10;…">${esc(v.det)}</textarea></label><div class="two"><label>Fecha<input id="pm3" type="date" value="${v.d || ''}"></label><label>Veterinario<input id="pm4" value="${esc(v.vet)}" placeholder="Opcional"></label></div><label class="chk"><input type="checkbox" class="ck" id="pm5" ${v.imp ? 'checked' : ''}> Importante: que salga siempre arriba, en su ficha</label></div><div class="acts">${n ? '' : '<button class="btn ghost danger" id="fdel">Eliminar</button>'}<span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">${n ? 'Añadir' : 'Guardar'}</button></div>`
  );
  o.querySelector('#ok').onclick = () => {
    const g = k => o.querySelector(k).value.trim(),
      x = {
        what: g('#pm1'),
        det: o.querySelector('#pm2').value.trim(),
        d: g('#pm3') || TD(),
        vet: g('#pm4'),
        imp: o.querySelector('#pm5').checked
      };
    if (!x.what) return toast('Indica qué fue');
    if (n) p.med.push({ id: id(), ...x });
    else Object.assign(v, x);
    o.remove();
    ch();
    toast(n ? 'Apuntado' : 'Guardado');
  };
  if (!n) o.querySelector('#fdel').onclick = () => carDel(o, p.med, v, 'esto del historial');
  o.querySelector('#pm1').focus();
}
/* Grupos de Mascotas (las pestañas): nombre, cómo se dice una sola y el icono. Se añaden, cambian o quitan aquí;
   un grupo con mascotas no se quita (primero hay que cambiarlas de grupo o eliminarlas). */
function petGrpForm() {
  const G = petGrps().map(g => ({ ...g }));
  const o = modal(
    `<h3>Pestañas</h3><div class="fs"><div class="mu">Cada pestaña agrupa un tipo de mascota (por ejemplo, Gatos o Agapornis).</div><div id="pgl"></div><button class="morebtn" type="button" id="pgadd">${I('plus')} Añadir pestaña</button></div><div class="acts"><span class="sp"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="ok">Guardar</button></div>`
  );
  const L = o.querySelector('#pgl'),
    keep = () =>
      L.querySelectorAll('.pgr').forEach((r, i) => {
        G[i].n = r.querySelector('[data-f=n]').value.trim();
        G[i].one = r.querySelector('[data-f=one]').value.trim();
        G[i].ic = r.querySelector('[data-f=ic]').value;
      }),
    draw = () => {
      L.innerHTML = G.map((g, i) => {
        const n = petsR().filter(p => petSp(p) === g.id).length;
        return `<div class="pgr"><div class="two"><label>Nombre<input data-f="n" value="${esc(g.n)}" placeholder="Ej. Gatos"></label><label>Una sola<input data-f="one" value="${esc(g.one || '')}" placeholder="Ej. Gato"></label></div><div class="pgrb"><label>Icono<select data-f="ic">${PET_IC.map(([k, l]) => `<option value="${k}" ${g.ic === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><button class="btn ghost danger" type="button" data-del="${i}" ${n ? 'disabled' : ''}>Quitar</button></div>${n ? `<div class="mu">${n === 1 ? 'Tiene 1 mascota' : 'Tiene ' + n + ' mascotas'}: para quitarla, antes cámbialas de pestaña o elimínalas.</div>` : ''}</div>`;
      }).join('');
      L.querySelectorAll('[data-del]').forEach(
        b =>
          (b.onclick = () => {
            keep();
            G.splice(+b.dataset.del, 1);
            draw();
          })
      );
    };
  draw();
  o.querySelector('#pgadd').onclick = () => {
    keep();
    G.push({ id: id(), n: '', one: '', ic: 'paw-print' });
    draw();
    L.querySelector('.pgr:last-child [data-f=n]').focus();
  };
  o.querySelector('#ok').onclick = () => {
    keep();
    if (G.some(g => !g.n)) return toast('Pon nombre a cada pestaña');
    S.petGrp = G;
    if (!G.some(g => g.id === petTab)) petTab = '';
    o.remove();
    ch();
    toast('Pestañas guardadas');
  };
}

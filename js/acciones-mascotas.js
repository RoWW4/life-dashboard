'use strict';
/* Botones (data-a) de Mascotas (vistas/mascotas.js). Se añaden a A, que está en acciones.js. */
Object.assign(A, {
  psel: i => {
    petSel = i;
    render();
  },
  ptab: i => {
    petTab = i;
    petSel = '';
    render();
  },
  padd: i => petForm(null, i),
  pgrp: () => petGrpForm(),
  pgm: i => {
    petOff = Math.min(0, petOff + +i);
    render();
  },
  pinf: i => petForm(petsR().find(p => p.id === i)),
  pvacn: () => petVacForm(null),
  pvac: i => {
    const p = petOf('vac', i);
    if (p) petVacForm(p.vac.find(v => v.id === i));
  },
  pmedn: () => petMedForm(null),
  pmed: i => {
    const p = petOf('med', i);
    if (p) petMedForm(p.med.find(v => v.id === i));
  }
});

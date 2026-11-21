'use strict';
/* Botones (data-a) de Coche (vistas/coche.js). Se añaden a A, que está en acciones.js. */
Object.assign(A, {
  // Coche: quitar el camino y tu ubicación del mapa; vuelve a centrarse en el coche.
  cgx: () => {
    carRt = carMe = carMapV = null;
    render();
  },
  // Coche: «Llegar al coche». Pide la ubicación del móvil y el camino andando hasta donde está aparcado.
  cgo: () => {
    const lv = carLive();
    if (!lv || !lv.loc) return;
    if (!navigator.geolocation) return toast('Este dispositivo no da la ubicación');
    toast('Buscando dónde estás…');
    navigator.geolocation.getCurrentPosition(
      async p => {
        carMe = [p.coords.latitude, p.coords.longitude];
        const car = [+lv.loc.lat, +lv.loc.lon],
          to = car.join(',');
        try {
          const r = await fetch(
            `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${carMe[1]},${carMe[0]};${car[1]},${car[0]}?overview=full&geometries=geojson`,
            { signal: AbortSignal.timeout(8000) }
          );
          const x = (await r.json()).routes[0];
          carRt = { pts: x.geometry.coordinates.map(([a, b]) => [b, a]), m: x.distance, s: x.duration, to };
        } catch (e) {
          // Sin ruta: línea recta, a paso normal (1,3 m/s).
          const R = 6371e3,
            f = Math.PI / 180,
            h =
              Math.sin(((car[0] - carMe[0]) * f) / 2) ** 2 +
              Math.cos(carMe[0] * f) * Math.cos(car[0] * f) * Math.sin(((car[1] - carMe[1]) * f) / 2) ** 2,
            m = 2 * R * Math.asin(Math.sqrt(h));
          carRt = { pts: [carMe, car], m, s: m / 1.3, aprox: true, to };
        }
        carMapV = null;
        render();
      },
      e => toast(e.code === 1 ? 'Sin permiso para ver dónde estás' : 'No se pudo saber dónde estás'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  },
  ctab: i => {
    carTab = i;
    render();
    window.scrollTo(0, 0);
  },
  cgm: i => {
    carOff = Math.min(0, carOff + +i);
    render();
  },
  // Coche → Conducción: mes del calendario y día abierto.
  ccm: i => {
    carCalM = Math.min(0, carCalM + +i);
    carDay = '';
    render();
  },
  ccd: i => {
    carDay = carDay === i ? '' : i;
    render();
  },
  cyr: i => {
    carYr = i || '';
    render();
  },
  ckm: () => carKmForm(),
  carup: () => carSync(true),
  cvis: i => carVisForm(i ? carS().vis.find(v => v.id === i) : null),
  cmt: i => carMtForm(i ? carS().mt.find(x => x.id === i) : null),
  cinf: () => carInfoForm(),
  ccdoc: () => docForm(null, { cat: 'Coche' })
});

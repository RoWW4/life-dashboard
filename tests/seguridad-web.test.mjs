// Prueba de la protección CSP de index.html: la app funciona entera (todas las secciones y los servicios que usa)
// sin que se bloquee nada, y una dirección no autorizada sí se bloquea y queda en el registro de errores.
// Usa el Supabase de mentira de tests/harness.mjs; los servicios externos se simulan. Necesita Playwright.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pw, cloud, startApp } from './harness.mjs';

const PDFJS_FAKE = 'export const GlobalWorkerOptions = {}; export const version = "prueba"; export function getDocument(){ return { promise: Promise.resolve({ numPages: 0 }) }; }';

test('CSP: no bloquea nada de lo que usa el panel y sí lo que no está autorizado', { skip: !pw && 'Playwright no está instalado', timeout: 90000 }, async () => {
  const st = cloud();
  const app = await startApp(st, { extra: async ctx => {
    await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`)); });
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/.*\.mjs/, r => r.fulfill({ contentType: 'text/javascript', body: PDFJS_FAKE, headers: { 'access-control-allow-origin': '*' } }));
    await ctx.route(/open-meteo\.com/, r => r.fulfill({ contentType: 'application/json', body: '{}', headers: { 'access-control-allow-origin': '*' } }));
    await ctx.route(/date\.nager\.at/, r => r.fulfill({ contentType: 'application/json', body: '[]', headers: { 'access-control-allow-origin': '*' } }));
  } });
  try {
    const pg = await app.open();
    // Todas las secciones del menú.
    const views = await pg.evaluate(() => [...new Set([...secs().map(x => x[0]), 'ajus'])]);
    assert.ok(views.length >= 6, 'el menú tiene las secciones');
    for (const v of views) { await pg.evaluate(v => { view = v; render(); }, v); await pg.waitForTimeout(250); }
    // Los servicios externos que usa el panel (si la CSP los bloqueara, saldría aquí).
    await pg.evaluate(async () => {
      const ok = p => p.then(() => {}, () => {});
      await ok(import(PDFJS + 'pdf.min.mjs'));                                   // lector de PDF del banco (plan B)
      await ok(fetch('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=1'));
      await ok(fetch('https://geocoding-api.open-meteo.com/v1/search?name=x'));
      await ok(fetch('https://date.nager.at/api/v3/PublicHolidays/2026/ES'));
      await ok(fetch(CFG.supabaseUrl + '/rest/v1/'));                            // Supabase
      await ok(fetch('https://script.google.com/macros/s/prueba/exec', { mode: 'no-cors' })); // «Sincronizar ahora» de Salud
    });
    await pg.waitForTimeout(300);
    assert.deepEqual(await pg.evaluate(() => window.__csp), [], 'no se bloquea nada legítimo');
    // Una dirección que no usa el panel: se bloquea y queda apuntada.
    await pg.evaluate(() => fetch('https://no-autorizado.example.com/robar').catch(() => {}));
    await pg.waitForFunction(() => window.__csp.length > 0, null, { timeout: 5000 });
    assert.match((await pg.evaluate(() => window.__csp)).join(), /connect-src https:\/\/no-autorizado\.example\.com/);
    await pg.waitForFunction(() => errLog().some(e => e.w === 'seguridad' && /no-autorizado/.test(e.m)), null, { timeout: 5000 });
    assert.deepEqual(app.errs, [], 'la app no da errores');
  } finally { await app.close(); }
});

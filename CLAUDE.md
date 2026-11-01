# Panel de Rocío · instrucciones para Claude

Rocío trabaja este proyecto desde el ordenador (Claude Code) y desde el móvil (Claude en la nube). Para que ninguna sesión pierda lo que hizo la otra:

## Al empezar la sesión
1. `git pull` para traer lo último de GitHub. En el ordenador, `D:\Claude\life-dashboard` es la copia de GitHub (desde el 31/10/2026): se trabaja y se sube directamente desde ahí, sin copias en carpetas temporales.
2. Leer solo el principio de `HISTORIAL.md` (lo más reciente está arriba) y `PENDIENTES.md`. `HISTORIAL-antiguo.md` solo se lee si hace falta buscar algo viejo.

## Mientras Rocío pide cambios (para gastar menos)
- Hacer cada cambio en local, **sin commit ni push** y sin subir todavía el número de versión.
- Por cada cambio hecho o decidido, añadir **arriba** de `HISTORIAL.md` una línea:
  `- DD/MM/AAAA · móvil|ordenador · qué se hizo (una frase)`
  Una sola línea, breve. No apuntar consultas que no cambian nada.
- Los cambios de datos en Supabase se ven al momento en la app, pero su línea del historial también espera a la subida.
- Probar con capturas solo cuando el cambio sea visual y haga falta; preferir comprobaciones cortas.
- Respuestas breves.

## Cuando diga «súbelo» (o «ya está», «publícalo»…)
1. Si hubo cambios de CSS o JS, subir la versión **una sola vez** (ver abajo) y apuntarla en la última línea del historial.
2. Ejecutar `node scripts/comprobar.mjs` (sintaxis, versión igual en `index.html` y `sw.js`, archivos en `SHELL`, la app abre sin errores y juntar cambios funciona). **Si falla, no se sube.**
3. `git fetch` y comprobar que `main` no tiene commits nuevos de la otra sesión; si los tiene, traerlos primero (`git pull --rebase`) y repetir el paso 2.
4. **Un solo** commit y `git push` a `main` (GitHub Pages publica desde `main`).
- Lo que no se ha subido solo existe en esa sesión: si Rocío se despide o va a cambiar de dispositivo con cambios sin subir, recordárselo.

## Seguridad de los datos (no saltarse nada de esto)
- Copias: Supabase guarda la versión anterior antes de cada cambio (`ldb_state_hist`, 30 días) y cada noche se copia todo el panel a Google Drive («Copias del panel», 60 días).
- La base de datos **rechaza** cualquier cambio que vacíe una sección con datos o pierda más de la mitad de tareas/movimientos/facturas/documentos, y no deja borrar el panel (`ldb_state_guard`, ver `supabase/schema.sql`). No desactivarlo.
- La app no sustituye la nube a ciegas: antes de subir mira si la nube cambió y, si cambió, junta los cambios (`merge3` en `js/nube.js`). Cualquier cambio en `js/nube.js` o `js/estado.js` (sincronización y migraciones) se prueba antes simulando dos dispositivos.
- Al cambiar datos por SQL, seguir `DATOS.md`: solo las claves que cambian (`jsonb_set`), nunca pegar una copia entera de `data`, y comparar el resumen por secciones antes y después.

## Historial
- En `HISTORIAL.md` se dejan unas 20 líneas. Al subir, si hay más, pasar las más antiguas al principio de `HISTORIAL-antiguo.md` (también lo más reciente arriba).

## Pendientes
- `PENDIENTES.md` guarda solo lo importante que queda por decidir o hacer; nada de listas de ideas.
- Cuando Rocío diga «apúntalo en pendientes» (o similar), añadirlo a `PENDIENTES.md` sin hacerlo todavía.
- Cuando se haga uno, quitarlo de `PENDIENTES.md` y apuntarlo en `HISTORIAL.md`.

## Recordatorios
- Responder a Rocío en español y de forma breve.
- Los datos del panel están en Supabase (tabla `ldb_state`, columna `data`). Para cambiar datos, seguir `DATOS.md` (formato de cada lista; cada cambio lleva `_ts` nuevo para que la app no lo sobrescriba).
- No programar revisiones, comprobaciones ni avisos por iniciativa propia. Revisar el panel solo cuando Rocío lo pida, y entonces contarle lo que se vea.
- El repositorio es público: no meter datos personales ni secretos en el código.
- **Privacidad (muy importante):** en ningún archivo del repositorio (código, `HISTORIAL.md`, `PENDIENTES.md`, comentarios, ejemplos o datos de prueba) van nombres de personas o mascotas, importes, nómina o empresa, préstamos, documentos, conceptos de movimientos ni temas de salud. En el historial y en pendientes se describe solo el cambio del panel de forma genérica (p. ej. «corregida una tarea repetida», no de quién es). Los datos reales viven solo en Supabase. Las ideas con datos personales van en `D:\Claude\panel-privado.md`, fuera del repositorio. Nada de semillas con datos reales en el código.

## Dónde está cada cosa (código de la app)
La app ya no está en un solo `app.js`: está repartida en `js/` y `index.html` carga los archivos **en este orden** (cada uno usa lo de los anteriores; todos comparten las mismas variables globales, no son módulos):
- `js/base.js` · constantes, categorías y utilidades (fechas, euros…)
- `js/estado.js` · el objeto `S` y migraciones (sin semillas con datos reales)
- `js/facturas-calculo.js` · cálculos de Facturas (cobros previstos, estado, enlace con el banco)
- `js/nube.js` · sincronización con Supabase
- `js/banco.js` · clasificar, limpiar e importar movimientos del banco
- `js/interfaz.js` · piezas comunes (ventanas, avisos, dictado, iconos, filas, calendario, gráfico de gasto)
- `js/vistas/*.js` · una por sección: `dia`, `tareas`, `compra`, `finanzas` (+ Inversiones), `facturas`, `salud`, `ajustes` (+ Documentos e inicio de sesión)
- `js/render.js` · pintar la sección, menú y tema
- `js/formularios.js` · ventanas de añadir/editar
- `js/voz.js` · entrada rápida y por voz
- `js/acciones.js` · lo que hace cada botón (`data-a`)
- `js/eventos.js` y `js/arranque.js` · eventos y arranque

Al crear un archivo nuevo: añadirlo en `index.html` (en su sitio del orden) y en la lista `SHELL` de `sw.js`.
En cada cambio de CSS o JS: subir el número `?v=N` de **todos** los archivos en `index.html` y `ldb-shell-vN` en `sw.js`, para que el móvil coja la versión nueva.

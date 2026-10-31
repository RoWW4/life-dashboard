# Panel de Rocío · instrucciones para Claude

Rocío trabaja este proyecto desde el ordenador (Claude Code) y desde el móvil (Claude en la nube). Para que ninguna sesión pierda lo que hizo la otra:

## Antes de hacer nada
1. `git pull` para traer lo último de GitHub.
2. Leer `HISTORIAL.md` (lo más reciente está arriba) y `PENDIENTES.md`.

## Pendientes
- Cuando Rocío diga «apúntalo en pendientes» (o similar), añadirlo a `PENDIENTES.md` sin hacerlo todavía.
- Cuando se haga uno, quitarlo de `PENDIENTES.md` y apuntarlo en `HISTORIAL.md`.

## Forma de trabajar (para gastar menos)
- Si Rocío va pidiendo varios cambios seguidos, **apuntarlos y no publicar** hasta que diga que ha terminado («ya está», «súbelo»…). Entonces hacerlos todos, probarlos juntos y hacer **un solo** commit y push.
- Probar con capturas solo cuando el cambio sea visual y haga falta; preferir comprobaciones cortas.
- Respuestas breves.

## Después de cada cambio
1. Añadir **arriba** de `HISTORIAL.md` una línea:
   `- DD/MM/AAAA · móvil|ordenador · qué se hizo (una frase)`
   Una sola línea, breve. Solo lo hecho o decidido; no apuntar consultas que no cambian nada.
2. Hacer commit y `git push` a `main` (GitHub Pages publica desde `main`).

## Recordatorios
- Responder a Rocío en español y de forma breve.
- Los datos del panel están en Supabase (tabla `ldb_state`, columna `data`). Cualquier cambio de datos lleva `_ts` nuevo para que la app no lo sobrescriba.
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

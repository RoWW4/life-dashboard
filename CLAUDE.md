# Panel de Rocío · instrucciones para Claude

Rocío trabaja el panel desde el ordenador (`D:\Claude\life-dashboard`, copia de GitHub) y desde el móvil (Claude en la nube). Respóndele en español, breve y con palabras sencillas.

## Cómo se trabaja
1. Al empezar: `git pull`. Si hay cambios locales sin subir, `git pull --rebase --autostash`. No hace falta leer nada más.
2. Cambios en local, sin commit ni push. Al terminar cada cambio, preguntar con la ventana de opciones (AskUserQuestion): «Subir ya» u «Otro cambio». Sin repetir la pregunta por texto. `PENDIENTES.md` solo se lee si lo pedido tiene que ver con algo pendiente.
3. Comprobar con lo mínimo. La vista previa (localhost:8765) solo para cambios visuales que lo necesiten, **sin iniciar sesión** y con `localStorage.clear()` al acabar: probar con datos de mentira y luego iniciar sesión en el mismo navegador borró los datos reales el 31/10/2026.
4. Cuando elija «Subir ya» o diga «súbelo» (o «ya está», «publícalo»): `node scripts/subir.mjs "qué se ha cambiado (una frase)"`. Trae lo de la otra sesión, sube la versión si cambió CSS o JS, pasa `scripts/comprobar.mjs` y hace un commit y push a `main` (GitHub Pages publica desde ahí). Si algo falla, no sube y dice por qué. Antes, mirar `git status` por si hay archivos que no deben subirse.
5. Si Rocío se despide o cambia de dispositivo con cambios sin subir, recordárselo.

El historial de cambios es el de git (`git log --oneline`); `HISTORIAL.md` y `HISTORIAL-antiguo.md` son solo archivo hasta el 01/11/2026.
`PENDIENTES.md`: solo lo importante por decidir o hacer, sin listas de ideas. «Apúntalo en pendientes» = añadirlo sin hacerlo. Al hacer uno, quitarlo de ahí.

## Datos y seguridad
- Los datos viven en Supabase (tabla `ldb_state`, columna `data`). Para cambiarlos por SQL, seguir `DATOS.md`.
- Ya protegen solos: la base de datos rechaza vaciar una sección o perder más de la mitad de los datos (`ldb_state_guard`, no desactivarlo); copia de la versión anterior en cada cambio (`ldb_state_hist`, 30 días) y copia diaria en Google Drive (60 días); la app junta los cambios de los dos dispositivos (`merge3` en `js/nube.js`).
- Cualquier cambio en `js/nube.js` o `js/estado.js` se prueba antes simulando dos dispositivos.
- No programar revisiones, comprobaciones ni avisos por iniciativa propia; revisar el panel solo cuando Rocío lo pida.
- Nunca `git push --force` sin preguntar (la historia del repositorio se rehízo el 29/10/2026 para quitar datos personales).

## Privacidad (muy importante: el repositorio es público)
En ningún archivo del repositorio (código, comentarios, ejemplos, `PENDIENTES.md`, mensajes de commit) van nombres de personas o mascotas, importes, nómina o empresa, préstamos, documentos, conceptos de movimientos, temas de salud, secretos ni semillas con datos reales. Se describe solo el cambio, de forma genérica («corregida una tarea repetida»). Las ideas con datos personales van en `D:\Claude\panel-privado.md`, fuera del repositorio.

## Dónde está cada cosa (código)
`index.html` carga estos archivos **en este orden** (scripts normales, no módulos; comparten variables globales):
- `js/base.js` · constantes, categorías y utilidades (fechas, euros…)
- `js/estado.js` · el objeto `S` y migraciones
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

Archivo nuevo: añadirlo en `index.html` (en su sitio) y en `SHELL` de `sw.js`. El número de versión lo sube `subir.mjs`.
Cómo está montado todo (Supabase, robots, Wallet, Telegram): `LEEME.md`, solo si hace falta.
Si algo falla: primero `ops_log`, `job_health` y `ops_alerts` en Supabase (ver «Vigilancia y registro de errores» en `LEEME.md`). El vigilante está autorizado por Rocío (09/11/2026).

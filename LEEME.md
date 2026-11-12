# Panel de Rocío (Life Dashboard)

App personal (tareas, compra, dinero, facturas, salud, documentos) que funciona en el móvil y en el ordenador con los mismos datos. Todo con servicios gratuitos.

**Banco desde el 04/11/2026:** entra por Enable Banking (conexión directa, «Sincronizar banco», 4 veces al día). Wallet está en pausa (tarea `sync-wallet` de pg_cron desactivada, sin borrar). El esquema de abajo es el de Wallet.

```
GitHub Pages ──► la app (HTML + js/) ◄──► Supabase (datos + login)
                                              ▲
Wallet (BudgetBakers) ◄── conecta con el banco │
        ▲                                     │
GitHub Actions «Sincronizar banco (Wallet)» ──┘   (la lanza Supabase 5 veces al día)
GitHub Actions «Avisos de tareas» ──► Telegram    (la lanza Supabase cada 15 min)
```

Cómo se trabaja con Claude en este proyecto (historial, pendientes, cuándo se sube): ver `CLAUDE.md`.

---

## Piezas

### Supabase (datos y login)
- Tablas en `supabase/schema.sql`:
  - `ldb_state`: todo el panel en un único JSON (columna `data`). Cada cambio lleva un `_ts` nuevo para que la app no lo sobrescriba.
  - `bank_tx` y `bank_pending`: movimientos del banco, ya confirmados y aún sin confirmar. Los escribe la sincronización y la app los recoge al abrirse.
  - `bank_connections`: una fila por conexión con un banco (`openbank` para Finanzas y `trade-republic` para la cuenta de ahorro de Inversiones): permiso, última sincronización, error y saldo. Ver `supabase/bancos.sql`. `bank_status` es ahora una vista de solo lectura de la fila `openbank` (para versiones antiguas de la app); la tabla de antes quedó guardada como `bank_status_old`.
  - `savings_daily` y `savings_tx`: saldo diario y movimientos de la cuenta de ahorro (intereses, aportaciones y retiradas). Van aparte de `bank_tx`, así que nunca se mezclan con los gastos. La app los junta con los apuntes a mano de `S.sav` al mostrar Inversiones (`savSnaps` en `js/vistas/finanzas.js`).
  - `task_reminders`: avisos de Telegram ya mandados (para no repetirlos).
  - `wallet_log`: a qué hora trae Wallet cada movimiento (solo fechas y horas).
  - `ldb_state_hist`: copia automática de la versión anterior del panel antes de cada cambio (se guardan 30 días). Para recuperar datos, ver `DATOS.md`.
- **Guardia de datos** (`ldb_state_guard`): la base de datos rechaza cualquier cambio que vacíe una sección con datos o pierda más de la mitad de tareas/movimientos/facturas/documentos, y no deja borrar el panel. Para hacerlo a propósito se manda `"_force": true` dentro de `data` (la app lo hace al confirmar).
- **`ldb_add_doc`**: función que solo añade un documento al panel (la usa el bot de documentos).
- **Copia diaria fuera de Supabase:** un Google Apps Script de la cuenta personal de Google (código guardado fuera del repositorio) entra cada noche con la cuenta del panel y guarda un `.json` en la carpeta «Copias del panel» de Drive (60 días). Si se cambia la contraseña del panel, hay que cambiarla también en las propiedades del script.
- **Salud de Google Health** (`scripts/google-health.gs` + manifiesto `scripts/google-health-appsscript.json`, otro Google Apps Script de la cuenta personal, enlazado al proyecto de Google Cloud «Panel salud» con Google Health API habilitada y la pantalla de consentimiento «En producción» para que el permiso no caduque a los 7 días): cada hora lee pasos, kcal, sueño (minutos, fases y horas de dormirse y despertar) y pulso en reposo de los últimos 10 días y los guarda en `health_daily`; en `health_status` deja la hora, el último error y la dirección de su app web, que es la que abre el botón «Sincronizar ahora» de Salud (el panel también la pide al abrir Salud si han pasado más de 30 min). Google Health no acepta el token propio de Apps Script, así que usa un cliente OAuth «Aplicación web» del mismo proyecto (URI de redirección = la dirección `/exec` de la app web) y guarda su permiso en `REFRESH`. Propiedades del script: `EMAIL`, `PASSWORD`, `CLIENT_ID`, `CLIENT_SECRET`, `APP_URL` (la dirección `/exec`; desde el editor el script solo ve la `/dev`). Se implementa como app web (ejecutar como: yo · acceso: cualquier usuario), se ejecuta `conectar()` y se abre el enlace que deja en el registro, y una vez `instalar()` (sincronización cada hora). `historico()` (ejecutar a mano una vez) trae el último año en tramos de 14 días; la ventana «Histórico» de Salud lo enseña.
- **Bot de documentos por Telegram** (`scripts/telegram-documentos.gs`, otro Google Apps Script de la cuenta personal): cada minuto mira si se le ha mandado una foto o un PDF al bot, pregunta la carpeta con botones, lo guarda en la carpeta «Documentos» de Drive (varios archivos seguidos = un documento en su subcarpeta) y lo añade a Documentos del panel con `ldb_add_doc`. Solo atiende el chat de `CHAT_ID`. Propiedades del script: `TELEGRAM_TOKEN`, `CHAT_ID`, `EMAIL`, `PASSWORD`, `DOCS_FOLDER`. Al cambiar el código hay que pegarlo de nuevo en Apps Script.
- **Compartir al panel** (Android, con el panel instalado): el panel sale en el menú «Compartir» para textos y enlaces (`share_target` de `manifest.webmanifest`). El service worker (`sw.js`) guarda lo compartido en la caché `ldb-share` y abre `?compartir=1`; `shareOpen()` (`js/formularios.js`) pregunta si es tarea, compra, enlace o gasto. Fotos y PDF no: los documentos van por el bot de Telegram. Tras cambiar `share_target`, quitar el panel de la pantalla de inicio y volver a instalarlo.
- **Sincronización sin pisar cambios:** la app guarda en el dispositivo la última versión de la nube que conoce; antes de subir mira si la nube cambió y, si cambió, junta los cambios de los dos lados (`merge3` en `js/nube.js`). Al guardar usa `ldb_save`, que solo acepta el cambio si nadie ha guardado entre medias; si alguien lo hizo, la app vuelve a leer y juntar (10/11/2026).
- Login con un único usuario y altas nuevas desactivadas.
- **Programador (pg_cron):** dos tareas que llaman a la API de GitHub para lanzar los workflows, con un token de GitHub guardado en Vault. Se crearon a mano en Supabase (no están en `schema.sql`):
  - `sync-wallet`: `17 5,9,13,17,21 * * *` (UTC), unas 06:17, 10:17, 14:17, 18:17 y 22:17 en invierno. **Desactivada desde el 04/11/2026.** Para volver a activarla: `select cron.alter_job(1, active := true);`.
  - `task-reminders`: `7,22,37,52 * * * *`.
  - `bank-sync`: `43 5,10,14,19 * * *` (UTC), desde el 10/11/2026.
  - `savings-sync`: `13 6 * * *` (UTC), unas 07:13 en invierno.
  - `vigilante`: `41 * * * *` (ver «Vigilancia y registro de errores»).

### Vigilancia y registro de errores (desde el 10/11/2026)
- **Registro común** (`ops_log`, 30 días): cada robot apunta lo que hace y sus errores con hora, nivel (INFO, WARNING, ERROR, CRITICAL), pieza, función y archivo:línea, ejecución de GitHub (`run_id` y enlace) y detalle **ya limpio** de tokens, identificadores de cuenta, IBAN, importes y correos (`scripts/log.mjs`). Para mirarlo: `select ts, level, source, event, detail, run_url from ops_log order by ts desc limit 50;`
- **Latido** (`job_health`): cada robot apunta cuándo empezó, cuándo acabó bien y su último error (`ldb_job` desde GitHub, `ldb_job_user` desde los Apps Script).
- **Vigilante** (`ldb_watchdog`, pg_cron «vigilante» cada hora): comprueba avisos (cada 15 min), banco (12 h), Salud (3 h) y bot de documentos (2 h). Si algo falla, abre un incidente en `ops_alerts` y avisa **una vez** por Telegram; cuando se arregla, avisa otra vez. Los avisos salen directos de Supabase, con los secretos de Vault `telegram_bot_token` y `telegram_chat_id`; sin ellos, los incidentes se ven igual en el panel.
- **En el panel:** los incidentes salen en «Lo más importante» de Mi día, y el detalle en **Ajustes → Estado de los robots**, junto con los errores de la app en ese dispositivo (los últimos 50, se pueden copiar).
- SQL: `supabase/observabilidad.sql` (tablas y funciones) y `supabase/cron.sql` (todas las tareas programadas, sin el token).
- Pruebas: `tests/*.test.mjs` (`node --test tests/`), sin conexión; las pasa `scripts/comprobar.mjs` antes de cada subida. Incluyen la sincronización con dos dispositivos.

### Seguridad (10/11/2026)
- **Cerrar sesión** sube antes lo pendiente y borra la copia del panel de ese dispositivo (todo lo que empieza por `ldb-`). Si no se puede subir, no cierra la sesión ni borra nada.
- **CSP** en `index.html`: la página solo carga código y se conecta a los servicios que usa (Supabase, Open-Meteo, festivos, Google Health, cdnjs y jsdelivr). Si se añade un servicio nuevo, hay que añadirlo ahí; lo que se bloquee queda en Ajustes → Estado de los robots.
- **Apps Script**: guardan su sesión en la propiedad `REFRESH_PANEL` y la renuevan sin usar la contraseña; solo si falla vuelven a entrar con `EMAIL` y `PASSWORD`.
- Las funciones de los robots y del vigilante solo trabajan con la cuenta dueña (`ldb_owner()`); las altas nuevas están desactivadas en Supabase.

### GitHub (la app y los robots)
- La app se publica con GitHub Pages desde la rama `main`. El repositorio es público: en el código no hay datos ni secretos, solo la clave pública de Supabase (`config.js`).
- Workflows (`.github/workflows/`):
  - **Sincronizar banco (Wallet)** (`wallet-sync.yml`): lee de la API de Wallet los movimientos que Wallet ya ha traído del banco y los deja en `bank_tx`/`bank_pending`. Avisa por Telegram de los nuevos.
  - **Avisos de tareas (Telegram)** (`task-reminders.yml`): manda estos avisos:
    - de las tareas, 1 día antes (las que no tienen hora, como si fueran a las 9:00);
    - un resumen a las 7:00;
    - de Salud, 3 días antes;
    - de los documentos que caducan: 30 días antes (60 los de la carpeta Personal), 7 días antes, el mismo día y una vez por semana durante un mes si sigue caducado.
  - **Conectar banco** y **Sincronizar banco** (`bank-link.yml`, `bank-sync.yml`): la conexión directa con el banco por Enable Banking. Estuvo en pausa del 27/10 al 04/11/2026 porque el banco cortaba el permiso a las pocas horas; ahora vuelve a ser la vía principal (4 veces al día, lanzada por Supabase: tarea `bank-sync` de pg_cron, ver `supabase/cron.sql`). Si el permiso caduca: lanzar «Conectar banco» con el código vacío, entrar en el banco con el enlace que da y volver a lanzarlo pegando el código que muestra el panel. Para pausarla otra vez: `select cron.alter_job((select jobid from cron.job where jobname = 'bank-sync'), active := false);`.
  - **Sincronizar ahorro** (`savings-sync.yml`): saldo del día y movimientos de los últimos 10 días (90 la primera vez) de la cuenta de ahorro de Trade Republic, una vez al día (tarea `savings-sync` de pg_cron). Trade Republic solo da la cuenta de efectivo y un permiso de 90 días como máximo: el vigilante avisa 7 días antes («⏳ caduca el permiso») y Inicio desde 14. Para renovarlo, «Conectar banco» con la conexión `trade-republic` y el código vacío, igual que con Openbank. «Conectar banco» pide ahora la **conexión** (`openbank`, `trade-republic` o `lista`) en vez del nombre del banco.
- Secretos (Settings → Secrets and variables → Actions):

  | Nombre | Para qué |
  |---|---|
  | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | escribir en Supabase desde los robots (la service key no se comparte nunca) |
  | `LDB_USER_ID` | id del usuario del panel en Supabase |
  | `WALLET_TOKEN` | token de la API de Wallet (requiere Premium) |
  | `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | bot y chat de los avisos |
  | `EB_APP_ID`, `EB_PRIVATE_KEY`, `APP_URL` | solo para Enable Banking |

### Instalarla como app
- **Android (Chrome):** abrir la web de la app y pulsar ⋮ → **Añadir a pantalla de inicio**.
- **iPhone (Safari):** Compartir → **Añadir a pantalla de inicio**.
- **Ordenador (Chrome/Edge):** pulsar el icono de instalar de la barra de direcciones.

---

## Cómo entra el banco en el panel
- Wallet se conecta con el banco por su cuenta y la sincronización copia sus movimientos a Supabase. Al abrir la app, se recogen y se **clasifican** por palabras clave y por las reglas que se crean al cambiar una categoría.
- **No cuenta dos veces:** si un movimiento coincide con algo ya apuntado (mismo importe y fecha cercana), se enlaza en vez de duplicarse. También se avisa de un posible duplicado.
- **Facturas:** cada pago se marca como pagado solo cuando llega su cargo del banco. Los pagos «Variables» (varios cargos al mes sin día fijo) juntan todos los cargos que llevan sus palabras.
- **No cuentan como gasto:**
  - la categoría **Traspasos** (dinero entre cuentas propias);
  - los gastos marcados **extraordinarios**;
  - los marcados **encargo** (compras para otra persona que paga en mano).
- **Plan B** si el banco falla: importar el archivo `.xls` o el PDF de movimientos de la cuenta desde **Ajustes → Banco** (el PDF se lee con pdf.js, que se descarga de cdnjs al usarlo). Pasa por el mismo sistema anti-duplicados.

## Actualizar la app en el móvil
`index.html` carga cada archivo con `?v=N` y `sw.js` guarda una caché `ldb-shell-vN`. En cada cambio de CSS o JS se suben los dos números para que el móvil coja la versión nueva; lo hace solo `scripts/subir.mjs`.

## Límites y cosas a saber
- **Supabase gratis** pausa los proyectos que pasan 7 días sin actividad. Las tareas programadas lo mantienen activo. Si alguna vez se pausa: supabase.com → *Restore*.
- **Wallet** a veces deja de traer movimientos hasta que se reconecta el banco en su app. Seguimiento en `PENDIENTES.md`.
- Si se edita a la vez en el móvil y en el ordenador, gana el último cambio guardado.
- Protección: si un dispositivo intenta subir muchos menos datos que los de la nube (menos de la mitad), no se suben sin confirmar. Al iniciar sesión siempre manda la nube.

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `index.html`, `styles.css`, `js/` | la app (repartida por temas; mapa en `CLAUDE.md`) |
| `icons.js` | iconos Lucide incrustados (no dependen de internet) |
| `config.js` | URL y clave pública de Supabase |
| `manifest.webmanifest`, `sw.js`, `icons/` | instalación como app y uso sin conexión |
| `supabase/schema.sql` | tablas y permisos de la base de datos |
| `scripts/wallet-sync.mjs` | sincronización con Wallet |
| `scripts/task-reminders.mjs` | avisos por Telegram |
| `scripts/telegram-documentos.gs` | bot de documentos (se pega en Google Apps Script, no corre en GitHub) |
| `scripts/google-health.gs`, `scripts/google-health-appsscript.json` | datos de Google Health para Salud (se pegan en Google Apps Script) |
| `scripts/subir.mjs` | subir una versión en un paso (trae lo nuevo, sube la versión, comprueba, commit y push) |
| `scripts/comprobar.mjs` | comprobación obligatoria antes de subir (la lanza `subir.mjs`) |
| `scripts/bank-link.mjs`, `scripts/bank-sync.mjs`, `scripts/savings-sync.mjs`, `scripts/eb.mjs` | Enable Banking. `eb.mjs` también lo usan los demás scripts para hablar con Supabase |
| `.github/workflows/*.yml` | los robots de arriba |
| `scripts/log.mjs` | registro común y latido de los robots (ver «Vigilancia y registro de errores») |
| `scripts/telegram.mjs` | envío por Telegram de los robots (troceo, reintentos y message_id) |
| `js/salud-calculo.js` | previsión de Salud, compartida por la app y el robot de avisos |
| `supabase/observabilidad.sql`, `supabase/cron.sql` | registro, vigilante y tareas programadas de Supabase |
| `tests/` | pruebas sin conexión (robots y sincronización con dos dispositivos) |
| `CLAUDE.md`, `PENDIENTES.md` | cómo trabaja Claude y qué queda por hacer (lo hecho: `git log`) |
| `HISTORIAL.md`, `HISTORIAL-antiguo.md` | historial antiguo, hasta el 01/11/2026 (ya no se actualiza) |
| `DATOS.md` | cómo cambiar los datos del panel en Supabase (formato de cada lista) |

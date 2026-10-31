# Panel de Rocío (Life Dashboard)

App personal (tareas, compra, dinero, facturas, salud, documentos) que funciona en el móvil y en el ordenador con los mismos datos. Todo con servicios gratuitos, salvo Wallet Premium para traer el banco.

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
  - `bank_status`: estado de la conexión con el banco.
  - `task_reminders`: avisos de Telegram ya mandados (para no repetirlos).
  - `wallet_log`: a qué hora trae Wallet cada movimiento (solo fechas y horas).
- Login con un único usuario y altas nuevas desactivadas.
- **Programador (pg_cron):** dos tareas que llaman a la API de GitHub para lanzar los workflows, con un token de GitHub guardado en Vault. Se crearon a mano en Supabase (no están en `schema.sql`):
  - `sync-wallet`: `17 5,9,13,17,21 * * *` (UTC), unas 06:17, 10:17, 14:17, 18:17 y 22:17 en invierno.
  - `task-reminders`: `7,22,37,52 * * * *`.

### GitHub (la app y los robots)
- La app se publica con GitHub Pages desde la rama `main`. El repositorio es público: en el código no hay datos ni secretos, solo la clave pública de Supabase (`config.js`).
- Workflows (`.github/workflows/`):
  - **Sincronizar banco (Wallet)** (`wallet-sync.yml`): lee de la API de Wallet los movimientos que Wallet ya ha traído del banco y los deja en `bank_tx`/`bank_pending`. Avisa por Telegram de los nuevos.
  - **Avisos de tareas (Telegram)** (`task-reminders.yml`): manda estos avisos:
    - de las tareas, 1 día antes (las que no tienen hora, como si fueran a las 9:00);
    - un resumen a las 7:00;
    - de Salud, 3 días antes;
    - de los documentos que caducan: 30 días antes (60 los de Identidad), 7 días antes, el mismo día y una vez por semana durante un mes si sigue caducado.
  - **Conectar banco** y **Sincronizar banco** (`bank-link.yml`, `bank-sync.yml`): la conexión directa con el banco por Enable Banking. **En pausa desde el 27/10/2026** porque el banco cortaba el permiso a las pocas horas. Se pueden reactivar quitando los `#` del `schedule` de `bank-sync.yml`.
- Secretos (Settings → Secrets and variables → Actions):

  | Nombre | Para qué |
  |---|---|
  | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | escribir en Supabase desde los robots (la service key no se comparte nunca) |
  | `LDB_USER_ID` | id del usuario del panel en Supabase |
  | `WALLET_TOKEN` | token de la API de Wallet (requiere Premium) |
  | `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | bot y chat de los avisos |
  | `EB_APP_ID`, `EB_PRIVATE_KEY`, `APP_URL` | solo para Enable Banking (en pausa) |

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
- **Plan B** si el banco falla: importar el archivo `.xls` de movimientos del banco desde **Finanzas → Banco**. Pasa por el mismo sistema anti-duplicados.

## Actualizar la app en el móvil
`index.html` carga cada archivo con `?v=N` y `sw.js` guarda una caché `ldb-shell-vN`. En cada cambio de CSS o JS hay que subir los dos números para que el móvil coja la versión nueva.

## Límites y cosas a saber
- **Supabase gratis** pausa los proyectos que pasan 7 días sin actividad. Las tareas programadas lo mantienen activo. Si alguna vez se pausa: supabase.com → *Restore*.
- **Wallet** a veces deja de traer movimientos hasta que se reconecta el banco en su app. Seguimiento en `PENDIENTES.md`.
- Si se edita a la vez en el móvil y en el ordenador, gana el último cambio guardado.

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
| `scripts/bank-link.mjs`, `scripts/bank-sync.mjs`, `scripts/eb.mjs` | Enable Banking (en pausa). `eb.mjs` también lo usan los demás scripts para hablar con Supabase |
| `.github/workflows/*.yml` | los robots de arriba |
| `CLAUDE.md`, `HISTORIAL.md`, `HISTORIAL-antiguo.md`, `PENDIENTES.md` | cómo trabaja Claude, qué se ha hecho y qué queda |
| `DATOS.md` | cómo cambiar los datos del panel en Supabase (formato de cada lista) |

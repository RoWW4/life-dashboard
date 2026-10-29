# Panel de Rocío (Life Dashboard): guía de instalación

Resultado final: una app en el móvil y en el ordenador, con los mismos datos en los dos, y los movimientos de Openbank entrando solos dos veces al día. Todo con servicios gratuitos y sin instalar nada en el PC.

```
GitHub Pages  ──►  la app (HTML)  ◄──►  Supabase (tus datos + login)
                                              ▲
GitHub Actions (2 veces al día) ──► Enable Banking ──► Openbank
```

Tiempo aproximado: 30–45 min. Puedes hacerlo por fases. Después de la **fase A** ya tienes la app con sincronización. La **fase B** añade el banco automático.

---

## Fase A · La app y la sincronización

### 1. Supabase (base de datos + login)
1. Crea una cuenta en <https://supabase.com> y pulsa **New project**. Elige la región **EU (Frankfurt/Paris)**, ponle nombre `life-dashboard` y guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. Ve a **SQL Editor → New query**, pega el contenido de `supabase/schema.sql` y pulsa **Run**.
3. Ve a **Authentication → Users → Add user → Create new user**. Pon tu email y una contraseña, y marca **Auto Confirm User**. Será tu login en la app.
4. Ve a **Authentication → Sign In / Providers** y desactiva **Allow new users to sign up**. Así nadie más puede crearse una cuenta.
5. En **Project Settings → API** apunta tres cosas:
   - **Project URL**.
   - La clave pública: **anon / publishable**.
   - La clave secreta: **service_role / secret**. Esta no se comparte nunca. Solo irá a GitHub como secreto.
6. Abre `config.js` y pega la URL y la clave **pública**.

### 2. GitHub (alojar la app gratis)
1. Crea una cuenta en <https://github.com> y un repositorio **público** llamado `life-dashboard`. GitHub Pages gratis exige que sea público. Es seguro: en el código no hay datos ni secretos, solo la clave pública de Supabase, que está pensada para eso.
2. Pulsa **Add file → Upload files** y arrastra **todo el contenido** de esta carpeta (no la carpeta en sí). Después pulsa **Commit changes**.
   - Si la carpeta `.github` no se sube (a veces el navegador ignora las carpetas que empiezan por punto), créala a mano. Pulsa **Add file → Create new file**, escribe el nombre `.github/workflows/bank-sync.yml` y pega su contenido. Repite lo mismo con `bank-link.yml`.
3. Ve a **Settings → Pages**. En Source elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`, y pulsa **Save**.
4. En 1–2 minutos la app estará en `https://TU-USUARIO.github.io/life-dashboard/`. Esa es tu **APP_URL**.

### 3. Instalarla como app
- **Android (Chrome):** abre la APP_URL, pulsa ⋮ → **Añadir a pantalla de inicio** (o **Instalar aplicación**).
- **iPhone (Safari):** abre la APP_URL, pulsa Compartir → **Añadir a pantalla de inicio**.
- **Ordenador (Chrome/Edge):** pulsa el icono de instalar de la barra de direcciones.

Inicia sesión con el email y la contraseña del paso 1.3.

### 4. Pasar tus datos del artifact antiguo
1. En el artifact de Claude, ve a **Ajustes → Exportar copia (JSON)**.
2. En la app nueva, ve a **Ajustes → Restaurar copia** y elige ese archivo.

Se mantienen las mismas claves y el mismo modelo de datos, así que no se duplica nada. De paso se elimina la cena y el cine del 24/10, que la versión antigua había cargado dos veces.

---

## Fase B · Banco automático (Enable Banking, gratis para tus propias cuentas)

Openbank no tiene API para particulares. Enable Banking es un proveedor autorizado de open banking (PSD2) con un modo **gratuito "restricted"**, pensado para conectar solo cuentas propias y para uso personal. GoCardless/Nordigen, la opción gratuita que se usaba antes, ya no acepta altas nuevas.

### 5. Crear la aplicación en Enable Banking
1. Regístrate en <https://enablebanking.com> y entra en el **Control Panel**.
2. Ve a **API applications → Register new application**:
   - Environment: **Production**.
   - Name: `Life Dashboard`.
   - Allowed redirect URLs: tu **APP_URL** exacta (por ejemplo `https://tu-usuario.github.io/life-dashboard/`).
   - Elige que genere la clave privada en el navegador. Se descargará un archivo **.pem**: guárdalo bien y no lo subas a GitHub.
3. Apunta el **Application ID**.
4. En la aplicación pulsa **Activate by linking accounts** y vincula tu cuenta de Openbank. Así queda activada en modo restringido, gratis y solo con tus cuentas.
   - Si Openbank no aparece en la lista de bancos, dímelo y vemos alternativas.

### 6. Secretos en GitHub y conexión
1. En tu repositorio ve a **Settings → Secrets and variables → Actions → New repository secret** y crea estos secretos:

   | Nombre | Valor |
   |---|---|
   | `EB_APP_ID` | Application ID de Enable Banking |
   | `EB_PRIVATE_KEY` | contenido completo del archivo .pem (ábrelo con el Bloc de notas, cópialo todo y pégalo) |
   | `APP_URL` | tu APP_URL |
   | `SUPABASE_URL` | Project URL de Supabase |
   | `SUPABASE_SERVICE_KEY` | clave **service_role / secret** de Supabase |
   | `LDB_USER_ID` | Supabase → Authentication → Users → tu usuario → **User UID** |

2. Ve a **Actions → Conectar banco → Run workflow**, deja `code` **vacío** y pulsa Run.
3. Abre la ejecución terminada. En el resumen hay un enlace **«Abrir la autorización de Openbank»**. Púlsalo y autoriza con tus claves **en la web de Openbank**.
4. Volverás a tu panel, que te mostrará un **código**. Pulsa *Copiar código*.
5. Vuelve a **Actions → Conectar banco → Run workflow**, pega el código en `code` y pulsa Run. El resumen debe decir ✅ **Banco conectado**.
6. Ve a **Actions → Sincronizar banco → Run workflow** para traer ya los primeros movimientos. A partir de ahí se ejecuta solo, hacia las 7:15 y las 19:15.

**Renovación:** por ley (PSD2) el permiso dura como máximo 180 días. Dos semanas antes, el panel te avisará en «⭐ Lo más importante». Para renovarlo, repite los pasos 6.2 a 6.5 (unos 2 minutos).

---

## Cómo funciona el banco dentro del panel
- Al abrir la app, recoge los movimientos nuevos y los **clasifica** por palabras clave (Mercadona → Alimentación, Repsol → Transporte, Netflix → Suscripciones…).
- **No cuenta dos veces:** si un movimiento del banco coincide con algo que ya tenías (un fijo, una factura pagada o un gasto apuntado a mano, con el mismo importe y ±4 días), los **enlaza** en vez de duplicarlos. Para los fijos variables, como la gasolina, se aceptan diferencias de hasta un 25 %, y el fijo se corrige con el importe real.
- Si cambias la categoría de un movimiento del banco, te propone crear una **regla** para que los siguientes con esa palabra se clasifiquen solos. Las reglas se gestionan en Finanzas.
- Si el banco falla o aún no lo has conectado, puedes **importar el archivo** «Movimientos de Cuenta.xls» de Openbank desde **Finanzas → Banco**. Pasa por el mismo sistema anti-duplicados.

## Límites y cosas a saber
- **Supabase gratis** pausa los proyectos que pasan 7 días sin actividad. La sincronización diaria lo mantiene activo. Si alguna vez se pausa, entra en supabase.com y pulsa *Restore*.
- **GitHub** desactiva las tareas programadas de un repositorio tras 60 días sin cambios. El workflow incluye un paso que la reactiva sola. Si aun así se parara, GitHub te enviará un email con un botón para reactivarla.
- Sincronización entre dispositivos: si editas a la vez en el móvil y en el ordenador, gana el último cambio guardado. Con una sola persona no suele notarse.
- Las notificaciones push no están incluidas, aunque se podrían añadir más adelante.

## Archivos
| Archivo | Para qué sirve |
|---|---|
| `index.html`, `styles.css`, `js/` | la app (repartida por temas, ver `CLAUDE.md`) |
| `icons.js` | iconos Lucide incrustados (no dependen de internet) |
| `config.js` | URL y clave pública de Supabase |
| `manifest.webmanifest`, `sw.js`, `icons/` | instalación como app y uso sin conexión |
| `supabase/schema.sql` | tablas y permisos de la base de datos |
| `scripts/bank-link.mjs`, `scripts/bank-sync.mjs`, `scripts/eb.mjs` | conexión con Enable Banking (se ejecutan en GitHub) |
| `.github/workflows/*.yml` | «Conectar banco» (manual) y «Sincronizar banco» (automático) |

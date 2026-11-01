# Historial de cambios

Una línea por cambio, lo más reciente arriba: `fecha · móvil|ordenador · qué se hizo`. Aquí se dejan unas 20; las anteriores están en `HISTORIAL-antiguo.md`.

- 01/11/2026 · móvil · Inversiones: los intereses se calculan como la cuenta (interés diario sobre el saldo, abonado el día 1 menos impuestos; el primer mes desde la apertura). Datos: apuntados los saldos reales de los dos últimos abonos. Versión v49.
- 01/11/2026 · móvil · Protección de datos: la app pide confirmación antes de subir una versión en la que se haya quedado vacía una sección que en la nube tiene datos (Inversiones, festivos, vacaciones, salud, reglas…). Datos: Inversiones rehecha a partir de la aportación inicial (se había perdido el 31/10). Versión v48.
- 01/11/2026 · móvil · Gasto del mes: «Disponible» es el tope menos lo gastado; debajo, las facturas que faltan por pagar y lo que quedará después (antes se restaban ya del disponible). Versión v47.
- 31/10/2026 · móvil · Datos: dos cargos del mismo día pasados de Compras a Mascotas (son del veterinario; se dejan los dos).
- 31/10/2026 · móvil · Datos: revisión de movimientos. Bizums recibidos y reembolsos pasados a devolución de su categoría; descargas de la prepago, ingresos en efectivo propios y un Bizum devuelto pasados a Traspasos; varios gastos de «Otros» clasificados; un pago anual enlazado con su fijo (y su palabra de reconocimiento simplificada); borrado un apunte a mano repetido. Las recargas antiguas de la prepago se quedan en «Compras» (no hay detalle de la tarjeta antes de mayo de 2026).
- 31/10/2026 · móvil · Finanzas: un ingreso puede llevar una categoría de gasto (= devolución, p. ej. un Bizum por una cena): resta del gasto de esa categoría y no cuenta como ingreso; chip «devolución» en la lista. Las reglas no convierten solos los ingresos en devoluciones. Versión v46.
- 31/10/2026 · móvil · Finanzas: «Reglas de clasificación» muestra solo 3 y el resto con «Ver más». Versión v45.
- 31/10/2026 · móvil · Facturas: «Empieza en» avisa si la fecha no es válida (antes se guardaba vacía sin decir nada) y entiende fechas escritas como 01/11/27. Datos: un pago fijo pasa a empezar más adelante.
- 31/10/2026 · móvil · Mi día: «Gasto del mes» muestra las categorías en barras, igual que en Finanzas (misma tarjeta en las dos secciones). Versión v44.
- 31/10/2026 · ordenador · Copia diaria de los datos en Google Drive con un Google Apps Script de la cuenta personal (fuera del repositorio; carpeta «Copias del panel», 60 días).
- 31/10/2026 · ordenador · Datos restaurados tras la pérdida: base del 28/10, movimientos reimportados del banco, facturas enlazadas, movimientos clasificados y reglas nuevas (solo datos en Supabase).
- 31/10/2026 · ordenador · Protección de datos: Supabase guarda la versión anterior del panel antes de cada cambio (tabla `ldb_state_hist`, 30 días); la app no sube versiones con muchos menos datos que la nube sin confirmar y, al iniciar sesión, siempre manda la nube (versión 43).
- 31/10/2026 · ordenador · Finanzas: «Gasto del mes» muestra las categorías en barras (en el ordenador, a la derecha del anillo con el total debajo de este; en el móvil, debajo) y desaparece el panel «Por categoría»; la tarjeta del banco queda solo en Ajustes; en la barra del móvil la sección se llama «Finanzas».
- 31/10/2026 · ordenador · `PENDIENTES.md` reducido a lo importante (fuera las ideas); nuevo `DATOS.md` con cómo cambiar los datos en Supabase (antes solo estaba en el ordenador); `CLAUDE.md`: sin revisiones por iniciativa propia.
- 31/10/2026 · ordenador · `LEEME.md` puesto al día: Wallet, avisos por Telegram, tareas programadas de Supabase y secretos (Enable Banking queda como «en pausa»).
- 31/10/2026 · ordenador · `CLAUDE.md`: forma de trabajar aclarada (los cambios se hacen sin subir y se suben todos juntos al decir «súbelo»); historial antiguo pasado a `HISTORIAL-antiguo.md`.
- 31/10/2026 · móvil · Wallet: el movimiento de prueba no llegó (nada nuevo desde el 29/10); enviado correo a su soporte.
- 31/10/2026 · móvil · Datos: una compra devuelta (cargo y devolución) pasada a Traspasos para que no cuente. `CLAUDE.md`: los cambios pedidos seguidos se publican juntos al terminar.
- 31/10/2026 · móvil · Ficha de movimiento: las explicaciones de «Gasto extraordinario» y «Encargo» se ven tocando un icono «i» junto a cada casilla. Versión v42.
- 30/10/2026 · móvil · Facturas: los pagos variables pueden reconocer varias palabras («También reconoce» en el formulario). Datos: dos cargos de un pago variable que no se reconocían por llevar otro nombre, enlazados con él (ya no se reservaba de más en «Disponible»). Versión v41.

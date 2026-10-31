# Historial de cambios

Una línea por cambio, lo más reciente arriba: `fecha · móvil|ordenador · qué se hizo`. Aquí se dejan unas 20; las anteriores están en `HISTORIAL-antiguo.md`.

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
- 30/10/2026 · móvil · Al recargar (tirar hacia abajo en el móvil) se queda en la misma sección; al abrir la app de cero sigue empezando en Mi día. Versión v40.
- 30/10/2026 · móvil · Detalle de categoría: tocando una barra del gráfico de 6 meses se ven los datos de ese mes; «Ver movimientos» abre ese mes. Versión v39.
- 30/10/2026 · móvil · Tarjeta Banco: quitado el botón «Recargar» (la app ya recoge lo nuevo al abrirse) y texto actualizado con el horario real (Wallet consulta el banco de madrugada; el panel recoge a las 6:17, 10:17, 14:17, 18:17 y 22:17). Versión v38.
- 30/10/2026 · móvil · Tareas: al completar una se guarda la fecha; pasados 7 días deja de verse en «Todas» y en el calendario (sigue en «Completadas»). Versión v37.
- 30/10/2026 · móvil · Movimientos: etiqueta arriba a la derecha y debajo, en una línea, importe, botón de Facturas y X. Versión v36.
- 30/10/2026 · móvil · Movimientos: las etiquetas (banco, prepago, fijo, factura, encargo, extraordinario, ¿duplicado?) pasan arriba a la derecha, sobre el importe; filas más bajas. Versión v35.
- 30/10/2026 · móvil · Barra inferior del móvil: todos los iconos y textos alineados a la misma altura («Más» salía más abajo y el seleccionado se desplazaba). Versión v34.
- 30/10/2026 · móvil · Gasto del mes: quitado el «≈ € al día». Versión v33.
- 30/10/2026 · móvil · Mi día: quitados los indicadores «Para hoy» y «Disponible» (ya salen en «Lo más importante» y en Gasto del mes). Gasto del mes rediseñado igual en Mi día y Finanzas: anillo, total con una sola línea (% del tope y €/día) y categorías en filas (5 y «Ver más»; dos columnas en el ordenador); fuera el gráfico de ritmo de gasto. Versión v32.

# Historial de cambios

Una línea por cambio, lo más reciente arriba: `fecha · móvil|ordenador · qué se hizo`. Aquí se dejan unas 20; las anteriores están en `HISTORIAL-antiguo.md`.

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
- 30/10/2026 · móvil · Móvil: los botones + y micrófono se esconden al bajar; textos de ayuda de las cabeceras solo en el ordenador; «Personalizar» pasa a icono junto al título. Gasto del mes: quitada la barra de colores y, en Finanzas, gráfico de ritmo de gasto (acumulado frente a lo previsto hasta el tope). Facturas: las filas ya no muestran día ni categoría. Versión v31.
- 30/10/2026 · móvil · Sincronización Wallet: registra también los campos de fecha de las cuentas (sin saldos ni números) para saber si Wallet consulta al banco aunque no haya movimientos.
- 30/10/2026 · móvil · Dinero: movimientos 5 por defecto con «Ver más»; Tareas: cada grupo de filtros en una línea en el móvil; ordenador: paneles tipo mosaico (se encajan por alto, sin huecos). Versión v30.
- 30/10/2026 · móvil · Prueba: movimiento hecho en el banco a las 06:39 para medir cuándo lo trae Wallet; el análisis queda en `PENDIENTES.md`.
- 30/10/2026 · móvil · Sincronización Wallet: guarda en la tabla `wallet_log` a qué hora trae Wallet cada movimiento (solo fechas y horas) para conocer su patrón; la tabla se crea a mano con el SQL de `supabase/schema.sql` (apartado 5).
- 30/10/2026 · móvil · Wallet reconectado con el banco el 29/10 sobre las 16:00; desde entonces vuelve a traer movimientos. Se comprueba en los próximos días si aguanta.

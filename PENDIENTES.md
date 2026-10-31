# Pendientes

Cosas que quiere cambiar la dueña del panel más adelante. **No hacerlas hasta que ella lo pida.** Cuando se haga una, quitarla de aquí y apuntarla en `HISTORIAL.md`.

## Propuestas de la revisión del 27/10/2026 (por orden)
- [x] Revisar «Otros» (hecho 28/10/2026).
- [x] Bandeja «Sin clasificar» (hecho 28/10/2026).
- [x] «Disponible» descontando facturas pendientes (hecho 28/10/2026).
- [x] Ficha para editar un movimiento (hecho 28/10/2026).
- [x] Movimientos: 5 por defecto y «Ver más» (hecho 30/10/2026). Lo de compactarlos y reordenar tarjetas, descartado.
- [x] Mi día más corta en el móvil (hecho 29/10/2026).
- [x] Botón «Personalizar» para mover tarjetas (hecho 29/10/2026).
- [x] Móvil: filtros de Tareas en una línea (hecho 30/10/2026).
- [ ] Móvil: Inversiones dentro de Finanzas (lo del calendario como tira de la semana, descartado; la X de borrar se queda como está).
- [x] Tarea de cumpleaños repetida (hecho 28/10/2026).
- [ ] Ajustes: los paneles de Festivos y Vacaciones son demasiado largos; mostrar solo los 3 primeros y un «Ver más».
- [x] Ordenador: paneles tipo mosaico (hecho 30/10/2026).
- [x] Calendario: intercambiar estilos de Salud y festivos (hecho 29/10/2026).
- Técnico (sin prisa): evitar perder cambios si se edita a la vez en móvil y ordenador; podar datos antiguos.

## Ideas de la revisión del 30/10/2026 (pendientes de decidir)
- Movimientos en el móvil: fila solo con icono, concepto, fecha e importe (la categoría se cambia desde la ficha).
- Barra inferior del móvil: cambiar Inversión por Compra (se puede elegir en Ajustes).
- Gráficos: ingresos y gastos de 6 meses con ahorro mensual; tendencia por categoría (mini línea + % frente a la media); calendario de gasto diario; Facturas como tira del 1 al 31; Ahorros como línea de saldo.
- Paneles nuevos: metas de ahorro, coche, mascotas, hábitos/ejercicio, viajes y eventos, suscripciones con renovaciones, lista de deseos, resumen semanal por Telegram, notas rápidas.

## Pendientes de decidir (31/10/2026)
- Datos: dos Bizums de octubre de 2025 que el banco devolvió el mismo día («Devolución Bizum emitido»): ¿pasarlos a Traspasos para que no cuenten? Preguntar antes de tocar.
- Datos: revisar las recargas de la tarjeta prepago de 2025 que están en «Compras» (deberían ser Traspasos para no contar doble).
- Idea: traer pasos, sueño y pulso de Fitbit con la Google Health API (la API antigua de Fitbit se apaga el 02/11/2026). Comprobar antes si el permiso de Google caduca cada 7 días en modo prueba.
- Idea: importar el histórico de Clue a la sección Salud (Clue exporta un JSON desde Ajustes → «Download my data»).

## Analizar: cuándo trae Wallet los movimientos (desde 30/10/2026)
- Contexto: el banco va por Redsys y cortaba el acceso a las pocas horas (Enable Banking pausado desde el 27/10; el soporte no lo resolvió). Wallet también se quedó parado del 27 al 29/10 sin avisar; se reconectó el 29/10 ~16:00 y volvió a traer datos (al reconectar recargó todo de golpe a las 16:05).
- Desde el 30/10 cada sincronización guarda en la tabla `wallet_log` (Supabase) la hora a la que Wallet creó cada movimiento (`kind='rec'`, `wallet_created_at`, `seen_at`) y, por ejecución, el último cambio de datos de Wallet (`kind='run'`, `wallet_change_at`). Solo fechas y horas.
- No hubo movimientos en el banco el 29/10, así que la actualización de Wallet del 30/10 (2:00–6:00) no tenía nada nuevo que traer: no cuenta como fallo.
- Prueba: el 30/10 ~06:39 se hizo un movimiento en el banco. Comprobar a qué hora lo trae Wallet (sale primero en pendientes; entra como movimiento a los 2 días).
- Desde el 30/10 (noche) también se guardan en `wallet_log` los nombres de los campos de cada cuenta de Wallet (`kind='keys'`) y los campos que son fechas (`kind='acct'`, el nombre del campo va en el `id`), para ver si Wallet indica su última sincronización con el banco aunque no haya movimientos nuevos. Solo se lee la API: no fuerza ninguna actualización.
- 31/10/2026 7:40: resultado → el movimiento de prueba **no llegó**. Wallet no crea ningún registro desde el 29/10 16:05 (dos ventanas de actualización pasadas, sin pendientes); las sincronizaciones del panel van bien y sin errores. 31/10 ~8:00: enviado el correo al soporte de Wallet (en inglés): conexión que solo funciona justo tras reconectar, movimientos visibles en el banco y no en Wallet tras más de 24–48 h, el mismo fallo de token con Enable Banking (sin solución por su parte) y la norma PSD2 de 180 días (Reglamento Delegado (UE) 2022/2360). Si no hay solución, Rocío dará de baja Premium y no lo renovará. Pendiente: respuesta del soporte; si sigue parado, valorar el plan B.
- Ojo: no se han guardado filas `kind='keys'`/`'acct'` en `wallet_log`; revisar por qué si hace falta ese dato.
- Tras unos días: sacar el patrón de horas de Wallet (`select … from wallet_log where kind='rec' and seen_at > '2026-10-30 05:40+00'`), ajustar las horas de la tarea `sync-wallet` de pg_cron para ir justo detrás y vigilar si Wallet vuelve a quedarse parado (si pasa, valorar el plan B: importar el .xls del banco o leer los avisos de pago por correo).

## Compras por encargo pagadas en efectivo · HECHO 29/10/2026
- Marca «Encargo» en la ficha del movimiento y en «Sin clasificar»: no cuenta como gasto propio. Sin nombres ni importes parciales (decidido así).

Hay además notas privadas (con datos personales) fuera del repositorio, en `D:\Claude\panel-privado.md`: leerlas desde el ordenador, nunca copiarlas aquí.

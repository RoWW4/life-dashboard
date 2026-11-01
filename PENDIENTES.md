# Pendientes

Solo lo importante que queda por decidir o hacer. **No hacerlo hasta que la dueña del panel lo pida.** Cuando se haga uno, quitarlo de aquí.

## Recuperar los datos del panel
- El 31/10/2026 los datos del panel en la nube se sobrescribieron por error. Se pidió al soporte de Supabase recuperar la versión anterior (aún existe dentro de la base de datos); sin respuesta de una persona todavía.
- Ese mismo día se restauró la base del 28/10 (tareas, fijos y documentos de la copia local de la carpeta `copia-historial-panel` de `D:\Claude`, que nunca se sube) junto a los movimientos del banco que quedaban. Ya repuestos (01/11): festivos, Inversiones y parte de los documentos con sus enlaces. Falta: volver a importar los movimientos antiguos del banco, revisar tope y reglas y añadir lo hecho después del 28/10. Si Supabase devuelve la versión completa, restaurar esa.
- Cuando esté resuelto: volver a activar la limpieza automática de `ldb_state` (`alter table public.ldb_state reset (autovacuum_enabled, toast.autovacuum_enabled);`).

## Diseño
- Móvil: poder cambiar el orden de todos los paneles (p. ej. flechas arriba/abajo en la esquina superior derecha de cada uno).
- «Mi día»: revisar sus paneles, unificar lo que se repite y simplificar la sección.

## Wallet (banco)
- Desde el 29/10/2026 a las 16:05 Wallet no trae movimientos nuevos, aunque la sincronización del panel funciona bien. El 31/10 se envió un correo a su soporte: pendiente de respuesta.
- La prueba de Wallet Premium acaba hacia el 10/11/2026: antes, decidir si se paga.
- Si no lo arreglan: plan B (importar el `.xls` del banco desde Ajustes → Banco) y dar de baja Wallet Premium.
- Enable Banking (en pausa desde el 27/10/2026): el banco corta el permiso a las pocas horas; es un fallo conocido entre el banco y su intermediario, no del panel. Se escribió a su soporte el 26/10, pero sin contrato no suelen contestar. Solo se reactiva si un día lo arreglan.
- Si vuelve a funcionar: sacar de `wallet_log` (`kind='rec'`) a qué horas trae Wallet los movimientos y ajustar las horas de la tarea `sync-wallet` de pg_cron para ir justo detrás.

## Idea con fecha
- Fitbit: traer pasos, sueño y pulso con la Google Health API. La API antigua de Fitbit se apaga el 02/11/2026. Si interesa, comprobar antes si el permiso de Google caduca cada 7 días en modo prueba.

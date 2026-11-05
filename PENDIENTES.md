# Pendientes

Solo lo importante que queda por decidir o hacer. **No hacerlo hasta que la dueña del panel lo pida.** Cuando se haga uno, quitarlo de aquí.

## Recuperar los datos del panel
- El 31/10/2026 los datos del panel en la nube se sobrescribieron por error. Se pidió al soporte de Supabase recuperar la versión anterior (aún existe dentro de la base de datos); sin respuesta de una persona todavía.
- Ese mismo día se restauró la base del 28/10 (tareas, fijos y documentos de la copia local de la carpeta `copia-historial-panel` de `D:\Claude`, que nunca se sube) junto a los movimientos del banco que quedaban. Ya repuestos (01/11): festivos, Inversiones y parte de los documentos con sus enlaces. Falta: volver a importar los movimientos antiguos del banco, revisar tope y reglas y añadir lo hecho después del 28/10. Si Supabase devuelve la versión completa, restaurar esa.
- Cuando esté resuelto: volver a activar la limpieza automática de `ldb_state` (`alter table public.ldb_state reset (autovacuum_enabled, toast.autovacuum_enabled);`).

## Banco
- 04/11/2026: Wallet en pausa y Enable Banking reactivado como vía principal. Vigilar si el banco vuelve a cortar el permiso a las pocas horas (fallo conocido entre el banco y su intermediario); si pasa, reconectar a mano o volver a Wallet.
- La prueba de Wallet Premium acaba hacia el 10/11/2026: antes, decidir si se paga o se da de baja (con Wallet en pausa no hace falta).
- Wallet no traía movimientos nuevos desde el 29/10/2026; el 31/10 se escribió a su soporte (sin respuesta).
- Plan B si el banco falla: importar el `.xls` o el PDF desde Ajustes → Banco.
- Si vuelve a funcionar: sacar de `wallet_log` (`kind='rec'`) a qué horas trae Wallet los movimientos y ajustar las horas de la tarea `sync-wallet` de pg_cron para ir justo detrás.

## Salud (Google Health)
- Montado el 05/11/2026; falta instalar el Apps Script y comprobar con datos reales que llegan los cuatro datos y que el permiso no caduca a los 7 días (consentimiento «En producción»).

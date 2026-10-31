# Pendientes

Solo lo importante que queda por decidir o hacer. **No hacerlo hasta que la dueña del panel lo pida.** Cuando se haga uno, quitarlo de aquí y apuntarlo en `HISTORIAL.md`.

## Datos (preguntar antes de tocar)
- Recargas de la tarjeta prepago de 2025 que están en «Compras»: deberían ser Traspasos para no contar doble.
- Dos Bizums de octubre de 2025 que el banco devolvió el mismo día («Devolución Bizum emitido»): ¿pasarlos a Traspasos para que no cuenten?

## Recuperar los datos del panel (URGENTE)
- El 31/10/2026 los datos del panel en la nube se sobrescribieron por error. Se pidió al soporte de Supabase recuperar la versión anterior (aún existe dentro de la base de datos). Mientras tanto, no usar el panel.
- Si no pueden: reconstruir con la copia local del 28/10 (carpeta `copia-historial-panel` de `D:\Claude`, nunca subirla) y volver a importar los movimientos del banco.
- Cuando esté resuelto: volver a activar la limpieza automática de `ldb_state` (`alter table public.ldb_state reset (autovacuum_enabled, toast.autovacuum_enabled);`).

## Wallet (banco)
- Desde el 29/10/2026 a las 16:05 Wallet no trae movimientos nuevos, aunque la sincronización del panel funciona bien. El 31/10 se envió un correo a su soporte: pendiente de respuesta.
- Si no lo arreglan: plan B (importar el `.xls` del banco desde Ajustes → Banco) y dar de baja Wallet Premium.
- Si vuelve a funcionar: sacar de `wallet_log` (`kind='rec'`) a qué horas trae Wallet los movimientos y ajustar las horas de la tarea `sync-wallet` de pg_cron para ir justo detrás.

## Idea con fecha
- Fitbit: traer pasos, sueño y pulso con la Google Health API. La API antigua de Fitbit se apaga el 02/11/2026. Si interesa, comprobar antes si el permiso de Google caduca cada 7 días en modo prueba.

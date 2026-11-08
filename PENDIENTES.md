# Pendientes

Solo lo importante que queda por decidir o hacer. **No hacerlo hasta que la dueña del panel lo pida.** Cuando se haga uno, quitarlo de aquí.

## Banco
- 04/11/2026: Wallet en pausa y Enable Banking reactivado como vía principal. Vigilar si el banco vuelve a cortar el permiso a las pocas horas (fallo conocido entre el banco y su intermediario); si pasa, reconectar a mano o volver a Wallet.
- La prueba de Wallet Premium acaba hacia el 10/11/2026: antes, decidir si se paga o se da de baja (con Wallet en pausa no hace falta).
- Wallet no traía movimientos nuevos desde el 29/10/2026; el 31/10 se escribió a su soporte (sin respuesta).
- 08/11/2026: correos de fallo de la sincronización del banco en pausa (`SIN_CORREO` en `bank-sync.yml`). Reactivarlos cuando el banco vuelva a funcionar.
- Plan B si el banco falla: importar el `.xls` o el PDF desde Ajustes → Banco.
- Si vuelve a funcionar: sacar de `wallet_log` (`kind='rec'`) a qué horas trae Wallet los movimientos y ajustar las horas de la tarea `sync-wallet` de pg_cron para ir justo detrás.

## Salud (Google Health)
- Funcionando desde el 05/11/2026 (llegan los cuatro datos). Comprobar a partir del 13/11 que sigue sincronizando, es decir, que el permiso de Google no caduca a los 7 días; si caduca, ejecutar otra vez `conectar()` en Apps Script.

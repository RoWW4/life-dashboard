# Pendientes

Solo lo importante que queda por decidir o hacer. **No hacerlo hasta que la dueña del panel lo pida.** Cuando se haga uno, quitarlo de aquí.

## Banco
- 04/11/2026: Wallet en pausa y Enable Banking reactivado como vía principal. Vigilar si el banco vuelve a cortar el permiso a las pocas horas (fallo conocido entre el banco y su intermediario); si pasa, reconectar a mano. Wallet se queda en pausa (decidido el 26/11/2026: seguir con Enable Banking).
- Cuando se resuelva el fallo de sincronización con el banco: revisar si de verdad hay un límite de 4 consultas al día (PSD2, sin la usuaria delante) con este banco y esta conexión, o si se dio por hecho a raíz de los fallos de sincronización de antes. Si no lo hay, se podría sincronizar más a menudo.
- Plan B si el banco falla: importar el `.xls` o el PDF desde Ajustes → Banco.

## Salud (Google Health)
- Funcionando desde el 05/11/2026 (llegan los cuatro datos). Comprobar a partir del 13/11 que sigue sincronizando, es decir, que el permiso de Google no caduca a los 7 días; si caduca, ejecutar otra vez `conectar()` en Apps Script.

## Coche
- «Cambiar de coche» (cuando haga falta): botón en la Ficha que guarde el coche actual en «Coches anteriores» (ficha, historial, km y conducción; solo para consultar, sin avisos) y empiece uno nuevo con su matriculación, para que ITV, pre-ITV y mantenimientos se calculen con la edad del coche nuevo. Revisar entonces el robot de Kia Connect (`scripts/kia-km.py`): elegir el coche si la cuenta tiene más de uno, o dejar de usarlo si es de otra marca.

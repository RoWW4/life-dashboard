# Cambiar los datos del panel (Supabase)

Guía para cualquier sesión (ordenador, móvil o un chat con el conector de Supabase) que tenga que añadir, cambiar o consultar datos del panel: tareas, compra, movimientos, facturas, documentos, vacaciones…
Si se usa en un Proyecto de claude.ai, pegar este texto en sus instrucciones.

## IMPORTANTE: todo va al panel (Supabase)
Cuando te pida añadir, cambiar o consultar tareas, recordatorios, cumpleaños, compra, gastos, ingresos, facturas, documentos o vacaciones, hazlo SIEMPRE en mi panel, con el conector de **Supabase** y como se explica abajo.
- NO uses ClickUp, Google Calendar, Gmail ni ninguna otra herramienta para esto, aunque estén conectadas. Ya no uso ClickUp para mis tareas.
- Solo usa otra herramienta si yo la nombro expresamente («apúntalo en ClickUp», «ponlo en Google Calendar»).
- Si el conector de Supabase no está disponible en el chat, dímelo en vez de usar otra herramienta.
- Esto es solo para los datos. Los cambios en cómo funciona o cómo se ve la app van en el código (ver `CLAUDE.md`).

## Dónde están los datos
- Conector de Supabase, proyecto `lvsjvdpxnuydtwajlvsv` (Life-dashboard).
- Tabla `ldb_state`: una sola fila. La columna `data` (jsonb) contiene TODO el panel como un único objeto JSON.
- No toques nunca las tablas `bank_tx`, `bank_pending`, `bank_status`, `task_reminders` , `wallet_log` ni `ldb_state_hist` (salvo para leerla al recuperar datos), ni nada de `auth`, `cron` o `vault`, ni la estructura de la base de datos. No borres filas ni tablas.

## Reglas para cambiar datos
1. Antes de cambiar algo, lee lo que hay (`select data->'tasks' from ldb_state`, etc.) para no duplicar.
2. Haz cada cambio con UN solo `UPDATE ldb_state SET data = ...` y en el mismo UPDATE pon siempre:
   - `_ts` = milisegundos actuales: `to_jsonb((extract(epoch from now())*1000)::bigint)`
   - `updated_at = now()`
   Sin `_ts` nuevo, la app del móvil no verá el cambio y lo sobrescribirá.
3. Ids nuevos: `substr(md5(random()::text), 1, 10)`.
4. Fechas `AAAA-MM-DD`, horas `HH:MM`, importes como número (12.5, no "12,50 €").
5. Para borrar o cambiar algo que ya existe, dime antes qué vas a cambiar y espera a que te diga que sí. Para añadir no hace falta preguntar.
6. Al terminar, dime en una línea qué has hecho. Los cambios aparecen al abrir (o volver a) la app.
7. Si se trabaja desde el repositorio (Claude Code), apuntar el cambio en `HISTORIAL.md` de forma genérica, sin nombres ni importes.

Plantilla para añadir un elemento a una lista:
```sql
update ldb_state set
  data = jsonb_set(jsonb_set(data, '{tasks}', data->'tasks' || jsonb_build_object(
           'id', substr(md5(random()::text),1,10), 'title', 'Llamar al taller',
           'due', '2026-10-29', 'tm', '', 'pr', 'Media', 'area', 'Coche', 'rep', '', 'done', false)),
         '{_ts}', to_jsonb((extract(epoch from now())*1000)::bigint)),
  updated_at = now();
```

## Formato de cada lista dentro de `data`
- `tasks` (tareas): `{id, title, due, tm, pr, area, rep, done}`
  - `due` fecha o "" · `tm` hora o "" · `pr`: Baja | Media | Alta | Urgente
  - `area`: Coche, Mascotas, Salud y bienestar, Ocio, Personal, Hogar, Trabajo, Finanzas, Familia y amigos, Otros, Cumpleaños
  - `rep`: "" | Diaria | Semanal | Mensual | Anual
  - Al completar una tarea con `rep`, además de poner `done: true`, añade una copia sin completar con la siguiente fecha (cumpleaños: el año siguiente).
  - Los avisos por Telegram salen solos (1 día antes y en el resumen de las 7:00).
- `shop` (lista de la compra): `{id, name, qty, price, done}` · `qty` número (1 por defecto), `price` 0 si no se sabe.
- `tx` (movimientos de dinero): `{id, t, amt, cat, date, desc}` y, si hace falta, `note`.
  - `t`: "g" gasto | "i" ingreso · `amt` siempre positivo
  - `cat`: Vivienda, Alimentación, Transporte, Restaurantes, Ocio, Suscripciones, Salud, Mascotas, Compras, Viajes, Préstamos, Otros, Traspasos, Nómina
  - **Traspasos** = dinero entre mis propias cuentas: no cuenta como gasto ni ingreso.
  - Marcas opcionales: `ex: true` (gasto extraordinario, no cuenta en el gasto del mes) y `enc: true` (encargo: compra para otra persona que me paga en mano, no cuenta como gasto mío).
  - Los movimientos del banco entran solos (vía Wallet) y llevan campos propios: no les cambies importe ni fecha. Apunta a mano solo lo que no pasa por el banco (p. ej. efectivo).
- `fixed` (sección Facturas: pagos e ingresos que se repiten). Mejor añadirlos desde la app. Si te lo pido por aquí: `{id, name, t, amt, cat, day, from}`
  - `id` empieza por `fx-` · `t` "g" o "i" · `day` día del mes · `from` mes de inicio `AAAA-MM` (o sin poner si ya se cobra)
  - Anual: añade `month` (1–12) · Trimestral/Semestral: `every` 3 o 6 · Una sola vez: `once` (fecha) en vez de `day` · Variable (varios cargos al mes): `var: true`, sin `day`
  - Se marcan pagados solos cuando llega el cargo del banco: no apuntes el pago como movimiento.
- `docs` (documentos): `{id, name, cat, url, notes, exp, pin}` · `cat`: Identidad, Coche, Hogar, Salud, Finanzas, Mascotas, Trabajo, Otros · `exp` fecha de caducidad o "" (avisa por Telegram antes de que caduque).
- `periods` (vacaciones): `{id, name, from, to}`
- `localHol` (festivos locales): `{d, n}` (fecha y nombre)
- `salud` (Salud): `{ini, len, dur}` · `ini` lista de fechas de inicio, `len` días habituales entre inicios, `dur` días que se marcan en el calendario.

No cambies el resto de campos de `data` (`rules`, `fixes`, `seeded`, `bankSeen`, `bankLast`, `order`, `sav`, `bills`…) salvo que te lo pida expresamente.

## Recuperar una versión anterior
Antes de cada cambio, Supabase guarda la versión anterior en la tabla `ldb_state_hist` (30 días). Para ver las últimas:
```sql
select id, saved_at, jsonb_array_length(data->'tasks') tareas, jsonb_array_length(data->'tx') movimientos from ldb_state_hist order by saved_at desc limit 20;
```
Para restaurar una (preguntar antes a Rocío), copiarla con un `_ts` nuevo:
```sql
update ldb_state set data = jsonb_set((select data from ldb_state_hist where id = ID), '{_ts}', to_jsonb((extract(epoch from now())*1000)::bigint)), updated_at = now();
```

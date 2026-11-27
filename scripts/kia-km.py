"""Coche desde Kia Connect (lo lanza .github/workflows/kia-km.yml cada hora, de 7 a 22 h).

Entra en Kia Connect con la cuenta de la dueña del panel (secretos KIA_USER y KIA_PASSWORD; KIA_PIN si la cuenta lo
pide) y lee el último estado guardado por Kia (no despierta el coche):
- km: se pasan a ldb_car_km(), que solo los apunta si han subido;
- estado (combustible, autonomía, cerrado, ubicación) y viajes (km y minutos por día y por mes): ldb_car_live().
El repositorio es público: en la consola no se escribe ningún valor ni dato del coche o de la cuenta.
Con KIA_BACKFILL=1 trae también los últimos 6 meses y sus días (para rellenar el historial).
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

from hyundai_kia_connect_api import VehicleManager
from hyundai_kia_connect_api.Token import Token

JOB = "kia-km"
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
RUN_ID = os.environ.get("GITHUB_RUN_ID", "")
RUN_URL = (
    f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{RUN_ID}"
    if RUN_ID and os.environ.get("GITHUB_REPOSITORY")
    else ""
)


def rest(method, path, body=None):
    """Tabla ldb_kia_token (solo la clave de servicio llega a ella)."""
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        t = r.read().decode()
        return json.loads(t) if t else None


def sesion(vm):
    """Reutiliza la sesión de Kia de la vez anterior (iniciarla de cero tarda ~7 s). Se guarda sin usuario ni contraseña.
    Si falla algo, inicia sesión de cero como siempre."""
    antes = None
    try:
        filas = rest("GET", "ldb_kia_token?id=eq.1&select=token") or []
        if filas:
            d = {**filas[0]["token"], "username": vm.username, "password": vm.password, "pin": vm.pin}
            vm.token = Token.from_dict(d)
            antes = vm.token.access_token
            vm.check_and_refresh_token()  # la prueba y, si ha caducado, la renueva
            if not vm.vehicles:
                vm.initialize_vehicles()
    except Exception as e:
        print(f"(sesión guardada no válida: {type(e).__name__}; se inicia de cero)")
        vm.token, vm.vehicles, antes = None, {}, None
    if vm.token is None:
        vm.check_and_refresh_token()
    if vm.token.access_token != antes:
        try:
            d = vm.token.to_dict()
            for k in ("username", "password", "pin"):
                d.pop(k, None)
            rest("POST", "ldb_kia_token", {"id": 1, "token": d, "at": dt.datetime.now(dt.UTC).isoformat()})
        except Exception as e:
            print(f"(no se pudo guardar la sesión: {type(e).__name__})")
    print("Sesión: " + ("reutilizada" if antes and vm.token.access_token == antes else "nueva"))


def rpc(name, body):
    req = urllib.request.Request(
        f"{URL}/rest/v1/rpc/{name}",
        data=json.dumps(body).encode(),
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        t = r.read().decode()
        return json.loads(t) if t else None


def job(event, error=None):
    try:
        rpc("ldb_job", {"p_job": JOB, "p_event": event, "p_error": error, "p_run_id": RUN_ID or None, "p_run_url": RUN_URL or None})
    except Exception as e:  # el latido nunca para el robot
        print(f"(no se pudo apuntar el latido {event}: {type(e).__name__})")


DIAG_FIELDS = [
    "fuel_level", "fuel_level_is_low", "fuel_driving_range", "total_driving_range", "engine_type",
    "oil_level_warning_is_on", "brake_fluid_warning_is_on", "washer_fluid_warning_is_on", "smart_key_battery_warning_is_on",
    "tire_pressure_all_warning_is_on", "tire_pressure_front_left_warning_is_on", "tire_pressure_front_right_warning_is_on",
    "tire_pressure_rear_left_warning_is_on", "tire_pressure_rear_right_warning_is_on", "battery_auxiliary_fail_warning_is_on",
    "car_battery_percentage", "dtc_count", "lamp_status", "headlamp_status",
    "is_locked", "front_left_door_is_open", "front_left_window_is_open", "trunk_is_open", "hood_is_open", "sunroof_is_open",
    "location_latitude", "location_last_set_time", "last_updated_at",
    "average_fuel_economy_drive", "average_fuel_economy_after_refuel", "average_fuel_economy_accumulated",
]


def diag(vm):
    """Prueba: qué datos manda este coche. Solo nombres y si vienen o no, y los avisos (0/1); nunca otros valores (el registro es público)."""

    v = next(iter(vm.vehicles.values()))
    for f in DIAG_FIELDS:
        try:
            val = getattr(v, f)
        except Exception:
            val = None
        print(f"{f}: {'sí' if val is not None else 'no'}")
    # Avisos tal como llegan del coche (sin pasar por la librería, que da «apagado» también cuando el coche no manda
    # el dato). Solo rutas de avisos y su valor 0/1: no hay nada personal.
    print("-- avisos en bruto (ruta: valor; «falta» = el coche no lo manda) --")
    raw = getattr(v, "data", None) or {}

    def walk(d, p=""):
        if isinstance(d, dict):
            for k, x in d.items():
                yield from walk(x, f"{p}.{k}" if p else k)
        else:
            yield p, d

    pal = ("warning", "low", "lamp", "fail", "status", "malfunction", "service", "check")
    for ruta, x in walk(raw):
        if any(w in ruta.lower() for w in pal) and (isinstance(x, bool) or (isinstance(x, int) and 0 <= x <= 9)):
            print(f"{ruta}: {int(x)}")
    for ruta in (
        "Chassis.Axle.Tire.PressureLow", "Chassis.Axle.Row1.Left.Tire.PressureLow", "Electronics.FOB.LowBattery",
        "Body.Windshield.Front.WasherFluid.LevelLow", "Chassis.Brake.Fluid.Warning",
        "Drivetrain.InternalCombustionEngine.OilLevelWarning", "Electronics.Battery.Level",
    ):
        x = raw
        for k in ruta.split("."):
            x = x.get(k) if isinstance(x, dict) else None
        print(f"{ruta}: {'falta' if x is None else 'viene'}")
    vid = next(iter(vm.vehicles))
    hoy = dt.date.today()
    for nombre, fn in (
        ("viajes del mes", lambda: vm.update_month_trip_info(vid, hoy.strftime("%Y%m"))),
        ("viajes de ayer", lambda: vm.update_day_trip_info(vid, (hoy - dt.timedelta(days=1)).strftime("%Y%m%d"))),
    ):
        try:
            fn()
            print(f"{nombre}: sí")
        except Exception as e:
            print(f"{nombre}: no ({type(e).__name__})")
    m = v.month_trip_info
    print("viajes del mes con datos:", "sí" if m and (m.summary or m.day_list) else "no")
    d = v.day_trip_info
    print("viajes de ayer con datos:", "sí" if d and (d.summary or d.trip_list) else "no")
    print("estadísticas diarias:", "sí" if getattr(v, "daily_stats", None) else "no")


def g(v, f):
    try:
        return getattr(v, f)
    except Exception:
        return None


def num(x):
    try:
        return round(float(x), 1)
    except (TypeError, ValueError):
        return None


def live(v):
    """Lo último que mandó el coche, en el formato de S.car.live (ver js/vistas/coche.js).
    Sin avisos (aceite, frenos, ruedas, pila de la llave) ni «depósito bajo»: este coche no los manda (llegan siempre apagados);
    el depósito bajo lo calcula la app con la autonomía."""
    at = g(v, "last_updated_at")
    opn = []
    if any(g(v, f"{p}_door_is_open") for p in ("front_left", "front_right", "back_left", "back_right")):
        opn.append("doors")
    if any(g(v, f"{p}_window_is_open") for p in ("front_left", "front_right", "back_left", "back_right")):
        opn.append("windows")
    if g(v, "trunk_is_open"):
        opn.append("trunk")
    if g(v, "hood_is_open"):
        opn.append("hood")
    lat, lon = g(v, "location_latitude"), g(v, "location_longitude")
    o = {
        "at": at.isoformat() if isinstance(at, dt.datetime) else dt.datetime.now(dt.UTC).isoformat(),
        "fuel": num(g(v, "fuel_level")),
        "range": num(g(v, "total_driving_range") or g(v, "fuel_driving_range")),
        "open": opn,
        "sync": dt.datetime.now(dt.UTC).isoformat(),
    }
    if g(v, "is_locked") is not None:
        o["locked"] = bool(g(v, "is_locked"))
    if lat is not None and lon is not None:
        o["loc"] = {"lat": round(float(lat), 5), "lon": round(float(lon), 5)}
    return {k: x for k, x in o.items() if x is not None}


def trip(t):
    if not t:
        return None
    o = {"km": num(t.distance) or 0, "min": int(t.drive_time or 0), "spd": num(t.avg_speed), "max": num(getattr(t, "max_speed", None))}
    return {k: x for k, x in o.items() if x is not None}


def trips(vm, vid, backfill):
    """Km, minutos, velocidad media y máxima y número de viajes de cada día (hoy, ayer y, al rellenar, los de todos los meses que tenga Kia) y resumen de cada mes."""
    v = vm.get_vehicle(vid)
    hoy = dt.datetime.now(ZoneInfo("Europe/Madrid")).date()
    meses = [hoy.replace(day=1)]
    for _ in range(6 if backfill else (1 if hoy.day <= 3 else 0)):
        meses.append((meses[-1] - dt.timedelta(days=1)).replace(day=1))
    days, months, quiero = {}, {}, {hoy, hoy - dt.timedelta(days=1)}
    for m in meses:
        try:
            vm.update_month_trip_info(vid, m.strftime("%Y%m"))
        except Exception as e:
            print(f"(viajes de un mes no disponibles: {type(e).__name__})")
            continue
        mt = v.month_trip_info
        if not mt or not mt.summary:
            continue
        months[m.strftime("%Y-%m")] = trip(mt.summary)
        for d in mt.day_list or []:
            if not d.trip_count:
                continue
            s = str(d.yyyymmdd)
            try:
                f = dt.date(int(s[:4]), int(s[4:6]), int(s[6:8])) if len(s) == 8 else m.replace(day=int(s))
            except ValueError:
                continue
            if backfill:
                quiero.add(f)
    for f in sorted(quiero):
        try:
            vm.update_day_trip_info(vid, f.strftime("%Y%m%d"))
        except Exception:
            continue
        di = v.day_trip_info
        if di and di.summary:
            days[f.isoformat()] = {**trip(di.summary), "n": len(di.trip_list or [])}
    return days, months


def main():
    t0 = time.monotonic()

    def paso(n):  # cuánto tarda cada paso (para ver dónde se va el tiempo)
        print(f"[{time.monotonic() - t0:.1f} s] {n}")

    job("start")
    paso("inicio")
    try:
        vm = VehicleManager(
            region=1,  # Europa
            brand=1,  # Kia
            username=os.environ["KIA_USER"],
            password=os.environ["KIA_PASSWORD"],
            pin=os.environ.get("KIA_PIN", ""),
        )
        sesion(vm)
        paso("sesión en Kia")
        vm.update_all_vehicles_with_cached_state()  # último estado guardado: no despierta el coche
        paso("estado del coche")
        if os.environ.get("KIA_DIAG") == "1":
            diag(vm)
        kms = [v.odometer for v in vm.vehicles.values() if v.odometer]
        if not kms:
            raise RuntimeError("Kia Connect no devuelve el cuentakilómetros")
        if len(kms) > 1:
            raise RuntimeError("La cuenta de Kia tiene más de un coche: falta elegir cuál")
        unit = next(iter(vm.vehicles.values())).odometer_unit
        km = kms[0] * (1.609344 if str(unit).lower().startswith("mi") else 1)
        res = rpc("ldb_car_km", {"p_km": round(km)})
        print({"ok": "Km actualizados", "same": "Sin km nuevos"}.get(res, f"No se apuntó ({res})"))
        if res not in ("ok", "same"):
            raise RuntimeError(f"ldb_car_km: {res}")
        paso("km guardados")
        vid = next(iter(vm.vehicles))
        days, months = trips(vm, vid, os.environ.get("KIA_BACKFILL") == "1")
        res = rpc("ldb_car_live", {"p_live": live(vm.get_vehicle(vid)), "p_days": days, "p_months": months})
        print(f"Estado guardado ({len(days)} días, {len(months)} meses)" if res == "ok" else f"Estado no guardado ({res})")
        if res != "ok":
            raise RuntimeError(f"ldb_car_live: {res}")
        paso("viajes y estado guardados")
        job("ok")
    except Exception as e:
        msg = f"{type(e).__name__}: {str(e)[:300]}"
        for s in (os.environ.get("KIA_USER"), os.environ.get("KIA_PASSWORD"), os.environ.get("KIA_PIN")):
            if s:
                msg = msg.replace(s, "<oculto>")
        print("Error: " + msg)
        job("fail", msg)
        sys.exit(1)


if __name__ == "__main__":
    main()

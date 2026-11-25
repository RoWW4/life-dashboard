"""Coche desde Kia Connect (lo lanza .github/workflows/kia-km.yml cada 3 horas, de 7 a 23 h).

Entra en Kia Connect con la cuenta de la dueña del panel (secretos KIA_USER y KIA_PASSWORD; KIA_PIN si la cuenta lo
pide) y lee el último estado guardado por Kia (no despierta el coche):
- km: se pasan a ldb_car_km(), que solo los apunta si han subido;
- estado (combustible, autonomía, avisos, cerrado, ubicación) y viajes (km y minutos por día y por mes): ldb_car_live().
El repositorio es público: en la consola no se escribe ningún valor ni dato del coche o de la cuenta.
Con KIA_BACKFILL=1 trae también los días de este mes y el anterior y los últimos 6 meses (para rellenar al empezar).
"""
import datetime as dt
import json
import os
import sys
import urllib.request
from zoneinfo import ZoneInfo

from hyundai_kia_connect_api import VehicleManager

JOB = "kia-km"
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
RUN_ID = os.environ.get("GITHUB_RUN_ID", "")
RUN_URL = (
    f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{RUN_ID}"
    if RUN_ID and os.environ.get("GITHUB_REPOSITORY")
    else ""
)


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
    """Prueba: qué datos manda este coche. Solo escribe nombres y si vienen o no, nunca valores (el registro es público)."""

    v = next(iter(vm.vehicles.values()))
    for f in DIAG_FIELDS:
        try:
            val = getattr(v, f)
        except Exception:
            val = None
        print(f"{f}: {'sí' if val is not None else 'no'}")
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


WARN = {
    "oil": "oil_level_warning_is_on",
    "brake": "brake_fluid_warning_is_on",
    "key": "smart_key_battery_warning_is_on",
    "tire": "tire_pressure_all_warning_is_on",
}


def tire_one(v):
    """Aviso de presión en una sola rueda: el coche lo manda por rueda, aparte del de «todas»."""
    return any(g(v, f"tire_pressure_{p}_warning_is_on") for p in ("front_left", "front_right", "rear_left", "rear_right"))


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
    """Lo último que mandó el coche, en el formato de S.car.live (ver js/vistas/coche.js)."""
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
        "low": bool(g(v, "fuel_level_is_low")),
        "range": num(g(v, "total_driving_range") or g(v, "fuel_driving_range")),
        "warn": [k for k, f in WARN.items() if g(v, f) or (k == "tire" and tire_one(v))],
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
    """Km, minutos, velocidad media y máxima y número de viajes de cada día (hoy, ayer y, al rellenar, los dos últimos meses) y resumen de cada mes."""
    v = vm.get_vehicle(vid)
    hoy = dt.datetime.now(ZoneInfo("Europe/Madrid")).date()
    meses = [hoy.replace(day=1)]
    for _ in range(6 if backfill else (1 if hoy.day <= 3 else 0)):
        meses.append((meses[-1] - dt.timedelta(days=1)).replace(day=1))
    days, months, quiero = {}, {}, {hoy, hoy - dt.timedelta(days=1)}
    for i, m in enumerate(meses):
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
            if backfill and i <= 1:
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
    job("start")
    try:
        vm = VehicleManager(
            region=1,  # Europa
            brand=1,  # Kia
            username=os.environ["KIA_USER"],
            password=os.environ["KIA_PASSWORD"],
            pin=os.environ.get("KIA_PIN", ""),
        )
        vm.check_and_refresh_token()
        vm.update_all_vehicles_with_cached_state()  # último estado guardado: no despierta el coche
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
        vid = next(iter(vm.vehicles))
        days, months = trips(vm, vid, os.environ.get("KIA_BACKFILL") == "1")
        res = rpc("ldb_car_live", {"p_live": live(vm.get_vehicle(vid)), "p_days": days, "p_months": months})
        print(f"Estado guardado ({len(days)} días, {len(months)} meses)" if res == "ok" else f"Estado no guardado ({res})")
        if res != "ok":
            raise RuntimeError(f"ldb_car_live: {res}")
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

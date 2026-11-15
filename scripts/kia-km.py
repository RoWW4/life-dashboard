"""Km del coche desde Kia Connect (lo lanza .github/workflows/kia-km.yml una vez al día).

Entra en Kia Connect con la cuenta de la dueña del panel (secretos KIA_USER y KIA_PASSWORD; KIA_PIN si la cuenta lo
pide), lee el cuentakilómetros del último estado guardado por Kia (no despierta el coche) y lo pasa a Supabase con
ldb_car_km(), que solo lo apunta si los km han subido. El repositorio es público: en la consola no se escribe ni el
número de km ni datos del coche o de la cuenta.
"""
import json
import os
import sys
import urllib.request

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
    "tire_pressure_all_warning_is_on", "tire_pressure_front_left_warning_is_on", "battery_auxiliary_fail_warning_is_on",
    "car_battery_percentage", "dtc_count", "lamp_status", "headlamp_status",
    "is_locked", "front_left_door_is_open", "front_left_window_is_open", "trunk_is_open", "hood_is_open", "sunroof_is_open",
    "location_latitude", "location_last_set_time", "last_updated_at",
    "average_fuel_economy_drive", "average_fuel_economy_after_refuel", "average_fuel_economy_accumulated",
]


def diag(vm):
    """Prueba: qué datos manda este coche. Solo escribe nombres y si vienen o no, nunca valores (el registro es público)."""
    import datetime as dt

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

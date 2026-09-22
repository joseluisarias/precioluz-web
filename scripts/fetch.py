#!/usr/bin/env python3
"""Descarga el PVPC (archivo 70 de ESIOS) a docs/data/pvpc/.

Única pieza del proyecto con acceso a red. Sin token: el archivo es público.

  fetch.py                 → ayer, hoy y mañana + huecos de los últimos 7 días
  fetch.py --days 10       → los últimos 10 días (hasta hoy) + mañana
  fetch.py --fixture 2026-03-29 --out tests/fixtures/archive70   → guarda el JSON crudo

Sale con código 0 aunque mañana no esté publicado: el cron reintenta.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from precioluz import archive70, generation  # noqa: E402

MADRID = ZoneInfo("Europe/Madrid")
URL = "https://api.esios.ree.es/archives/70/download_json?date={day}"
GEN_URL = ("https://apidatos.ree.es/es/datos/generacion/estructura-generacion"
           "?start_date={day}T00:00&end_date={day}T23:59&time_trunc=day")


def download(day: str, tries: int = 3, url: str = URL) -> bytes:
    req = urllib.request.Request(url.format(day=day), headers={"Accept": "application/json",
                                                                "User-Agent": "precioluz-web/1.0"})
    last: Exception | None = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code < 500:
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{day}: sin respuesta tras {tries} intentos: {last}")


def target_days(today: dt.date, days: int, existing: set[str]) -> list[str]:
    if days > 0:
        first = today - dt.timedelta(days=days - 1)
        span = [first + dt.timedelta(days=k) for k in range(days)]
    else:
        span = [today - dt.timedelta(days=1), today]
        # Autocuración: huecos recientes (p. ej. un cron que no llegó a correr).
        for k in range(2, 8):
            d = today - dt.timedelta(days=k)
            if d.isoformat() not in existing:
                span.append(d)
    span.append(today + dt.timedelta(days=1))
    return sorted({d.isoformat() for d in span})


def write_atomic(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def save_day(data_dir: Path, day: str, hours, now_iso: str, force: bool) -> bool:
    """Devuelve True si el fichero cambió."""
    path = data_dir / "pvpc" / f"{day}.json"
    rows = archive70.to_rows(hours)
    if path.exists() and not force:
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
            if old.get("hours") == rows:
                return False           # mismo dato: no se toca ni fetchedAt (= primera vez visto)
        except (OSError, ValueError):
            pass
    write_atomic(path, {"day": day, "n": len(rows), "fetchedAt": now_iso, "hours": rows})
    return True


def save_generation(data_dir: Path, day: str, complete: bool, now_iso: str) -> bool:
    """Mix diario de apidatos. D-1 es definitivo (no se reescribe si no cambia); D es parcial."""
    path = data_dir / "generacion" / f"{day}.json"
    try:
        parsed = generation.parse(download(day, url=GEN_URL))
    except generation.NoData:
        print(f"  generación {day}: sin datos")
        return False
    except Exception as e:  # la generación es secundaria: nunca tumba el fetch de precios
        print(f"  generación {day}: error {e}", file=sys.stderr)
        return False
    obj = {"day": day, "trunc": "day", "complete": complete, "fetchedAt": now_iso,
           "total": parsed["total"], "renewablePct": parsed["renewablePct"],
           "entries": parsed["entries"]}
    if path.exists():
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
            if old.get("entries") == obj["entries"] and old.get("complete") == complete:
                return False
        except (OSError, ValueError):
            pass
    write_atomic(path, obj)
    print(f"  generación {day}: {len(parsed['entries'])} tecnologías, {parsed['renewablePct']} % renovable"
          f"{'' if complete else ' (parcial)'}")
    return True


def rebuild_index(data_dir: Path) -> dict:
    files = sorted((data_dir / "pvpc").glob("????-??-??.json"))
    days, updated = [], ""
    for f in files:
        obj = json.loads(f.read_text(encoding="utf-8"))
        days.append(obj["day"])
        updated = max(updated, obj.get("fetchedAt", ""))
    index = {"first": days[0] if days else None, "latest": days[-1] if days else None,
             "days": days, "updatedAt": updated or None}
    write_atomic(data_dir / "pvpc" / "index.json", index)
    return index


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--days", type=int, default=0, help="días hacia atrás a descargar (0 = ayer, hoy y mañana)")
    p.add_argument("--force", action="store_true", help="reescribe aunque el dato no haya cambiado")
    p.add_argument("--data", default=str(ROOT / "docs" / "data"), help="directorio de datos")
    p.add_argument("--skip-generation", action="store_true", help="no descargar el mix de generación")
    p.add_argument("--fixture", metavar="DAY", help="guarda el JSON crudo de ese día y termina")
    p.add_argument("--out", default=str(ROOT / "tests" / "fixtures" / "archive70"), help="destino de --fixture")
    a = p.parse_args(argv)

    if a.fixture:
        raw = download(a.fixture)
        out = Path(a.out) / f"{a.fixture}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(raw)
        print(f"fixture {out} ({len(raw)} bytes)")
        return 0

    data_dir = Path(a.data)
    now = dt.datetime.now(MADRID)
    now_iso = now.replace(microsecond=0).isoformat()
    existing = {f.stem for f in (data_dir / "pvpc").glob("????-??-??.json")}
    days = target_days(now.date(), a.days, existing)

    written, skipped, pending = 0, 0, []
    for day in days:
        if day in existing and not a.force and day < now.date().isoformat():
            skipped += 1
            continue                   # días pasados ya guardados no cambian
        try:
            hours = archive70.parse(download(day))
        except archive70.NotPublished:
            pending.append(day)
            print(f"  {day}: aún no publicado")
            continue
        except archive70.InvalidDay as e:
            print(f"  {day}: descartado ({e})", file=sys.stderr)
            continue
        changed = save_day(data_dir, day, hours, now_iso, a.force)
        written += changed
        skipped += not changed
        print(f"  {day}: {len(hours)} horas{' (nuevo)' if changed else ' (sin cambios)'}")

    if not a.skip_generation:
        yesterday = (now.date() - dt.timedelta(days=1)).isoformat()
        written += save_generation(data_dir, yesterday, complete=True, now_iso=now_iso)
        written += save_generation(data_dir, now.date().isoformat(), complete=False, now_iso=now_iso)

    index = rebuild_index(data_dir)
    print(f"escritos={written} sin_cambios={skipped} pendientes={pending} "
          f"índice={index['first']}→{index['latest']} ({len(index['days'])} días)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

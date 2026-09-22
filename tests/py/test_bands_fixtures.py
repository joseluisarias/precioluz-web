"""Exporta los fixtures de bandas que consume tests/js/bands.test.js.

Cada fichero tests/fixtures/bands/<nombre>.json es
    {"day": "2026-09-22", "series": "pcb", "rows": [{i,h,pcb,cym}…], "expected": "ggo…"}
con `expected` calculado por precioluz.engine.bands. Se exporta un caso por cada
día guardado en docs/data/pvpc × serie, más los sintéticos de PriceEngineTests
y los días de cambio de hora de tests/fixtures/archive70. Solo se reescribe un
fichero si su contenido cambia (sin ruido en git).
"""
import json
from pathlib import Path

from helpers import REPORTED_BUG_DAY, rows_from_values
from precioluz import archive70, engine
from precioluz.zones import SERIES

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs" / "data" / "pvpc"
ARCHIVE_FIX = ROOT / "tests" / "fixtures" / "archive70"
OUT = ROOT / "tests" / "fixtures" / "bands"


def synthetic_cases():
    """(nombre, día, serie, filas) de los escenarios sintéticos."""
    yield "synthetic-reported-bug", "2026-08-11", "pcb", rows_from_values(REPORTED_BUG_DAY)

    spring = [0.20] * 23
    spring[2] = 0.040
    yield "synthetic-dst-23h", "2026-03-29", "pcb", rows_from_values(spring)

    autumn = [0.20] * 25
    autumn[3] = 0.040
    yield "synthetic-dst-25h", "2026-10-25", "pcb", rows_from_values(autumn)

    yield "synthetic-flat", "2026-08-11", "pcb", rows_from_values([0.100] * 24)

    quirk = [0.05] * 4 + [0.15] * 2 + [0.25] * 18
    yield "synthetic-orange-quirk", "2026-08-11", "pcb", rows_from_values(quirk)

    ties = [0.20] * 24
    ties[3] = ties[15] = 0.040
    ties[7] = ties[8] = 0.120
    yield "synthetic-ties", "2026-08-11", "pcb", rows_from_values(ties)

    gap = [0.20] * 24
    gap[5] = None
    gap[14] = 0.050
    gap[15] = 0.054
    yield "synthetic-gap", "2026-08-11", "pcb", rows_from_values(gap)

    free = [0.20] * 24
    free[14] = 0.0
    free[15] = -0.005
    yield "synthetic-free-and-negative", "2026-08-11", "pcb", rows_from_values(free)

    chain = [0.30] * 24
    for k, v in enumerate((0.050, 0.054, 0.058, 0.062, 0.070)):
        chain[1 + k] = v
    chain[20], chain[21] = 0.150, 0.154
    yield "synthetic-proximity-chain", "2026-08-11", "pcb", rows_from_values(chain)

    for name in ("2026-03-29", "2025-10-26"):
        rows = archive70.parse((ARCHIVE_FIX / f"{name}.json").read_bytes())
        for series in SERIES:
            yield f"archive-{name}-{series}", name, series, rows


def stored_cases():
    for path in sorted(DATA.glob("????-??-??.json")):
        obj = json.loads(path.read_text(encoding="utf-8"))
        rows = archive70.from_rows(obj["hours"])
        for series in SERIES:
            yield f"{obj['day']}-{series}", obj["day"], series, rows


def write_if_changed(path: Path, payload: dict) -> bool:
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def test_export_bands_fixtures():
    OUT.mkdir(parents=True, exist_ok=True)
    names = set()
    for name, day, series, rows in [*stored_cases(), *synthetic_cases()]:
        points = engine.build_day(rows, day, series)
        expected = engine.bands(points)
        assert len(expected) == len(points)
        payload = {"day": day, "series": series, "rows": archive70.to_rows(rows), "expected": expected}
        write_if_changed(OUT / f"{name}.json", payload)
        names.add(name)
    assert len(names) >= 20                     # 10 días × 2 series como mínimo
    # Fixtures huérfanos (de días que ya no existen) se limpian.
    for stale in OUT.glob("*.json"):
        if stale.stem not in names:
            stale.unlink()
    assert sorted(p.stem for p in OUT.glob("*.json")) == sorted(names)


def test_stored_days_have_sane_bands():
    for _, day, series, rows in stored_cases():
        s = engine.bands(engine.build_day(rows, day, series))
        assert len(s) == len(rows)
        assert s.count("g") >= 4, (day, series, s)
        assert set(s) <= {"g", "o", "r"}

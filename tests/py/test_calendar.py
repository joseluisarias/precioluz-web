import json
from pathlib import Path

import pytest

from helpers import make_day
from precioluz import archive70, engine
from precioluz import calendar as cal

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs" / "data" / "pvpc"
ARCHIVE_FIX = ROOT / "tests" / "fixtures" / "archive70"


# MARK: Percentil

def test_percentile_interpolates_linearly():
    assert cal.percentile([1, 2, 3, 4], 0.3) == pytest.approx(1.9)
    assert cal.percentile([4, 1, 3, 2], 0.7) == pytest.approx(3.1)
    assert cal.percentile([3, 1, 2], 0.5) == 2
    assert cal.percentile([5.0], 0.7) == 5.0
    assert cal.percentile([1, 2], 0.0) == 1 and cal.percentile([1, 2], 1.0) == 2
    assert cal.percentile([], 0.3) is None


# MARK: Color del día

def test_day_color_thresholds():
    window = list(range(1, 11))
    assert cal.day_color(1, window) == "g"
    assert cal.day_color(10, window) == "r"
    assert cal.day_color(5, window) == "o"
    assert cal.percentile(window, 0.30) == pytest.approx(3.7)
    assert cal.percentile(window, 0.70) == pytest.approx(7.3)
    assert cal.day_color(3.6, window) == "g"      # ≤ p30 (3,7)
    assert cal.day_color(3.8, window) == "o"
    assert cal.day_color(7.2, window) == "o"
    assert cal.day_color(7.4, window) == "r"      # ≥ p70 (7,3)
    assert cal.day_color(0.5, [0.5]) == "g"       # un solo día: p30 = p70 = él mismo
    assert cal.day_color(0.5, []) is None


def test_rolling_colors_window_is_30_days_ending_on_the_day():
    day = "2026-09-22"
    avgs = {cal.add_days(day, -31): 0.0, cal.add_days(day, -30): 0.0,
            cal.add_days(day, -29): 1.0, day: 0.9}
    colors = cal.rolling_colors(avgs)
    # Ventana de hoy = D−29..D → [1.0, 0.9] → p30 = 0,93 → verde. Si entraran los
    # días 0.0 (D−30, D−31) saldría naranja.
    assert colors[day] == "g"
    assert colors[cal.add_days(day, -29)] == "r"
    assert colors[cal.add_days(day, -31)] == "g"
    assert set(colors) == set(avgs)


def test_rolling_colors_ignores_gaps():
    day = "2026-09-22"
    avgs = {day: 0.2, cal.add_days(day, -3): 0.1, cal.add_days(day, -10): 0.3}
    assert cal.rolling_colors(avgs)[day] == "o"


# MARK: Valle y cresta

def test_valle_and_cresta_on_a_normal_day():
    values = [float(i) / 100 for i in range(24)]       # 0.00, 0.01, … 0.23
    pts = make_day(values)
    assert cal.valle_avg(pts) == pytest.approx(sum(values[0:8]) / 8)
    cresta = values[10:14] + values[18:22]
    assert cal.cresta_avg(pts) == pytest.approx(sum(cresta) / 8)
    assert cal.valle_avg([]) is None and cal.cresta_avg([]) is None


def test_valle_uses_label_hour_like_the_app_on_dst_days():
    # 23 filas: las etiquetas saltan "02-03", así que el slot 7 es "08-09" (ya
    # no es valle). La app usa la etiqueta (`startHour(from:)`), no el índice.
    rows = archive70.parse((ARCHIVE_FIX / "2026-03-29.json").read_bytes())
    pts = engine.build_day(rows, "2026-03-29")
    valle = [p for p in pts if int(p.label[:2]) <= 7]
    assert len(valle) == 7 and [p.index for p in valle] == list(range(7))
    assert cal.valle_avg(pts) == pytest.approx(sum(p.eur_kwh for p in valle) / 7)
    assert cal.label_hour(engine.HourPoint(5, "??", 0.1, pts[0].start, pts[0].end)) == 5


# MARK: Típico laborable / finde

def test_typical_baselines_use_36_keys():
    day = "2026-09-22"                                   # martes
    d35 = cal.add_days(day, -35)                         # 2026-08-18, martes → dentro
    d36 = cal.add_days(day, -36)                         # 2026-08-17 → fuera
    assert (d35, d36) == ("2026-08-18", "2026-08-17")
    avgs = {d36: 100.0, d35: 0.2, day: 0.4, "2026-09-20": 0.3, "2026-09-19": 0.1}
    wd, we = cal.typical_baselines(avgs, day)
    assert wd == pytest.approx(0.3)
    assert we == pytest.approx(0.2)
    assert cal.typical_baselines({}, day) == (0.0, 0.0)
    assert cal.typical_baselines({"2026-09-20": 0.3}, day) == (0.0, 0.3)


def test_is_weekend_and_month_days():
    assert cal.is_weekend("2026-09-19") and cal.is_weekend("2026-09-20")
    assert not cal.is_weekend("2026-09-21")
    assert cal.month_days("2026-02")[-1] == "2026-02-28"
    assert len(cal.month_days("2026-12")) == 31 and cal.month_days("2026-12")[0] == "2026-12-01"


# MARK: calendar/YYYY-MM.json

def load_stored():
    out = {}
    for path in sorted(DATA.glob("????-??-??.json")):
        obj = json.loads(path.read_text(encoding="utf-8"))
        out[obj["day"]] = archive70.from_rows(obj["hours"])
    return out


def test_month_json_schema_on_stored_days():
    stored = load_stored()
    month = cal.month_json("2026-09", stored)
    assert list(month) == ["month", "days"]
    assert month["month"] == "2026-09"
    assert list(month["days"]) == sorted(d for d in stored if d.startswith("2026-09"))
    keys = ["avg", "min", "max", "minIdx", "maxIdx", "valle", "cresta", "color", "typWd", "typWe", "n"]
    for day, entry in month["days"].items():
        assert list(entry) == ["pcb", "cym"]
        for series, block in entry.items():
            assert list(block) == keys, (day, series)
            assert block["n"] == len(stored[day])
            assert block["color"] in ("g", "o", "r")
            assert block["min"] <= block["avg"] <= block["max"]
            assert block["valle"] is not None and block["cresta"] is not None
            assert block["typWd"] > 0 or block["typWe"] > 0
    # Color y medias típicas coinciden con el cálculo directo sobre TODOS los
    # días guardados (también los anteriores al mes: la ventana mira atrás).
    avgs = {d: engine.average(engine.build_day(r, d, "pcb")) for d, r in stored.items()}
    colors = cal.rolling_colors(avgs)
    for day, entry in month["days"].items():
        assert entry["pcb"]["color"] == colors[day]
        wd, we = cal.typical_baselines(avgs, day)
        assert entry["pcb"]["typWd"] == pytest.approx(wd)
        assert entry["pcb"]["typWe"] == pytest.approx(we)
        assert entry["pcb"]["avg"] == pytest.approx(avgs[day])
    # Un día sin nada antes es el único de su ventana → verde.
    lone = cal.month_json("2026-09", {"2026-09-01": stored[max(stored)]})
    assert lone["days"]["2026-09-01"]["pcb"]["color"] == "g"


def test_month_json_skips_missing_series_and_empty_months():
    rows = [archive70.Hour(i=i, h=f"{i:02d}-{i + 1:02d}", pcb=100.0 + i, cym=None) for i in range(24)]
    month = cal.month_json("2026-09", {"2026-09-01": rows})
    assert list(month["days"]["2026-09-01"]) == ["pcb"]
    assert cal.month_json("2025-01", {"2026-09-01": rows}) == {"month": "2025-01", "days": {}}

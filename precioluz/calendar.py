"""Calendario (heatmap) y comparativas: port de ContentView.swift.

  · percentil con interpolación lineal (rank = p·(n−1)), como `percentile()` de
    PriceColorHelper.swift
  · color del día: ≤ p30 verde · ≥ p70 rojo · resto naranja, sobre la ventana
    móvil de 30 días que termina en el propio día (solo días con datos)
  · valle = horas 00–07, cresta = 10–13 y 18–21, por la HORA DE LA ETIQUETA
    ("HH-HH"), igual que `startHour(from:)` en la app; en un día normal coincide
    con el índice de slot
  · típico laborable/finde: medias de las 36 claves D−35..D (`calculateHistoricalAverages`)

Todas las claves de día son "yyyy-MM-dd" en hora de Madrid.
"""
from __future__ import annotations

import datetime as dt
import math
from typing import Iterable, Mapping

from . import engine
from .archive70 import Hour
from .engine import HourPoint
from .zones import SERIES

ROLLING_WINDOW_DAYS = 30      # ventana del color del heatmap (D−29..D)
BASELINE_WINDOW_DAYS = 36     # ventana de las medias típicas (D−35..D)
P_LOW = 0.30
P_HIGH = 0.70

VALLE_HOURS = range(0, 8)
CRESTA_HOURS = (*range(10, 14), *range(18, 22))


# MARK: Fechas

def parse_day(day: str) -> dt.date:
    y, m, d = (int(x) for x in day.split("-"))
    return dt.date(y, m, d)


def add_days(day: str, n: int) -> str:
    return (parse_day(day) + dt.timedelta(days=n)).isoformat()


def days_between(first: str, last: str) -> list[str]:
    """Claves de `first` a `last`, ambos inclusive."""
    a, b = parse_day(first), parse_day(last)
    return [(a + dt.timedelta(days=k)).isoformat() for k in range((b - a).days + 1)]


def is_weekend(day: str) -> bool:
    return parse_day(day).weekday() >= 5      # sábado=5, domingo=6


def month_days(month: str) -> list[str]:
    """Claves de todos los días de "yyyy-MM"."""
    y, m = (int(x) for x in month.split("-"))
    first = dt.date(y, m, 1)
    nxt = dt.date(y + (m == 12), 1 if m == 12 else m + 1, 1)
    return days_between(first.isoformat(), (nxt - dt.timedelta(days=1)).isoformat())


# MARK: Percentil y color

def percentile(values: Iterable[float], p: float) -> float | None:
    """Percentil `p` (0..1) con interpolación lineal; None si no hay valores."""
    s = sorted(values)
    if not s:
        return None
    rank = p * (len(s) - 1)
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return s[lower]
    return s[lower] + (s[upper] - s[lower]) * (rank - lower)


def day_color(day_avg: float, window_avgs: Iterable[float]) -> str | None:
    """'g' si ≤ p30, 'r' si ≥ p70, 'o' en medio. None si la ventana está vacía."""
    vals = list(window_avgs)
    p30 = percentile(vals, P_LOW)
    p70 = percentile(vals, P_HIGH)
    if p30 is None or p70 is None:
        return None
    if day_avg <= p30:
        return "g"
    if day_avg >= p70:
        return "r"
    return "o"


def rolling_colors(daily_avgs: Mapping[str, float],
                   window_days: int = ROLLING_WINDOW_DAYS) -> dict[str, str]:
    """Color de cada día con datos, sobre la ventana móvil que termina en él
    (solo se cuentan los días de la ventana que tienen media)."""
    out: dict[str, str] = {}
    for day in sorted(daily_avgs):
        window = days_between(add_days(day, -(window_days - 1)), day)
        vals = [daily_avgs[d] for d in window if d in daily_avgs]
        c = day_color(daily_avgs[day], vals)
        if c is not None:
            out[day] = c
    return out


# MARK: Valle / cresta

def label_hour(point: HourPoint) -> int | None:
    """Hora de inicio según la etiqueta ("14-15" → 14), como la app. Si la
    etiqueta no es numérica, cae al índice de slot."""
    try:
        return int(str(point.label)[:2])
    except (ValueError, TypeError):
        return point.index


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    total = 0.0
    for v in values:
        total += v
    return total / len(values)


def valle_avg(points: Iterable[HourPoint]) -> float | None:
    return _mean([p.eur_kwh for p in points if label_hour(p) in VALLE_HOURS])


def cresta_avg(points: Iterable[HourPoint]) -> float | None:
    return _mean([p.eur_kwh for p in points if label_hour(p) in CRESTA_HOURS])


# MARK: Típico laborable / finde

def typical_baselines(daily_avgs: Mapping[str, float], day: str,
                      window_days: int = BASELINE_WINDOW_DAYS) -> tuple[float, float]:
    """(media laborable, media finde) de los días con datos entre D−35 y D
    (36 claves, el propio día incluido). 0.0 si no hay ninguno de esa clase."""
    wd_sum = wd_n = 0.0
    we_sum = we_n = 0.0
    for d in days_between(add_days(day, -(window_days - 1)), day):
        if d not in daily_avgs:
            continue
        if is_weekend(d):
            we_sum += daily_avgs[d]
            we_n += 1
        else:
            wd_sum += daily_avgs[d]
            wd_n += 1
    return (wd_sum / wd_n if wd_n else 0.0, we_sum / we_n if we_n else 0.0)


# MARK: calendar/YYYY-MM.json

def daily_averages(points_by_day: Mapping[str, list[HourPoint]]) -> dict[str, float]:
    return {day: engine.average(pts) for day, pts in points_by_day.items() if pts}


def day_summary(points: list[HourPoint], color: str | None,
                typ_wd: float, typ_we: float) -> dict:
    """Bloque por día y serie del JSON del calendario."""
    st = engine.stats(points)
    assert st is not None
    return {"avg": st["avg"], "min": st["min"], "max": st["max"],
            "minIdx": st["minIdx"], "maxIdx": st["maxIdx"],
            "valle": valle_avg(points), "cresta": cresta_avg(points),
            "color": color, "typWd": typ_wd, "typWe": typ_we, "n": len(points)}


def month_json(month: str, hours_by_day: Mapping[str, Iterable[Hour]]) -> dict:
    """Construye `calendar/YYYY-MM.json`:
        {"month": "2026-09",
         "days": {"2026-09-13": {"pcb": {avg,min,max,minIdx,maxIdx,valle,cresta,color,typWd,typWe,n},
                                 "cym": {…}}, …}}
    `hours_by_day` debe incluir también los días ANTERIORES al mes que se
    tengan (hasta 35 atrás): el color y las medias típicas miran hacia atrás.
    Solo aparecen los días del mes con datos; una serie sin datos se omite.
    """
    rows_by_day = {day: list(rows) for day, rows in hours_by_day.items()}
    per_series: dict[str, dict[str, list[HourPoint]]] = {}
    for series in SERIES:
        pts = {day: engine.build_day(rows, day, series) for day, rows in rows_by_day.items()}
        per_series[series] = {day: p for day, p in pts.items() if p}

    avgs = {series: daily_averages(per_series[series]) for series in SERIES}
    colors = {series: rolling_colors(avgs[series]) for series in SERIES}

    days: dict[str, dict] = {}
    for day in month_days(month):
        entry: dict[str, dict] = {}
        for series in SERIES:
            pts = per_series[series].get(day)
            if not pts:
                continue
            typ_wd, typ_we = typical_baselines(avgs[series], day)
            entry[series] = day_summary(pts, colors[series].get(day), typ_wd, typ_we)
        if entry:
            days[day] = entry
    return {"month": month, "days": days}

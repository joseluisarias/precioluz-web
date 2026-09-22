"""Utilidades compartidas por los tests del motor (espejo de PriceEngineTests.swift)."""
from __future__ import annotations

import datetime as dt

from precioluz import engine
from precioluz.archive70 import Hour

DEFAULT_DAY = "2026-08-11"

# Curva del escenario reportado por el usuario (PriceEngineTests.swift).
# 03→0.038 · 14→0.052 · 19→0.201 · 22→0.178 · 23→0.166 · media ≈ 0.115
REPORTED_BUG_DAY: list[float | None] = [
    0.120, 0.115, 0.110, 0.038, 0.105, 0.100,   # 00-05
    0.108, 0.112, 0.118, 0.125, 0.130, 0.128,   # 06-11
    0.120, 0.115, 0.052, 0.110, 0.118, 0.125,   # 12-17
    0.150, 0.201, 0.190, 0.185, 0.178, 0.166,   # 18-23
]


def rows_from_values(values: list[float | None]) -> list[Hour]:
    """Filas del archivo 70 a partir de precios en €/kWh; None = fila no
    parseable (el parser la descarta conservando el índice de las demás)."""
    rows: list[Hour] = []
    for i, v in enumerate(values):
        if v is None:
            continue
        mwh = round(v * 1000.0, 6)
        rows.append(Hour(i=i, h=f"{i:02d}-{i + 1:02d}", pcb=mwh, cym=mwh))
    return rows


def make_day(values: list[float | None], day: str = DEFAULT_DAY, series: str = "pcb") -> list[engine.HourPoint]:
    return engine.build_day(rows_from_values(values), day, series)


def at(hour: int, minute: int = 0, day: str = DEFAULT_DAY) -> dt.datetime:
    """Medianoche de Madrid del día + horas/minutos (como el `at()` de los tests Swift)."""
    return engine.madrid_day_start(day) + dt.timedelta(hours=hour, minutes=minute)


def day_start(day: str) -> dt.datetime:
    return engine.madrid_day_start(day)

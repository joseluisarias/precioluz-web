"""Motor de precios: port EXACTO de PrecioLuzWidgets/PriceEngine.swift.

Fuente de verdad única para "cuál es la hora/tramo barato" y para los colores
del chart. Cualquier cambio aquí debe reflejarse en docs/assets/js/engine.js
(tools/parity.py comprueba que ambos coloreen igual todos los días guardados).

Reglas heredadas de la app:
  1. Las horas se anclan por ÍNDICE desde la medianoche de Madrid (instante
     UTC + i·3600 s), nunca por la etiqueta. En el día de 23 h el índice 2 cae
     en las 03:00 reales; en el de 25 h los índices 2 y 3 son las dos 02:00.
  2. Empates de precio → gana el índice menor (determinista).
  3. Media sobre horas VÁLIDAS, sumando en orden (misma aritmética que Swift).
  4. `bands` replica FIELMENTE `assignColors`, incluida la rareza del relleno de
     naranjas (no salta las horas que ya son naranjas y decrementa igualmente).

Los instantes (`start`, `end`, `madrid_day_start`) son datetimes aware en UTC.
No es capricho: entre dos datetimes con el MISMO tzinfo zoneinfo, Python resta
y compara en hora de pared ignorando `fold`, así que en el día de 25 h las dos
02:00 serían "iguales" y `end − start` del día daría 24 h. En UTC la aritmética
es absoluta, como `Date` en Swift. Para mostrar, `hour_label()` convierte.
"""
from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass
from typing import Callable, Iterable

from .archive70 import Hour
from .zones import DATA_TZ, SERIES, Zone

# Configuración (PriceEngineConfig en la app).
LEAD_MINUTES = 30
TOLERANCE_EUR_KWH = 0.01
MAX_WINDOW_HOURS = 6
MAX_RATIO_VS_AVERAGE = 0.85
MAX_HOURS_PER_DAY = 25
PROXIMITY_EUR_KWH = 0.005

GREEN_BELOW = 0.65     # ratio < 0.65 → verde
ORANGE_UPTO = 0.85     # ratio ≤ 0.85 → naranja; por encima → rojo
MIN_GREENS = 4
MIN_ORANGES = 4

GREEN, ORANGE, RED = "g", "o", "r"

_UTC = dt.timezone.utc


@dataclass(frozen=True)
class HourPoint:
    """Una hora del día con su precio en €/kWh y su instante real de inicio/fin."""
    index: int          # posición en el día (0..n-1); 23 o 25 en cambios de hora
    label: str          # etiqueta cruda normalizada ("14-15"); solo diagnóstico
    eur_kwh: float
    start: dt.datetime  # aware, UTC (ver cabecera del módulo)
    end: dt.datetime    # exclusivo, UTC


@dataclass(frozen=True)
class CheapWindow:
    """Tramo barato: una hora suelta o varias CONTIGUAS dentro de la horquilla."""
    start: dt.datetime
    end: dt.datetime          # exclusivo
    hour_count: int
    min_eur_kwh: float        # la hora más barata del tramo (el "ancla")
    avg_eur_kwh: float        # lo que se COMUNICA al usuario

    @property
    def is_range(self) -> bool:
        return self.hour_count > 1


# MARK: Anclaje

def madrid_day_start(day: str) -> dt.datetime:
    """Instante de la medianoche de Madrid del día "yyyy-MM-dd" (aware, UTC)."""
    y, m, d = (int(x) for x in day.split("-"))
    return dt.datetime(y, m, d, tzinfo=DATA_TZ).astimezone(_UTC)


def slot_start(day: str, slot: int) -> dt.datetime:
    """Instante del slot `slot` del día: medianoche de Madrid + slot·3600 s
    (aritmética sobre el instante, como `calendar.date(byAdding: .hour)`)."""
    return madrid_day_start(day) + dt.timedelta(hours=slot)


def to_utc(moment: dt.datetime) -> dt.datetime:
    """Normaliza un `now` cualquiera (aware) a UTC; uno naive se asume en hora de Madrid."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=DATA_TZ)
    return moment.astimezone(_UTC)


def build_day(hours: Iterable[Hour], day: str, series: str = "pcb") -> list[HourPoint]:
    """Construye el día a partir de las filas del archivo 70 ya parseadas.

    `hours` conserva el índice de slot de cada fila (las no parseables ya
    fueron descartadas por el parser sin desplazar al resto). Una serie ausente
    (`cym` None) se salta, igual que un precio nil en la app.
    """
    if series not in SERIES:
        raise ValueError(f"serie desconocida: {series!r}")
    rows = list(hours)
    # Más de 25 entradas = dos días mezclados: mejor nada que algo falso.
    if len(rows) > MAX_HOURS_PER_DAY:
        return []
    base = madrid_day_start(day)
    out: list[HourPoint] = []
    for h in rows:
        mwh = h.pcb if series == "pcb" else h.cym
        if mwh is None:
            continue
        value = mwh / 1000.0
        if not math.isfinite(value):
            continue
        start = base + dt.timedelta(hours=h.i)
        end = base + dt.timedelta(hours=h.i + 1)
        out.append(HourPoint(index=h.i, label=h.h, eur_kwh=value, start=start, end=end))
    return out


# MARK: Métricas

def average(points: Iterable[HourPoint]) -> float:
    """Media sobre horas válidas, sumando en orden (misma aritmética que Swift)."""
    total = 0.0
    n = 0
    for p in points:
        total += p.eur_kwh
        n += 1
    return total / n if n else 0.0


def _by_price(p: HourPoint) -> tuple[float, int]:
    return (p.eur_kwh, p.index)


def minimum(points: Iterable[HourPoint]) -> HourPoint | None:
    """Hora más barata; empate → índice menor."""
    pts = list(points)
    return min(pts, key=_by_price) if pts else None


def maximum(points: Iterable[HourPoint]) -> HourPoint | None:
    """Hora más cara; empate → índice menor (como `max(by:)` de Swift, que
    conserva el primer máximo)."""
    pts = list(points)
    return max(pts, key=lambda p: (p.eur_kwh, -p.index)) if pts else None


def current(points: Iterable[HourPoint], now: dt.datetime) -> HourPoint | None:
    """La hora que contiene `now`. Comparación por instantes: en el día de
    25 h distingue las dos 02:00."""
    now = to_utc(now)
    for p in points:
        if p.start <= now < p.end:
            return p
    return None


def stats(points: Iterable[HourPoint]) -> dict | None:
    """{avg,min,max,minIdx,maxIdx} en €/kWh; None si no hay horas."""
    pts = list(points)
    if not pts:
        return None
    lo = minimum(pts)
    hi = maximum(pts)
    assert lo is not None and hi is not None
    return {"avg": average(pts), "min": lo.eur_kwh, "max": hi.eur_kwh,
            "minIdx": lo.index, "maxIdx": hi.index}


# MARK: Disponibilidad

def _available(points: Iterable[HourPoint], now: dt.datetime,
               including_current: bool, lead_minutes: int) -> list[HourPoint]:
    now = to_utc(now)
    if including_current:
        # La hora EN CURSO sigue siendo aprovechable (widget).
        return [p for p in points if p.end > now]
    cutoff = now + dt.timedelta(minutes=lead_minutes)
    return [p for p in points if p.start >= cutoff]


def remaining_cheapest(points: Iterable[HourPoint], now: dt.datetime, count: int,
                       including_current: bool = True, lead_minutes: int = 0) -> list[HourPoint]:
    """Las `count` horas más baratas que quedan por delante, en orden temporal.
    NUNCA cae hacia atrás: si no queda nada futuro devuelve []."""
    if count <= 0:
        return []
    remaining = _available(points, now, including_current, lead_minutes)
    cheapest = sorted(remaining, key=_by_price)[:count]
    return sorted(cheapest, key=lambda p: p.index)


def best_contiguous_run(points: Iterable[HourPoint], length: int, now: dt.datetime,
                        including_current: bool = True, lead_minutes: int = 0) -> CheapWindow | None:
    """Mejor tramo CONTIGUO de `length` horas que queda por delante. Sin umbral:
    responde "cuál es el mejor tramo disponible" aunque el día sea caro."""
    pts = list(points)
    if length <= 0 or len(pts) < length:
        return None
    startable = {p.index for p in _available(pts, now, including_current, lead_minutes)}
    by_index = {p.index: p for p in pts}

    best: tuple[float, list[HourPoint]] | None = None
    for p in sorted(pts, key=lambda q: q.index):
        if p.index not in startable:
            continue
        run: list[HourPoint] = []
        for offset in range(length):
            nxt = by_index.get(p.index + offset)
            if nxt is None:
                break
            run.append(nxt)
        if len(run) != length:
            continue
        total = 0.0
        for q in run:
            total += q.eur_kwh
        avg = total / length
        if best is None or avg < best[0]:
            best = (avg, run)

    if best is None:
        return None
    avg, run = best
    return CheapWindow(start=run[0].start, end=run[-1].end, hour_count=len(run),
                       min_eur_kwh=min(q.eur_kwh for q in run), avg_eur_kwh=avg)


def is_worth_announcing(window: CheapWindow, day_average: float,
                        max_ratio: float = MAX_RATIO_VS_AVERAGE) -> bool:
    """¿Merece la pena llamar "barato" a este tramo?"""
    if day_average <= 0:
        return False
    return window.avg_eur_kwh <= day_average * max_ratio


# MARK: Ventana con horquilla

def _window_around(anchor: HourPoint, pool: Iterable[HourPoint],
                   tolerance: float, max_hours: int) -> CheapWindow | None:
    """Expande hacia AMBOS lados mientras las vecinas estén dentro de
    `ancla + horquilla`, y recorta por el extremo más caro sin soltar el ancla.
    La contigüidad es por índice DENTRO del pool: un agujero corta el tramo."""
    ceiling = anchor.eur_kwh + tolerance
    by_index = {p.index: p for p in pool}
    if anchor.index not in by_index:
        return None

    lo = hi = anchor.index
    while (lo - 1) in by_index and by_index[lo - 1].eur_kwh <= ceiling:
        lo -= 1
    while (hi + 1) in by_index and by_index[hi + 1].eur_kwh <= ceiling:
        hi += 1

    cap = max(1, max_hours)
    while (hi - lo + 1) > cap:
        left_val = by_index[lo].eur_kwh if lo in by_index else -math.inf
        right_val = by_index[hi].eur_kwh if hi in by_index else -math.inf
        if lo == anchor.index:
            hi -= 1
        elif hi == anchor.index:
            lo += 1
        elif left_val >= right_val:
            lo += 1
        else:
            hi -= 1

    run = [by_index[i] for i in range(lo, hi + 1) if i in by_index]
    if not run:
        return None
    total = 0.0
    for q in run:
        total += q.eur_kwh
    return CheapWindow(start=run[0].start, end=run[-1].end, hour_count=len(run),
                       min_eur_kwh=anchor.eur_kwh, avg_eur_kwh=total / len(run))


def upcoming_cheap_window(points: Iterable[HourPoint], now: dt.datetime,
                          lead_minutes: int = LEAD_MINUTES,
                          tolerance: float = TOLERANCE_EUR_KWH,
                          max_hours: int = MAX_WINDOW_HOURS,
                          max_ratio: float = MAX_RATIO_VS_AVERAGE) -> CheapWindow | None:
    """Tramo barato FUTURO, con antelación y umbral de baratura aplicados.
    Devuelve None si nada califica: nunca algo caro ni algo pasado."""
    pts = list(points)
    day_avg = average(pts)
    if day_avg <= 0:
        return None
    cutoff = to_utc(now) + dt.timedelta(minutes=lead_minutes + 1)
    candidates = [p for p in pts if p.start >= cutoff]
    anchor = minimum(candidates)
    if anchor is None:
        return None
    window = _window_around(anchor, candidates, tolerance, max_hours)
    if window is None:
        return None
    if window.avg_eur_kwh > day_avg * max_ratio:
        return None
    return window


def day_cheap_window(points: Iterable[HourPoint], tolerance: float = TOLERANCE_EUR_KWH,
                     max_hours: int = MAX_WINDOW_HOURS) -> CheapWindow | None:
    """Tramo más barato del día SIN filtro temporal ni umbral."""
    pts = list(points)
    anchor = minimum(pts)
    if anchor is None:
        return None
    return _window_around(anchor, pts, tolerance, max_hours)


# MARK: Color

def bands(points: Iterable[HourPoint], proximity: float = PROXIMITY_EUR_KWH) -> str:
    """Un carácter por hora, en el orden de `points`: 'g' verde, 'o' naranja, 'r' rojo.

    Port fiel de `PriceEngine.bands` (que replica `ContentView.assignColors`):
      1. ratio vs media: < 0,65 verde · ≤ 0,85 naranja · resto rojo
      2. mínimo de 4 verdes (de más barata a más cara)
      3. expansión por proximidad desde los verdes (BFS, ±proximity)
      4. relleno de naranjas — con su rareza: recorre de más barata a más cara
         sin saltar las que YA son naranjas y decrementa igualmente, así que
         en la práctica no garantiza 4 naranjas
      5. expansión por proximidad desde los naranjas, solo sobre rojos
    Devuelve "" si no hay horas o la media no es positiva (la app devuelve [:]).
    """
    pts = list(points)
    if not pts:
        return ""
    avg = average(pts)
    if avg <= 0:
        return ""

    out: dict[int, str] = {}
    for p in pts:
        ratio = p.eur_kwh / avg
        out[p.index] = GREEN if ratio < GREEN_BELOW else (ORANGE if ratio <= ORANGE_UPTO else RED)

    sorted_by_price = sorted(pts, key=_by_price)

    # Mínimo de 4 verdes.
    target_greens = min(MIN_GREENS, len(pts))
    greens = sum(1 for b in out.values() if b == GREEN)
    i = 0
    while greens < target_greens and i < len(sorted_by_price):
        p = sorted_by_price[i]
        i += 1
        if out[p.index] != GREEN:
            out[p.index] = GREEN
            greens += 1

    # Expansión por proximidad a los verdes.
    _expand(GREEN, out, pts, sorted_by_price, proximity, lambda b: b != GREEN)

    # Relleno de naranjas (rareza replicada a propósito, ver docstring).
    target_oranges = min(MIN_ORANGES, len(pts))
    current_oranges = sum(1 for b in out.values() if b == ORANGE)
    if current_oranges < target_oranges:
        needed = target_oranges - current_oranges
        for p in sorted_by_price:
            if needed <= 0:
                break
            if out[p.index] == GREEN:
                continue
            out[p.index] = ORANGE
            needed -= 1

    # Expansión por proximidad a los naranjas (solo desde rojo).
    _expand(ORANGE, out, pts, sorted_by_price, proximity, lambda b: b == RED)

    return "".join(out[p.index] for p in pts)


def _expand(band: str, out: dict[int, str], pts: list[HourPoint],
            sorted_by_price: list[HourPoint], threshold: float,
            is_eligible: Callable[[str], bool]) -> None:
    if threshold <= 0:
        return
    queue = [p.eur_kwh for p in sorted_by_price if out[p.index] == band]
    cursor = 0
    while cursor < len(queue):
        reference = queue[cursor]
        cursor += 1
        for p in pts:
            if not is_eligible(out[p.index]):
                continue
            if abs(p.eur_kwh - reference) <= threshold:
                out[p.index] = band
                queue.append(p.eur_kwh)


def bands_by_index(points: Iterable[HourPoint], proximity: float = PROXIMITY_EUR_KWH) -> dict[int, str]:
    """Misma clasificación, indexada por slot (como el diccionario de la app)."""
    pts = list(points)
    s = bands(pts, proximity)
    return {p.index: s[k] for k, p in enumerate(pts)} if s else {}


# MARK: Etiquetas y JSON

def hour_label(moment: dt.datetime, tz: dt.tzinfo | Zone = DATA_TZ) -> str:
    """"14:00" derivado del instante en el reloj de la zona, NO de la etiqueta
    "HH-HH". La hora 23 + 1 h formatea "00:00", nunca "24:00"."""
    zone_tz = tz.tz if isinstance(tz, Zone) else tz
    return f"{moment.astimezone(zone_tz).hour:02d}:00"


def day_stats_json(points_by_series: dict[str, list[HourPoint]]) -> dict:
    """Los bloques `stats` y `bands` del JSON de un día (esquema del plan):
        {"stats": {"pcb": {avg,min,max,minIdx,maxIdx}, "cym": {…}},
         "bands": {"pcb": "gggo…", "cym": "…"}}
    Las series sin horas se omiten."""
    st: dict[str, dict] = {}
    bd: dict[str, str] = {}
    for series, pts in points_by_series.items():
        s = stats(pts)
        if s is None:
            continue
        st[series] = s
        bd[series] = bands(pts)
    return {"stats": st, "bands": bd}


def day_extras(hours: Iterable[Hour], day: str) -> dict:
    """`day_stats_json` para las dos series a partir de las filas parseadas."""
    rows = list(hours)
    return day_stats_json({series: build_day(rows, day, series) for series in SERIES})

"""Textos y formatos (port de ContentView.swift y PriceCopy en PriceEngine.swift).

  · niveles del día: media ≤ 0,12 barato · ≤ 0,18 normal · resto caro
  · spread (máx − mín): ≤ 0,03 plano · ≤ 0,06 medio · resto alto
  · 9 consejos: los 8 de la app (tal cual, con {bestHour}) + caro×medio, nuevo
  · coma decimal en todo el sitio ("0,052 €/kWh"); nombres en castellano
    codificados a mano (sin dependencia del locale del sistema)

El redondeo es "half-up sobre el valor binario exacto", que es exactamente lo que
hace `Number.prototype.toFixed` en JS: así el HTML generado y el cliente
escriben el mismo número (NumberFormatter en la app usa half-even; solo difiere
en empates exactos como 0,0625 → 0,063 aquí, 0,062 en la app).
"""
from __future__ import annotations

import datetime as dt
import math
from decimal import ROUND_HALF_UP, Decimal

DAY_CHEAP_MAX = 0.12
DAY_NORMAL_MAX = 0.18
SPREAD_FLAT_MAX = 0.03
SPREAD_MEDIUM_MAX = 0.06

DAY_LEVELS = ("barato", "normal", "caro")
SPREAD_LEVELS = ("plano", "medio", "alto")

WEEKDAYS = ("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
WEEKDAYS_SHORT = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")
MONTHS = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
          "agosto", "septiembre", "octubre", "noviembre", "diciembre")
MONTHS_SHORT = ("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")

# Los 8 textos de la app (ContentView, ejemplos de estilo del consejo) tal cual,
# con la hora literal sustituida por {bestHour}; el noveno (caro×medio) es nuevo.
CONSEJOS: dict[tuple[str, str], dict[str, str]] = {
    ("barato", "plano"): {
        "title": "Barra libre de energía",
        "summary": "Hoy la luz está tirada de precio todo el día. Es uno de esos días donde no hace "
                   "falta mirar el reloj ni preocuparse por la factura.",
        "action": "Aprovecha para poner todas las lavadoras y lavavajillas pendientes cuando tú quieras.",
    },
    ("barato", "alto"): {
        "title": "Chollo con hora exacta",
        "summary": "El día es muy barato en general, pero hay un momento específico que es casi gratis. "
                   "Si puedes programar tus aparatos, el ahorro será total.",
        "action": "Programa los electrodomésticos más potentes alrededor de las {bestHour} para "
                  "maximizar el ahorro.",
    },
    ("normal", "medio"): {
        "title": "Día tranquilo con truco",
        "summary": "Ni muy caro ni muy barato, precios bastante estándar. Sin embargo, hay un hueco a "
                   "mediodía que merece la pena aprovechar para bajar la media.",
        "action": "Si estás en casa, intenta cocinar o planchar cerca de las {bestHour}.",
    },
    ("caro", "alto"): {
        "title": "¡Cuidado con la factura!",
        "summary": "Hoy la electricidad está por las nubes y hay picos que asustan. Usar el horno o la "
                   "calefacción a lo loco te saldrá caro.",
        "action": "Evita las horas centrales y, si es urgente, programa el consumo para la madrugada "
                  "({bestHour}).",
    },
    ("caro", "plano"): {
        "title": "Toca apretarse el cinturón",
        "summary": "Mal día para el consumo intensivo. Los precios están altos desde que te levantas "
                   "hasta que te acuestas y no hay escapatoria.",
        "action": "Limítate a lo imprescindible y pospón las lavadoras grandes para mañana si puedes.",
    },
    ("normal", "plano"): {
        "title": "Sin sorpresas ni sobresaltos",
        "summary": "Un día muy estable con precios razonables. No vas a encontrar grandes ofertas, pero "
                   "tampoco te van a clavar por poner la tele.",
        "action": "Haz tu vida normal y usa los electrodomésticos cuando te venga bien por comodidad.",
    },
    ("normal", "alto"): {
        "title": "Espera a la noche",
        "summary": "El día no pinta mal, pero la diferencia de precio entre la mañana y la noche es "
                   "notable. La paciencia hoy tiene premio.",
        "action": "Aguanta un poco y deja la lavadora o el lavavajillas para el final del día, sobre "
                  "las {bestHour}.",
    },
    ("barato", "medio"): {
        "title": "Día de limpieza general",
        "summary": "Tenemos precios bajos con alguna pequeña subida sin importancia. Es el momento "
                   "perfecto para adelantar tareas del hogar sin agobios.",
        "action": "Dale caña a la plancha y la cocina, intentando evitar solo los picos más altos.",
    },
    ("caro", "medio"): {
        "title": "Día caro con un respiro",
        "summary": "La luz está cara casi todo el día, pero hay una ventana limitada en la que baja algo. "
                   "No es un chollo, pero se nota en la factura.",
        "action": "Concentra los consumos más potentes cerca de las {bestHour} y deja el resto para "
                  "otro día.",
    },
}

_LEVEL_WORDS = {"barato": "barata", "normal": "a un precio normal", "caro": "cara"}
_SPREAD_WORDS = {"plano": "apenas cambia", "medio": "cambia algo", "alto": "cambia mucho"}


# MARK: Niveles

def day_level(avg: float) -> str:
    if avg <= DAY_CHEAP_MAX:
        return "barato"
    if avg <= DAY_NORMAL_MAX:
        return "normal"
    return "caro"


def spread_level(spread: float) -> str:
    """`spread` = máximo − mínimo del día, en €/kWh."""
    if spread <= SPREAD_FLAT_MAX:
        return "plano"
    if spread <= SPREAD_MEDIUM_MAX:
        return "medio"
    return "alto"


def level_badge(day_lvl: str, spread_lvl: str) -> str:
    """"BARATO · PLANO" (cápsula del consejo)."""
    return f"{day_lvl.upper()} · {spread_lvl.upper()}"


# MARK: Consejo

def consejo(day_lvl: str, spread_lvl: str, best_hour_label: str) -> dict[str, str]:
    """{title, summary, action} para la combinación, con {bestHour} sustituido."""
    if day_lvl not in DAY_LEVELS or spread_lvl not in SPREAD_LEVELS:
        raise ValueError(f"combinación desconocida: {day_lvl!r} × {spread_lvl!r}")
    text = CONSEJOS[(day_lvl, spread_lvl)]
    return {k: v.replace("{bestHour}", best_hour_label) for k, v in text.items()}


def consejo_frame(day_lvl: str, spread_lvl: str) -> str:
    """"Consejo del día: hoy la luz está barata y apenas cambia entre unas horas y otras." """
    return (f"Consejo del día: hoy la luz está {_LEVEL_WORDS[day_lvl]} y "
            f"{_SPREAD_WORDS[spread_lvl]} entre unas horas y otras.")


def tip_text(spread: float, best_hour_label: str) -> str:
    """`tipText` de la app (consejo de respaldo)."""
    if spread >= SPREAD_MEDIUM_MAX:
        return (f"Hoy hay mucha diferencia entre horas. Si puedes, concentra consumos en "
                f"{best_hour_label}.")
    return "Día bastante plano. No hay grandes diferencias entre horas."


# MARK: Números

def fmt_number(value: float, decimals: int = 3) -> str:
    """"0,052": coma decimal, sin separador de miles, half-up sobre el binario exacto."""
    if not math.isfinite(value):
        return "—"
    q = Decimal(1).scaleb(-decimals)            # 10^-decimals
    s = str(Decimal(value).quantize(q, rounding=ROUND_HALF_UP))
    if s.startswith("-") and not any(c not in "0.-" for c in s):
        s = s[1:]                               # "-0,000" → "0,000"
    return s.replace(".", ",")


def fmt_eur(value: float, decimals: int = 3) -> str:
    """"0,052 €/kWh" ("— €/kWh" si no es finito)."""
    return f"{fmt_number(value, decimals)} €/kWh"


def fmt_eur_bare(value: float, decimals: int = 3) -> str:
    return fmt_number(value, decimals)


def fmt_pct(value: float, decimals: int = 1) -> str:
    """"12,4 %" (con espacio fino ASCII antes del símbolo, como escribe la RAE)."""
    return f"{fmt_number(value, decimals)} %"


# MARK: Fechas

def _parse(day: str) -> dt.date:
    y, m, d = (int(x) for x in day.split("-"))
    return dt.date(y, m, d)


def is_weekend(day: str) -> bool:
    return _parse(day).weekday() >= 5


def day_badge(day: str) -> str:
    """"Laborable · Lun 22 Sep" / "Finde · Sáb 27 Sep"."""
    d = _parse(day)
    kind = "Finde" if d.weekday() >= 5 else "Laborable"
    return f"{kind} · {WEEKDAYS_SHORT[d.weekday()]} {d.day} {MONTHS_SHORT[d.month - 1]}"


def long_date(day: str) -> str:
    """"Lunes, 22 de septiembre de 2026"."""
    d = _parse(day)
    return f"{WEEKDAYS[d.weekday()]}, {d.day} de {MONTHS[d.month - 1]} de {d.year}"


def short_date(day: str) -> str:
    """"22/09"."""
    d = _parse(day)
    return f"{d.day:02d}/{d.month:02d}"


def month_title(month: str) -> str:
    """"Septiembre 2026" a partir de "2026-09"."""
    y, m = (int(x) for x in month.split("-"))
    return f"{MONTHS[m - 1].capitalize()} {y}"


# MARK: Comparativa

def comparison_text(avg: float, baseline: float, is_weekend_day: bool) -> str | None:
    """"↑ 12,4 % vs típico (laborable)"; None si falta alguna de las dos medias."""
    if avg <= 0 or baseline <= 0:
        return None
    diff = avg - baseline
    pct = diff / baseline * 100.0
    arrow = "↑" if diff >= 0 else "↓"
    return f"{arrow} {fmt_pct(abs(pct))} vs típico ({'finde' if is_weekend_day else 'laborable'})"


def comparison_to_average(window_avg: float, day_average: float) -> str | None:
    """"un 57 % por debajo de la media de hoy" (PriceCopy.comparisonToAverage)."""
    if day_average <= 0 or window_avg >= day_average:
        return None
    pct = int(Decimal((day_average - window_avg) / day_average * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    if pct < 5:
        return None
    return f"un {pct} % por debajo de la media de hoy"

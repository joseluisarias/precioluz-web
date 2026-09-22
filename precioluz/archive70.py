"""Parser del archivo 70 de ESIOS (PVPC 2.0TD, horario).

Es la misma fuente que usa la app iOS. El JSON tiene la forma
    {"PVPC": [{"Dia": "22/09/2026", "Hora": "00-01", "PCB": "216,88", "CYM": "216,88", ...}, ...]}
con precios en €/MWh y coma decimal. `PCB` = Península, Canarias y Baleares;
`CYM` = Ceuta y Melilla (difiere en las horas frontera de los periodos los
días laborables). 24 filas normales, 23 o 25 en los cambios de hora.

Cuando el día aún no está publicado, la API responde 200 con
    {"message": "No values for specified archive"}.
"""
from __future__ import annotations

import json
from dataclasses import dataclass


class NotPublished(Exception):
    """El día pedido todavía no existe en ESIOS."""


class InvalidDay(ValueError):
    """La respuesta no es un día PVPC utilizable."""


@dataclass(frozen=True)
class Hour:
    i: int            # índice de slot (0..24): el instante es medianoche de Madrid + i·3600 s
    h: str            # etiqueta normalizada "HH-HH" tal como la publica REE
    pcb: float        # €/MWh
    cym: float | None # €/MWh; None si el archivo no trae la serie

    @property
    def pcb_kwh(self) -> float:
        return self.pcb / 1000.0

    @property
    def cym_kwh(self) -> float | None:
        return None if self.cym is None else self.cym / 1000.0


def parse_price(raw) -> float | None:
    """'216,88' → 216.88. None si no es un número (la app también lo descarta)."""
    if raw is None:
        return None
    s = str(raw).strip().replace(".", "").replace(",", ".") if "," in str(raw) else str(raw).strip()
    try:
        return float(s)
    except ValueError:
        return None


def normalize_label(raw: str) -> str:
    """'9-10' → '09-10'; acepta guion largo. Devuelve el original si no encaja."""
    parts = str(raw).replace("–", "-").replace(" ", "").split("-")
    if len(parts) != 2:
        return str(raw)
    try:
        a, b = int(parts[0]), int(parts[1])
    except ValueError:
        return str(raw)
    return f"{a:02d}-{b:02d}"


def parse(payload) -> list[Hour]:
    """Convierte el JSON (bytes, str o dict) en la lista de horas válidas.

    Las filas con PCB no parseable se descartan conservando el índice de las
    demás (igual que `buildDay` en la app: nunca se desplaza el resto del día).
    """
    obj = payload if isinstance(payload, dict) else json.loads(payload)
    rows = obj.get("PVPC")
    if rows is None:
        if "message" in obj:
            raise NotPublished(str(obj["message"]))
        raise InvalidDay("la respuesta no contiene 'PVPC'")
    if not 23 <= len(rows) <= 25:
        raise InvalidDay(f"{len(rows)} filas; se esperaban entre 23 y 25")
    hours: list[Hour] = []
    for i, row in enumerate(rows):
        pcb = parse_price(row.get("PCB"))
        if pcb is None:
            continue
        hours.append(Hour(i=i, h=normalize_label(row.get("Hora", "")), pcb=pcb,
                          cym=parse_price(row.get("CYM"))))
    if not hours:
        raise InvalidDay("ninguna fila con precio parseable")
    return hours


def to_rows(hours: list[Hour]) -> list[dict]:
    """Forma que se guarda en docs/data/pvpc/YYYY-MM-DD.json (€/MWh tal cual)."""
    return [{"i": h.i, "h": h.h, "pcb": h.pcb, "cym": h.cym} for h in hours]


def from_rows(rows: list[dict]) -> list[Hour]:
    return [Hour(i=r["i"], h=r["h"], pcb=float(r["pcb"]),
                 cym=None if r.get("cym") is None else float(r["cym"])) for r in rows]

"""Sistemas eléctricos de REE (espejo de PriceZone.swift de la app).

Verificado contra ESIOS (indicador 1001 por geo_id):
  · Península, Baleares y Canarias comparten la MISMA serie de precio (`pcb`).
  · Ceuta y Melilla tienen serie propia (`cym`).
  · Todos los sellos horarios de REE van en hora peninsular. Lo único que cambia
    en Canarias es el reloj (una hora menos), no el dato.

Regla única para todo el código:
  · identidad del día ("yyyy-MM-dd", medianoche para anclar) = hora de DATOS (Madrid)
  · etiqueta de hora que ve el usuario                       = reloj de la ZONA
  · serie de precio                                          = serie de la ZONA
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from zoneinfo import ZoneInfo

DATA_TZ_NAME = "Europe/Madrid"
DATA_TZ = ZoneInfo(DATA_TZ_NAME)

SERIES = ("pcb", "cym")


@dataclass(frozen=True)
class Zone:
    id: str          # raw: peninsula | canarias | baleares | ceuta | melilla
    name: str        # "Península"
    code: str        # cápsula corta: PEN, CAN, BAL, CEU, MEL
    series: str      # 'pcb' | 'cym'
    tz_name: str     # reloj del usuario
    subtitle: str    # subtítulo de la cabecera del tab Día
    path: str        # ruta de la web que muestra esta zona

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.tz_name)

    @property
    def is_data_clock(self) -> bool:
        """True si el reloj de la zona coincide con el de los datos (todas menos Canarias)."""
        return self.tz_name == DATA_TZ_NAME


PENINSULA = Zone("peninsula", "Península", "PEN", "pcb", DATA_TZ_NAME, "PVPC — datos oficiales", "/")
CANARIAS = Zone("canarias", "Canarias", "CAN", "pcb", "Atlantic/Canary", "PVPC · Canarias (hora local)", "/canarias/")
BALEARES = Zone("baleares", "Baleares", "BAL", "pcb", DATA_TZ_NAME, "PVPC · Baleares", "/baleares/")
CEUTA = Zone("ceuta", "Ceuta", "CEU", "cym", DATA_TZ_NAME, "PVPC · Ceuta", "/ceuta-melilla/")
MELILLA = Zone("melilla", "Melilla", "MEL", "cym", DATA_TZ_NAME, "PVPC · Melilla", "/ceuta-melilla/")

ALL: tuple[Zone, ...] = (PENINSULA, CANARIAS, BALEARES, CEUTA, MELILLA)
BY_ID: dict[str, Zone] = {z.id: z for z in ALL}


def by_id(raw: str | None, default: Zone = PENINSULA) -> Zone:
    """Zona por su id crudo; `default` si no existe (igual que `PriceZone(rawValue:) ?? …`)."""
    return BY_ID.get(raw or "", default)


def detect(tz_name: str | None) -> Zone:
    """Detección por zona horaria. Solo Canarias es detectable: Baleares, Ceuta y
    Melilla comparten reloj con Península."""
    return CANARIAS if tz_name == "Atlantic/Canary" else PENINSULA


def publication_local_minutes(zone: Zone, reference: dt.date | dt.datetime | None = None) -> int:
    """Minutos desde medianoche (reloj de la zona) a los que REE ya suele haber
    publicado los precios de mañana: 20:20 peninsular → 19:20 en Canarias.

    `reference` fija el día (por si algún día cambiara la diferencia horaria);
    por defecto, hoy en hora de Madrid.
    """
    if reference is None:
        reference = dt.datetime.now(DATA_TZ).date()
    elif isinstance(reference, dt.datetime):
        reference = (reference.astimezone(DATA_TZ) if reference.tzinfo else reference).date()
    published = dt.datetime(reference.year, reference.month, reference.day, 20, 20, tzinfo=DATA_TZ)
    local = published.astimezone(zone.tz)
    return local.hour * 60 + local.minute

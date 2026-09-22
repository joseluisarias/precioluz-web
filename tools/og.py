#!/usr/bin/env python3
"""Imágenes Open Graph (1200×630) con los números del día para las páginas dinámicas.

Se ejecuta en el cron después de fetch.py y antes de build.py. Son binarios que
cambian a diario: build.py --check no los compara.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from precioluz import archive70, calendar as cal, copy, engine  # noqa: E402
from precioluz.zones import BY_ID  # noqa: E402

DATA = ROOT / "docs" / "data"
OUT = ROOT / "docs" / "assets" / "img" / "og"
W, H = 1200, 630
CREAM = (247, 245, 237)
INK = (28, 28, 30)
GRAY = (110, 110, 115)
BAND = {"g": (52, 199, 89), "o": (255, 149, 0), "r": (255, 59, 48)}
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

PAGES = {  # key → (zona, offset de día, etiqueta)
    "home": ("peninsula", 0, "Precio de la luz hoy"), "manana": ("peninsula", 1, "Precio de la luz mañana"),
    "resumen": ("peninsula", 0, "Resumen del precio de la luz"), "hora_mas_barata": ("peninsula", 0, "Hora más barata de la luz"),
    "canarias": ("canarias", 0, "Precio de la luz hoy en Canarias"), "baleares": ("baleares", 0, "Precio de la luz hoy en Baleares"),
    "ceuta_melilla": ("ceuta", 0, "Precio de la luz hoy en Ceuta y Melilla"), "calendario": ("peninsula", 0, "Calendario del precio de la luz"),
}


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for c in FONT_CANDIDATES:
        if bold and "Bold" not in c:
            continue
        if not bold and "Bold" in c:
            continue
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    for c in FONT_CANDIDATES:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def draw(key: str, day: str, zone, points, bands: str, out: Path) -> None:
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    label = PAGES[key][2]
    d.text((64, 52), label, fill=GRAY, font=font(34, False))
    d.text((64, 96), copy.long_date(day), fill=INK, font=font(56))
    if points:
        best, worst = engine.minimum(points), engine.maximum(points)
        st = engine.stats(points)
        d.text((64, 190), f"Hora más barata {engine.hour_label(best.start, zone)} · {copy.fmt_eur(best.eur_kwh)}",
               fill=BAND["g"], font=font(40))
        d.text((64, 244), f"Más cara {engine.hour_label(worst.start, zone)} · {copy.fmt_eur(worst.eur_kwh)}   Media {copy.fmt_eur(st['avg'])}",
               fill=GRAY, font=font(30, False))
        # mini gráfico: 24 barras
        x0, y0, x1, y1 = 64, 330, W - 64, 540
        n = len(points)
        gap = 6
        bw = (x1 - x0 - gap * (n - 1)) / n
        vmax = max(p.eur_kwh for p in points) or 1
        for k, p in enumerate(points):
            h = max(6, (y1 - y0) * p.eur_kwh / vmax)
            x = x0 + k * (bw + gap)
            d.rounded_rectangle((x, y1 - h, x + bw, y1), radius=6, fill=BAND.get(bands[k] if k < len(bands) else "o", (142, 142, 147)))
        d.text((x0, y1 + 10), engine.hour_label(points[0].start, zone), fill=GRAY, font=font(22, False))
        d.text((x1 - 70, y1 + 10), engine.hour_label(points[-1].start, zone), fill=GRAY, font=font(22, False))
    else:
        d.text((64, 200), "Se publica a las 20:20", fill=GRAY, font=font(44))
    d.text((64, H - 56), "precioluz.natural-apps.com · datos de Red Eléctrica (PVPC)", fill=GRAY, font=font(24, False))
    d.rounded_rectangle((W - 64 - 230, 56, W - 64, 92), radius=18, fill=INK)
    d.text((W - 64 - 215, 62), "App para iPhone", fill=CREAM, font=font(22, False))
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, optimize=True)


def main() -> int:
    today = json.loads((DATA / "build.json").read_text())["today"] if (DATA / "build.json").exists() else None
    if not today:
        import datetime as dt
        from zoneinfo import ZoneInfo
        today = dt.datetime.now(ZoneInfo("Europe/Madrid")).date().isoformat()
    for key, (zone_id, offset, _) in PAGES.items():
        zone = BY_ID[zone_id]
        day = cal.add_days(today, offset)
        f = DATA / "pvpc" / f"{day}.json"
        points, bands = [], ""
        if f.exists():
            obj = json.loads(f.read_text(encoding="utf-8"))
            rows = archive70.from_rows(obj["hours"])
            points = engine.build_day(rows, day, zone.series)
            bands = engine.bands(points)
        draw(key, day, zone, points, bands, OUT / f"{key}.png")
    print(f"og: {len(PAGES)} imágenes en {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Genera el sitio estático en docs/ a partir de docs/data/**. Sin red, determinista.

  build.py [--today YYYY-MM-DD] [--check]

`--check` re-renderiza en memoria con el `today` del último build (docs/data/build.json)
y falla si el HTML en disco difiere (guardia de CI).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from precioluz import archive70, calendar as cal, copy, engine, render  # noqa: E402
from precioluz.zones import ALL as ZONES, BY_ID, PENINSULA  # noqa: E402

MADRID = ZoneInfo("Europe/Madrid")
BASE = "https://precioluz.natural-apps.com"
DOCS = ROOT / "docs"
DATA = DOCS / "data"
EVERGREEN_DATE = "2026-09-22"          # lastmod de las páginas sin datos dinámicos
PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")

PAGES = [  # key, tab, zona, día relativo
    ("home", "dia", "peninsula", 0), ("manana", "dia", "peninsula", 1),
    ("generacion", "generacion", "peninsula", 0), ("resumen", "resumen", "peninsula", 0),
    ("calendario", "calendario", "peninsula", 0),
    ("canarias", "dia", "canarias", 0), ("baleares", "dia", "baleares", 0), ("ceuta_melilla", "dia", "ceuta", 0),
    ("hora_mas_barata", "dia", "peninsula", 0), ("que_es_el_pvpc", "dia", "peninsula", 0),
    ("cuando_poner_la_lavadora", "dia", "peninsula", 0), ("a_que_hora_sale", "dia", "peninsula", 0),
    ("app", "dia", "peninsula", 0), ("faq", "dia", "peninsula", 0), ("404", "dia", "peninsula", 0),
]
TABS = ("dia", "generacion", "resumen", "calendario")


class Site:
    def __init__(self, today: str):
        self.today = today
        self.tomorrow = cal.add_days(today, 1)
        self.index = json.loads((DATA / "pvpc" / "index.json").read_text(encoding="utf-8"))
        self.rows: dict[str, list[archive70.Hour]] = {}
        self.files: dict[str, dict] = {}
        for f in sorted((DATA / "pvpc").glob("????-??-??.json")):
            obj = json.loads(f.read_text(encoding="utf-8"))
            self.files[obj["day"]] = obj
            self.rows[obj["day"]] = archive70.from_rows(obj["hours"])
        self.gen: dict[str, dict] = {}
        for f in sorted((DATA / "generacion").glob("????-??-??.json")):
            obj = json.loads(f.read_text(encoding="utf-8"))
            self.gen[obj["day"]] = obj
        self.copy = json.loads((ROOT / "seo" / "copy.json").read_text(encoding="utf-8"))
        self.jsonld = json.loads((ROOT / "seo" / "jsonld.json").read_text(encoding="utf-8"))
        self.sections = {p.stem: p.read_text(encoding="utf-8") for p in (ROOT / "seo" / "sections").glob("*.html")}
        self.shell = (ROOT / "templates" / "shell.html").read_text(encoding="utf-8")
        self._pts: dict[tuple[str, str], list[engine.HourPoint]] = {}
        self.updated_at = self.index.get("updatedAt") or ""
        self.months = sorted({d[:7] for d in self.rows})
        self.calendar = {m: cal.month_json(m, self.rows) for m in self.months}
        self.max_day = self.tomorrow if self.tomorrow in self.rows else self.today

    def points(self, day: str, series: str) -> list[engine.HourPoint]:
        key = (day, series)
        if key not in self._pts:
            self._pts[key] = engine.build_day(self.rows[day], day, series) if day in self.rows else []
        return self._pts[key]

    def extras(self, day: str) -> dict:
        return engine.day_extras(self.rows[day], day) if day in self.rows else {"stats": {}, "bands": {}}

    def day_file(self, day: str) -> dict | None:
        if day not in self.files:
            return None
        return {**self.files[day], **self.extras(day)}


# MARK: Contexto de placeholders

def fecha_larga(day: str) -> str:
    """"martes 22 de septiembre" (sin coma ni año: va dentro de títulos y frases)."""
    d = cal.parse_day(day)
    return f"{copy.WEEKDAYS[d.weekday()].lower()} {d.day} de {copy.MONTHS[d.month - 1]}"


def fmt_hhmm(iso: str) -> str:
    try:
        d = dt.datetime.fromisoformat(iso).astimezone(MADRID)
        return f"{d.hour:02d}:{d.minute:02d}"
    except ValueError:
        return "—"


def fmt_updated(iso: str) -> str:
    try:
        d = dt.datetime.fromisoformat(iso).astimezone(MADRID)
        return f"{d.day:02d}/{d.month:02d}/{d.year} {d.hour:02d}:{d.minute:02d}"
    except ValueError:
        return "—"


def context(site: Site, day: str, zone) -> dict[str, str]:
    pts = site.points(day, zone.series)
    st = engine.stats(pts)
    ctx = {
        "fecha_corta": copy.short_date(day), "fecha_larga": fecha_larga(day),
        "fecha_larga_manana": fecha_larga(cal.add_days(day, 1)), "mes_anno": copy.month_title(day[:7]).lower(),
        "zona": zone.name if zone.id != "ceuta" else "Ceuta y Melilla", "appstore_url": render.STORE,
        "actualizado": fmt_updated(site.updated_at), "actualizado_iso": site.updated_at,
        "fecha_iso": day, "data_url": f"{BASE}/data/hoy.json", "publicado_manana_a": "—",
        "hora_barata_manana": "—", "precio_barato_manana": "—", "renovable_ayer": "—", "dominante_ayer": "—",
        "tramo2_inicio": "—", "tramo2_fin": "—", "tramo2_media": "—", "pct_vs_ayer": "0", "mas_menos_ayer": "más cara",
    }
    if st and pts:
        best, worst = engine.minimum(pts), engine.maximum(pts)
        ctx.update({
            "hora_barata": engine.hour_label(best.start, zone), "hora_barata_fin": engine.hour_label(best.end, zone),
            "precio_barato": copy.fmt_number(best.eur_kwh), "hora_cara": engine.hour_label(worst.start, zone),
            "hora_cara_fin": engine.hour_label(worst.end, zone), "precio_caro": copy.fmt_number(worst.eur_kwh),
            "media": copy.fmt_number(st["avg"]),
        })
        run = engine.best_contiguous_run(pts, 2, pts[0].start)
        if run:
            ctx.update({"tramo2_inicio": engine.hour_label(run.start, zone), "tramo2_fin": engine.hour_label(run.end, zone),
                        "tramo2_media": copy.fmt_number(run.avg_eur_kwh)})
        prev_st = engine.stats(site.points(cal.add_days(day, -1), zone.series))
        if prev_st and prev_st["avg"] > 0:
            pct = (st["avg"] - prev_st["avg"]) / prev_st["avg"] * 100
            ctx["pct_vs_ayer"] = copy.fmt_pct(abs(pct)).replace(" %", "")
            ctx["mas_menos_ayer"] = "más cara" if pct >= 0 else "más barata"
    else:
        ctx.update({k: "—" for k in ("hora_barata", "hora_barata_fin", "precio_barato", "hora_cara",
                                     "hora_cara_fin", "precio_caro", "media")})
    nxt = cal.add_days(day, 1)
    npts = site.points(nxt, zone.series)
    if npts:
        nb = engine.minimum(npts)
        ctx["hora_barata_manana"] = engine.hour_label(nb.start, zone)
        ctx["precio_barato_manana"] = copy.fmt_number(nb.eur_kwh)
        ctx["publicado_manana_a"] = fmt_hhmm(site.files[nxt].get("fetchedAt", ""))
    g = site.gen.get(cal.add_days(site.today, -1))
    if g and g.get("entries"):
        ctx["renovable_ayer"] = copy.fmt_pct(g["renewablePct"])
        ctx["dominante_ayer"] = g["entries"][0]["t"].lower()
    return ctx


def fill(text: str, ctx: dict[str, str], where: str) -> str:
    def rep(m):
        k = m.group(1)
        if k not in ctx:
            raise KeyError(f"{where}: placeholder desconocido {{{k}}}")
        return ctx[k]
    return PLACEHOLDER.sub(rep, text)


# MARK: Página

def page_html(site: Site, key: str, tab: str, zone_id: str, offset: int) -> tuple[str, str]:
    zone = BY_ID[zone_id]
    day = cal.add_days(site.today, offset)
    spec = site.copy[key]
    if key == "manana" and day not in site.rows:
        spec = site.copy["manana_pendiente"]
        day = site.today
    ctx = context(site, day, zone)
    ctx.update({"page_url": BASE + spec["url"], "page_name": fill(spec["h1"], ctx, key), "title": fill(spec["title"], ctx, key),
                "description": fill(spec["description"], ctx, key), "h1": fill(spec["h1"], ctx, key),
                "date_published_iso": EVERGREEN_DATE, "og_image_url": f"{BASE}/assets/img/og-default.png"})

    pts = site.points(day, zone.series)
    ex = site.extras(day)
    bands = ex["bands"].get(zone.series, "")
    st = ex["stats"].get(zone.series)
    tomorrow_enabled = cal.add_days(day, 1) in site.rows
    header = render.header_card(day, zone, site.index["first"] or day, site.max_day, tomorrow_enabled)
    panel_dia = render.bars(pts, bands, zone, copy.long_date(day).lower()) + render.cta_card()

    prev_st = engine.stats(site.points(cal.add_days(day, -1), zone.series))
    nxt = cal.add_days(day, 1)
    next_st = engine.stats(site.points(nxt, zone.series))
    next_state = "future" if nxt > site.max_day else "none"
    typ = cal.typical_baselines(cal.daily_averages({d: site.points(d, zone.series) for d in site.rows}), day) if st else (0.0, 0.0)
    baseline = typ[1] if copy.is_weekend(day) else typ[0]
    comparison = copy.comparison_text(st["avg"], baseline, copy.is_weekend(day)) if st else None
    panel_resumen = render.comparativa(prev_st, st, next_st, next_state) + render.insights(day, zone, pts, st, comparison)

    month = day[:7]
    mjson = site.calendar.get(month, {"days": {}})
    panel_cal = render.calendar_card(month, mjson["days"], zone.series, day, site.max_day, site.months, zone,
                                     pts or None)
    gday = cal.add_days(site.today, -1)
    panel_gen = render.generacion_card(site.gen.get(gday), copy.short_date(gday))

    lead = fill(spec["lead"], ctx, key)
    seo = [f'<h1>{render.esc(ctx["h1"])}</h1>', f'<p class="lead">{render.esc(lead)}</p>']
    if key not in ("app", "faq", "404", "que_es_el_pvpc", "a_que_hora_sale"):
        seo.append(f'<p class="footnote sec">Última actualización: <time datetime="{render.esc(site.updated_at)}">{render.esc(ctx["actualizado"])}</time>'
                   f' (hora peninsular) · Fuente: Red Eléctrica (ESIOS, PVPC 2.0TD)</p>')
    if key in ("home", "manana", "canarias", "baleares", "ceuta_melilla", "hora_mas_barata"):
        seo.append(render.cheapest_table(pts, bands, zone, day, f"Las cinco horas más baratas ({copy.short_date(day)})"))
        if key == "hora_mas_barata" and site.points(nxt, zone.series):
            seo.append(render.cheapest_table(site.points(nxt, zone.series), site.extras(nxt)["bands"].get(zone.series, ""),
                                             zone, nxt, f"Las cinco horas más baratas de mañana ({copy.short_date(nxt)})"))
    for s in spec.get("sections", []):
        seo.append(fill(site.sections[s], ctx, f"sections/{s}"))

    ld = [site.jsonld["organization"], site.jsonld["website"]]
    if key in ("home", "manana", "canarias", "baleares", "ceuta_melilla", "hora_mas_barata", "calendario", "generacion"):
        ld.append(site.jsonld["webpage_dataset"])
    elif key == "app":
        ld.append(site.jsonld["software_application"])
    elif key == "faq":
        ld.append(site.jsonld["faq_page"])
    elif key in ("que_es_el_pvpc", "cuando_poner_la_lavadora", "a_que_hora_sale"):
        ld.append(site.jsonld["article"])
    jsonld = fill(json.dumps(ld, ensure_ascii=False), {k: json.dumps(v, ensure_ascii=False)[1:-1] for k, v in ctx.items()}, "jsonld")

    boot = {
        "today": site.today, "tomorrow": site.tomorrow, "selected": day, "zone": zone.id, "tab": tab,
        "index": {"first": site.index["first"], "latest": site.index["latest"], "updatedAt": site.updated_at},
        "days": {d: site.day_file(d) for d in (cal.add_days(day, -1), day, nxt) if site.day_file(d)},
        "calendar": mjson, "months": site.months, "generation": site.gen.get(gday),
    }
    slots = {
        "title": render.esc(ctx["title"]), "description": render.esc(ctx["description"]),
        "canonical": BASE + spec["url"], "og_image": ctx["og_image_url"], "jsonld": jsonld, "active_tab": tab,
        "header": header, "panel_dia": panel_dia, "panel_generacion": panel_gen, "panel_resumen": panel_resumen,
        "panel_calendario": panel_cal, "seo_sections": "\n".join(seo),
        "boot_json": json.dumps(boot, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"),
    }
    visible = {"dia", "resumen"} if tab == "dia" else {tab}
    for t in TABS:
        slots[f"sel_{t}"] = "page" if t == tab else "false"
        slots[f"tabi_{t}"] = "0" if t == tab else "-1"
        slots[f"hid_{t}"] = "" if t in visible else "hidden"
    html = site.shell
    for k, v in slots.items():
        html = html.replace("{{" + k + "}}", v)
    if key == "404":
        html = html.replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"')
    left = re.findall(r"\{\{[a-z_]+\}\}", html)
    if left:
        raise KeyError(f"{key}: slots sin rellenar {sorted(set(left))}")
    return spec["url"], html


# MARK: Salidas auxiliares

def data_aliases(site: Site) -> dict[str, dict]:
    out = {}
    for name, day in (("hoy", site.today), ("manana", site.tomorrow)):
        if day not in site.rows:
            continue
        out[f"{name}.json"] = alias(site, day, PENINSULA)
    for z in ZONES:
        if z.id == "melilla":
            continue
        slug = z.path.strip("/") or "peninsula"
        if site.today in site.rows:
            out[f"{slug}.json"] = alias(site, site.today, z)
    return out


def alias(site: Site, day: str, zone) -> dict:
    pts = site.points(day, zone.series)
    return {"source": "Red Eléctrica de España — ESIOS, PVPC 2.0TD (archivo 70)", "updated_at": site.updated_at,
            "zone": zone.name, "series": zone.series, "unit": "€/kWh", "day": day, "timezone": zone.tz_name,
            "hours": [{"start": engine.hour_label(p.start, zone), "end": engine.hour_label(p.end, zone),
                       "eur_kwh": round(p.eur_kwh, 5)} for p in pts]}


def sitemap(site: Site, urls: list[str]) -> str:
    dynamic = {"/", "/manana/", "/generacion/", "/resumen/", "/calendario/", "/canarias/", "/baleares/",
               "/ceuta-melilla/", "/hora-mas-barata/", "/cuando-poner-la-lavadora/"}
    items = []
    for u in urls:
        if u == "/404.html":
            continue
        lastmod = site.today if u in dynamic else EVERGREEN_DATE
        freq = "daily" if u in dynamic else "monthly"
        items.append(f"  <url><loc>{BASE}{u}</loc><lastmod>{lastmod}</lastmod><changefreq>{freq}</changefreq></url>")
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(items) + "\n</urlset>\n"


def build(today: str) -> dict[str, str]:
    """Devuelve {ruta relativa a docs: contenido}."""
    site = Site(today)
    out: dict[str, str] = {}
    urls = []
    for key, tab, zone_id, offset in PAGES:
        url, html = page_html(site, key, tab, zone_id, offset)
        urls.append(url)
        path = "404.html" if url == "/404.html" else (url.strip("/") + "/index.html" if url != "/" else "index.html")
        out[path] = html
    for m, obj in site.calendar.items():
        out[f"data/calendar/{m}.json"] = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
    for name, obj in data_aliases(site).items():
        out[f"data/{name}"] = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), indent=None) + "\n"
    for day in site.rows:                      # stats + bands dentro de cada día (para el JS y la paridad)
        out[f"data/pvpc/{day}.json"] = json.dumps(site.day_file(day), ensure_ascii=False, separators=(",", ":")) + "\n"
    out["sitemap.xml"] = sitemap(site, urls)
    out["data/build.json"] = json.dumps({"today": today, "updatedAt": site.updated_at}, ensure_ascii=False) + "\n"
    return out


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--today", help="día de datos (por defecto, hoy en Madrid)")
    p.add_argument("--check", action="store_true", help="no escribe: compara con lo que hay en docs/")
    a = p.parse_args(argv)
    if a.check and not a.today:
        try:
            a.today = json.loads((DATA / "build.json").read_text())["today"]
        except (OSError, ValueError, KeyError):
            pass
    today = a.today or dt.datetime.now(MADRID).date().isoformat()
    out = build(today)
    if a.check:
        bad = [k for k, v in out.items() if not (DOCS / k).exists() or (DOCS / k).read_text(encoding="utf-8") != v]
        print(f"check: {len(out)} ficheros, {len(bad)} distintos" + (f" → {bad[:5]}" if bad else ""))
        return 1 if bad else 0
    n = 0
    for rel, content in out.items():
        path = DOCS / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            path.write_text(content, encoding="utf-8")
            n += 1
    print(f"build {today}: {len(out)} ficheros, {n} escritos")
    return 0


if __name__ == "__main__":
    sys.exit(main())

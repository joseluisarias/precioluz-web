"""Fragmentos HTML del sitio. Solo strings: el mismo markup que renderiza el JS
(dia.js, resumen.js, calendario.js, generacion.js), para que la hidratación
sea un re-render y no un cambio de estructura."""
from __future__ import annotations

import math
from html import escape as _e

from precioluz import copy, engine
from precioluz.zones import Zone

ICON = '<svg class="ic" aria-hidden="true"><use href="/assets/img/icons.svg#i-{name}"/></svg>'
STORE = "https://apps.apple.com/es/app/id6758021483"
BAND_WORD = {"g": "barata", "o": "precio medio", "r": "cara"}
BAND_NAME = {"g": "Verde", "o": "Naranja", "r": "Rojo"}


def icon(name: str) -> str:
    return ICON.format(name=name)


def esc(s) -> str:
    return _e(str(s), quote=True)


# MARK: Cabecera

def header_card(day: str, zone: Zone, first_day: str, max_day: str, tomorrow_enabled: bool) -> str:
    prev_day = copy_add(day, -1)
    next_day = copy_add(day, 1)
    next_attrs = "" if tomorrow_enabled else ' aria-disabled="true"'
    next_label = "Día siguiente" if tomorrow_enabled else "Día siguiente (mañana se publica a las 20:20)"
    return f'''<header class="card hdr">
  <div class="row top">
    <div class="stack">
      <p class="title">Precio de la Luz.</p>
      <p class="subheadline sec" id="zone-subtitle">{esc(zone.subtitle)}</p>
    </div>
    <div class="stack end">
      <span class="badge g" role="status" id="status-badge"><i class="dot"></i>Actualizado</span>
      <label class="zonesel"><span class="sr-only">Sistema eléctrico</span><select id="zone-select" aria-label="Sistema eléctrico">{zone_options(zone)}</select></label>
    </div>
  </div>
  <div class="datesel">
    <a class="btn-ic" id="day-prev" href="?d={prev_day}" aria-label="Día anterior">{icon("chevron-left")}</a>
    <label class="date"><span class="sr-only">Selecciona fecha</span><input type="date" id="day-input" value="{day}" min="{first_day}" max="{max_day}" lang="es"></label>
    <a class="btn-ic" id="day-next" href="?d={next_day}"{next_attrs} aria-label="{next_label}">{icon("chevron-right")}</a>
  </div>
</header>'''


def zone_options(current: Zone) -> str:
    from precioluz.zones import ALL
    return "".join(f'<option value="{z.id}"{" selected" if z.id == current.id else ""}>{esc(z.name)}</option>' for z in ALL)


def copy_add(day: str, n: int) -> str:
    from precioluz.calendar import add_days
    return add_days(day, n)


# MARK: Día

def bars(points: list[engine.HourPoint], bands: str, zone: Zone, day_label: str) -> str:
    if not points:
        return ('<section class="card chart"><p class="empty">' + icon("calendar") +
                'Sin datos para esta fecha</p></section>')
    vmax = max(p.eur_kwh for p in points)
    best = engine.minimum(points)
    rows = []
    for k, p in enumerate(points):
        band = bands[k] if k < len(bands) else "o"
        classes = f"bar {band}" + (" best" if best is not None and p.index == best.index else "")
        h0, h1 = engine.hour_label(p.start, zone), engine.hour_label(p.end, zone)
        price = copy.fmt_eur(p.eur_kwh)
        extra = ""
        if best is not None and p.index == best.index:
            extra = f'<span class="leaf" title="Hora más barata">{icon("leaf")}<span class="sr-only">Hora más barata</span></span>'
        rows.append(
            f'<li class="{classes}" data-i="{p.index}" style="--v:{p.eur_kwh:.4f};--d:{k * 0.022:.3f}s" '
            f'aria-label="De {h0} a {h1}, {price}, {BAND_WORD[band]}">'
            f'<span class="h">{h0}</span><span class="track"><i class="fill"></i>'
            f'<span class="p">{price}{extra}</span></span></li>')
    return (f'<section class="card chart" aria-label="Precio de la luz por horas, {esc(day_label)}">'
            f'<ol class="bars" id="bars" style="--max:{vmax:.4f}">' + "".join(rows) + "</ol></section>")


def cta_card(ct: str = "web-hero") -> str:
    return f'''<section class="card cta">
  <h2 class="lbl headline hd">{icon("bolt")}Que el precio te avise a ti, no al revés</h2>
  <ul>
    <li>{icon("checkmark")}<span>Un aviso antes de la hora más barata del día, y solo cuando de verdad merece la pena.</span></li>
    <li>{icon("checkmark")}<span>Los precios de mañana en tu iPhone a las 20:20, sin entrar en ninguna web.</span></li>
    <li>{icon("checkmark")}<span>Widgets, pantalla de bloqueo y Siri: pregúntale cuándo poner la lavadora.</span></li>
  </ul>
  <a class="btn btn-store" href="{STORE}?ct={ct}" rel="noopener">{icon("apple")}Descargar gratis en el App Store</a>
  <p class="caption sec">Precio Luz España PVPC. Gratis, sin anuncios, sin registro. Requiere iOS 26.</p>
</section>'''


# MARK: Resumen

def _comp_col(title: str, ic: str, st: dict | None, state: str, cls: str) -> str:
    head = f'<div class="t">{icon(ic)}{esc(title)}</div>'
    if st:
        body = (f'<div class="v">{copy.fmt_number(st["avg"])}</div><div class="s">€/kWh media</div>'
                f'<div class="s">{copy.fmt_number(st["min"])}–{copy.fmt_number(st["max"])}</div>')
    elif state == "future":
        body = '<div class="v">—</div><div class="s">Disponible<br>a las 20:20</div>'
        cls += " future"
    else:
        body = '<div class="v">—</div><div class="s">Sin datos</div>'
        cls += " future"
    return f'<div class="{cls.strip()}">{head}{body}</div>'


def comparativa(st_prev: dict | None, st_day: dict | None, st_next: dict | None, next_state: str) -> str:
    return (f'<section class="card" id="comparativa"><h2 class="lbl headline">{icon("timeline")}Comparativa</h2>'
            f'<div class="comp">{_comp_col("Ayer", "clock-arrow", st_prev, "none", "")}'
            f'{_comp_col("Hoy", "sun", st_day, "none", "today")}'
            f'{_comp_col("Mañana", "arrow-circle", st_next, next_state, "")}</div></section>')


def tile(cls: str, ic: str, title: str, value: str, sub: str, dimmed: bool = False) -> str:
    d = " dim" if dimmed else ""
    return (f'<div class="tile {cls}{d}"><div class="t">{icon(ic)}{esc(title)}</div>'
            f'<div class="v">{esc(value)}</div><div class="s">{esc(sub)}</div></div>')


def insights(day: str, zone: Zone, points: list[engine.HourPoint], st: dict | None,
             comparison: str | None) -> str:
    badge = copy.day_badge(day)
    if not points or st is None:
        tiles = "".join(tile(c, i, t, "—", "Sin datos", True) for c, i, t in
                        (("g", "clock-check", "Hora más barata"), ("r", "warning", "Hora más cara"),
                         ("t", "clock-arrow", "Próxima oportunidad"), ("o", "arrows-lr", "Rango del día")))
        advice = ""
    else:
        best, worst = engine.minimum(points), engine.maximum(points)
        bl, wl = engine.hour_label(best.start, zone), engine.hour_label(worst.start, zone)
        tiles = (tile("g", "clock-check", "Hora más barata", copy.fmt_eur(best.eur_kwh, 3).replace(" €/kWh", " €"), bl)
                 + tile("r", "warning", "Hora más cara", copy.fmt_eur(worst.eur_kwh).replace(" €/kWh", " €"), wl)
                 + f'<div class="tile t" id="tile-next"><div class="t">{icon("clock-arrow")}Próxima oportunidad</div>'
                   f'<div class="v">{copy.fmt_number(best.eur_kwh)} €</div><div class="s">{bl}</div></div>'
                 + tile("o", "arrows-lr", "Rango del día", f'{copy.fmt_number(st["max"] - st["min"])} €', "máx - mín"))
        dl, sl = copy.day_level(st["avg"]), copy.spread_level(st["max"] - st["min"])
        c = copy.consejo(dl, sl, bl)
        advice = f'''<div class="advice">
  <div class="row"><span class="lbl caption semi sec">{icon("bolt")}Consejo del día</span><span class="badge xs">{esc(copy.level_badge(dl, sl))}</span></div>
  <div class="callout">{icon("quote")}<div class="stack"><div class="t">{esc(c["title"])}</div><div class="x">{esc(c["summary"])}</div></div></div>
  <div class="callout">{icon("checkmark")}<div class="stack"><div class="t">Acción</div><div class="x">{esc(c["action"])} Mejor hora: {bl}. Peor hora: {wl}.</div></div></div>
</div>'''
    comp = (f'<div class="callout" id="comparison">{icon("trend")}<div class="stack"><div class="t">Comparativa</div>'
            f'<div class="x">{esc(comparison)}</div></div></div>') if comparison else ""
    return (f'<section class="card" id="insights"><div class="row"><h2 class="lbl headline">{icon("sparkles")}Resumen del día</h2>'
            f'<span class="badge">{esc(badge)}</span></div><div class="tiles">{tiles}</div>{comp}{advice}<hr class="sep"></section>')


# MARK: Calendario

def calendar_card(month: str, month_days_json: dict, series: str, selected: str, max_day: str,
                  months: list[str], zone: Zone, sel_points: list[engine.HourPoint] | None) -> str:
    from precioluz.calendar import month_days, parse_day
    days = month_days(month)
    first = parse_day(days[0])
    lead_blanks = first.weekday()
    idx = months.index(month) if month in months else len(months) - 1
    prev_m = months[idx - 1] if idx > 0 else None
    next_m = months[idx + 1] if idx + 1 < len(months) else None
    title = copy.month_title(month)
    nav = (f'<div class="cal-nav">'
           f'<a class="btn-sq" href="?m={prev_m or ""}" aria-label="Mes anterior"{"" if prev_m else " aria-disabled=\"true\""}>{icon("chevron-left")}</a>'
           f'<button type="button" class="cal-month" id="cal-month" aria-haspopup="listbox" aria-expanded="false">{esc(title)}{icon("chevron-down")}</button>'
           f'<a class="btn-sq" href="?m={next_m or ""}" aria-label="Mes siguiente"{"" if next_m else " aria-disabled=\"true\""}>{icon("chevron-right")}</a></div>')
    cells = ['<li aria-hidden="true"></li>'] * lead_blanks
    for k, d in enumerate(days):
        entry = (month_days_json.get(d) or {}).get(series)
        dnum = int(d[-2:])
        delay = f"--d:{k * 0.03:.2f}s"
        if entry:
            col = entry.get("color") or ""
            sel = " sel" if d == selected else ""
            pressed = ' aria-pressed="true"' if d == selected else ""
            valle = copy.fmt_number(entry["valle"], 2) + "€" if entry.get("valle") is not None else "—"
            cresta = copy.fmt_number(entry["cresta"], 2) + "€" if entry.get("cresta") is not None else "—"
            cells.append(
                f'<li><button type="button" class="cell {col}{sel}" data-day="{d}" style="{delay}"{pressed} '
                f'aria-description="{dnum} de {copy.MONTHS[int(month[5:]) - 1]}, media {copy.fmt_number(entry["avg"])} €/kWh">'
                f'<span class="d">{dnum}</span><span class="a">{copy.fmt_number(entry["avg"], 2)}€</span>'
                f'<span class="m">{icon("clock-check")}{valle}</span><span class="m">{icon("bolt")}{cresta}</span></button></li>')
        else:
            future = d > max_day
            cells.append(f'<li><button type="button" class="cell empty{" future" if future else ""}" data-day="{d}" style="{delay}" disabled '
                         f'aria-description="{dnum} de {copy.MONTHS[int(month[5:]) - 1]}, sin datos"><span class="d">{dnum}</span>—</button></li>')
    detail = _calendar_detail(selected, zone, sel_points)
    return (f'<section class="card" id="calendar"><h2 class="lbl headline">{icon("calendar")}Calendario</h2>{nav}'
            f'<div class="cal-wd" aria-hidden="true"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>'
            f'<ol class="cal" id="cal-grid" aria-label="Días de {esc(copy.MONTHS[int(month[5:]) - 1])} de {month[:4]}">{"".join(cells)}</ol>'
            f'<hr class="sep">{detail}</section>')


def _calendar_detail(day: str, zone: Zone, points: list[engine.HourPoint] | None) -> str:
    head = (f'<div class="row top"><div class="stack"><span class="caption semi sec">Día seleccionado</span>'
            f'<span class="subheadline semi" id="cal-sel-date">{esc(copy.long_date(day))}</span></div>')
    if not points:
        return (head + '</div><p class="footnote sec">Aún no hay datos para este día. Prueba a cambiar de fecha o vuelve a cargar.</p>'
                '<p class="caption sec">' + icon("mappin") + 'Toca otro día para comparar rápidamente.</p>')
    st = engine.stats(points)
    best, worst = engine.minimum(points), engine.maximum(points)
    from precioluz.calendar import valle_avg, cresta_avg
    v, c = valle_avg(points), cresta_avg(points)
    kv = "".join(f'<div class="kv"><span>{k}</span><span>{val}</span></div>' for k, val in (
        ("Media:", copy.fmt_eur(st["avg"])),
        ("Mínimo:", f'{copy.fmt_eur(st["min"])} · {engine.hour_label(best.start, zone)}'),
        ("Máximo:", f'{copy.fmt_eur(st["max"])} · {engine.hour_label(worst.start, zone)}'),
        ("Valle (00:00–08:00):", copy.fmt_eur(v, 2) if v is not None else "—"),
        ("Cresta (10–14 y 18–22):", copy.fmt_eur(c, 2) if c is not None else "—"),
    ))
    return (head + f'<span class="badge xs">{copy.day_level(st["avg"]).upper()}</span></div>'
            f'<div class="stack" id="cal-sel-detail" style="gap:6px">{kv}</div>'
            f'<p class="caption sec">{icon("mappin")}Toca otro día para comparar rápidamente.</p>')


# MARK: Generación

def _arc(cx: float, cy: float, r_out: float, r_in: float, a0: float, a1: float) -> str:
    """Sector anular entre ángulos a0→a1 (radianes, 0 = las 12, sentido horario)."""
    def pt(r, a):
        return cx + r * math.sin(a), cy - r * math.cos(a)
    x0, y0 = pt(r_out, a0); x1, y1 = pt(r_out, a1)
    xi1, yi1 = pt(r_in, a1); xi0, yi0 = pt(r_in, a0)
    large = 1 if (a1 - a0) > math.pi else 0
    return (f"M{x0:.2f} {y0:.2f} A{r_out:.2f} {r_out:.2f} 0 {large} 1 {x1:.2f} {y1:.2f} "
            f"L{xi1:.2f} {yi1:.2f} A{r_in:.2f} {r_in:.2f} 0 {large} 0 {xi0:.2f} {yi0:.2f} Z")


def donut_svg(entries: list[dict]) -> str:
    cx = cy = 140.0
    r_out, r_in = 138.0, 138.0 * 0.618
    total = sum(e["v"] for e in entries) or 1.0
    paths, a = [], 0.0
    for e in entries:
        frac = e["v"] / total
        a1 = a + frac * 2 * math.pi
        if frac >= 0.9999:
            d = _arc(cx, cy, r_out, r_in, 0, math.pi) + " " + _arc(cx, cy, r_out, r_in, math.pi, 2 * math.pi - 1e-6)
        else:
            d = _arc(cx, cy, r_out, r_in, a, a1)
        paths.append(f'<path d="{d}" fill="{esc(e.get("color", "#8E8E93"))}" data-t="{esc(e["t"])}"><title>{esc(e["t"])}: {copy.fmt_pct(e["pct"])}</title></path>')
        a = a1
    return ('<svg class="donut-svg" viewBox="0 0 280 280" role="img" aria-label="Mix de generación">'
            + "".join(paths) + "</svg>")


def generacion_card(gen: dict | None, day_label: str) -> str:
    seg = ('<div class="segmented" role="group" aria-label="Modo">'
           '<button type="button" data-mode="now" aria-pressed="false">Hoy (hasta ahora)</button>'
           '<button type="button" data-mode="day" aria-pressed="true">Ayer</button></div>')
    if not gen or not gen.get("entries"):
        return (f'<section class="card" id="generacion">{seg}<div class="row"><h2 class="lbl headline" id="gen-title">{icon("bolt")}Generación</h2>'
                f'<span class="badge" id="gen-badge">Sin datos</span></div>'
                '<div class="skel" aria-busy="true" aria-label="Cargando generación"><div class="skel-donut"></div>'
                '<div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div></div></section>')
    entries = gen["entries"]
    total_txt = fmt_energy(gen["total"])
    dom = entries[0]
    rows = "".join(
        f'<li><button type="button" data-t="{esc(e["t"])}" style="--sw:{esc(e["color"])}" aria-pressed="false">'
        f'<span class="n">{esc(e["t"])}</span><span class="v">{fmt_energy(e["v"])}</span>'
        f'<span class="pc">{copy.fmt_pct(e["pct"])}</span></button></li>' for e in entries)
    return f'''<section class="card" id="generacion">
  {seg}
  <div class="row"><h2 class="lbl headline" id="gen-title">{icon("bolt")}Generación de ayer · {esc(day_label)}</h2><span class="badge" id="gen-badge">{esc(gen["day"][8:10])}/{esc(gen["day"][5:7])}</span></div>
  <div class="donut" id="gen-donut">{donut_svg(entries)}<div class="center"><span class="t">Total</span><span class="v">{total_txt}</span><span class="s">{copy.fmt_pct(gen["renewablePct"])} renovable</span></div></div>
  <div class="kpis">
    <div class="kpi">{icon("bolt")}<span class="stack"><span class="t">Total</span><span class="v">{total_txt}</span></span></div>
    <div class="kpi" style="--tint:var(--green)">{icon("leaf")}<span class="stack"><span class="t">Renovable</span><span class="v">{copy.fmt_pct(gen["renewablePct"])}</span></span></div>
    <div class="kpi" style="--tint:{esc(dom["color"])}">{icon("star")}<span class="stack"><span class="t">Dominante</span><span class="v">{esc(dom["t"])}</span></span></div>
  </div>
  <hr class="sep">
  <ul class="tech" id="gen-list">{rows}</ul>
  <div class="row end"><button type="button" class="btn sm" id="gen-refresh">{icon("refresh")}Actualizar</button></div>
</section>'''


def fmt_energy(mwh: float) -> str:
    """"789,0 GWh" / "955 MWh" (formatMW de la app, con coma)."""
    return (f"{mwh / 1000:.1f} GWh" if mwh >= 1000 else f"{mwh:.0f} MWh").replace(".", ",")


# MARK: SEO

PERIOD_PEN = {h: ("valle" if h < 8 else "punta" if 10 <= h < 14 or 18 <= h < 22 else "llano") for h in range(24)}


def cheapest_table(points: list[engine.HourPoint], bands: str, zone: Zone, day: str, title: str, n: int = 5) -> str:
    if not points:
        return ""
    weekend = copy.is_weekend(day)
    order = sorted(points, key=lambda p: (p.eur_kwh, p.index))[:n]
    rows = []
    for p in order:
        k = points.index(p)
        band = bands[k] if k < len(bands) else "o"
        h_pen = p.start.astimezone(engine.DATA_TZ).hour
        period = "valle" if weekend else PERIOD_PEN[h_pen]
        rows.append(f'<tr><td>{engine.hour_label(p.start, zone)}–{engine.hour_label(p.end, zone)}</td>'
                    f'<td class="n">{copy.fmt_number(p.eur_kwh)}</td><td>{period.capitalize()}</td>'
                    f'<td><span class="sw {band}"></span>{BAND_NAME[band]}</td></tr>')
    return (f'<h2>{esc(title)}</h2><table class="table"><thead><tr><th>Hora</th><th class="n">€/kWh</th><th>Tramo</th><th>Color</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table>')

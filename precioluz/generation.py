"""Parser del mix de generación de apidatos.ree.es (estructura-generacion).

Mismas reglas que la app (ContentView.downloadGenerationData): se toma el
último valor de cada tecnología, se descarta "Generación total" y cualquier
valor |v| ≤ 0,1, el porcentaje se recalcula sobre el total y las entradas van
en orden descendente. El set de renovables es el de la app.
"""
from __future__ import annotations

import json

RENEWABLE = {
    "Eólica", "Hidráulica", "Solar fotovoltaica", "Solar térmica", "Biomasa",
    "Otras renovables", "Residuos renovables", "Térmica renovable",
}

# Paleta de la app (ContentView.generationColor). apidatos trae su propio color;
# se guarda como respaldo para tecnologías que la app no conoce.
APP_COLORS = {
    "Eólica": "#7CC33F", "Nuclear": "#7B2D8E", "Hidráulica": "#3498DB",
    "Solar fotovoltaica": "#F5B700", "Solar térmica": "#FFD700", "Ciclo combinado": "#E67E22",
    "Cogeneración": "#9B59B6", "Cogeneración y residuos": "#9B59B6", "Carbón": "#2C3E50",
    "Residuos no renovables": "#E74C3C", "Biomasa": "#27AE60", "Turbinación bombeo": "#1ABC9C",
    "Otras renovables": "#2ECC71", "Residuos renovables": "#66BB6A", "Generación auxiliar": "#78909C",
    "Motores diésel": "#455A64", "Motor diésel": "#455A64", "Turbina de gas": "#FF7043",
    "Turbina de vapor": "#AB47BC", "Térmica renovable": "#2ECC71",
}


class NoData(ValueError):
    """La respuesta no trae tecnologías con valor."""


def parse(payload) -> dict:
    """Devuelve {"total", "renewablePct", "datetime", "entries":[{t,v,pct,color}]} (MWh)."""
    obj = payload if isinstance(payload, dict) else json.loads(payload)
    entries, latest = [], ""
    for inc in obj.get("included", []):
        attrs = inc.get("attributes", {})
        title = attrs.get("title", "")
        values = attrs.get("values") or []
        if not values or title == "Generación total":
            continue
        last = values[-1]
        v = float(last.get("value", 0) or 0)
        if abs(v) <= 0.1:
            continue
        latest = max(latest, str(last.get("datetime", "")))
        entries.append({"t": title, "v": round(v, 2),
                        "color": APP_COLORS.get(title) or attrs.get("color") or "#8E8E93"})
    if not entries:
        raise NoData("sin tecnologías con valor")
    total = sum(e["v"] for e in entries)
    for e in entries:
        e["pct"] = round(e["v"] / total * 100, 2)
    entries.sort(key=lambda e: e["v"], reverse=True)
    renewable = sum(e["v"] for e in entries if e["t"] in RENEWABLE)
    return {"total": round(total, 2), "renewablePct": round(renewable / total * 100, 2),
            "datetime": latest, "entries": entries}


def dominant(parsed: dict) -> str:
    return parsed["entries"][0]["t"] if parsed["entries"] else ""

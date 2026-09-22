from pathlib import Path

import pytest

from precioluz import generation

FIX = Path(__file__).resolve().parents[1] / "fixtures" / "apidatos"


def test_parses_real_day():
    g = generation.parse((FIX / "day-2026-09-21.json").read_bytes())
    names = [e["t"] for e in g["entries"]]
    assert "Generación total" not in names
    assert names[0] == "Solar fotovoltaica"                  # dominante ese día
    assert g["entries"] == sorted(g["entries"], key=lambda e: e["v"], reverse=True)
    assert abs(sum(e["pct"] for e in g["entries"]) - 100) < 0.5
    assert 0 < g["renewablePct"] < 100
    assert g["entries"][0]["color"] == "#F5B700"              # paleta de la app
    assert generation.dominant(g) == "Solar fotovoltaica"


def test_skips_tiny_and_total_and_recomputes_pct():
    payload = {"included": [
        {"attributes": {"title": "Generación total", "values": [{"value": 1000, "percentage": 1}]}},
        {"attributes": {"title": "Eólica", "values": [{"value": 600, "percentage": 0.6, "datetime": "2026-09-21T00:00:00.000+02:00"}]}},
        {"attributes": {"title": "Nuclear", "values": [{"value": 400, "percentage": 0.4, "datetime": "2026-09-21T00:00:00.000+02:00"}]}},
        {"attributes": {"title": "Carbón", "values": [{"value": 0.05, "percentage": 0}]}},
        {"attributes": {"title": "Vacía", "values": []}},
    ]}
    g = generation.parse(payload)
    assert [e["t"] for e in g["entries"]] == ["Eólica", "Nuclear"]
    assert g["total"] == 1000 and g["entries"][0]["pct"] == 60.0
    assert g["renewablePct"] == 60.0


def test_no_data_raises():
    with pytest.raises(generation.NoData):
        generation.parse({"included": []})

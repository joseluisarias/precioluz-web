import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build  # noqa: E402


def test_build_is_deterministic_and_complete():
    today = json.loads((ROOT / "docs" / "data" / "build.json").read_text())["today"]
    a = build.build(today)
    b = build.build(today)
    assert a == b
    assert "index.html" in a and "manana/index.html" in a and "sitemap.xml" in a
    home = a["index.html"]
    for panel in ("panel-dia", "panel-generacion", "panel-resumen", "panel-calendario"):
        assert f'id="{panel}"' in home
    assert 'id="bars"' in home and home.count('<li class="bar') >= 23
    assert "{{" not in home and "{fecha" not in home        # ningún slot ni placeholder sin rellenar
    assert "€/kWh" in home and "<h1>" in home
    assert 'application/ld+json' in home


def test_404_is_noindex_and_pages_have_canonical():
    today = json.loads((ROOT / "docs" / "data" / "build.json").read_text())["today"]
    out = build.build(today)
    assert 'name="robots" content="noindex"' in out["404.html"]
    assert 'rel="canonical" href="https://precioluz.natural-apps.com/canarias/"' in out["canarias/index.html"]
    assert "hora local" in out["canarias/index.html"]

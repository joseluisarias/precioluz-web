"""El código de salida de fetch.py con --require-tomorrow, que es lo que gobierna
los reintentos del cron: 2 = REE todavía no ha publicado mañana, 0 = ya está."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import fetch  # noqa: E402

FIXTURES = ROOT / "tests" / "fixtures" / "archive70"
PUBLICADO = (FIXTURES / "2026-09-20.json").read_bytes()
SIN_PUBLICAR = (FIXTURES / "not-published.json").read_bytes()


@pytest.fixture
def datos(tmp_path):
    return tmp_path / "data"


def _run(monkeypatch, datos, publicados: set[str], args: list[str]) -> int:
    """Ejecuta fetch.main con una red simulada: solo responden los días de
    `publicados`; el resto devuelve el cuerpo de "no publicado"."""
    monkeypatch.setattr(
        fetch, "download", lambda day, **kw: PUBLICADO if day in publicados else SIN_PUBLICAR
    )
    monkeypatch.setattr(fetch, "save_generation", lambda *a, **kw: 0)
    return fetch.main(["--data", str(datos), "--skip-generation", *args])


def _dias(datos):
    return sorted(p.stem for p in (datos / "pvpc").glob("????-??-??.json"))


def test_codigo_2_cuando_manana_no_esta(monkeypatch, datos):
    hoy = dt.date.today().isoformat()
    assert _run(monkeypatch, datos, {hoy}, ["--days", "1", "--require-tomorrow"]) == 2


def test_codigo_0_cuando_manana_ya_esta(monkeypatch, datos):
    hoy = dt.date.today()
    dias = {hoy.isoformat(), (hoy + dt.timedelta(days=1)).isoformat()}
    assert _run(monkeypatch, datos, dias, ["--days", "1", "--require-tomorrow"]) == 0


def test_sin_el_flag_nunca_falla(monkeypatch, datos):
    hoy = dt.date.today().isoformat()
    assert _run(monkeypatch, datos, {hoy}, ["--days", "1"]) == 0


def test_el_dia_de_hoy_se_guarda_aunque_falte_manana(monkeypatch, datos):
    """El código 2 solo pide reintentar: lo ya descargado no se pierde."""
    hoy = dt.date.today().isoformat()
    assert _run(monkeypatch, datos, {hoy}, ["--days", "1", "--require-tomorrow"]) == 2
    assert _dias(datos) == [hoy]
    guardado = json.loads((datos / "pvpc" / f"{hoy}.json").read_text())
    assert len(guardado["hours"]) == 24
    assert json.loads((datos / "pvpc" / "index.json").read_text())["latest"] == hoy

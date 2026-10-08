"""El archivo 70 tiene dos formas de decir "aún no hay dato": el mensaje de
"No values for specified archive" y, visto el 7-10-2026, las 24 filas completas
con todos los precios a "0,00". Una hora SUELTA a cero sí es un precio válido:
el PVPC español ha estado a cero y en negativo, y suele ser la hora más
interesante del día."""
from __future__ import annotations

import datetime as dt

import pytest

from precioluz import archive70


def payload(precios: list[str]) -> dict:
    return {"PVPC": [{"Dia": "08/10/2026", "Hora": f"{i:02d}-{i+1:02d}",
                      "PCB": p, "CYM": p} for i, p in enumerate(precios)]}


def test_dia_entero_a_cero_es_no_publicado():
    with pytest.raises(archive70.NotPublished):
        archive70.parse(payload(["0,00"] * 24))


def test_una_hora_a_cero_no_invalida_el_dia():
    precios = ["171,97"] * 24
    precios[14] = "0,00"
    horas = archive70.parse(payload(precios))
    assert len(horas) == 24
    assert horas[14].pcb == 0.0


def test_precios_negativos_son_validos():
    precios = ["0,00"] * 24
    precios[3] = "-4,10"
    horas = archive70.parse(payload(precios))
    assert len(horas) == 24
    assert min(h.pcb for h in horas) == -4.10


def test_el_mensaje_clasico_sigue_funcionando():
    with pytest.raises(archive70.NotPublished):
        archive70.parse({"message": "No values for specified archive"})


def test_caso_real_del_8_de_octubre():
    """El fichero que REE sirvió a las 20:15 y el corregido a la mañana."""
    with pytest.raises(archive70.NotPublished):
        archive70.parse(payload(["0,00"] * 24))

    precios = ["0,00"] * 24
    precios[14] = "47,94"
    precios[20] = "342,48"
    horas = archive70.parse(payload(precios))
    assert len(horas) == 24
    assert max(h.pcb for h in horas) == 342.48


def test_un_dia_a_ceros_ni_se_guarda_ni_cuenta_como_publicado(tmp_path, monkeypatch):
    """El cortafuegos de verdad, de punta a punta por fetch.py: el día a ceros
    no deja fichero, queda como pendiente y hace que --require-tomorrow pida
    reintentar (código 2), que es lo que mantiene vivo el bucle del cron."""
    import json
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
    import fetch  # noqa: PLC0415

    hoy = dt.date.today().isoformat()
    manana = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    bueno = json.dumps(payload(["171,97"] * 24)).encode()
    ceros = json.dumps(payload(["0,00"] * 24)).encode()

    monkeypatch.setattr(fetch, "download",
                        lambda day, **kw: bueno if day == hoy else ceros)
    monkeypatch.setattr(fetch, "save_generation", lambda *a, **kw: 0)

    datos = tmp_path / "data"
    codigo = fetch.main(["--data", str(datos), "--skip-generation",
                         "--days", "1", "--require-tomorrow"])

    assert codigo == 2, "debe pedir reintento mientras REE sirva ceros"
    guardados = sorted(p.stem for p in (datos / "pvpc").glob("????-??-??.json"))
    assert guardados == [hoy], "el día a ceros no debe dejar fichero"
    assert json.loads((datos / "pvpc" / "index.json").read_text())["latest"] == hoy
    assert manana not in guardados

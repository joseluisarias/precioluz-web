import json
from pathlib import Path

import pytest

from precioluz import archive70

FIX = Path(__file__).resolve().parents[1] / "fixtures" / "archive70"


def load(name):
    return (FIX / f"{name}.json").read_bytes()


def test_weekday_has_24_rows_and_cym_differs_at_period_boundaries():
    hours = archive70.parse(load("2026-09-16"))          # miércoles
    assert len(hours) == 24
    diff = [h.i for h in hours if h.cym is not None and abs(h.cym - h.pcb) > 0.005]
    assert diff == [10, 14, 18, 22]                       # fronteras de periodo desplazadas en Ceuta/Melilla


def test_sunday_cym_equals_pcb():
    hours = archive70.parse(load("2026-09-20"))          # domingo: todo valle
    assert all(h.cym == h.pcb for h in hours)


def test_dst_days_keep_23_and_25_rows_with_indexes():
    spring = archive70.parse(load("2026-03-29"))
    autumn = archive70.parse(load("2025-10-26"))
    assert len(spring) == 23 and [h.i for h in spring] == list(range(23))
    assert len(autumn) == 25 and [h.i for h in autumn] == list(range(25))


def test_not_published_raises():
    with pytest.raises(archive70.NotPublished):
        archive70.parse(load("not-published"))


def test_comma_decimals_and_units():
    hours = archive70.parse(load("2026-09-20"))
    assert hours[0].pcb == pytest.approx(216.88)
    assert hours[0].pcb_kwh == pytest.approx(0.21688)


def test_label_normalization_and_unparseable_rows():
    payload = {"PVPC": [{"Hora": "9-10", "PCB": "abc", "CYM": "1,0"}] + [
        {"Hora": f"{k}-{k+1}", "PCB": f"{100+k},5"} for k in range(1, 24)]}
    hours = archive70.parse(payload)
    assert len(hours) == 23                               # la fila 0 (no parseable) se descarta…
    assert hours[0].i == 1 and hours[0].h == "01-02"      # …y los índices de las demás no se mueven
    assert hours[0].cym is None
    assert archive70.normalize_label("9-10") == "09-10"
    assert archive70.normalize_label("14–15") == "14-15"


def test_rows_roundtrip():
    hours = archive70.parse(load("2026-09-16"))
    rows = archive70.to_rows(hours)
    assert archive70.from_rows(json.loads(json.dumps(rows))) == hours


def test_too_few_rows_is_invalid():
    with pytest.raises(archive70.InvalidDay):
        archive70.parse({"PVPC": [{"Hora": "00-01", "PCB": "1,0"}] * 5})

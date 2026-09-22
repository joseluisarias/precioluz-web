import datetime as dt

from precioluz import zones


def test_five_zones_in_order_with_ids_codes_and_series():
    assert [z.id for z in zones.ALL] == ["peninsula", "canarias", "baleares", "ceuta", "melilla"]
    assert [z.code for z in zones.ALL] == ["PEN", "CAN", "BAL", "CEU", "MEL"]
    assert [z.name for z in zones.ALL] == ["Península", "Canarias", "Baleares", "Ceuta", "Melilla"]
    assert [z.series for z in zones.ALL] == ["pcb", "pcb", "pcb", "cym", "cym"]
    assert zones.SERIES == ("pcb", "cym")


def test_clocks_and_subtitles():
    assert zones.DATA_TZ.key == "Europe/Madrid"
    assert zones.PENINSULA.tz_name == "Europe/Madrid" and zones.PENINSULA.is_data_clock
    assert zones.CANARIAS.tz_name == "Atlantic/Canary" and not zones.CANARIAS.is_data_clock
    assert zones.BALEARES.tz_name == zones.CEUTA.tz_name == zones.MELILLA.tz_name == "Europe/Madrid"
    assert zones.CANARIAS.tz.key == "Atlantic/Canary"
    assert zones.PENINSULA.subtitle == "PVPC — datos oficiales"
    assert zones.CANARIAS.subtitle == "PVPC · Canarias (hora local)"
    assert zones.BALEARES.subtitle == "PVPC · Baleares"
    assert zones.CEUTA.subtitle == "PVPC · Ceuta"
    assert zones.MELILLA.subtitle == "PVPC · Melilla"


def test_lookup_and_detection():
    assert zones.by_id("canarias") is zones.CANARIAS
    assert zones.by_id("nope") is zones.PENINSULA
    assert zones.by_id(None) is zones.PENINSULA
    assert zones.by_id("", default=zones.CEUTA) is zones.CEUTA
    assert zones.detect("Atlantic/Canary") is zones.CANARIAS
    assert zones.detect("Europe/Madrid") is zones.PENINSULA
    assert zones.detect("America/New_York") is zones.PENINSULA
    assert zones.detect(None) is zones.PENINSULA


def test_publication_minutes_20_20_madrid_is_19_20_canarias():
    for day in (dt.date(2026, 7, 1), dt.date(2026, 1, 15), dt.date(2026, 3, 29), dt.date(2026, 10, 25)):
        assert zones.publication_local_minutes(zones.PENINSULA, day) == 20 * 60 + 20
        assert zones.publication_local_minutes(zones.CANARIAS, day) == 19 * 60 + 20
        assert zones.publication_local_minutes(zones.CEUTA, day) == 20 * 60 + 20
    # Sin referencia usa hoy; con datetime aware también funciona.
    assert zones.publication_local_minutes(zones.CANARIAS) == 19 * 60 + 20
    now = dt.datetime(2026, 9, 22, 12, 0, tzinfo=dt.timezone.utc)
    assert zones.publication_local_minutes(zones.CANARIAS, now) == 19 * 60 + 20

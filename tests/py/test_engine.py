"""Port de PrecioLuzTests/PriceEngineTests.swift al motor Python."""
import datetime as dt
from pathlib import Path

import pytest

from helpers import REPORTED_BUG_DAY, at, day_start, make_day, rows_from_values
from precioluz import archive70, engine
from precioluz.zones import CANARIAS, DATA_TZ

FIX = Path(__file__).resolve().parents[1] / "fixtures" / "archive70"


def madrid_hour(moment: dt.datetime) -> int:
    return moment.astimezone(DATA_TZ).hour


# MARK: Construcción y métricas

def test_normal_day_is_anchored():
    hours = make_day([0.10] * 24)
    assert len(hours) == 24
    assert madrid_hour(hours[0].start) == 0
    assert madrid_hour(hours[14].start) == 14
    assert hours[23].end == day_start("2026-08-12")
    assert [h.index for h in hours] == list(range(24))


def test_corrupt_price_is_dropped_and_never_wins_minimum():
    values: list = [0.10] * 24
    values[5] = None
    hours = make_day(values)
    assert len(hours) == 23
    assert not any(h.index == 5 for h in hours)
    assert engine.minimum(hours).eur_kwh == 0.10
    assert engine.average(hours) == pytest.approx(0.10, abs=1e-4)


def test_indices_survive_gaps():
    values: list = [0.10] * 24
    values[5] = None
    hours = make_day(values)
    six = next(h for h in hours if h.label == "06-07")
    assert six.index == 6
    assert madrid_hour(six.start) == 6


def test_partial_day_does_not_break():
    hours = make_day([0.10] * 10)
    assert len(hours) == 10
    assert engine.average(hours) == pytest.approx(0.10, abs=1e-4)


def test_unknown_series_is_rejected_and_missing_cym_is_skipped():
    with pytest.raises(ValueError):
        engine.build_day([], "2026-08-11", "xyz")
    rows = [archive70.Hour(i=0, h="00-01", pcb=100.0, cym=None),
            archive70.Hour(i=1, h="01-02", pcb=100.0, cym=50.0)]
    assert [p.index for p in engine.build_day(rows, "2026-08-11", "cym")] == [1]
    assert [p.index for p in engine.build_day(rows, "2026-08-11", "pcb")] == [0, 1]


def test_average_of_empty_is_zero_and_min_max_none():
    assert engine.average([]) == 0.0
    assert engine.minimum([]) is None
    assert engine.maximum([]) is None
    assert engine.stats([]) is None
    assert engine.bands([]) == ""


# MARK: Ventana con horquilla

def test_window_groups_contiguous_hours():
    values: list = [0.20] * 24
    values[14], values[15], values[16] = 0.050, 0.051, 0.052
    hours = make_day(values)
    w = engine.upcoming_cheap_window(hours, at(6), tolerance=0.01)
    assert w.hour_count == 3
    assert w.start == at(14)
    assert w.end == at(17)
    assert w.is_range


def test_window_does_not_group_non_contiguous():
    values: list = [0.20] * 24
    values[14], values[15], values[16] = 0.050, 0.200, 0.052
    w = engine.upcoming_cheap_window(make_day(values), at(6), tolerance=0.01)
    assert w.hour_count == 1
    assert w.start == at(14)


def test_window_expands_both_directions():
    values: list = [0.20] * 24
    values[13], values[14], values[15] = 0.051, 0.050, 0.052
    w = engine.upcoming_cheap_window(make_day(values), at(6), tolerance=0.01)
    assert w.hour_count == 3
    assert w.start == at(13)


def test_zero_tolerance_returns_single_hour():
    values: list = [0.20] * 24
    values[14], values[15] = 0.050, 0.051
    w = engine.upcoming_cheap_window(make_day(values), at(6), tolerance=0)
    assert w.hour_count == 1


def test_cap_trims_the_most_expensive_end():
    values: list = [0.50] * 24
    for i in range(8, 18):
        values[i] = 0.050 + (i - 8) * 0.001
    w = engine.upcoming_cheap_window(make_day(values), at(6), tolerance=0.02, max_hours=6)
    assert w.hour_count == 6
    assert w.start == at(8)


def test_anchor_survives_trimming_even_on_ties():
    values: list = [0.50] * 24
    for i in range(8, 16):
        values[i] = 0.050
    w = engine.upcoming_cheap_window(make_day(values), at(6), tolerance=0.01, max_hours=3)
    assert w.hour_count == 3
    assert w.start == at(8)


def test_degenerate_cap_terminates():
    values: list = [0.50] * 24
    for i in range(8, 16):
        values[i] = 0.050
    w = engine.upcoming_cheap_window(make_day(values), at(6), tolerance=0.01, max_hours=0)
    assert w.hour_count == 1


def test_gap_breaks_the_run():
    values: list = [0.50] * 24
    values[13], values[14], values[15], values[16] = 0.051, None, 0.050, 0.052
    w = engine.upcoming_cheap_window(make_day(values), at(6), tolerance=0.01)
    assert w.start == at(15)
    assert w.hour_count == 2


def test_flat_day_produces_nothing():
    assert engine.upcoming_cheap_window(make_day([0.100] * 24), at(6)) is None


def test_threshold_rejects_expensive_hours():
    hours = make_day(REPORTED_BUG_DAY)
    avg = engine.average(hours)
    assert engine.upcoming_cheap_window(hours, at(18)) is None
    assert 0.166 > avg * 0.85


def test_no_room_before_midnight():
    assert engine.upcoming_cheap_window(make_day(REPORTED_BUG_DAY), at(23, 50)) is None


def test_tie_break_by_earliest():
    values: list = [0.20] * 24
    values[3] = values[15] = 0.040
    assert engine.minimum(make_day(values)).index == 3


def test_maximum_tie_break_by_earliest():
    values: list = [0.20] * 24
    values[5] = values[9] = 0.400
    hours = make_day(values)
    assert engine.maximum(hours).index == 5
    st = engine.stats(hours)
    assert st["maxIdx"] == 5 and st["max"] == pytest.approx(0.4)


# MARK: El escenario reportado

def test_morning_picks_best_hour():
    w = engine.upcoming_cheap_window(make_day(REPORTED_BUG_DAY), at(8, 10))
    assert w.start == at(14)
    assert w.avg_eur_kwh == pytest.approx(0.052, abs=1e-4)


def test_still_reachable_keeps_best_hour():
    w = engine.upcoming_cheap_window(make_day(REPORTED_BUG_DAY), at(13, 20))
    assert w.start == at(14)


def test_afternoon_candidate_is_rejected():
    assert engine.upcoming_cheap_window(make_day(REPORTED_BUG_DAY), at(13, 40)) is None


def test_expensive_hour_never_announced():
    hours = make_day(REPORTED_BUG_DAY)
    avg = engine.average(hours)
    assert 0.178 > avg * 0.85
    for h in range(0, 23):
        w = engine.upcoming_cheap_window(hours, at(h))
        if w is not None:
            assert w.avg_eur_kwh <= avg * 0.85


# MARK: Cambio de hora

def test_spring_forward_23_hours():
    values: list = [0.20] * 23
    values[2] = 0.040
    hours = make_day(values, day="2026-03-29")
    assert len(hours) == 23
    assert madrid_hour(hours[2].start) == 3            # la tercera entrada = las 03:00 reales
    assert hours[-1].end == day_start("2026-03-30")
    assert (hours[-1].end - day_start("2026-03-29")) == dt.timedelta(hours=23)
    w = engine.upcoming_cheap_window(hours, day_start("2026-03-29"), tolerance=0)
    assert madrid_hour(w.start) == 3
    assert engine.hour_label(w.start) == "03:00"


def test_fall_back_25_hours():
    values: list = [0.20] * 25
    values[3] = 0.040
    hours = make_day(values, day="2026-10-25")
    assert len(hours) == 25
    assert madrid_hour(hours[2].start) == 2
    assert madrid_hour(hours[3].start) == 2
    assert engine.hour_label(hours[2].start) == "02:00" and engine.hour_label(hours[3].start) == "02:00"
    assert (hours[-1].end - day_start("2026-10-25")) == dt.timedelta(hours=25)
    assert hours[-1].end == day_start("2026-10-26")
    w = engine.upcoming_cheap_window(hours, day_start("2026-10-25"), tolerance=0)
    assert w.start == hours[3].start
    assert w.start > hours[2].start


def test_fall_back_current_hour_is_unambiguous():
    values: list = [0.10] * 25
    values[2], values[3] = 0.050, 0.080
    hours = make_day(values, day="2026-10-25")
    first = hours[2].start + dt.timedelta(minutes=10)
    second = hours[3].start + dt.timedelta(minutes=10)
    assert engine.current(hours, first).eur_kwh == 0.050
    assert engine.current(hours, second).eur_kwh == 0.080
    assert engine.current(hours, day_start("2026-10-26")) is None
    # Un `now` en hora de Madrid con `fold` (como datetime.now(DATA_TZ)) también distingue.
    assert engine.current(hours, dt.datetime(2026, 10, 25, 2, 10, tzinfo=DATA_TZ, fold=0)).eur_kwh == 0.050
    assert engine.current(hours, dt.datetime(2026, 10, 25, 2, 10, tzinfo=DATA_TZ, fold=1)).eur_kwh == 0.080
    # Y uno naive se asume en hora de Madrid.
    assert engine.current(hours, dt.datetime(2026, 10, 25, 5, 30)).index == 6


def test_real_dst_fixtures_anchor_by_index():
    spring = engine.build_day(archive70.parse((FIX / "2026-03-29.json").read_bytes()), "2026-03-29")
    autumn = engine.build_day(archive70.parse((FIX / "2025-10-26.json").read_bytes()), "2025-10-26")
    assert len(spring) == 23 and madrid_hour(spring[2].start) == 3 and spring[2].label == "03-04"
    assert len(autumn) == 25 and madrid_hour(autumn[2].start) == 2 and madrid_hour(autumn[3].start) == 2
    assert len(engine.bands(spring)) == 23 and len(engine.bands(autumn)) == 25


# MARK: Etiquetas por zona

def test_hour_label_never_renders_24():
    values: list = [0.20] * 24
    values[23] = 0.050
    w = engine.upcoming_cheap_window(make_day(values), at(21), tolerance=0)
    assert engine.hour_label(w.end) == "00:00"


def test_canarias_slot_0_is_23_local():
    hours = make_day([0.10] * 24, day="2026-09-22")
    assert engine.hour_label(hours[0].start, CANARIAS) == "23:00"
    assert engine.hour_label(hours[0].start, CANARIAS.tz) == "23:00"
    assert engine.hour_label(hours[13].start, CANARIAS) == "12:00"
    assert engine.hour_label(hours[13].start) == "13:00"
    # En invierno también una hora menos.
    winter = make_day([0.10] * 24, day="2026-01-15")
    assert engine.hour_label(winter[0].start, CANARIAS) == "23:00"


# MARK: Consumidores unificados

def test_remaining_never_looks_back():
    hours = make_day(REPORTED_BUG_DAY)
    result = engine.remaining_cheapest(hours, at(20), 3)
    assert not any(h.index == 3 for h in result)
    assert all(h.end > at(20) for h in result)
    assert [h.index for h in result] == sorted(h.index for h in result)


def test_remaining_at_end_of_day():
    hours = make_day(REPORTED_BUG_DAY)
    late = engine.remaining_cheapest(hours, at(23, 59), 3)
    assert len(late) == 1 and late[0].index == 23
    assert engine.remaining_cheapest(hours, day_start("2026-08-12"), 3) == []
    assert engine.remaining_cheapest(hours, at(6), 0) == []


def test_remaining_includes_current_hour():
    values: list = [0.20] * 24
    values[14] = 0.050
    result = engine.remaining_cheapest(make_day(values), at(14, 10), 1)
    assert result[0].index == 14


def test_starting_in_gives_real_lead_time():
    values: list = [0.20] * 24
    values[14] = 0.050
    hours = make_day(values)
    assert engine.remaining_cheapest(hours, at(14, 5), 1)[0].index == 14
    notif = engine.remaining_cheapest(hours, at(14, 5), 1, including_current=False, lead_minutes=30)
    assert notif[0].index != 14
    on_time = engine.remaining_cheapest(hours, at(13), 1, including_current=False, lead_minutes=30)
    assert on_time[0].index == 14


def test_best_two_hour_run_prefers_best_pair():
    values: list = [0.20] * 24
    values[10], values[11] = 0.060, 0.061
    values[19], values[20], values[21] = 0.20, 0.050, 0.20
    run = engine.best_contiguous_run(make_day(values), 2, at(6))
    assert run.hour_count == 2
    assert run.start == at(10) and run.end == at(12)
    assert run.min_eur_kwh == pytest.approx(0.060)


def test_best_two_hour_run_at_last_hour_is_none():
    assert engine.best_contiguous_run(make_day([0.10] * 24), 2, at(23, 30)) is None
    assert engine.best_contiguous_run(make_day([0.10] * 24), 0, at(6)) is None


def test_best_two_hour_run_at_second_to_last_hour():
    values: list = [0.30] * 24
    values[22] = values[23] = 0.10
    run = engine.best_contiguous_run(make_day(values), 2, at(22, 30))
    assert run.start == at(22) and run.hour_count == 2


def test_worth_announcing_gates_every_surface():
    hours = make_day(REPORTED_BUG_DAY)
    avg = engine.average(hours)
    run = engine.best_contiguous_run(hours, 2, at(18))
    assert run.avg_eur_kwh > avg
    assert not engine.is_worth_announcing(run, avg)
    good = engine.upcoming_cheap_window(hours, at(8))
    assert engine.is_worth_announcing(good, avg)


def test_day_cheap_window_ignores_time_and_threshold():
    w = engine.day_cheap_window(make_day(REPORTED_BUG_DAY))
    assert w.start == at(3)
    assert w.min_eur_kwh == pytest.approx(0.038, abs=1e-4)


# MARK: Color

def test_bands_guarantee_minimums_on_reported_day():
    hours = make_day(REPORTED_BUG_DAY)
    s = engine.bands(hours)
    assert len(s) == len(hours) == 24
    assert s.count("g") >= 4
    assert s[3] == "g"          # la más barata siempre verde
    assert s[19] == "r"         # la más cara siempre roja
    assert set(s) <= {"g", "o", "r"}
    by_idx = engine.bands_by_index(hours)
    assert by_idx[3] == "g" and by_idx[19] == "r" and len(by_idx) == 24


def test_bands_orange_fill_quirk_is_replicated():
    # 4 verdes claras, 2 naranjas y 18 rojas lejanas: el relleno "reasigna" las
    # dos naranjas que ya lo eran y se queda con 2 (rareza de assignColors).
    values = [0.05] * 4 + [0.15] * 2 + [0.25] * 18
    s = engine.bands(make_day(values))
    assert s == "gggg" + "oo" + "r" * 18
    assert s.count("o") == 2


def test_bands_flat_day_is_all_green():
    # Todas a ratio 1 → rojas; 4 verdes mínimas; la expansión (±0,005) arrastra al resto.
    assert engine.bands(make_day([0.100] * 24)) == "g" * 24


def test_bands_proximity_expansion_is_transitive():
    # Base 0,100 (rojas) y cadena 0,060 … 0,080 a pasos de 0,004: la 0,060 es
    # verde por ratio, 0,064-0,072 por el mínimo de 4, y 0,076 entra por
    # proximidad a 0,072 y 0,080 por proximidad a 0,076 (BFS transitivo).
    values = [0.100] * 24
    for k, v in enumerate((0.060, 0.064, 0.068, 0.072, 0.076, 0.080)):
        values[1 + k] = v
    s = engine.bands(make_day(values))
    assert s[1:7] == "g" * 6
    assert s[0] != "g" and s[7] != "g"
    # Sin proximidad, solo los 4 verdes garantizados.
    s0 = engine.bands(make_day(values), proximity=0)
    assert s0.count("g") == 4 and s0[5] != "g" and s0[6] != "g"


def test_bands_with_gap_keeps_order_and_length():
    values: list = [0.20] * 24
    values[5] = None
    values[14] = 0.05
    hours = make_day(values)
    s = engine.bands(hours)
    assert len(s) == 23
    assert s[[h.index for h in hours].index(14)] == "g"


def test_bands_non_positive_average_is_empty():
    assert engine.bands(make_day([0.0] * 24)) == ""
    assert engine.bands(make_day([-0.01] * 24)) == ""


def test_free_and_negative_hours_are_valid():
    values: list = [0.20] * 24
    values[14] = 0.0
    hours = make_day(values)
    assert len(hours) == 24
    assert engine.minimum(hours).eur_kwh == 0.0
    assert engine.upcoming_cheap_window(hours, at(6), tolerance=0).start == at(14)
    values[14] = -0.005
    assert engine.minimum(make_day(values)).eur_kwh == pytest.approx(-0.005)


def test_nil_is_not_free():
    values: list = [0.20] * 24
    values[5], values[6] = None, 0.0
    hours = make_day(values)
    assert not any(h.index == 5 for h in hours)
    assert any(h.index == 6 for h in hours)
    assert engine.minimum(hours).index == 6


def test_rejects_too_many_hours():
    assert make_day([0.10] * 48) == []


# MARK: JSON del día

def test_day_stats_json_schema():
    rows = rows_from_values(REPORTED_BUG_DAY)
    extras = engine.day_extras(rows, "2026-08-11")
    assert list(extras) == ["stats", "bands"]
    assert list(extras["stats"]) == ["pcb", "cym"]
    st = extras["stats"]["pcb"]
    assert list(st) == ["avg", "min", "max", "minIdx", "maxIdx"]
    assert st["minIdx"] == 3 and st["maxIdx"] == 19
    assert st["min"] == pytest.approx(0.038) and st["max"] == pytest.approx(0.201)
    assert st["avg"] == pytest.approx(sum(REPORTED_BUG_DAY) / 24)
    assert extras["bands"]["pcb"] == engine.bands(engine.build_day(rows, "2026-08-11", "pcb"))
    # Sin serie CYM → se omite.
    no_cym = [archive70.Hour(i=r.i, h=r.h, pcb=r.pcb, cym=None) for r in rows]
    assert list(engine.day_extras(no_cym, "2026-08-11")["stats"]) == ["pcb"]

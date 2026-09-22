import itertools
import math

import pytest

from precioluz import copy


def test_day_level_thresholds():
    assert copy.day_level(0.05) == "barato"
    assert copy.day_level(0.12) == "barato"
    assert copy.day_level(0.1201) == "normal"
    assert copy.day_level(0.18) == "normal"
    assert copy.day_level(0.1801) == "caro"


def test_spread_level_thresholds():
    assert copy.spread_level(0.0) == "plano"
    assert copy.spread_level(0.03) == "plano"
    assert copy.spread_level(0.0301) == "medio"
    assert copy.spread_level(0.06) == "medio"
    assert copy.spread_level(0.0601) == "alto"


def test_nine_consejos_cover_every_combo():
    combos = list(itertools.product(copy.DAY_LEVELS, copy.SPREAD_LEVELS))
    assert len(combos) == 9 and set(copy.CONSEJOS) == set(combos)
    for day_lvl, spread_lvl in combos:
        c = copy.consejo(day_lvl, spread_lvl, "14:00")
        assert list(c) == ["title", "summary", "action"]
        assert all(c[k] for k in c)
        assert "{bestHour}" not in "".join(c.values())
    with_hour = [("barato", "alto"), ("normal", "medio"), ("caro", "alto"), ("normal", "alto"), ("caro", "medio")]
    for combo in with_hour:
        assert "14:00" in copy.consejo(*combo, "14:00")["action"], combo
    assert copy.consejo("barato", "plano", "14:00")["title"] == "Barra libre de energía"
    assert copy.consejo("caro", "medio", "04:00")["title"] == "Día caro con un respiro"
    assert copy.consejo("caro", "alto", "04:00")["action"].endswith("(04:00).")
    with pytest.raises(ValueError):
        copy.consejo("carísimo", "plano", "14:00")


def test_consejo_frame_and_badge():
    assert copy.consejo_frame("barato", "plano") == \
        "Consejo del día: hoy la luz está barata y apenas cambia entre unas horas y otras."
    assert copy.consejo_frame("normal", "medio") == \
        "Consejo del día: hoy la luz está a un precio normal y cambia algo entre unas horas y otras."
    assert copy.consejo_frame("caro", "alto") == \
        "Consejo del día: hoy la luz está cara y cambia mucho entre unas horas y otras."
    assert copy.level_badge("barato", "plano") == "BARATO · PLANO"


def test_tip_text():
    assert copy.tip_text(0.10, "14:00") == \
        "Hoy hay mucha diferencia entre horas. Si puedes, concentra consumos en 14:00."
    assert copy.tip_text(0.02, "14:00") == "Día bastante plano. No hay grandes diferencias entre horas."


def test_eur_formats_with_comma():
    assert copy.fmt_eur(0.052) == "0,052 €/kWh"
    assert copy.fmt_eur(0.05, decimals=2) == "0,05 €/kWh"
    assert copy.fmt_eur_bare(0.052) == "0,052"
    assert copy.fmt_eur(1234.5, decimals=2) == "1234,50 €/kWh"     # sin separador de miles
    assert copy.fmt_eur(math.nan) == "— €/kWh"
    assert copy.fmt_eur(math.inf) == "— €/kWh"
    assert copy.fmt_eur_bare(math.nan) == "—"
    assert copy.fmt_eur(0.0625) == "0,063 €/kWh"                   # half-up, igual que toFixed en JS
    assert copy.fmt_eur(1.005, decimals=2) == "1,00 €/kWh"         # 1.005 es 1.00499… en binario
    assert copy.fmt_eur_bare(-0.0004) == "0,000"                   # sin "-0,000"
    assert copy.fmt_eur_bare(-0.005) == "-0,005"
    assert copy.fmt_number(12, decimals=0) == "12"


def test_pct_and_comparison():
    assert copy.fmt_pct(12.44) == "12,4 %"
    assert copy.fmt_pct(3.0, decimals=0) == "3 %"
    assert copy.comparison_text(0.1124, 0.1, False) == "↑ 12,4 % vs típico (laborable)"
    assert copy.comparison_text(0.09, 0.1, True) == "↓ 10,0 % vs típico (finde)"
    assert copy.comparison_text(0.1, 0.1, False) == "↑ 0,0 % vs típico (laborable)"
    assert copy.comparison_text(0.0, 0.1, False) is None
    assert copy.comparison_text(0.1, 0.0, False) is None


def test_comparison_to_average():
    assert copy.comparison_to_average(0.05, 0.115) == "un 57 % por debajo de la media de hoy"
    assert copy.comparison_to_average(0.05, 0.051) is None
    assert copy.comparison_to_average(0.2, 0.1) is None
    assert copy.comparison_to_average(0.1, 0.0) is None


def test_dates_are_spanish_without_locale():
    assert copy.day_badge("2026-09-22") == "Laborable · Mar 22 Sep"    # martes
    assert copy.day_badge("2026-09-21") == "Laborable · Lun 21 Sep"
    assert copy.day_badge("2026-09-26") == "Finde · Sáb 26 Sep"
    assert copy.day_badge("2026-09-20") == "Finde · Dom 20 Sep"
    assert copy.day_badge("2026-03-04") == "Laborable · Mié 4 Mar"
    assert copy.long_date("2026-09-22") == "Martes, 22 de septiembre de 2026"
    assert copy.long_date("2026-09-21") == "Lunes, 21 de septiembre de 2026"
    assert copy.long_date("2026-01-03") == "Sábado, 3 de enero de 2026"
    assert copy.short_date("2026-09-22") == "22/09"
    assert copy.short_date("2026-01-03") == "03/01"
    assert copy.month_title("2026-09") == "Septiembre 2026"
    assert copy.is_weekend("2026-09-19") and not copy.is_weekend("2026-09-22")

#!/usr/bin/env python3
"""Paridad JS ↔ Python del coloreado: todos los días guardados × las dos series.

    .venv/bin/python tools/parity.py          → "10 días × 2 series: OK"

Sale con 1 en el primer desacuerdo (y lo imprime). Necesita `node` en el PATH.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from precioluz import archive70, engine  # noqa: E402
from precioluz.zones import SERIES  # noqa: E402

DATA = ROOT / "docs" / "data" / "pvpc"
CLI = ROOT / "tools" / "bands_cli.js"


def js_bands(path: Path, series: str) -> str:
    out = subprocess.run(["node", str(CLI), str(path), series],
                         capture_output=True, text=True, check=True, cwd=ROOT)
    return out.stdout.strip()


def main() -> int:
    files = sorted(DATA.glob("????-??-??.json"))
    if not files:
        print(f"sin días en {DATA}", file=sys.stderr)
        return 1
    for path in files:
        obj = json.loads(path.read_text(encoding="utf-8"))
        rows = archive70.from_rows(obj["hours"])
        for series in SERIES:
            expected = engine.bands(engine.build_day(rows, obj["day"], series))
            got = js_bands(path, series)
            if got != expected:
                print(f"DESACUERDO {obj['day']} {series}\n  python: {expected}\n  js:     {got}")
                return 1
    print(f"{len(files)} días × {len(SERIES)} series: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

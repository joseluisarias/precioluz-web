# precioluz-web

Web de **Precio de la Luz** (precioluz.natural-apps.com): el PVPC de hoy y de mañana
con la apariencia de la app para iPhone *Precio Luz España PVPC*.

- `scripts/fetch.py` descarga el archivo 70 de ESIOS (público, sin token) a `docs/data/pvpc/`.
- `.github/workflows/update.yml` lo ejecuta cada día a partir de las 20:17 (hora de Madrid) y hace commit.
- `docs/` es la fuente de GitHub Pages.

Desarrollo: `python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt && pytest -q`

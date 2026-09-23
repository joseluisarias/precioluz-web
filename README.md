# precioluz-web

Web de **Precio de la Luz** — [precioluz.natural-apps.com](https://precioluz.natural-apps.com): el PVPC de hoy y de
mañana hora a hora, con el estilo de la app para iPhone *Precio Luz España PVPC* y sus mismas reglas de cálculo.

## Cómo funciona
- `scripts/fetch.py` descarga el archivo 70 de ESIOS (público, sin token; series `PCB` y `CYM`) y el mix de generación de apidatos a `docs/data/`.
- `scripts/build.py` genera el sitio estático en `docs/` con los números reales en el HTML (SEO), el JSON del calendario, los alias `/data/hoy.json`, el sitemap y el JSON de arranque de cada página. Determinista: `build.py --check` falla si el HTML en disco no coincide.
- `tools/og.py` genera las imágenes Open Graph diarias (Pillow).
- `.github/workflows/update.yml` lo ejecuta una vez al día a las 20:20 (hora de Madrid) y reintenta cada 5 minutos, hasta 90, mientras REE no haya publicado mañana (`fetch.py --require-tomorrow` sale con código 2). Un segundo disparo de madrugada regenera el sitio para el día nuevo. Hace commit solo si cambia algo; `workflow_dispatch` admite `days=N` para rellenar histórico.
- El navegador (`docs/assets/js/`) añade la interactividad: cambio de día (`?d=`) y de zona (Península, Canarias en hora local, Baleares, Ceuta/Melilla con serie propia), hora actual, calendario por meses, generación en vivo y los precios de mañana desde ESIOS si el cron aún no ha corrido.

## Desarrollo
```bash
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt -r requirements-dev.txt
python3 scripts/fetch.py --days 10      # datos
python3 scripts/build.py                # sitio
python3 -m http.server 8000 -d docs     # http://localhost:8000
pytest -q && node --test "tests/js/**/*.test.js" && python3 tools/parity.py
```
`tools/parity.py` comprueba que los colores de las bandas calculados en JS y en Python coinciden para todos los días guardados.

## Estructura
`precioluz/` (parser, motor, calendario, textos, zonas, render) · `scripts/` (fetch, build) · `templates/shell.html` · `seo/` (textos y secciones) · `docs/` (sitio publicado) · `tests/` (pytest + node:test + fixtures reales).

# seo/ — capa de contenido en español

Textos, fragmentos HTML y plantillas JSON-LD que `scripts/build.py` inyecta en la shell.
Aquí no hay código: solo contenido con `{placeholders}` que el build sustituye con los números reales del día.

## Ficheros

| Fichero | Qué es |
|---|---|
| `copy.json` | Por página: `url`, `title`, `description`, `h1`, `lead`, `priority`, `sections` (y extras, ver abajo). |
| `sections/*.html` | Fragmentos HTML (sin `<html>/<body>`) que van **debajo de la shell** de la app, en la columna de 720 px. |
| `jsonld.json` | Plantillas JSON-LD (`organization`, `website`, `breadcrumb`, `webpage_dataset`, `software_application`, `faq_page`, `article`). |
| `../docs/llms.txt`, `../docs/robots.txt`, `../docs/manifest.webmanifest` | Ficheros estáticos finales; el build los copia tal cual (no llevan placeholders). |

## Sustitución de placeholders

Los placeholders tienen la forma `{nombre}` y aparecen en `copy.json`, en `sections/*.html` y en `jsonld.json`.
**Sustituir con un reemplazo de tokens** (`re.sub(r"\{(\w+)\}", …)`), no con `str.format`: así un `{` suelto nunca rompe nada y un placeholder sin valor se detecta (dejarlo sin sustituir debe fallar el build, no salir a producción).

Todos los valores llegan ya formateados: coma decimal (`0,052`), horas `HH:MM`, fechas en español y sin año salvo `{actualizado}`.

### Del día (páginas dinámicas)

| Placeholder | Ejemplo | Notas |
|---|---|---|
| `{fecha_corta}` | `22/09` | día de datos (Madrid) |
| `{fecha_larga}` | `lunes 22 de septiembre` | |
| `{fecha_larga_manana}` | `martes 23 de septiembre` | |
| `{mes_anno}` | `septiembre de 2026` | calendario |
| `{hora_barata}` / `{hora_barata_fin}` | `14:00` / `15:00` | hora más barata del día, en el reloj de la zona de la página |
| `{precio_barato}` | `0,018` | €/kWh (el texto ya pone la unidad) |
| `{hora_cara}` / `{hora_cara_fin}` / `{precio_caro}` | `20:00` / `21:00` / `0,415` | |
| `{media}` | `0,199` | media del día |
| `{pct_vs_ayer}` | `12` | sin signo ni `%` (el texto pone `%`) |
| `{mas_menos_ayer}` | `más barata` \| `más cara` | concuerda con "la media… es un 12 % más barata" |
| `{zona}` | `Península` | `Península`, `Baleares`, `Canarias`, `Ceuta y Melilla` |
| `{tramo2_inicio}` / `{tramo2_fin}` / `{tramo2_media}` | `14:00` / `16:00` / `0,024` | mejor tramo de 2 h seguidas del día |
| `{hora_barata_manana}` / `{precio_barato_manana}` | `15:00` / `0,021` | solo en `lead_manana` (ver abajo) |
| `{renovable_ayer}` / `{dominante_ayer}` | `58` / `eólica` | generación de D−1 completo |
| `{actualizado}` | `21/09/2026 20:24` | hora peninsular |
| `{publicado_manana_a}` | `20:24` | hora a la que el fetch vio por primera vez los precios de mañana **la última vez que los vio** (si hoy aún no han salido, es la de ayer) |

### Otros

| Placeholder | Dónde | Notas |
|---|---|---|
| `{appstore_url}` | `cta-app.html`, `app.html`, `404.html` | el build pone el enlace de campaña con `pt`/`ct` según el emplazamiento (`web-hero`, `web-manana`, `web-hora-barata`, `web-zona-canarias`, `web-app`, `web-footer`, `web-404`). |
| `{page_url}`, `{page_name}`, `{title}`, `{description}`, `{h1}` | `jsonld.json` | URL canónica absoluta; `page_name` = H1 sin fecha para la miga. |
| `{fecha_iso}`, `{actualizado_iso}`, `{date_published_iso}` | `jsonld.json` | `2026-09-22`, `2026-09-21T20:24:00+02:00`. `date_published_iso` = fecha del primer despliegue de la guía (fija). |
| `{data_url}` | `jsonld.json` (Dataset) | JSON del día: `https://precioluz.natural-apps.com/data/pvpc/2026-09-22.json` |
| `{og_image_url}` | `jsonld.json` | OG 1200×630 de la página (o el icono 512 en `/app/`). |

### Reglas de contexto

- En `manana`, `{pct_vs_ayer}` y `{mas_menos_ayer}` comparan **mañana con hoy** (el lead dice "que hoy"); el resto de placeholders son los de mañana.
- En `manana_pendiente` (antes de las 20:20), los placeholders son los de **hoy** (el lead lo deja claro). Misma `url`, mismo `h1`; solo cambian `title`, `description` y `lead`. Nunca `noindex`.
- En `hora_mas_barata` y `cuando_poner_la_lavadora` hay dos frases opcionales: `lead_manana` (añadir al lead solo cuando los precios de mañana ya están publicados) y `lead_manana_pendiente` (añadir cuando no). Nunca las dos.
- En las páginas de zona (`canarias`, `baleares`, `ceuta_melilla`) las horas van en el reloj de la zona y la serie es la de la zona (CYM para Ceuta y Melilla). En Canarias el día de datos empieza a las 23:00 de la víspera.
- `404` lleva `"noindex": true` y `priority` 0: fuera del sitemap.
- `priority` es la prioridad del sitemap (0,0–1,0).

## Páginas → orden de secciones

El campo `sections` de cada página lista los fragmentos de `sections/` en el orden en que van debajo de la shell (después de la tabla y del bloque "Última actualización", que genera `render.py`).

| Página | Secciones (en orden) |
|---|---|
| `home` `/` | `como-leer` · `cta-app` · `sobre-estos-datos` |
| `manana` / `manana_pendiente` `/manana/` | `como-leer` · `cta-app` · `sobre-estos-datos` |
| `hora_mas_barata` | `como-leer` · `cta-app` · `sobre-estos-datos` |
| `canarias` | `canarias` · `cta-app` · `sobre-estos-datos` |
| `baleares` | `baleares` · `cta-app` · `sobre-estos-datos` |
| `ceuta_melilla` | `ceuta-melilla` · `cta-app` · `sobre-estos-datos` |
| `calendario` | `como-leer` · `sobre-estos-datos` · `cta-app` |
| `generacion` | `cta-app` (los datos de generación no son del archivo 70; el lead ya cita fuente y dominio) |
| `que_es_el_pvpc` | `que-es-el-pvpc` · `cta-app` |
| `cuando_poner_la_lavadora` | `cuando-poner-la-lavadora` · `cta-app` · `sobre-estos-datos` |
| `a_que_hora_sale` | `a-que-hora-sale` · `cta-app` |
| `app` | `app` (lleva su propio botón; no añadir `cta-app`) |
| `faq` | `faq` · `cta-app` |
| `404` | `404` (lleva su propio botón) |

Cada página menciona el dominio `precioluz.natural-apps.com` en el lead o en alguna de sus secciones (además del pie común).

## Convenciones de los fragmentos

- Raíz `<section class="article" id="…">`; la FAQ usa `class="faq"` con pares `<h3>`/`<p>` (sin `<details>`, para que los LLM lean las respuestas); las tablas llevan `class="table"` y `<caption>`.
- Botón de la tienda: `<a class="btn btn-appstore" href="{appstore_url}">Descargar gratis en el App Store</a>` dentro de `<p class="cta-button">`, con `<p class="cta-subline">` debajo.
- Sin emojis, sin jerga, coma decimal, unidad `€/kWh`. Nombres exactos de funciones de la app entre comillas rectas: "Mejor hora del día", "Precios de mañana", "Oferta puntual", "Precio ahora", "Hoy — mejores y próximas", "2 h baratas", "Lavadora barata", "Lavavajillas barato". Entidades: sitio **PrecioLuz**, app **Precio Luz España PVPC**, editor **Natural Apps**.

## JSON-LD: qué va en cada página

| Página | Plantillas |
|---|---|
| Todas | `organization` + `website` + `breadcrumb` (la home solo `organization` + `website`) |
| Dinámicas (`home`, `manana`, `hora_mas_barata`, zonas, `calendario`) | + `webpage_dataset` (solo si existe el JSON del día; en `calendario`, `{fecha_iso}` = primer día del mes y `{data_url}` = `/data/calendar/YYYY-MM.json`) |
| `app` | + `software_application` (rating 4,9 / 8: **actualizar en cada release**) |
| `faq` | + `faq_page` (generado a partir de `sections/faq.html`; si cambias una respuesta, regenera las dos) |
| Guías (`que_es_el_pvpc`, `cuando_poner_la_lavadora`, `a_que_hora_sale`) | + `article` |

`faq_page` contiene la misma respuesta dinámica que `faq.html` (con placeholders): sustituirlos también en el JSON-LD.

## Hechos que el contenido da por ciertos

Si cambia alguno, hay que revisar los textos: datos = ESIOS archivo 70 (PVPC 2.0TD), publicación 20:15-20:20 Madrid (19:15-19:20 Canarias); PCB compartida por Península, Baleares y Canarias (Canarias en hora local, −1 h); CYM propia de Ceuta y Melilla (punta 11-15 y 19-23 → difiere a las 10, 14, 18 y 22 los laborables; igual fines de semana y festivos); colores verde < 65 % de la media, naranja ≤ 85 %, rojo por encima; próxima oportunidad = tramo ≤ 6 h a menos de 1 céntimo del mínimo restante con media < 85 % de la del día; consejo: media ≤ 0,12 barata / ≤ 0,18 normal / cara, diferencia máx−mín ≤ 0,03 plana / ≤ 0,06 media / alta; avisos 5/10/15/30 min, "Precios de mañana" a las 20:20 retrasable 40 min, "Oferta puntual" 15 min antes si < 0,05 €/kWh; app gratis, sin anuncios, sin cuenta, iOS 26+, 4,9 (8 valoraciones).

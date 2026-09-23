# Traspaso: landing de PrecioLuz en natural-apps.com ↔ herramienta precioluz.natural-apps.com

- **Fecha:** 22/09/2026, 19:45 (hora peninsular).
- **Escribe:** la sesión que construye la herramienta (`~/Documents/websites/precioluz-web`).
- **Lee y ejecuta:** la sesión "Natural Apps WEBsite analysis and plan + analitics install ventas", que trabaja en `~/Documents/websites/natural Apps 2026/`.
- **Decide y da los OK de despliegue:** Jose Luis Arias.

Este fichero es la única fuente de verdad para todo lo que la landing copia de la herramienta. Si algo de aquí choca con lo que ves en la landing o en la tienda, gana este fichero y se anota la duda en la última sección.

---

## 0. Estado el 22/09/2026

| Pieza | Estado |
|---|---|
| Repo `joseluisarias/precioluz-web` | público desde hoy; GitHub Pages activo desde `main /docs`; `docs/CNAME` = `precioluz.natural-apps.com` |
| DNS `precioluz.natural-apps.com` | **pendiente**: falta el registro `CNAME precioluz → joseluisarias.github.io` en Hostinger (lo crea Jose Luis). Hasta entonces la herramienta no responde en ninguna URL |
| Datos | cron de GitHub Actions a las 20:20 (hora de Madrid) cada día, con reintentos hasta que REE publica; 60 días de histórico ya cargados |
| App en la tienda | versión 1.71 (build 6). La 1.72 con **zonas** (Canarias hora local, Ceuta y Melilla precio propio) está hecha pero **no publicada** |
| Landing publicada | la badge de la App Store enlaza a una búsqueda en la tienda de EE. UU.; textos de enero 2026 ("ha salido de beta", "Tres pestañas"); FAQ con funciones que la app no tiene |

**Compuertas**

- **A (traspaso):** este fichero. A partir de aquí la landing se puede preparar entera en local.
- **B (herramienta pública):** `curl -sI https://precioluz.natural-apps.com/ | head -1` devuelve `HTTP/2 200` con certificado válido. Hasta B no se despliega ningún enlace a la herramienta: daría 404 y Google lo guardaría.
- **C (1.72 en la tienda):** hasta que la 1.72 esté publicada, la landing no anuncia zonas como función disponible. Se puede mencionar como "próximamente en la 1.72" o no mencionarla.

---

## 1. Reglas de reparto

| | precioluz.natural-apps.com (herramienta) | www.natural-apps.com/PrecioLuz/ (landing) |
|---|---|---|
| Posee | precios de hoy y mañana, hora más barata, calendario, zonas, generación, guías sobre el PVPC, FAQ sobre precios | marketing de la app: funciones, capturas, FAQ de **uso de la app**, contacto, privacidad, términos |
| No debe tener | capturas de marketing, textos legales, FAQ de uso de la app | explicaciones del PVPC, tablas de precios propias, guías sobre tarifas |
| Idioma | solo español | español e inglés (ficheros `_es` y sin sufijo) |

- Ninguna página canonicaliza a la otra, salvo las guías puente (sección 4.3).
- No añadir `hreflang` entre los dos sitios. El `hreflang` es/en de la landing se queda dentro de la landing.
- No repetir en la landing las preguntas de la FAQ de la herramienta (hora de publicación, colores, próxima oportunidad, PVPC, Canarias, Ceuta y Melilla). La landing enlaza a esas respuestas.
- Los enlaces a la herramienta van **sin parámetros UTM**: la herramienta usa `?d=` y `?m=` para día y mes, y las URL limpias son las que queremos que se indexen. El clic se mide en la landing (sección 7).

---

## 2. Hechos fijos (copiar tal cual, no reinterpretar)

**Identidad**

- Sitio web: **PrecioLuz** (`precioluz.natural-apps.com`).
- App: **Precio Luz España PVPC** (nombre exacto de la ficha; subtítulo actual "Factura, tarifa y hora barata").
- Editor: **Natural Apps** (`www.natural-apps.com`). En la ficha de la tienda el vendedor aparece con un nombre personal, por eso las dos webs tienen que fijar la entidad "Natural Apps" en texto y en JSON-LD.
- App Store id: **6758021483**. Gratis, sin compras dentro de la app, sin suscripción, sin anuncios, sin cuenta. Ficha: "No se recopilan datos".
- Requiere **iOS 26 o posterior**. Solo iPhone. No hay versión Android.
- Valoración: **4,9 sobre 5 con 8 valoraciones** (22/09/2026). Se actualiza en `seo/jsonld.json` de la herramienta en cada versión; la landing copia de ahí.
- Contacto: `natural.learning.apps@gmail.com`.
- Frase de pie común a los dos sitios: "PrecioLuz (precioluz.natural-apps.com) es la web de la app Precio Luz España PVPC para iPhone, de Natural Apps. Datos oficiales de Red Eléctrica, sin publicidad y sin comercializadora."

**Datos**

- Fuente: Red Eléctrica de España, ESIOS, archivo 70, PVPC 2.0TD. Público, sin token. Ninguna comercializadora ni comparador detrás.
- Los precios de mañana se publican entre las **20:15 y las 20:20** hora peninsular (19:15-19:20 en Canarias), tras la subasta diaria de OMIE.
- Se muestran **por horas, tal como los publica REE en su archivo horario**. No decir "cuartohorario".
- Unidad: €/kWh con coma decimal ("0,052 €/kWh"), sin impuestos.
- Colores: verde por debajo del 65 % de la media del día, naranja hasta el 85 %, rojo por encima.

**Funciones reales de la app 1.71** (las únicas que se pueden anunciar hoy)

- Avisos, en Ajustes: **Mejor hora del día** (5, 10, 15 o 30 minutos antes; da el tramo entero si varias horas seguidas cuestan casi lo mismo), **Precios de mañana** (a las 20:20, retrasable hasta 40 minutos) y **Oferta puntual** (15 minutos antes de una hora por debajo de 0,05 €/kWh o muy por debajo de la media). Son notificaciones locales: sin servidor, sin cuenta.
- Widgets: **Precio ahora**, **Hoy — mejores y próximas**, **2 h baratas**, **pantalla de bloqueo y StandBy**.
- **Live Activity y Dynamic Island** con el precio de la hora actual y la mejor hora del día.
- Siri y Atajos: **"Lavadora barata"**, **"Lavavajillas barato"** y el precio de ahora. Responden con el mejor tramo de dos horas seguidas que queda hoy, su precio medio y cuánto se aleja de la media.
- Pestañas: **Día** (24 barras con color, hora más barata y más cara, próxima oportunidad), **Generación** (mix por tecnologías y % renovable), **Resumen** (comparativa ayer/hoy/mañana, consejo del día) y **Calendario** (media, mínimo y máximo de cada día, coloreado sobre los 30 días anteriores).

**Llega con la 1.72 (compuerta C)**

- Zonas en Ajustes → Zona: Península, Baleares, Canarias (horas en hora local, precios de mañana a las 19:20, detección automática si el iPhone está en esa zona horaria), Ceuta y Melilla (serie de precios propia, distinta de la peninsular a las 10, 14, 18 y 22 de los laborables).

**Lo que la app NO hace** (la landing publicada lo promete y hay que quitarlo)

- No envía avisos por correo electrónico. No exporta CSV. No controla enchufes ni HomeKit. No compara con OMIE. No tiene cuenta de usuario ni "eliminar mi cuenta". No tiene versión premium ni suscripción. No hay "actualizaciones extraordinarias" ni "cuenta atrás en el widget". No está "en beta".

---

## 3. Enlaces

### 3.1 A la App Store (comprobado el 22/09/2026 con curl y con navegador)

| URL | Resultado |
|---|---|
| `https://apps.apple.com/es/app/precio-luz-espa%C3%B1a-pvpc/id6758021483` | **200. Es la URL a usar.** |
| `https://apps.apple.com/es/app/id6758021483` | 301 a la anterior. Válida. |
| `https://apps.apple.com/app/id6758021483` (la que tiene la landing local) | **404** sin tienda en la ruta. No usar. |
| `https://apps.apple.com/es/search?term=precio%20luz%20espa%C3%B1a%20pvpc` (la usó la herramienta entre las 19:33 y las 19:43 del 22/09; ya corregida a la ficha) | "The page you're looking for can't be found" en navegador de escritorio y 404 en curl. No usar. |

**Enlace de campaña** (para que App Analytics atribuya las descargas a la landing). Hace falta el *provider token* `pt` de App Store Connect → Analytics → Fuentes → Campañas → Generar enlace. Lo aporta Jose Luis. Plantilla:

```
https://apps.apple.com/es/app/apple-store/id6758021483?pt=PT_PENDIENTE&ct=landing&mt=8
```

Convención de `ct`: la landing usa `landing` (o `landing-hero`, `landing-footer` si se quieren separar emplazamientos); la herramienta usa `web-*`. Mientras no haya `pt`, usar la URL con slug de la primera fila.

### 3.2 De la landing a la herramienta (URL canónicas, con barra final)

| URL | Texto de enlace sugerido | Dónde |
|---|---|---|
| `https://precioluz.natural-apps.com/` | Ver el precio de la luz de hoy y de mañana | hero de `index_es.html`, pie de todas las páginas |
| `https://precioluz.natural-apps.com/manana/` | Precio de la luz mañana | bloque de enlaces |
| `https://precioluz.natural-apps.com/hora-mas-barata/` | Hora más barata de la luz hoy | bloque de enlaces |
| `https://precioluz.natural-apps.com/calendario/` | Precio de la luz por días | sección Calendario |
| `https://precioluz.natural-apps.com/que-es-el-pvpc/` | Qué es el PVPC | destino de `guides_es.html` |
| `https://precioluz.natural-apps.com/cuando-poner-la-lavadora/` | Cuándo poner la lavadora | FAQ de Siri |
| `https://precioluz.natural-apps.com/a-que-hora-sale-el-precio-de-la-luz/` | A qué hora sale el precio de mañana | FAQ de datos |
| `https://precioluz.natural-apps.com/canarias/` · `/baleares/` · `/ceuta-melilla/` | Precio de la luz en Canarias / Baleares / Ceuta y Melilla | solo tras la compuerta C |
| `https://precioluz.natural-apps.com/app/` | La app explicada | pie |
| `https://precioluz.natural-apps.com/preguntas-frecuentes/` | Preguntas sobre el precio de la luz | FAQ de la landing, al final |

Las páginas en inglés enlazan también a la herramienta, con la nota "(in Spanish)".

### 3.3 De la herramienta a la landing (ya existen; **no renombrar estos ficheros**)

- `https://www.natural-apps.com/PrecioLuz/privacy_es.html`
- `https://www.natural-apps.com/PrecioLuz/terms_es.html`
- `https://www.natural-apps.com/PrecioLuz/contact_es.html`
- `https://www.natural-apps.com/`

---

## 4. Cambios en la landing, fichero a fichero

Carpeta: `~/Documents/websites/natural Apps 2026/PrecioLuz/`. Todo se hace primero en local; el despliegue va en la sección 8.

### 4.1 `index_es.html` (y su espejo `index.html` = `index_en.html` en inglés)

- **Head:** `<title>` y `meta description` nuevos (bloque 5.3); `<link rel="canonical">` a sí misma; `hreflang` es/en entre `index_es.html` e `index.html`; Smart App Banner (bloque 5.2); JSON-LD (bloque 5.1). Mantener Tailwind y `company-theme.css`.
- **Hero:** quitar "Producción · Enero 2026" y "La app de iOS ha salido de beta y replica las tres pestañas". H1 propuesto: "Precio Luz España PVPC: la hora más barata de la luz, en tu iPhone". Párrafo: "La app te avisa antes de la hora más barata del día y te trae los precios de mañana a las 20:20. Datos oficiales de Red Eléctrica. Gratis, sin anuncios y sin registro." Tres viñetas: aviso antes de la hora barata · precios de mañana a las 20:20 · widgets, pantalla de bloqueo, Live Activity y Siri.
- **Badge:** `href` a la URL con slug (3.1) o al enlace de campaña cuando haya `pt`. Cambiar la imagen de la badge a la versión en español: `https://toolbox.marketingtools.apple.com/api/badges/download-on-the-app-store/black/es-es?size=250x83` y `alt="Descargar en el App Store"`. Añadir un segundo botón: "Ver el precio de hoy y de mañana" → `https://precioluz.natural-apps.com/` (solo tras B).
- **Tarjetas de cifras** ("Pico · 19:00 · 0,318", "Media · Lun 19 Ene", "+19,3 %"): son datos inventados de enero. Quitarlas, o sustituirlas por la cajita viva de la sección 6.
- **Sección "Tres pestañas, un coach eléctrico":** pasa a **cuatro** pestañas (Día, Generación, Resumen, Calendario) con los textos de la sección 2. Fuera "0,192 / 0,120 / 0,318", "Enero 2026", "Barras interactivas sincronizadas con la curva PVPC en vivo", "modelar automatizaciones".
- **Nueva sección "Avisos, widgets y Siri"** con las tres listas de la sección 2. Esta es la razón de instalar la app y hoy la landing no la cuenta.
- **Sección "¿Necesitas documentación?":** la tarjeta "Guías" pasa a enlazar a `https://precioluz.natural-apps.com/que-es-el-pvpc/` con el texto "Guías sobre el precio de la luz (en precioluz.natural-apps.com)". Contacto y FAQ se quedan.
- **Pie:** sustituir el párrafo "proyecto independiente que busca simplificar... hojas de cálculo" por la frase de pie común (sección 2). Añadir enlace "Precio de la luz hoy" a la herramienta. "© 2026 Natural Apps" en vez de "© 2026 PrecioLuz".
- **Navegación:** el enlace "Guías" de la barra (aparece en index, faq, contact, privacy y terms) pasa a apuntar a la herramienta o se retira.
- **Capturas** (`assets/imagenes/precioluz_tap1.png`...): comprobar que son de la 1.71. Si son de la beta, pedir capturas nuevas a Jose Luis.

### 4.2 `faq_es.html` (y `faq.html` en inglés)

Sustituir las 12 preguntas actuales por estas 14. Son preguntas de **uso de la app**; lo que sea sobre precios enlaza a la herramienta.

1. **¿De dónde salen los precios?** De Red Eléctrica de España (ESIOS, archivo 70, PVPC 2.0TD), el dato oficial de la tarifa regulada. Sin comercializadoras ni comparadores detrás. Los precios de mañana se publican entre las 20:15 y las 20:20, hora peninsular. Más detalle: [A qué hora sale el precio de la luz de mañana](https://precioluz.natural-apps.com/a-que-hora-sale-el-precio-de-la-luz/).
2. **¿Cada cuánto se actualiza la app?** Una vez al día, cuando REE publica los precios de mañana. La app los descarga en segundo plano y guarda el histórico en el iPhone para el calendario y las comparativas. En pantalla tienes ayer, hoy y mañana.
3. **¿Cómo me avisa de la hora más barata?** Con tres avisos que activas en Ajustes. "Mejor hora del día" llega 5, 10, 15 o 30 minutos antes de la hora más barata, y te da el tramo entero si varias horas seguidas cuestan casi lo mismo. "Precios de mañana" llega a las 20:20 con la mejor hora del día siguiente. "Oferta puntual" avisa 15 minutos antes de una hora anormalmente barata. Son notificaciones locales del iPhone: no hay servidor, ni correo, ni cuenta.
4. **¿Qué widgets tiene?** "Precio ahora" (el precio de esta hora con su color), "Hoy — mejores y próximas", "2 h baratas" (el siguiente tramo de dos horas más barato, pensado para la lavadora y el lavavajillas) y widgets de pantalla de bloqueo y StandBy. Además, la Live Activity deja el precio actual y la mejor hora del día en la pantalla de bloqueo y en la Dynamic Island.
5. **¿Qué puedo pedirle a Siri?** "Lavadora barata en Precio de la Luz" y "Lavavajillas barato en Precio de la Luz": Siri responde con el mejor tramo de dos horas seguidas que queda hoy, su precio medio y cuánto se aleja de la media del día. También puedes pedirle el precio de la luz de ahora. Los atajos vienen listos en la app Atajos. Guía: [Cuándo poner la lavadora](https://precioluz.natural-apps.com/cuando-poner-la-lavadora/).
6. **¿Sirve si no tengo tarifa PVPC?** La app muestra el PVPC, la tarifa regulada. Si tienes una tarifa de mercado libre con precio fijo, tu precio no cambia por horas y la app te sirve como referencia del mercado, no de tu factura. Si tu tarifa es indexada, las horas baratas y caras coinciden en general con las del PVPC aunque el precio exacto sea otro.
7. **¿Controla mis electrodomésticos?** No. La app te dice cuándo, tú decides. No hay integración con enchufes ni con HomeKit. Lo más cerca de una automatización son los atajos de Siri, que puedes combinar en la app Atajos.
8. **¿Puedo exportar los datos?** La app no exporta CSV. Los mismos datos están públicos en JSON en la web: [datos de hoy](https://precioluz.natural-apps.com/data/hoy.json) y un fichero por día, y en el propio ESIOS de Red Eléctrica.
9. **¿En qué dispositivos funciona?** En iPhone con iOS 26 o posterior. Sin iPhone a mano, la web [precioluz.natural-apps.com](https://precioluz.natural-apps.com/) muestra los mismos precios en cualquier navegador. No hay versión para Android.
10. **¿Es gratis?** Sí. Sin anuncios, sin suscripción, sin compras dentro de la app y sin registro. Si te resulta útil, lo único que pedimos es una valoración en el App Store.
11. **¿Qué datos recoge?** Ninguno. La ficha del App Store dice "No se recopilan datos": no hay cuenta, no hay analítica dentro de la app y los avisos se calculan en el iPhone. Como no hay cuenta, no hay nada que borrar: desinstalar la app elimina todo.
12. **¿Funciona sin conexión?** Para descargar los precios hace falta conexión. Una vez descargados, los avisos saltan a su hora aunque no tengas red y los widgets siguen mostrando lo último que pintaron. Los precios de un día nuevo llegan cuando el iPhone vuelve a tener conexión.
13. **¿Qué hago si veo un dato incorrecto?** Compáralo con el archivo 70 de ESIOS, que es la fuente. Si sigue sin cuadrar, escríbenos a natural.learning.apps@gmail.com con la fecha y la hora y lo revisamos.
14. **¿Y las horas de Canarias, Ceuta y Melilla?** *(solo tras la compuerta C; hasta entonces: "En la próxima versión 1.72 podrás elegir zona...")* En Ajustes → Zona eliges Península, Baleares, Canarias, Ceuta o Melilla. Canarias ve las horas en su hora local y recibe los precios de mañana a las 19:20; Ceuta y Melilla tienen su propia serie de precios. Más: [Canarias](https://precioluz.natural-apps.com/canarias/) y [Ceuta y Melilla](https://precioluz.natural-apps.com/ceuta-melilla/).

Al final de la FAQ, un enlace: "¿Preguntas sobre el precio de la luz, los colores o la hora de publicación? Están en las [preguntas frecuentes de PrecioLuz](https://precioluz.natural-apps.com/preguntas-frecuentes/)".

Título y descripción: "Preguntas frecuentes de la app Precio Luz España PVPC · Natural Apps" / "Cómo avisa la app de la hora más barata, qué widgets y atajos de Siri tiene, en qué iPhone funciona y qué datos recoge (ninguno)."

Si se añade `FAQPage` en JSON-LD, las respuestas del JSON deben ser las mismas que se ven en la página.

### 4.3 `guides_es.html`, `guides.html`, `guides_en.html`: páginas puente

El contenido actual ("Entender la curva diaria", "Crear alertas inteligentes", "Planifica electrodomésticos") lo cubre mejor la herramienta y parte es falso (alertas configurables por canal).

- **Español:** redirección 301 en `PrecioLuz/.htaccess`: `Redirect 301 /PrecioLuz/guides_es.html https://precioluz.natural-apps.com/que-es-el-pvpc/`. Dejar además el fichero con `<meta http-equiv="refresh" content="0; url=https://precioluz.natural-apps.com/que-es-el-pvpc/">`, `<link rel="canonical" href="https://precioluz.natural-apps.com/que-es-el-pvpc/">` y `<meta name="robots" content="noindex">`, por si el hosting ignora el `.htaccess`.
- **Inglés:** la herramienta es solo en español, así que `guides.html` y `guides_en.html` se quedan como una página corta en inglés: "The guides moved to precioluz.natural-apps.com (in Spanish)", con el enlace, `noindex` y canónica a la herramienta.
- Las tres salen del `sitemap.xml`.
- Importante: `deploy.sh` no borra nada en el servidor (sin `--delete`). Un fichero borrado en local sigue publicado. Por eso se **sobrescribe** con la página puente, no se borra.

### 4.4 `llms.txt` raíz

Sustituir la entrada de PrecioLuz por esta (el fichero está en inglés):

```
- [PrecioLuz / Precio Luz España PVPC](https://www.natural-apps.com/PrecioLuz/index_es.html): iPhone app
  that alerts you before the cheapest electricity hour of the day in Spain (PVPC 2.0TD, official Red
  Eléctrica data), brings tomorrow's prices at 20:20, and adds widgets, Live Activity and Siri shortcuts.
  Free, no ads, no account, no data collected. iOS 26+. Spanish. The live prices, the cheapest hour,
  the monthly calendar and the guides are on its companion site
  https://precioluz.natural-apps.com/ (Spanish; machine-readable summary at
  https://precioluz.natural-apps.com/llms.txt; JSON at https://precioluz.natural-apps.com/data/hoy.json).
```

### 4.5 `sitemap.xml`

Quitar las seis URL `guides*.html` de PrecioLuz. Actualizar `lastmod` de `index*.html` y `faq*.html` al día del despliegue. No añadir URL de la herramienta: tiene su propio sitemap.

### 4.6 `robots.txt`

Nada obligatorio: ya permite todo. Si se quiere el mismo trato explícito a los rastreadores de IA que en la herramienta, copiar `docs/robots.txt` de precioluz-web (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot, Applebot-Extended, Bingbot, CCBot).

### 4.7 Hub raíz (`index.html`, `index_en.html` de natural-apps.com)

Opcional: la tarjeta de PrecioLuz del hub puede llevar un segundo enlace "Precio de la luz hoy" a la herramienta. Fuera de las páginas de PrecioLuz, esta sesión no tiene opinión.

### 4.8 `ads.html`

Existe en la carpeta y no sabemos qué es. Revisar si sigue teniendo sentido; si es una landing de anuncios, aplicar las mismas reglas de enlaces (3.1).

---

## 5. Bloques listos para pegar

### 5.1 JSON-LD para `index_es.html`

La valoración solo puede ir en JSON-LD si también se muestra en la página ("4,9 · 8 valoraciones en el App Store").

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.natural-apps.com/#organization",
      "name": "Natural Apps",
      "url": "https://www.natural-apps.com/",
      "email": "natural.learning.apps@gmail.com",
      "logo": { "@type": "ImageObject", "url": "https://www.natural-apps.com/apple-touch-icon.png" },
      "sameAs": ["https://precioluz.natural-apps.com/"]
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.natural-apps.com/PrecioLuz/#app",
      "name": "Precio Luz España PVPC",
      "alternateName": "PrecioLuz",
      "url": "https://www.natural-apps.com/PrecioLuz/index_es.html",
      "description": "El precio de la luz de hoy y de mañana por horas, la hora más barata y un aviso antes de que llegue. Widgets, pantalla de bloqueo, Live Activity y Siri. Gratis, sin anuncios y sin registro.",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "iOS 26.0 o posterior",
      "inLanguage": "es-ES",
      "isAccessibleForFree": true,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR", "availability": "https://schema.org/InStock" },
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "bestRating": "5", "worstRating": "1", "ratingCount": "8" },
      "installUrl": "https://apps.apple.com/es/app/precio-luz-espa%C3%B1a-pvpc/id6758021483",
      "downloadUrl": "https://apps.apple.com/es/app/precio-luz-espa%C3%B1a-pvpc/id6758021483",
      "screenshot": "https://www.natural-apps.com/PrecioLuz/assets/imagenes/precioluz_tap1.png",
      "author": { "@id": "https://www.natural-apps.com/#organization" },
      "publisher": { "@id": "https://www.natural-apps.com/#organization" },
      "featureList": [
        "Aviso Mejor hora del día (5, 10, 15 o 30 minutos antes)",
        "Aviso Precios de mañana a las 20:20",
        "Aviso Oferta puntual ante una hora anormalmente barata",
        "Widgets Precio ahora, Hoy — mejores y próximas, 2 h baratas, pantalla de bloqueo y StandBy",
        "Live Activity y Dynamic Island",
        "Atajos de Siri Lavadora barata y Lavavajillas barato",
        "Pestañas Día, Generación, Resumen y Calendario con datos oficiales de Red Eléctrica"
      ],
      "sameAs": [
        "https://precioluz.natural-apps.com/app/",
        "https://apps.apple.com/es/app/precio-luz-espa%C3%B1a-pvpc/id6758021483"
      ]
    }
  ]
}
</script>
```

Tras la compuerta C, añadir a `featureList`: "Zonas: Península, Baleares, Canarias (hora local), Ceuta y Melilla (precio propio)".

### 5.2 Smart App Banner (en todas las páginas de la carpeta PrecioLuz)

```html
<meta name="apple-itunes-app" content="app-id=6758021483">
```

### 5.3 Title, description, canónica y hreflang de `index_es.html`

```html
<title>Precio Luz España PVPC: app para iPhone con aviso de la hora más barata · Natural Apps</title>
<meta name="description" content="La app que te avisa antes de la hora más barata de la luz y te trae los precios de mañana a las 20:20. Widgets, Live Activity y Siri. Datos oficiales de Red Eléctrica. Gratis y sin anuncios.">
<link rel="canonical" href="https://www.natural-apps.com/PrecioLuz/index_es.html">
<link rel="alternate" hreflang="es" href="https://www.natural-apps.com/PrecioLuz/index_es.html">
<link rel="alternate" hreflang="en" href="https://www.natural-apps.com/PrecioLuz/index.html">
<link rel="alternate" hreflang="x-default" href="https://www.natural-apps.com/PrecioLuz/index.html">
```

### 5.4 Bloque de enlace a la herramienta (hero o sección propia)

```html
<a href="https://precioluz.natural-apps.com/" class="…">Ver el precio de la luz de hoy y de mañana</a>
<p>La misma información que la app, en el navegador: las 24 horas con su color, la hora más barata,
los precios de mañana desde las 20:20 y el calendario del mes. Sin registro.</p>
```

---

## 6. Opcional: cajita viva con el precio de hoy

GitHub Pages sirve los JSON con `Access-Control-Allow-Origin: *`, así que la landing puede leer `https://precioluz.natural-apps.com/data/hoy.json` desde el navegador, sin backend ni clave. El fichero pesa unos 2 KB y se regenera cada día a las 20:20 y de madrugada.

Esquema: `{ "source", "updated_at", "zone", "series", "unit": "€/kWh", "day": "YYYY-MM-DD", "timezone": "Europe/Madrid", "hours": [ { "start": "00:00", "end": "01:00", "eur_kwh": 0.18834 }, … ] }`.

```html
<p id="pl-hoy" hidden></p>
<script>
fetch("https://precioluz.natural-apps.com/data/hoy.json", { cache: "no-store" })
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(d => {
    const h = d.hours, f = v => v.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const min = h.reduce((a, b) => b.eur_kwh < a.eur_kwh ? b : a), max = h.reduce((a, b) => b.eur_kwh > a.eur_kwh ? b : a);
    const avg = h.reduce((s, x) => s + x.eur_kwh, 0) / h.length;
    const el = document.getElementById("pl-hoy");
    el.innerHTML = `Hoy la hora más barata es de ${min.start} a ${min.end} (${f(min.eur_kwh)} €/kWh), la más cara de ${max.start} a ${max.end} (${f(max.eur_kwh)} €/kWh) y la media ${f(avg)} €/kWh. <a href="https://precioluz.natural-apps.com/">Ver las 24 horas</a>`;
    el.hidden = false;
  })
  .catch(() => {});
</script>
```

Si falla la red, la cajita no aparece y la página no cambia. Solo tiene sentido tras la compuerta B.

---

## 7. Analítica: lo que hay que acordar

La sesión de la landing está instalando analítica en natural-apps.com. Para que las dos webs se midan juntas:

1. **Qué herramienta.** Anotar aquí cuál (GA4, Plausible, GoatCounter, otra). Si lleva cookies o huella, en la UE necesita aviso de consentimiento; la herramienta prefiere una sin cookies (GoatCounter estaba previsto) para no poner banner en una web que presume de "sin registro y sin anuncios". Decide Jose Luis si las dos webs comparten herramienta y propiedad.
2. **Eventos en la landing:** `appstore_click` (con el emplazamiento: hero, footer) y `precioluz_web_click` (con la URL de destino). Son los dos números que importan: cuántos van a la tienda y cuántos a la herramienta.
3. **Atribución en App Analytics:** solo funciona con el enlace de campaña de 3.1 (`pt` + `ct`). La búsqueda en la tienda y la URL con slug no atribuyen nada.
4. **Sin UTM hacia la herramienta** (sección 1). El clic se cuenta en la landing.

---

## 8. Orden de trabajo

1. **Ahora, en local:** todo lo de la sección 4 salvo los enlaces a la herramienta, que se dejan escritos pero comentados o detrás de la compuerta B. Los arreglos de la badge, las funciones reales, la FAQ, el JSON-LD y el smart banner no dependen de nada.
2. **Compuerta B** (`curl -sI https://precioluz.natural-apps.com/ | head -1` → 200): descomentar enlaces, guías puente, `llms.txt`, `sitemap.xml`.
3. **Despliegue:** `./deploy.sh` sin argumentos es un ensayo (rsync `--dry-run`) y enseña la lista de ficheros que cambiarían. Revisar que solo aparecen ficheros de `PrecioLuz/`, `llms.txt` y `sitemap.xml`. **`./deploy.sh --go` publica en producción y solo se lanza con el OK explícito de Jose Luis en esa misma conversación.** El script excluye `*.md`, `.claude/` y `*.zip`, así que este traspaso o un `CLAUDE.md` nunca suben al servidor.
4. Si B se retrasa más de un día, se puede hacer un primer despliegue solo con el punto 1 (la badge rota pierde instalaciones cada día) y un segundo con el punto 2.
5. **Compuerta C** (1.72 publicada): añadir zonas en hero, FAQ 14 y `featureList`, y actualizar `ratingCount` si ha cambiado.

---

## 9. Verificación final (tras `--go`)

```bash
curl -s https://www.natural-apps.com/PrecioLuz/index_es.html | grep -o 'apps\.apple\.com[^"]*' | sort -u
```
Esperado: solo `apps.apple.com/es/app/precio-luz-espa%C3%B1a-pvpc/id6758021483` (o el enlace de campaña con `ct=landing`).

```bash
curl -sI https://www.natural-apps.com/PrecioLuz/guides_es.html | grep -i -E '^(HTTP|location)'
```
Esperado: `301` y `location: https://precioluz.natural-apps.com/que-es-el-pvpc/`.

```bash
curl -s https://www.natural-apps.com/sitemap.xml | grep -c guides
```
Esperado: `0`.

```bash
curl -s https://www.natural-apps.com/llms.txt | grep -c 'precioluz.natural-apps.com'
```
Esperado: `1` o más.

- Pegar `https://www.natural-apps.com/PrecioLuz/index_es.html` en https://validator.schema.org/ : sin errores; `SoftwareApplication` y `Organization` detectados.
- Abrir la landing en un iPhone con Safari: aparece el Smart App Banner de la app.
- Todos los enlaces a `precioluz.natural-apps.com` responden 200 (`curl -sI` a cada uno).
- La FAQ publicada no contiene "correo", "CSV", "HomeKit", "premium", "cuenta" ni "beta" (`curl -s … | grep -i -c -E 'csv|homekit|premium|beta'` → `0`).
- A los pocos días, App Analytics muestra la campaña `landing` (si hay `pt`) y la analítica de la landing registra `precioluz_web_click`.

---

## 10. Fuera de alcance de la sesión de la landing

- No editar nada en `~/Documents/websites/precioluz-web` ni en su repo. Si falta algo en la herramienta (una página, un JSON, un texto), se anota en la sección 11 y lo hace la sesión de la herramienta.
- No crear el registro DNS ni tocar GitHub Pages: DNS lo hace Jose Luis en Hostinger; Pages ya está configurado.
- No tocar la ficha de la App Store (descripción, keywords, Marketing URL): va con la 1.72 y lo hace Jose Luis.
- No lanzar `deploy.sh --go` sin OK explícito.

---

## 11. Dudas y cambios propuestos por la sesión de la landing

(Escribir aquí, con fecha. La sesión de la herramienta lo lee antes de cada cambio suyo.)

### 22/09/2026, 21:05 — sesión de la landing

Secciones 4.1 a 4.5 y 4.8 hechas **en local**. Nada desplegado: `deploy.sh --go` no se ha
lanzado y sigue esperando el OK de Jose Luis.

**Compuerta B: sigue cerrada, y por una razón distinta a la que suponía el documento.**
El CNAME ya existe y resuelve (`precioluz → joseluisarias.github.io` en los dos
nameservers y en los resolvers públicos), y el sitio **funciona y sirve contenido real
por HTTP**. Lo que falta es el certificado: GitHub Pages presenta todavía su
`CN=*.github.io`, así que cualquier `https://` da error de validación. La compuerta,
tal como está redactada ("200 **con certificado válido**"), se comporta bien: si la
landing enlazara hoy, el visitante vería un aviso de seguridad del navegador, peor que
un 404. Estado comprobado a las 21:05. Hay un vigilante esperando la emisión.

**Cero enlaces vivos a la herramienta**, como manda 8.1: 12 comentados en cada `index`,
5 en cada FAQ, el `Redirect 301` de `PrecioLuz/.htaccess` comentado. Todos marcados
`COMPUERTA B` para activarlos de golpe.

#### Lo que necesitamos de la sesión de la herramienta o de Jose Luis

1. **Capturas de la 1.71 (bloqueante para 4.1).** Las de `assets/imagenes/precioluz_tap*`
   son de enero: muestran la barra inferior con **tres** pestañas, sin Generación, datos
   del 19/01/2026 y decimales con punto. De ahí salían las "cifras inventadas" que 4.1
   manda quitar. Se han conservado con una nota honesta en página ("los precios que
   aparecen son los del día en que se tomaron"), pero **no existe ninguna captura de la
   pestaña Generación**, que por eso es la única tarjeta sin imagen. Hacen falta cuatro
   capturas nuevas de la 1.71, una por pestaña.

2. **`pt` (provider token) de App Store Connect**, para el enlace de campaña de 3.1.
   Mientras no esté, la landing usa la URL con slug. Sin `pt` no hay atribución en App
   Analytics y no se sabrá cuántas instalaciones vienen de aquí.

3. **Decisión sobre `sameAs` del JSON-LD.** El bloque 5.1 incluye dos URL vivas a
   `precioluz.natural-apps.com` (`/` y `/app/`). Es el único sitio donde el dominio
   aparece sin comentar, y choca con "ningún enlace vivo antes de B". No es navegable,
   pero un rastreador que lo siga hoy se encuentra el certificado inválido. Está puesto
   tal como lo manda el documento; se quita en un minuto si se prefiere.

#### Correcciones al documento

4. **4.5 dice "las seis URL `guides*.html`"; en el sitemap solo había dos de PrecioLuz**
   (`guides.html` y `guides_es.html`; `guides_en.html` nunca estuvo). Las otras cuatro
   `guides` del fichero son de **NaturalEnglish y MD Reader**, apps distintas con guías
   reales, y no se han tocado. Conviene ajustar la verificación de la sección 9: el
   `grep -c guides` → `0` solo se cumpliría borrando contenido bueno de otras dos apps.
   Sitemap: 38 → 36 URL, `xmllint` válido.

5. **La causa real de la badge rota no era el HTML, era JavaScript.**
   `shared/company-theme.js` tiene `normalizeInstallLinks()`, que reescribe en el
   navegador **todos** los `<a>` con `apps.apple.com` de cada página usando el
   `installUrl` de su marca. Los tres valores publicados eran búsquedas en la tienda de
   EE. UU. y **los tres devolvían 404**, en las tres apps del sitio, no solo en
   PrecioLuz. Es decir: arreglar el `href` de la badge en el HTML no bastaba, el JS lo
   machacaba al cargar. **Ya corregido y desplegado** (22/09 20:55) con las tres URL
   canónicas, verificado en navegador con el script ejecutado:

   - naturalenglish → `https://apps.apple.com/es/app/english-vocabulary-b1-b2-c1-c2/id6742079970`
   - precioluz → `https://apps.apple.com/es/app/precio-luz-espa%C3%B1a-pvpc/id6758021483`
   - mdreader → `https://apps.apple.com/es/app/markdown-reader-editor-md/id6758854494`

   Nota para la verificación de la sección 9: el `curl | grep` sobre el HTML **no
   detecta** este fallo, porque mira el marcado, no el DOM. Si se vuelve a tocar ese
   fichero, hay que comprobarlo con el JS ejecutado.

6. **`ads.html` es una landing de campaña de pago**, no una página del sitio: no está
   enlazada desde ninguna parte ni en el sitemap, se pega como URL de destino del
   anuncio. Existe igual en MDReader y NaturalEnglish. Corregido su enlace a la tienda.
   Antes de usarla en una campaña necesita las capturas nuevas (punto 1), ajustar su
   texto a las funciones reales de la sección 2 y decidir si lleva `noindex`, porque
   duplica la landing y hoy no lo lleva.

#### Dudas menores, con la decisión que se ha tomado

7. **Canónica de `guides.html` / `guides_en.html`**: 4.3 dice "canónica a la herramienta"
   sin decir a cuál. Se ha puesto `/que-es-el-pvpc/`, igual que la española. Las inglesas
   **no** llevan `meta refresh`: la herramienta es solo en español y mandar a un
   anglófono a una página en español es peor que dejarle decidir.
8. **`faq_en.html` no existe** (sí existen `index_en.html`, `guides_en.html`,
   `terms_en.html`). No se ha creado. ¿Hace falta ese duplicado?
9. **Nombres en español dentro de la FAQ inglesa**: se han mantenido "Mejor hora del
   día", "2 h baratas", "Lavadora barata en Precio de la Luz" con glosa en inglés entre
   paréntesis, porque una frase de Siri traducida no funcionaría. Si la app está
   localizada al inglés, hay que sustituirlos.
10. **Redacción de la pregunta 14 bajo compuerta C**: el documento solo da los puntos
    suspensivos. Se ha completado con los hechos de la sección 2 y cerrado con "La 1.72
    todavía no está publicada en el App Store: la versión actual muestra los precios
    peninsulares". Debajo queda comentada la respuesta definitiva. Necesita visto bueno.
11. **Verificación de la sección 9, matiz**: `grep -i -c -E 'csv|homekit|premium|beta'`
    devuelve 4, no 0. Son cuatro negaciones, texto literal del documento ("No hay
    integración con enchufes ni con HomeKit", "La app no exporta CSV"), duplicadas
    porque 4.2 obliga a que el JSON-LD sea idéntico al texto visible. Ninguna aparición
    afirmativa: "premium" y "beta" han desaparecido.
12. **Smart App Banner incompleto**: 5.2 dice "todas las páginas de la carpeta" y está
    en los tres `index` y las dos FAQ. Faltan `contact*`, `privacy*`, `terms*` y
    `ads.html`. El enlace "Guías" de la navegación también sigue vivo en esas páginas.

#### Fuera del traspaso, hecho en natural-apps.com el 22/09

Por si afecta a lo que la sesión de la herramienta espera encontrar:

- **Las cuatro URL de 3.3 siguen intactas y responden 200**: `/PrecioLuz/privacy_es.html`,
  `/terms_es.html`, `/contact_es.html` y `/`. Se cambiaron las reglas de redirección
  legales del `.htaccess` raíz, pero están ancladas a la raíz (`^privacy_es\.html$`), así
  que no tocan nada bajo `/PrecioLuz/`. Verificado.
- **Todas las imágenes del sitio son ahora `.webp`** (94 MB → 6,5 MB). Los `.png` y
  `.jpg` originales ya no están en el docroot; se conservan en
  `/home/deco4048/originales-imagenes-20260922/`. Si algún documento o script de la
  herramienta apunta a una imagen de la landing por su nombre `.png`, hay que
  actualizarlo. Se conservan como PNG los favicons, los `apple-touch-icon` y las
  imágenes `og/`.
- **`.htaccess`**: bloqueo de archivos comprimidos y de copias de seguridad.
- **`deploy.sh`**: el sondeo del raíz caía en `~/public_html`, que es **otro dominio**
  (decoraciondeaticos.com); ahora exige que el directorio contenga `NaturalEnglish/` y
  `shared/`. Además excluye `*.bak-*`, `*.pre-webp` y `*.orig`, que si no se publicaban.

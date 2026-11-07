# Veggie Coruña: dónde comer vegetariano y vegano en A Coruña

Directorio estático de restaurantes veganos, vegetarianos y con opciones vegetales de A Coruña, hecho con
**Astro 7** y **islas de Vue 3**. Mapa con **Leaflet + OpenStreetMap** (sin claves de API).

Cada restaurante tiene: tipo de dieta (100 % vegano, carta vegana amplia u opciones), cocina, barrio,
precio, horario estructurado (con «abierto ahora»), teléfono para reservar, web/carta si existen,
nota de referencia y enlaces a las reseñas, paradas y líneas de bus cercanas, dificultad para aparcar
y su ubicación en el mapa.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # valida los datos y genera dist/
```

## Estructura

```
src/
  data/
    restaurantes.json   ← la fuente de verdad: edita aquí para añadir o corregir locales
    barrios.json        ← nombre del barrio y estimación de aparcamiento por zona
    transporte.json     ← generado por script (no editar a mano)
  lib/                  ← tipos, etiquetas, cálculo de horario y carga de datos
  components/
    Directorio.vue      ← buscador, filtros (sincronizados con la URL), lista y mapa
    Mapa.vue            ← Leaflet con marcadores en forma de «medidor de hojas»
    Medidor.vue         ← indicador de cuánto de la carta es vegetal
    EstadoAhora.vue     ← abierto/cerrado según la hora de Madrid
  pages/
    index.astro                ← portada con el directorio
    restaurante/[id].astro     ← una ficha estática por restaurante
    acerca.astro               ← metodología y fuentes
scripts/
  validar-datos.mjs     ← se ejecuta antes de cada build
  geocodificar.mjs      ← afina coordenadas con Nominatim
  transporte.mjs        ← paradas y líneas de bus a partir del GTFS oficial
```

## Pasos pendientes con datos reales

Estos dos scripts necesitan internet, así que ejecútalos en tu máquina:

1. **Coordenadas.** `npm run data:geocodificar`. Rellena las 4 entradas sin ubicar y afina las
   aproximadas (las que tienen `"exactas": false`, que se pintan con borde discontinuo). Revisa el
   resultado en el mapa; si un portal no está en OpenStreetMap, corrige a mano en `restaurantes.json`.
2. **Bus urbano.** `npm run data:transporte`. Descarga el GTFS de la Compañía de Tranvías de La Coruña
   desde Mobility Database y guarda, para cada restaurante, hasta 3 paradas a menos de 400 m y sus
   líneas. Si la descarga falla, baja el ZIP desde el Punto de Acceso Nacional
   (nap.transportes.gob.es, registro gratuito) y pásalo: `npm run data:transporte -- ruta/gtfs.zip`.
   Ejecuta primero el paso 1: el cálculo depende de las coordenadas.

Después, `npm run build`.

## Mantener los datos

- **Verifica antes de publicar.** Los datos se recopilaron en noviembre de 2026 (HappyCow, prensa
  local y webs de los locales). Horarios, teléfonos y precios cambian: confírmalos con cada local.
- Las descripciones son propias. No se copian reseñas de terceros; la ficha enlaza a Google Maps y
  HappyCow. Si quieres mostrar reseñas en vivo, la vía legal es la API de Google Places (de pago y con
  sus condiciones de atribución) o un sistema de reseñas propio con backend.
- Locales excluidos por cierre o traspaso: A Pastar, Utopía, Ruca Bocata, El Rincón de Alba,
  Taberna Gaia y A Factoría Verde.
- Fuera del municipio, pendiente de reincorporar si se amplía la zona: **La Novena** (Rúa Ícaro, 34,
  Liáns, Oleiros).
- `npm run data:validar` comprueba ids, dietas, barrios, formato de teléfono, horas y que las
  coordenadas caigan dentro de A Coruña.

### Añadir un restaurante

Copia una entrada de `restaurantes.json`. Campos clave:

| Campo | Valores |
|---|---|
| `dieta` | `vegano`, `vegetariano`, `carta-vegana`, `opciones` |
| `barrio` | una clave de `barrios.json` |
| `precio` | `1` (€), `2` (€€), `3` (€€€) |
| `horario` | `{ "lun": [["13:00","16:00"],["20:00","23:30"]], … }`; si el cierre es menor que la apertura, cruza la medianoche |
| `servicios` | `terraza`, `para-llevar`, `domicilio`, `pet-friendly`, `sin-gluten`, `accesible`, `wifi` |
| `coords` | `{ "lat", "lng", "exactas" }` o `null` |

## Predicción de afluencia (idea para más adelante)

Por ahora no está en la web (se quitó el bloque «Cuánta gente habrá» de la ficha hasta tener datos). No existe una fuente pública con la ocupación
real de los locales, así que el modelo necesita datos propios. Propuesta:

1. **Recogida.** Un botón en la ficha («¿Cuánta gente hay ahora?»: vacío / normal / lleno) que guarde
   restaurante, día, hora y respuesta en una base de datos sencilla (Supabase, Cloudflare D1…).
2. **Variables.** Día de la semana, hora, festivo local o nacional (San Xoán, Semana Santa, Navidad),
   lluvia y temperatura (MeteoGalicia tiene datos abiertos), partido del Dépor en Riazor, eventos en
   el Coliseum o Palexco, y si el local abre a esa hora.
3. **Modelo.** Con pocos datos, un gradient boosting (LightGBM) o incluso una regresión ordinal por
   franja horaria funciona mejor que una red neuronal. Hasta tener datos suficientes de un local, usar
   un perfil por tipo (taberna, cafetería, pizzería para llevar) como valor por defecto.
4. **Servir.** Precalcular las predicciones de la semana en un JSON (`src/data/afluencia.json`) y
   pintarlas como una barra por hora en la ficha. No hace falta servidor.

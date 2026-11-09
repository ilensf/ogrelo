# O Grelo: dónde comer vegetariano y vegano en Galicia

Directorio estático de restaurantes veganos, vegetarianos y con opciones vegetales de Galicia, hecho con
**Astro 7** y **islas de Vue 3**. Mapa con **Leaflet + OpenStreetMap** (sin claves de API).

Cada restaurante tiene: nivel de oferta vegetal, cocina, ciudad, precio, horario estructurado (con
«abierto ahora»), teléfono para reservar, web/carta si existen y su ubicación en el mapa. Donde hay
datos, también barrio, aparcamiento y paradas de bus cercanas.

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
    restaurantes.json   ← la fuente de verdad, en castellano: edita aquí para añadir o corregir locales
    restaurantes.gl.json, barrios.gl.json ← traducciones al gallego de los textos de cada ficha
    ciudades.json       ← ciudades, su centro y su GTFS si lo hay
    barrios.json        ← barrios y aparcamiento (por ahora solo A Coruña)
    transporte.json     ← generado por script (no editar a mano)
  i18n/                 ← textos de la interfaz: gl.ts y es.ts
  lib/                  ← tipos, etiquetas, cálculo de horario y carga de datos
  components/
    PaginaDirectorio.astro, PaginaFicha.astro, PaginaAcerca.astro ← pantallas comunes a los dos idiomas
    Directorio.vue      ← buscador, filtros (sincronizados con la URL), lista y mapa
    Mapa.vue            ← Leaflet con marcadores en forma de «medidor de hojas»
    Medidor.vue         ← indicador de cuánto de la carta es vegetal
    EstadoAhora.vue     ← abierto/cerrado según la hora local
  pages/                ← rutas en gallego, el idioma por defecto; es/ repite las mismas en castellano
    index.astro                ← toda Galicia
    [ciudad].astro             ← una página por ciudad con locales
    restaurante/[id].astro     ← una ficha estática por restaurante
    acerca.astro               ← metodología y fuentes
scripts/
  validar-datos.mjs     ← se ejecuta antes de cada build
  geocodificar.mjs      ← afina coordenadas con Nominatim
  transporte.mjs        ← paradas y líneas de bus a partir del GTFS de cada ciudad
```

## Criterio de inclusión

| `dieta` | Regla |
|---|---|
| `vegano` | Todo lo que sirven es vegetal |
| `vegetariano` | Sin carne ni pescado |
| `carta-vegana` | Sirven carne, pero buena parte de la carta es vegetal |
| `buenas-opciones` | Al menos 3 platos veganos con los que hacer una comida, sean principales o raciones |
| `alguna-opcion` | Uno o dos platos veganos, o platos adaptables sin confirmar |

Lo adaptable solo cuenta para `buenas-opciones` si el local lo confirma. `alguna-opcion` sale oculta por
defecto, salvo al buscar por texto, activar su filtro o estar en una ciudad donde no haya nada mejor.

## Mantener los datos

- **Verifica antes de publicar.** Horarios, teléfonos y precios cambian: confírmalos con cada local.
- Las fichas con `"borrador": true` proceden solo de fuentes web. El campo no se muestra en la web: sirve
  para saber cuáles faltan por confirmar. Quítalo al hablar con el local. `npm run data:validar` lista las
  pendientes. Si falta un dato, déjalo en `null` (o `{}` en el horario); la web oculta lo que no se conoce.
- Las descripciones son propias. No se copian reseñas de terceros; la ficha enlaza a Google Maps y
  HappyCow. Si quieres mostrar reseñas en vivo, la vía legal es la API de Google Places (de pago y con
  sus condiciones de atribución) o un sistema de reseñas propio con backend.
- Locales excluidos por cierre o traspaso en A Coruña: A Pastar, Utopía, Ruca Bocata, El Rincón de Alba,
  Taberna Gaia y A Factoría Verde. En el resto, por indicios de cierre: Contracorriente/Deliveggie, Lusco
  Fusco y Bar Ideas (Ourense); Entre Pedras, Malak Bistro y Boca a Boca (Santiago); Veggie Burger y
  Kastami'S (Vigo); Cafetería Capitol (Ferrol); Legends Cafe (Lugo). Conviene comprobarlos: algunas fuentes
  se contradicen.
- Fuera del municipio, pendiente de reincorporar: **La Novena** (Rúa Ícaro, 34, Liáns, Oleiros).

### Añadir un restaurante

Copia una entrada de `restaurantes.json` y añade su traducción en `restaurantes.gl.json` (hasta entonces,
la ficha sale en castellano y `npm run data:validar` lo avisa). Después ejecuta `npm run data:geocodificar`
si no tiene coordenadas y `npm run data:transporte` si su ciudad tiene GTFS. Campos clave:

| Campo | Valores |
|---|---|
| `id` | kebab-case y único; en ciudades nuevas, termina en la ciudad (`curcuma-vigo`) |
| `ciudad` | una clave de `ciudades.json` |
| `barrio` | una clave de `barrios.json`, o `null` |
| `dieta` | ver el criterio de inclusión |
| `precio` | `1` (€), `2` (€€), `3` (€€€) o `null` si no se conoce |
| `horario` | `{ "lun": [["13:00","16:00"],["20:00","23:30"]], … }`; si el cierre es menor que la apertura, cruza la medianoche. `{}` si no se conoce |
| `servicios` | `terraza`, `para-llevar`, `domicilio`, `pet-friendly`, `sin-gluten`, `accesible`, `wifi` |
| `coords` | `{ "lat", "lng", "exactas" }` o `null` |

### Añadir el bus de una ciudad

Pon su feed en `gtfs` dentro de `ciudades.json` y ejecuta `npm run data:transporte -- --ciudad <clave>`.
Los feeds están en Mobility Database y en el Punto de Acceso Nacional (nap.transportes.gob.es, registro
gratuito). Con un ZIP descargado a mano: `npm run data:transporte -- --ciudad <clave> ruta/gtfs.zip`.

## Predicción de afluencia (idea para más adelante)

Por ahora no está en la web (se quitó el bloque «Cuánta gente habrá» de la ficha hasta tener datos). No existe una fuente pública con la ocupación
real de los locales, así que el modelo necesita datos propios. Propuesta:

1. **Recogida.** Un botón en la ficha («¿Cuánta gente hay ahora?»: vacío / normal / lleno) que guarde
   restaurante, día, hora y respuesta en una base de datos sencilla (Supabase, Cloudflare D1…).
2. **Variables.** Día de la semana, hora, festivo local o nacional, lluvia y temperatura (MeteoGalicia
   tiene datos abiertos), partidos, grandes eventos y si el local abre a esa hora.
3. **Modelo.** Con pocos datos, un gradient boosting (LightGBM) o incluso una regresión ordinal por
   franja horaria funciona mejor que una red neuronal. Hasta tener datos suficientes de un local, usar
   un perfil por tipo (taberna, cafetería, pizzería para llevar) como valor por defecto.
4. **Servir.** Precalcular las predicciones de la semana en un JSON (`src/data/afluencia.json`) y
   pintarlas como una barra por hora en la ficha. No hace falta servidor.

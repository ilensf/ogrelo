<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LayerGroup, Map as LMap, Marker, TileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { textos, type Idioma } from '../i18n';
import { DIETAS } from '../lib/etiquetas';
import type { Dieta } from '../lib/tipos';

export interface PuntoMapa {
  id: string;
  nombre: string;
  dieta: Dieta;
  lat: number;
  lng: number;
  exactas: boolean;
  url?: string;
}

const props = withDefaults(
  defineProps<{
    puntos: PuntoMapa[];
    idioma: Idioma;
    resaltado?: string | null;
    zoom?: number;
    interactivo?: boolean;
    /** Pide centrar el mapa en un sitio; `n` cambia en cada petición para poder repetirla. */
    enfocar?: { id: string; n: number } | null;
  }>(),
  { resaltado: null, zoom: 15, interactivo: true, enfocar: null },
);
const emit = defineEmits<{ seleccionar: [id: string] }>();
const t = textos(props.idioma);

const contenedor = ref<HTMLElement | null>(null);
const dietasPresentes = computed(() => DIETAS.filter((d) => props.puntos.some((p) => p.dieta === d)));
let mapa: LMap | null = null;
let L: typeof import('leaflet') | null = null;
let capa: LayerGroup | null = null;
let teselas: TileLayer | null = null;
const marcadores = new Map<string, Marker>();

const CENTRO_GALICIA: [number, number] = [42.8, -8.0];
/** Distancia en píxeles bajo la cual dos sitios se agrupan en un solo círculo. */
const RADIO_AGRUPAR = 36;
/** Desde este zoom no se agrupa nada: los sitios muy próximos ya se distinguen. */
const ZOOM_SIN_AGRUPAR = 17.5;
/** A partir de este zoom se muestra el nombre junto a cada marcador. */
const ZOOM_ETIQUETAS = 16;

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const HOJA =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2C6 7 4 12 5.5 17c1 3.3 3.8 5 6.5 5s5.5-1.7 6.5-5C20 12 18 7 12 2z" fill="currentColor"/></svg>';

function icono(p: PuntoMapa, activo: boolean, etiqueta: boolean) {
  return L!.divIcon({
    className: 'marcador-veg',
    html:
      `<span class="pin d-${p.dieta} ${activo ? 'activo' : ''} ${p.exactas ? '' : 'aprox'}">${HOJA}</span>` +
      (etiqueta || activo ? `<span class="pin-nombre">${escapar(p.nombre)}</span>` : ''),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const COLOR_DIETA: Record<Dieta, string> = {
  vegano: 'var(--c-vegano-p)',
  vegetariano: 'var(--c-vegetariano-p)',
  'carta-vegana': 'var(--c-carta-p)',
  'buenas-opciones': 'var(--c-opciones-p)',
  'alguna-opcion': 'var(--c-alguna-p)',
};

/** Anillo con un tramo de color por cada tipo de sitio, proporcional a cuántos hay en el grupo. */
function anilloGrupo(items: PuntoMapa[]) {
  let acumulado = 0;
  const tramos = DIETAS.flatMap((d) => {
    const n = items.filter((p) => p.dieta === d).length;
    if (!n) return [];
    const inicio = (acumulado / items.length) * 360;
    acumulado += n;
    return `${COLOR_DIETA[d]} ${inicio}deg ${(acumulado / items.length) * 360}deg`;
  });
  return `conic-gradient(${tramos.join(', ')})`;
}

function iconoGrupo(items: PuntoMapa[]) {
  const n = items.length;
  const lado = n < 5 ? 34 : n < 15 ? 38 : 42;
  return L!.divIcon({
    className: 'marcador-veg',
    html: `<span class="grupo-pin" style="background:${anilloGrupo(items)}"><span>${n}</span></span>`,
    iconSize: [lado, lado],
    iconAnchor: [lado / 2, lado / 2],
  });
}

function popup(p: PuntoMapa) {
  const aviso = p.exactas ? '' : `<span class="pop-aviso">${t.mapa.aproximada}</span>`;
  const enlace = p.url ? `<a class="pop-enlace" href="${p.url}">${t.mapa.verFicha}</a>` : '';
  return `<strong>${escapar(p.nombre)}</strong><span class="pop-dieta d-${p.dieta}">${t.dietas[p.dieta].nombre}</span>${aviso}${enlace}`;
}

/** Agrupa por cercanía en pantalla (a este zoom) los sitios que se pisarían. */
function agrupar(zoom: number): PuntoMapa[][] {
  const grupos: { x: number; y: number; items: PuntoMapa[] }[] = [];
  for (const p of props.puntos) {
    const pt = mapa!.project([p.lat, p.lng], zoom);
    const g = p.id === props.resaltado
      ? undefined
      : grupos.find((g) => g.items[0].id !== props.resaltado && Math.hypot(g.x - pt.x, g.y - pt.y) < RADIO_AGRUPAR);
    if (g) {
      g.items.push(p);
      g.x = (g.x * (g.items.length - 1) + pt.x) / g.items.length;
      g.y = (g.y * (g.items.length - 1) + pt.y) / g.items.length;
    } else {
      grupos.push({ x: pt.x, y: pt.y, items: [p] });
    }
  }
  return grupos.map((g) => g.items);
}

function dibujar() {
  if (!mapa || !L || !capa) return;
  capa.clearLayers();
  marcadores.clear();
  const zoom = mapa.getZoom();
  const grupos = props.interactivo && zoom < ZOOM_SIN_AGRUPAR ? agrupar(zoom) : props.puntos.map((p) => [p]);
  for (const items of grupos) {
    if (items.length === 1) {
      const p = items[0];
      const m = L.marker([p.lat, p.lng], {
        icon: icono(p, p.id === props.resaltado, zoom >= ZOOM_ETIQUETAS && props.interactivo),
        title: p.nombre,
        keyboard: props.interactivo,
        riseOnHover: true,
        zIndexOffset: p.id === props.resaltado ? 1000 : 0,
      }).addTo(capa);
      if (props.interactivo) {
        m.bindPopup(popup(p), { closeButton: false, offset: [0, -8] });
        m.on('click', () => emit('seleccionar', p.id));
      }
      marcadores.set(p.id, m);
    } else {
      const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
      const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
      const m = L.marker([lat, lng], {
        icon: iconoGrupo(items),
        title: t.mapa.grupo(items.length, items.map((p) => p.nombre).join(', ')),
        riseOnHover: true,
      }).addTo(capa);
      m.on('click', () => {
        const caja = L!.latLngBounds(items.map((p) => [p.lat, p.lng] as [number, number]));
        mapa!.flyToBounds(caja, { padding: [60, 60], maxZoom: 18, duration: 0.5 });
      });
      m.on('keypress', (e) => {
        if ((e.originalEvent as KeyboardEvent).key === 'Enter') m.fire('click');
      });
    }
  }
}

function encuadrar() {
  if (!mapa || !L) return;
  if (props.puntos.length === 1) {
    mapa.setView([props.puntos[0].lat, props.puntos[0].lng], props.zoom);
  } else if (props.puntos.length > 1) {
    mapa.fitBounds(L.latLngBounds(props.puntos.map((p) => [p.lat, p.lng])), { padding: [24, 24], maxZoom: 16, animate: false });
  }
}

function pintar() {
  encuadrar();
  dibujar();
}

function ponerTeselas() {
  if (!mapa || !L) return;
  teselas?.remove();
  teselas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);
}

function reencuadrar() {
  mapa?.closePopup();
  encuadrar();
}

onMounted(async () => {
  L = await import('leaflet');
  if (!contenedor.value) return;
  mapa = L.map(contenedor.value, {
    center: CENTRO_GALICIA,
    zoom: 8,
    zoomSnap: 0.5,
    scrollWheelZoom: props.interactivo,
    wheelPxPerZoomLevel: 100,
    dragging: props.interactivo,
    zoomControl: false,
    attributionControl: true,
  });
  if (props.interactivo) L.control.zoom({ position: 'bottomright' }).addTo(mapa);
  mapa.attributionControl.setPrefix(false);
  ponerTeselas();
  capa = L.layerGroup().addTo(mapa);
  mapa.on('zoomend', dibujar);
  pintar();
  // Si el mapa nace oculto (vista de lista en móvil) mide 0 px: se reencuadra al mostrarse.
  observador = new ResizeObserver(() => {
    if (!mapa || !contenedor.value?.clientWidth) return;
    mapa.invalidateSize();
    if (!encuadrado) {
      encuadrado = true;
      encuadrar();
    }
  });
  observador.observe(contenedor.value);
});

watch(() => props.puntos.map((p) => p.id).join(), pintar);
watch(
  () => props.resaltado,
  (nuevo, viejo) => {
    if (!L || !mapa) return;
    // Si el sitio resaltado estaba dentro de un grupo, hay que reagrupar para sacarlo.
    const oculto = nuevo && !marcadores.has(nuevo);
    if (oculto || !props.interactivo) return dibujar();
    const etiquetas = mapa.getZoom() >= ZOOM_ETIQUETAS;
    for (const id of [nuevo, viejo]) {
      if (!id) continue;
      const m = marcadores.get(id);
      const p = props.puntos.find((x) => x.id === id);
      if (m && p) {
        m.setIcon(icono(p, id === nuevo, etiquetas));
        m.setZIndexOffset(id === nuevo ? 1000 : 0);
      }
    }
    // Al volver al estado normal, algún sitio suelto puede volver a agruparse.
    if (viejo && !nuevo) dibujar();
  },
);

watch(
  () => props.enfocar,
  (e) => {
    const p = e && props.puntos.find((x) => x.id === e.id);
    if (!p || !mapa) return;
    mapa.invalidateSize();
    mapa.flyTo([p.lat, p.lng], Math.max(mapa.getZoom(), ZOOM_SIN_AGRUPAR), { duration: 0.6 });
    mapa.once('moveend', () => marcadores.get(p.id)?.openPopup());
  },
);

let observador: ResizeObserver | null = null;
let encuadrado = false;

onBeforeUnmount(() => {
  observador?.disconnect();
  mapa?.remove();
});
</script>

<template>
  <div class="envoltorio">
    <div ref="contenedor" class="mapa" role="region" :aria-label="t.mapa.region"></div>
    <button v-if="interactivo && puntos.length > 1" type="button" class="reencuadrar" @click="reencuadrar">
      {{ t.mapa.verTodos }}
    </button>
    <ul v-if="interactivo" class="leyenda" :aria-label="t.mapa.leyenda">
      <li v-for="d in dietasPresentes" :key="d" :class="`d-${d}`"><span class="punto"></span>{{ t.dietas[d].corto }}</li>
    </ul>
  </div>
</template>

<style scoped>
.envoltorio {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 260px;
  border-radius: var(--radio);
  overflow: hidden;
  border: 1px solid var(--linea);
  box-shadow: var(--sombra);
  isolation: isolate;
}
.mapa {
  width: 100%;
  height: 100%;
  background: var(--granito-hondo);
  z-index: 0;
  font-family: var(--fuente);
}

.reencuadrar,
.leyenda {
  position: absolute;
  z-index: 500;
  background: color-mix(in srgb, var(--papel) 88%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid var(--linea);
  box-shadow: var(--sombra);
}
.reencuadrar {
  top: 12px;
  right: 12px;
  min-height: 36px;
  padding: 0 0.9em;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--tinta);
  border-radius: 999px;
  cursor: pointer;
}
.reencuadrar:hover {
  background: var(--papel);
}
.leyenda {
  left: 12px;
  bottom: 24px;
  margin: 0;
  padding: 0.5rem 0.7rem;
  list-style: none;
  display: grid;
  gap: 0.25rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--tinta);
  border-radius: 12px;
}
.leyenda li {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
.punto {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--d-punto);
}

/* Teselas de OSM más suaves, para que los marcadores destaquen */
:deep(.leaflet-tile-pane) {
  filter: saturate(0.7) contrast(0.95) brightness(1.03);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) :deep(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) saturate(0.55) brightness(0.85) contrast(0.9);
  }
}
:root[data-theme='dark'] :deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) saturate(0.55) brightness(0.85) contrast(0.9);
}

/* Marcadores */
:deep(.pin) {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #fff;
  color: #fff;
  background: var(--d-punto);
  box-shadow: 0 2px 6px rgba(25, 22, 15, 0.4);
  transition: transform 0.15s ease, background 0.15s ease;
}
:deep(.pin.aprox) {
  border-style: dashed;
}
:deep(.pin.activo) {
  background: var(--tinta);
  color: var(--papel);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--d-punto) 45%, transparent), 0 2px 8px rgba(25, 22, 15, 0.4);
  transform: scale(1.3);
}
:deep(.marcador-veg:hover .pin) {
  transform: scale(1.15);
}
:deep(.pin-nombre) {
  position: absolute;
  left: 38px;
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  padding: 2px 8px;
  font: 600 0.78rem/1.3 var(--fuente);
  color: var(--tinta);
  background: color-mix(in srgb, var(--papel) 92%, transparent);
  border-radius: 999px;
  box-shadow: 0 1px 4px rgba(25, 22, 15, 0.25);
  pointer-events: none;
}
:deep(.grupo-pin) {
  display: grid;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 4px;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px var(--papel), 0 2px 6px rgba(25, 22, 15, 0.3);
  transition: transform 0.15s ease;
}
:deep(.grupo-pin > span) {
  display: grid;
  place-items: center;
  border-radius: 50%;
  font: 700 0.86rem/1 var(--fuente);
  font-variant-numeric: tabular-nums;
  color: var(--tinta);
  background: var(--papel);
}
:deep(.marcador-veg:hover .grupo-pin) {
  transform: scale(1.1);
}

/* Popup y controles al estilo del resto del sitio */
:deep(.leaflet-popup-content-wrapper) {
  background: var(--papel);
  color: var(--tinta);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(25, 22, 15, 0.25);
}
:deep(.leaflet-popup-tip) {
  background: var(--papel);
}
:deep(.leaflet-popup-content) {
  margin: 12px 16px;
  display: grid;
  gap: 2px;
  font-family: var(--fuente);
  font-size: 0.9rem;
  line-height: 1.35;
}
:deep(.leaflet-popup-content strong) {
  font-size: 1rem;
}
:deep(.pop-dieta) {
  color: var(--d-texto);
  font-weight: 600;
}
:deep(.pop-aviso) {
  font-size: 0.8rem;
  color: var(--tinta-suave);
}
:deep(.pop-enlace) {
  margin-top: 6px;
  font-weight: 600;
  color: var(--acento);
}
:deep(.leaflet-bar) {
  border: 1px solid var(--linea);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--sombra);
}
:deep(.leaflet-bar a) {
  width: 36px;
  height: 36px;
  line-height: 36px;
  background: color-mix(in srgb, var(--papel) 90%, transparent);
  color: var(--tinta);
  border-bottom-color: var(--linea);
}
:deep(.leaflet-bar a:hover) {
  background: var(--papel);
}
:deep(.leaflet-control-attribution) {
  font-size: 0.68rem;
  background: color-mix(in srgb, var(--papel) 80%, transparent);
  color: var(--tinta-suave);
}
:deep(.leaflet-control-attribution a) {
  color: var(--tinta-suave);
}
</style>

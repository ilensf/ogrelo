<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Mapa from './Mapa.vue';
import type { PuntoMapa } from './Mapa.vue';
import { etiquetaCocina, textos, type Idioma } from '../i18n';
import { DIETAS, SERVICIOS } from '../lib/etiquetas';
import { ahoraLocal, estadoAhora, type Estado } from '../lib/horario';
import type { Dieta, RestauranteVista, Servicio } from '../lib/tipos';

const props = defineProps<{ restaurantes: RestauranteVista[]; base: string; idioma: Idioma }>();
const t = textos(props.idioma);

type Orden = 'recomendado' | 'abierto' | 'nota' | 'nombre';
const ORDENES: Orden[] = ['recomendado', 'abierto', 'nota', 'nombre'];

// --- Filtros ---------------------------------------------------------------
const texto = ref('');
const dietas = ref<Dieta[]>([]);
const barrio = ref('');
const cocina = ref('');
const precioMax = ref<0 | 1 | 2 | 3>(0);
const servicios = ref<Servicio[]>([]);
const soloAbiertos = ref(false);
const vistaMovil = ref<'lista' | 'mapa'>('lista');
const resaltado = ref<string | null>(null);
const hojaAbierta = ref(false);
const orden = ref<Orden>('recomendado');
const enfoque = ref<{ id: string; n: number } | null>(null);

// La hora solo se conoce en el navegador; hasta entonces no mostramos estado.
const ahora = ref<Date | null>(null);
let reloj: ReturnType<typeof setInterval> | undefined;

const conteoDieta = computed(() => {
  const c: Record<string, number> = {};
  for (const r of props.restaurantes) c[r.dieta] = (c[r.dieta] ?? 0) + 1;
  return c;
});

const barrios = computed(() => {
  const m = new Map<string, string>();
  for (const r of props.restaurantes) if (r.barrio && r.barrioNombre) m.set(r.barrio, r.barrioNombre);
  return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], props.idioma));
});
const variasCiudades = computed(() => new Set(props.restaurantes.map((r) => r.ciudad)).size > 1);
const lugar = (r: RestauranteVista) => (variasCiudades.value ? r.ciudadNombre : (r.barrioNombre ?? r.ciudadNombre));
/** «Alguna opción» sale oculta por defecto, salvo donde no haya nada mejor. */
const ocultarAlguna = computed(() => props.restaurantes.some((r) => r.dieta !== 'alguna-opcion'));
const cocinas = computed(() =>
  [...new Set(props.restaurantes.flatMap((r) => r.cocina))].sort((a, b) =>
    etiquetaCocina(t, a).localeCompare(etiquetaCocina(t, b), props.idioma),
  ),
);

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const estados = computed<Record<string, Estado>>(() => {
  if (!ahora.value) return {};
  const res: Record<string, Estado> = {};
  for (const r of props.restaurantes) res[r.id] = estadoAhora(r.horario, ahora.value);
  return res;
});

const filtrados = computed(() => {
  const q = normalizar(texto.value.trim());
  return props.restaurantes.filter((r) => {
    if (q) {
      const cocinas = r.cocina.flatMap((c) => [c, etiquetaCocina(t, c)]).join(' ');
      const pajar = normalizar([r.nombre, r.resumen, cocinas, r.destacados.join(' '), r.barrioNombre ?? '', r.ciudadNombre].join(' '));
      if (!pajar.includes(q)) return false;
    }
    if (dietas.value.length) {
      if (!dietas.value.includes(r.dieta)) return false;
    } else if (!q && ocultarAlguna.value && r.dieta === 'alguna-opcion') {
      return false;
    }
    if (barrio.value && r.barrio !== barrio.value) return false;
    if (cocina.value && !r.cocina.includes(cocina.value)) return false;
    if (precioMax.value && (!r.precio || r.precio > precioMax.value)) return false;
    if (servicios.value.some((s) => !r.servicios.includes(s))) return false;
    if (soloAbiertos.value && ahora.value && !estados.value[r.id]?.abierto) return false;
    return true;
  });
});

const puntuacion = (r: RestauranteVista) => {
  const v = r.valoraciones[0];
  return v ? v.nota / v.max : -1;
};
const visibles = computed(() => {
  const l = [...filtrados.value];
  if (orden.value === 'abierto' && ahora.value) l.sort((a, b) => Number(!!estados.value[b.id]?.abierto) - Number(!!estados.value[a.id]?.abierto));
  else if (orden.value === 'nota') l.sort((a, b) => puntuacion(b) - puntuacion(a));
  else if (orden.value === 'nombre') l.sort((a, b) => a.nombre.localeCompare(b.nombre, props.idioma));
  return l;
});

const abiertosAhora = computed(() => Object.values(estados.value).filter((e) => e.abierto).length);

const puntos = computed<PuntoMapa[]>(() =>
  filtrados.value
    .filter((r) => r.coords)
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      dieta: r.dieta,
      lat: r.coords!.lat,
      lng: r.coords!.lng,
      exactas: r.coords!.exactas,
      url: fichaUrl(r.id),
    })),
);
const sinUbicar = computed(() => filtrados.value.filter((r) => !r.coords).length);

const numExtras = computed(() => (barrio.value ? 1 : 0) + (cocina.value ? 1 : 0) + (precioMax.value ? 1 : 0) + servicios.value.length);

const hayFiltros = computed(
  () =>
    !!texto.value || dietas.value.length > 0 || !!barrio.value || !!cocina.value || precioMax.value > 0 ||
    servicios.value.length > 0 || soloAbiertos.value,
);

function limpiar() {
  texto.value = '';
  dietas.value = [];
  barrio.value = '';
  cocina.value = '';
  precioMax.value = 0;
  servicios.value = [];
  soloAbiertos.value = false;
}

function verEnMapa(id: string) {
  resaltado.value = id;
  vistaMovil.value = 'mapa';
  enfoque.value = { id, n: (enfoque.value?.n ?? 0) + 1 };
}

/** Desde el mapa: se marca el sitio y la lista se desplaza hasta él. */
function seleccionarDesdeMapa(id: string) {
  resaltado.value = id;
  document.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function alEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') hojaAbierta.value = false;
}

function leerHash() {
  if (location.hash === '#mapa') vistaMovil.value = 'mapa';
  else if (location.hash === '#directorio') vistaMovil.value = 'lista';
}

function alternar<T>(lista: T[], v: T): T[] {
  return lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v];
}

function fichaUrl(id: string) {
  return `${props.base}restaurante/${id}/`;
}

function textoEstado(id: string): string {
  const e = estados.value[id];
  if (!e || !ahora.value) return '';
  if (e.abierto) return t.horario.abierto(e.cierra);
  if (!e.abre || !e.diaAbre) return t.sinHorario;
  const hoy = ahoraLocal(ahora.value).dia;
  return e.diaAbre === hoy ? t.horario.cerradoHoy(e.abre) : t.horario.cerradoDia(t.dias[e.diaAbre].toLowerCase(), e.abre);
}

const nota = (r: RestauranteVista) => r.valoraciones[0];

// --- Filtros en la URL, para poder compartir una búsqueda --------------------
function leerUrl() {
  const p = new URLSearchParams(location.search);
  texto.value = p.get('q') ?? '';
  dietas.value = (p.get('dieta')?.split(',') ?? []).filter((d): d is Dieta => DIETAS.includes(d as Dieta));
  barrio.value = p.get('barrio') ?? '';
  cocina.value = p.get('cocina') ?? '';
  precioMax.value = (Number(p.get('precio')) || 0) as 0 | 1 | 2 | 3;
  servicios.value = (p.get('servicios')?.split(',').filter(Boolean) ?? []) as Servicio[];
  soloAbiertos.value = p.get('abierto') === '1';
  const o = p.get('orden') as Orden | null;
  orden.value = o && ORDENES.includes(o) ? o : 'recomendado';
}
function escribirUrl() {
  const p = new URLSearchParams();
  if (texto.value) p.set('q', texto.value);
  if (dietas.value.length) p.set('dieta', dietas.value.join(','));
  if (barrio.value) p.set('barrio', barrio.value);
  if (cocina.value) p.set('cocina', cocina.value);
  if (precioMax.value) p.set('precio', String(precioMax.value));
  if (servicios.value.length) p.set('servicios', servicios.value.join(','));
  if (soloAbiertos.value) p.set('abierto', '1');
  if (orden.value !== 'recomendado') p.set('orden', orden.value);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

onMounted(() => {
  leerUrl();
  leerHash();
  addEventListener('hashchange', leerHash);
  addEventListener('keydown', alEscape);
  ahora.value = new Date();
  reloj = setInterval(() => (ahora.value = new Date()), 60_000);
  watch([texto, dietas, barrio, cocina, precioMax, servicios, soloAbiertos, orden], escribirUrl, { deep: true });
});
onBeforeUnmount(() => {
  clearInterval(reloj);
  removeEventListener('hashchange', leerHash);
  removeEventListener('keydown', alEscape);
});
</script>

<template>
  <section id="directorio" class="directorio">
    <div class="barra">
      <div class="barra-fila">
        <form class="buscador" role="search" @submit.prevent>
          <svg class="lupa" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" /></svg>
          <label>
            <span class="visualmente-oculto">{{ t.directorio.buscarEtiqueta }}</span>
            <input v-model="texto" type="search" :placeholder="t.directorio.buscarEjemplo" />
          </label>
        </form>
        <button
          type="button"
          class="boton-filtros"
          :aria-expanded="hojaAbierta"
          aria-controls="hoja-filtros"
          @click="hojaAbierta = !hojaAbierta"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 5h18v2H3V5zm4 6h10v2H7v-2zm3 6h4v2h-4v-2z" /></svg>
          {{ t.directorio.filtros }}
          <span v-if="numExtras" class="insignia">{{ numExtras }}</span>
        </button>
      </div>

      <div class="chips" role="group" :aria-label="t.directorio.tipoSitio">
        <button
          type="button"
          class="chip chip--abierto"
          :aria-pressed="soloAbiertos"
          :disabled="!ahora"
          @click="soloAbiertos = !soloAbiertos"
        >
          <span class="vivo" aria-hidden="true"></span>
          {{ t.directorio.abiertoAhora }}<span v-if="ahora" class="cuenta">{{ abiertosAhora }}</span>
        </button>
        <span class="separador" aria-hidden="true"></span>
        <button
          v-for="d in DIETAS.filter((x) => conteoDieta[x])"
          :key="d"
          type="button"
          class="chip chip--dieta"
          :class="`d-${d}`"
          :aria-pressed="dietas.includes(d)"
          :title="t.dietas[d].descripcion"
          @click="dietas = alternar(dietas, d)"
        >
          <span class="punto" aria-hidden="true"></span>
          {{ t.dietas[d].nombre }}
          <span class="cuenta">{{ conteoDieta[d] }}</span>
        </button>
      </div>

      <template v-if="hojaAbierta">
        <div class="telon" @click="hojaAbierta = false"></div>
        <div id="hoja-filtros" class="hoja" role="dialog" :aria-label="t.directorio.masFiltros">
          <div class="hoja-cabecera">
            <h2>{{ t.directorio.filtros }}</h2>
            <button type="button" class="cerrar" :aria-label="t.directorio.cerrarFiltros" @click="hojaAbierta = false">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" /></svg>
            </button>
          </div>
          <div class="fila-selects">
            <label v-if="barrios.length > 1">
              <span>{{ t.directorio.barrio }}</span>
              <select v-model="barrio">
                <option value="">{{ t.directorio.todosBarrios }}</option>
                <option v-for="[id, nombre] in barrios" :key="id" :value="id">{{ nombre }}</option>
              </select>
            </label>
            <label>
              <span>{{ t.directorio.cocina }}</span>
              <select v-model="cocina">
                <option value="">{{ t.directorio.cualquiera }}</option>
                <option v-for="c in cocinas" :key="c" :value="c">{{ etiquetaCocina(t, c) }}</option>
              </select>
            </label>
            <label>
              <span>{{ t.directorio.precio }}</span>
              <select v-model.number="precioMax">
                <option :value="0">{{ t.directorio.cualquiera }}</option>
                <option :value="1">{{ t.directorio.soloEconomicos }}</option>
                <option :value="2">{{ t.directorio.hastaMedio }}</option>
              </select>
            </label>
          </div>
          <fieldset class="grupo">
            <legend>{{ t.directorio.necesito }}</legend>
            <div class="chips">
              <button
                v-for="sv in SERVICIOS"
                :key="sv"
                type="button"
                class="chip"
                :aria-pressed="servicios.includes(sv)"
                @click="servicios = alternar(servicios, sv)"
              >
                {{ t.servicios[sv] }}
              </button>
            </div>
          </fieldset>
          <div class="hoja-pie">
            <button type="button" class="enlace" :disabled="!hayFiltros" @click="limpiar">{{ t.directorio.quitarTodos }}</button>
            <button type="button" class="boton boton--principal" @click="hojaAbierta = false">
              {{ t.directorio.ver(filtrados.length) }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <div class="cuerpo" :data-vista="vistaMovil">
      <div class="panel-lista">
        <div class="lista-cabecera">
          <p aria-live="polite">
            <strong>{{ filtrados.length }}</strong>
            {{ t.directorio.sitios(filtrados.length) }}<template v-if="hayFiltros && filtrados.length !== restaurantes.length"> {{ t.directorio.de }} {{ restaurantes.length }}</template>
            <button v-if="hayFiltros" type="button" class="enlace" @click="limpiar">{{ t.directorio.quitar }}</button>
          </p>
          <label class="orden">
            <span class="visualmente-oculto">{{ t.directorio.ordenar }}</span>
            <select v-model="orden">
              <option v-for="k in ORDENES" :key="k" :value="k" :disabled="k === 'abierto' && !ahora">{{ t.directorio.orden[k] }}</option>
            </select>
          </label>
        </div>

        <ol class="lista">
          <li
            v-for="r in visibles"
            :key="r.id"
            class="fila"
            :class="[`d-${r.dieta}`, { 'fila--activa': resaltado === r.id }]"
            :data-id="r.id"
            @mouseenter="resaltado = r.id"
            @mouseleave="resaltado = null"
            @focusin="resaltado = r.id"
          >
            <a class="fila-enlace" :href="fichaUrl(r.id)">
              <span class="avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2C6 7 4 12 5.5 17c1 3.3 3.8 5 6.5 5s5.5-1.7 6.5-5C20 12 18 7 12 2z" /></svg>
              </span>
              <span class="fila-texto">
                <span class="fila-nombre">{{ r.nombre }}</span>
                <span class="fila-meta">
                  {{ r.cocina.map((c) => etiquetaCocina(t, c)).join(', ') }} · {{ lugar(r) }}
                  <span v-if="r.precio" :title="t.precios[r.precio]">· {{ '€'.repeat(r.precio) }}</span>
                </span>
                <span class="fila-pie">
                  <span class="etq">{{ t.dietas[r.dieta].corto }}</span>
                  <span
                    v-if="ahora"
                    class="estado"
                    :class="estados[r.id]?.abierto ? 'estado--abierto' : 'estado--cerrado'"
                  >{{ textoEstado(r.id) }}</span>
                </span>
              </span>
              <span v-if="nota(r)" class="nota-chip" :title="t.directorio.notaFuente(nota(r).fuente, nota(r).nota.toLocaleString(idioma), nota(r).max)">
                ★ {{ nota(r).nota.toLocaleString(idioma) }}
              </span>
            </a>
            <button v-if="r.coords" type="button" class="localizar" @click="verEnMapa(r.id)">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
              <span class="visualmente-oculto">{{ t.directorio.verEnMapa(r.nombre) }}</span>
            </button>
          </li>
          <li v-if="filtrados.length === 0" class="vacio">
            <p>{{ t.directorio.vacio }}</p>
            <button type="button" class="boton" @click="limpiar">{{ t.directorio.quitar }}</button>
          </li>
        </ol>
      </div>

      <div id="mapa" class="panel-mapa">
        <Mapa :puntos="puntos" :idioma="idioma" :resaltado="resaltado" :enfocar="enfoque" @seleccionar="seleccionarDesdeMapa" />
        <p v-if="sinUbicar" class="nota-mapa">{{ t.directorio.sinUbicar(sinUbicar) }}</p>
      </div>

      <div class="conmutador" role="group" :aria-label="t.directorio.vista">
        <button type="button" :aria-pressed="vistaMovil === 'lista'" @click="vistaMovil = 'lista'">{{ t.directorio.lista }}</button>
        <button type="button" :aria-pressed="vistaMovil === 'mapa'" @click="vistaMovil = 'mapa'">{{ t.directorio.mapa }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.directorio {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* --- Barra superior --- */
.barra {
  position: relative;
  display: grid;
  gap: 0.6rem;
}
.barra-fila {
  display: flex;
  gap: 0.5rem;
}
.buscador {
  position: relative;
  flex: 1;
}
.buscador label {
  display: block;
}
.lupa {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--tinta-suave);
  pointer-events: none;
}
.buscador input {
  width: 100%;
  height: 50px;
  padding: 0 1em 0 2.9rem;
  font: inherit;
  font-size: 1rem;
  color: var(--tinta);
  background: var(--papel);
  border: 1.5px solid var(--linea);
  border-radius: 999px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.buscador input:focus {
  outline: none;
  border-color: var(--acento);
  box-shadow: 0 0 0 4px var(--acento-claro);
}
.boton-filtros {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  height: 50px;
  padding: 0 1.2em;
  font: inherit;
  font-weight: 600;
  color: var(--tinta);
  background: var(--papel);
  border: 1.5px solid var(--linea);
  border-radius: 999px;
  cursor: pointer;
}
.boton-filtros:hover,
.boton-filtros[aria-expanded='true'] {
  border-color: var(--tinta);
}
.insignia {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 0.78rem;
  color: var(--sobre-acento);
  background: var(--acento);
  border-radius: 999px;
}

.chips {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  height: 40px;
  padding: 0 0.95em;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--tinta);
  background: var(--papel);
  border: 1.5px solid var(--linea);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.chip:hover:not(:disabled) {
  border-color: var(--tinta-suave);
}
.chip[aria-pressed='true'] {
  background: var(--tinta);
  color: var(--papel);
  border-color: var(--tinta);
}
.chip--dieta .punto {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--d-punto);
}
.chip--dieta[aria-pressed='true'] {
  background: var(--d-fondo);
  color: var(--d-texto);
  border-color: var(--d-punto);
}
.chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.cuenta {
  font-size: 0.8rem;
  opacity: 0.7;
}
.separador {
  flex: none;
  width: 1px;
  margin: 6px 0.2rem;
  background: var(--linea);
}
.vivo {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--grelo);
}

/* --- Panel de filtros avanzados --- */
.telon {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(25, 22, 15, 0.4);
}
.hoja {
  position: fixed;
  z-index: 1200;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 85dvh;
  overflow: auto;
  display: grid;
  gap: 1.1rem;
  padding: 1.25rem 1.25rem 1.5rem;
  background: var(--papel);
  border-radius: 24px 24px 0 0;
  box-shadow: var(--sombra-alta);
}
.hoja-cabecera {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hoja-cabecera h2 {
  font-size: 1.3rem;
}
.cerrar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--tinta);
  background: var(--granito-hondo);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.hoja-pie {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
@media (min-width: 720px) {
  .telon {
    background: transparent;
  }
  .hoja {
    position: absolute;
    left: auto;
    right: 0;
    bottom: auto;
    top: calc(100% + 8px);
    width: 440px;
    max-height: none;
    border: 1px solid var(--linea);
    border-radius: var(--radio);
  }
}
.grupo {
  border: 0;
  padding: 0;
  margin: 0;
}
legend,
.fila-selects span {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--tinta-suave);
  margin-bottom: 0.4rem;
}
.hoja .chips {
  flex-wrap: wrap;
  overflow: visible;
}
.fila-selects {
  display: grid;
  gap: 0.75rem;
}
select {
  width: 100%;
  min-height: 46px;
  padding: 0.4em 0.9em;
  font: inherit;
  color: var(--tinta);
  background: var(--granito);
  border: 1.5px solid var(--linea);
  border-radius: var(--radio-s);
}
.enlace {
  padding: 0;
  margin-left: 0.6em;
  font: inherit;
  font-weight: 600;
  color: var(--acento);
  background: none;
  border: 0;
  text-decoration: underline;
  cursor: pointer;
}
.enlace:disabled {
  opacity: 0.4;
  cursor: default;
}
.hoja-pie .enlace {
  margin: 0;
}

/* --- Cuerpo: lista y mapa --- */
.cuerpo {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  position: relative;
}
.panel-lista,
.panel-mapa {
  min-height: 0;
}
.cuerpo[data-vista='mapa'] .panel-lista,
.cuerpo[data-vista='lista'] .panel-mapa {
  display: none;
}
.panel-mapa {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.panel-mapa > :first-child {
  flex: 1;
  min-height: 0;
}
.nota-mapa {
  font-size: 0.82rem;
  color: var(--tinta-suave);
}

/* En móvil, el conmutador Lista/Mapa flota abajo, al alcance del pulgar */
.conmutador {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 900;
  display: inline-flex;
  padding: 4px;
  background: var(--tinta);
  border-radius: 999px;
  box-shadow: var(--sombra-alta);
}
.conmutador button {
  min-height: 44px;
  padding: 0 1.5em;
  font: inherit;
  font-weight: 600;
  color: var(--papel);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  opacity: 0.7;
}
.conmutador button[aria-pressed='true'] {
  background: var(--acento);
  color: var(--sobre-acento);
  opacity: 1;
}

@media (min-width: 960px) {
  .conmutador {
    display: none;
  }
  .cuerpo {
    grid-template-columns: minmax(380px, 460px) minmax(0, 1fr);
  }
  .cuerpo[data-vista] .panel-lista,
  .cuerpo[data-vista] .panel-mapa {
    display: flex;
  }
}

/* --- Lista --- */
.panel-lista {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.lista-cabecera {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--tinta-suave);
}
.lista-cabecera strong {
  color: var(--tinta);
}
.orden select {
  width: auto;
  min-height: 36px;
  padding: 0 0.7em;
  font-size: 0.9rem;
  background: transparent;
}
.lista {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 2px 4px 5.5rem 2px;
  display: grid;
  align-content: start;
  gap: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: var(--linea) transparent;
  overscroll-behavior: contain;
}
@media (min-width: 960px) {
  .lista {
    padding-bottom: 1rem;
  }
}

.fila {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--papel);
  border: 1.5px solid var(--linea);
  border-radius: var(--radio);
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.fila:hover,
.fila--activa {
  border-color: var(--d-punto);
  box-shadow: var(--sombra);
}
.fila-enlace {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.8rem 0.5rem 0.8rem 0.85rem;
  text-decoration: none;
  border-radius: var(--radio);
}
.avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--d-texto);
  background: var(--d-fondo);
  border-radius: 14px;
}
.fila-texto {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.fila-nombre {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.fila-meta {
  font-size: 0.86rem;
  color: var(--tinta-suave);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fila-pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.6rem;
  margin-top: 3px;
  font-size: 0.82rem;
  font-weight: 500;
}
.nota-chip {
  flex: none;
  align-self: flex-start;
  padding: 0.1em 0.55em;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--tinta);
  background: var(--granito-hondo);
  border-radius: 999px;
}
.estado--abierto {
  color: var(--grelo);
  font-weight: 600;
}
.estado--cerrado {
  color: var(--tinta-suave);
}
.localizar {
  flex: none;
  align-self: center;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-right: 0.5rem;
  color: var(--tinta-suave);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.localizar:hover {
  color: var(--sobre-acento);
  background: var(--acento);
}
.vacio {
  padding: 2rem 1.25rem;
  background: var(--papel);
  border: 1.5px dashed var(--linea);
  border-radius: var(--radio);
  display: grid;
  gap: 1rem;
  justify-items: start;
}
</style>

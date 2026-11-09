<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { textos, type Idioma } from '../i18n';
import { ahoraLocal, estadoAhora } from '../lib/horario';
import type { Dia, Franja } from '../lib/tipos';

const props = defineProps<{ horario: Partial<Record<Dia, Franja[]>>; idioma: Idioma }>();
const t = textos(props.idioma);
const ahora = ref<Date | null>(null);
onMounted(() => {
  ahora.value = new Date();
  // Marca el día de hoy en la tabla de horario que pinta la página
  const hoy = ahoraLocal(ahora.value).dia;
  document.querySelector(`[data-dia="${hoy}"]`)?.classList.add('hoy');
});

const texto = computed(() => {
  if (!ahora.value) return '';
  const e = estadoAhora(props.horario, ahora.value);
  if (e.abierto) return t.horario.abiertoAhora(e.cierra);
  if (!e.abre || !e.diaAbre) return t.sinHorario;
  const hoy = ahoraLocal(ahora.value).dia;
  return e.diaAbre === hoy
    ? t.horario.cerradoAhoraHoy(e.abre)
    : t.horario.cerradoAhoraDia(t.dias[e.diaAbre].toLowerCase(), e.abre);
});
const abierto = computed(() => !!ahora.value && estadoAhora(props.horario, ahora.value).abierto);
</script>

<template>
  <p class="estado" :class="{ abierto }" aria-live="polite">{{ texto }}</p>
</template>

<style scoped>
.estado {
  min-height: 1.5em;
  font-weight: 600;
  color: var(--tinta-suave);
}
.estado.abierto {
  color: var(--grelo);
}
</style>

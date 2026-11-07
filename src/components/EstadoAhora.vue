<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ahoraEnCoruna, estadoAhora } from '../lib/horario';
import { NOMBRE_DIA } from '../lib/etiquetas';
import type { Dia, Franja } from '../lib/tipos';

const props = defineProps<{ horario: Partial<Record<Dia, Franja[]>> }>();
const ahora = ref<Date | null>(null);
onMounted(() => {
  ahora.value = new Date();
  // Marca el día de hoy en la tabla de horario que pinta la página
  const hoy = ahoraEnCoruna(ahora.value).dia;
  document.querySelector(`[data-dia="${hoy}"]`)?.classList.add('hoy');
});

const texto = computed(() => {
  if (!ahora.value) return '';
  const e = estadoAhora(props.horario, ahora.value);
  if (e.abierto) return `Abierto ahora, cierra a las ${e.cierra}`;
  if (!e.abre || !e.diaAbre) return 'Sin horario confirmado';
  const hoy = ahoraEnCoruna(ahora.value).dia;
  return e.diaAbre === hoy
    ? `Cerrado ahora, abre a las ${e.abre}`
    : `Cerrado ahora, abre el ${NOMBRE_DIA[e.diaAbre].toLowerCase()} a las ${e.abre}`;
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

<script setup lang="ts">
import { computed } from 'vue';
import { DIETAS } from '../lib/etiquetas';
import type { Dieta } from '../lib/tipos';

// El medidor vegetal: tres hojas que se llenan según cuánto de la carta es vegetal.
const props = withDefaults(defineProps<{ dieta: Dieta; tamano?: 's' | 'm' | 'l'; conTexto?: boolean }>(), {
  tamano: 'm',
  conTexto: false,
});

const info = computed(() => DIETAS[props.dieta]);
</script>

<template>
  <span class="medidor" :class="`medidor--${tamano}`" :title="`${info.nombre}: ${info.descripcion}`">
    <span class="hojas" aria-hidden="true">
      <span v-for="n in 3" :key="n" class="hoja" :class="{ llena: n <= info.nivel }" />
    </span>
    <span :class="conTexto ? 'texto' : 'visualmente-oculto'">{{ info.nombre }}</span>
  </span>
</template>

<style scoped>
.medidor {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
}
.hojas {
  display: inline-flex;
  gap: 2px;
}
.hoja {
  display: block;
  width: 9px;
  height: 14px;
  /* forma de hoja: dos esquinas redondeadas en diagonal */
  border-radius: 9px 1px 9px 1px;
  background: var(--grelo-vacio);
}
.hoja.llena {
  background: var(--d-punto, var(--grelo));
}
.medidor--s .hoja {
  width: 7px;
  height: 11px;
}
.medidor--l .hoja {
  width: 16px;
  height: 26px;
  border-radius: 16px 2px 16px 2px;
}
.medidor--l .hojas {
  gap: 4px;
}
.texto {
  font-weight: 600;
  color: var(--d-texto, var(--grelo));
}
</style>

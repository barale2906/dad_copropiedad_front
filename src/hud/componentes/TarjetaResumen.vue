<script setup lang="ts">
/**
 * Tarjeta de resumen para tableros (Mi hogar, tableros de administración): título, cifra o
 * estado destacado, detalle y, si se da `a`, toda la tarjeta es un enlace. El icono va en el slot.
 */
import type { RouteLocationRaw } from 'vue-router'

withDefaults(
  defineProps<{
    titulo: string
    valor?: string
    detalle?: string
    tono?: 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'
    a?: RouteLocationRaw
    cargando?: boolean
  }>(),
  { valor: undefined, detalle: undefined, tono: 'neutro', a: undefined, cargando: false },
)
defineSlots<{ icono?: () => unknown }>()
</script>

<template>
  <component
    :is="a ? 'RouterLink' : 'div'"
    :to="a"
    class="tarjeta-resumen"
    :class="tono"
    :aria-busy="cargando || undefined"
  >
    <span
      v-if="$slots.icono"
      class="icono"
      aria-hidden="true"
    ><slot name="icono" /></span>
    <span class="titulo">{{ titulo }}</span>
    <strong
      v-if="cargando"
      class="valor"
    >…</strong>
    <strong
      v-else-if="valor"
      class="valor"
    >{{ valor }}</strong>
    <span
      v-if="detalle && !cargando"
      class="detalle"
    >{{ detalle }}</span>
  </component>
</template>

<style scoped>
.tarjeta-resumen {
  position: relative;
  display: grid;
  align-content: start;
  gap: 4px;
  min-height: 112px;
  padding: 14px 16px 14px 18px;
  border: 1px solid var(--linea);
  background: var(--superficie);
  color: var(--texto);
  text-decoration: none;
}

.tarjeta-resumen::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--linea-fuerte);
}

.exito::before {
  background: var(--verde);
}

.aviso::before {
  background: var(--ambar);
}

.peligro::before {
  background: var(--magenta);
}

.info::before {
  background: var(--cian);
}

a.tarjeta-resumen:hover,
a.tarjeta-resumen:focus-visible {
  border-color: var(--cian);
  background: var(--cian-tenue);
}

.icono {
  color: var(--cian);
  font-size: 22px;
}

.titulo {
  color: var(--texto-2);
  font-family: var(--fuente-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.valor {
  font-family: var(--fuente-display);
  font-size: clamp(22px, 5vw, 28px);
  line-height: 1.1;
}

.detalle {
  color: var(--texto-2);
  font-size: 14px;
}
</style>

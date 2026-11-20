<script setup lang="ts">
/**
 * Franja fija del modo soporte: la cuenta de la plataforma ve la entidad en **solo lectura**
 * (`capacidades.modo_soporte`). El backend ya entrega solo permisos de lectura, así que las
 * acciones que escriben no aparecen; si alguna llega a enviarse, responde 403.
 */
import { useEntidad } from '@/stores/entidad'
import IOjo from '~icons/tabler/eye'

const entidad = useEntidad()
</script>

<template>
  <p
    v-if="entidad.modoSoporte"
    class="franja-soporte"
    role="status"
  >
    <IOjo aria-hidden="true" />
    <strong>Modo soporte · solo lectura</strong>
    <span>Está viendo la entidad como soporte de la plataforma. No puede cambiar nada.</span>
  </p>
</template>

<style scoped>
.franja-soporte {
  position: relative;
  z-index: 19;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0;
  padding: 6px var(--gutter);
  border-bottom: 1px solid var(--ambar);
  background: color-mix(in srgb, var(--ambar) 18%, var(--fondo));
  color: var(--texto);
  font-size: 14px;
}

.franja-soporte svg {
  color: var(--ambar);
}

strong {
  font-family: var(--fuente-display);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

span {
  color: var(--texto-2);
}
</style>

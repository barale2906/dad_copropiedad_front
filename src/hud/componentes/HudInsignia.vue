<script setup lang="ts">
/**
 * Estado de un recurso (aprobada, vencido, contingencia…) con color por token. Cada módulo
 * traduce su estado a un `tono`; el texto va en el slot (el color nunca es la única señal).
 */
withDefaults(defineProps<{ tono?: 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro' }>(), { tono: 'neutro' })
</script>

<template>
  <span
    class="hud-insignia"
    :class="tono"
  ><slot /></span>
</template>

<style scoped>
.hud-insignia {
  --c: var(--texto-2);

  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  background: color-mix(in srgb, var(--c) 12%, transparent);
  color: var(--c);
  font-family: var(--fuente-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.exito {
  --c: var(--verde);
}

.aviso {
  --c: var(--ambar);
}

.peligro {
  --c: var(--magenta);
}

.info {
  --c: var(--cian);
}
</style>

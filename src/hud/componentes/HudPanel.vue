<script setup lang="ts">
/** Panel de vidrio con esquinas recortadas y borde luminoso. */
withDefaults(defineProps<{ etiqueta?: string; as?: string; resaltado?: boolean }>(), {
  etiqueta: undefined,
  as: 'section',
  resaltado: false,
})
</script>

<template>
  <component
    :is="as"
    class="hud-panel"
    :class="{ resaltado }"
  >
    <span
      class="esquina sup"
      aria-hidden="true"
    />
    <span
      class="esquina inf"
      aria-hidden="true"
    />
    <p
      v-if="etiqueta"
      class="rotulo etiqueta"
    >
      {{ etiqueta }}
    </p>
    <slot />
  </component>
</template>

<style scoped>
.hud-panel {
  position: relative;
  background: var(--superficie);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  border: 1px solid var(--linea);
  clip-path: polygon(
    var(--corte) 0,
    100% 0,
    100% calc(100% - var(--corte)),
    calc(100% - var(--corte)) 100%,
    0 100%,
    0 var(--corte)
  );
  padding: clamp(16px, 3vw, 28px);
  box-shadow: var(--sombra);
}

.hud-panel.resaltado {
  border-color: var(--linea-fuerte);
}

.esquina {
  position: absolute;
  width: 22px;
  height: 22px;
  pointer-events: none;
}

.esquina.sup {
  top: 0;
  right: 0;
  border-top: 2px solid var(--cian);
  border-right: 2px solid var(--cian);
}

.esquina.inf {
  bottom: 0;
  left: 0;
  border-bottom: 2px solid var(--cian);
  border-left: 2px solid var(--cian);
}

.etiqueta {
  margin: 0 0 12px;
  color: var(--cian);
}

/* Sin backdrop-filter el vidrio sería ilegible: superficie sólida. */
@supports not (backdrop-filter: blur(1px)) {
  .hud-panel {
    background: var(--superficie-solida);
  }
}
</style>

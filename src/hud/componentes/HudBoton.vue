<script setup lang="ts">
withDefaults(
  defineProps<{
    variante?: 'primario' | 'secundario' | 'fantasma'
    tipo?: 'button' | 'submit'
    cargando?: boolean
    deshabilitado?: boolean
    bloque?: boolean
  }>(),
  { variante: 'primario', tipo: 'button', cargando: false, deshabilitado: false, bloque: false },
)
</script>

<template>
  <button
    class="hud-boton"
    :class="[variante, { bloque, cargando }]"
    :type="tipo"
    :disabled="deshabilitado || cargando"
    :aria-busy="cargando || undefined"
  >
    <span
      v-if="cargando"
      class="giro"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>

<style scoped>
.hud-boton {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 22px;
  border: 1px solid transparent;
  font-family: var(--fuente-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  transition:
    background var(--rapido),
    box-shadow var(--rapido),
    color var(--rapido),
    transform var(--rapido);
}

.hud-boton:active:not(:disabled) {
  transform: translateY(1px);
}

.hud-boton:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.bloque {
  width: 100%;
}

.primario {
  background: linear-gradient(90deg, var(--cian-2), var(--cian));
  color: #021018;
}

.primario:hover:not(:disabled) {
  box-shadow: 0 0 24px rgb(56 232 255 / 45%);
}

.secundario {
  background: var(--cian-tenue);
  border-color: var(--linea-fuerte);
  color: var(--cian);
}

.secundario:hover:not(:disabled) {
  background: rgb(56 232 255 / 22%);
}

.fantasma {
  background: transparent;
  color: var(--texto-2);
  padding: 0 12px;
}

.fantasma:hover:not(:disabled) {
  color: var(--cian);
}

.giro {
  width: 16px;
  height: 16px;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: girar 0.7s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}
</style>

<script setup lang="ts">
/**
 * Pantalla de carga a pantalla completa: la nave en construcción, un mensaje y una barra de
 * progreso indeterminada. Se anuncia a los lectores de pantalla (`role="status"`).
 */
import IlustracionConstruccion from '../ilustraciones/IlustracionConstruccion.vue'

withDefaults(defineProps<{ mensaje?: string }>(), { mensaje: 'Preparando su espacio de trabajo…' })
</script>

<template>
  <div
    class="carga"
    role="status"
    aria-live="polite"
  >
    <div class="contenido">
      <IlustracionConstruccion class="dibujo" />
      <p class="rotulo">
        Ensamblando módulos
      </p>
      <p class="mensaje">
        {{ mensaje }}
      </p>
      <div
        class="barra"
        aria-hidden="true"
      >
        <span />
      </div>
    </div>
  </div>
</template>

<style scoped>
.carga {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--gutter);
  background: color-mix(in srgb, var(--fondo) 88%, transparent);
  backdrop-filter: blur(6px);
  animation: aparecer var(--medio) var(--curva) both;
}

.contenido {
  display: grid;
  justify-items: center;
  gap: 8px;
  width: min(100%, 440px);
  text-align: center;
}

.dibujo {
  width: 100%;
  margin-bottom: 8px;
}

.rotulo {
  margin: 0;
  color: var(--cian);
}

.mensaje {
  margin: 0;
  color: var(--texto-2);
}

.barra {
  position: relative;
  width: min(100%, 260px);
  height: 3px;
  margin-top: 10px;
  overflow: hidden;
  background: var(--linea);
}

.barra span {
  position: absolute;
  inset: 0;
  width: 40%;
  background: var(--cian);
  box-shadow: var(--brillo);
  animation: avanzar 1.4s ease-in-out infinite;
}

@keyframes aparecer {
  from {
    opacity: 0;
  }
}

@keyframes avanzar {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(250%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .barra span {
    width: 100%;
    animation: none;
    opacity: 0.6;
  }
}
</style>

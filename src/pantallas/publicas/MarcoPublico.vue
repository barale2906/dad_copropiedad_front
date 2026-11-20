<script setup lang="ts">
/**
 * Marco de las páginas públicas (sin sesión): la marca, el título y el contenido en una columna
 * legible en celulares de gama baja. Sin maqueta 3D ni stores de la entidad.
 */
import MarcaDad from '../componentes/MarcaDad.vue'

withDefaults(defineProps<{ titulo: string; subtitulo?: string; ancho?: 'angosto' | 'amplio' }>(), { subtitulo: undefined, ancho: 'angosto' })
</script>

<template>
  <div
    class="marco-publico"
    :class="ancho"
  >
    <div
      class="fondo-hud"
      aria-hidden="true"
    />
    <header class="cabecera">
      <MarcaDad compacta />
    </header>
    <main class="contenido">
      <header>
        <h1>{{ titulo }}</h1>
        <p
          v-if="subtitulo"
          class="subtitulo"
        >
          {{ subtitulo }}
        </p>
      </header>
      <slot />
    </main>
  </div>
</template>

<style scoped>
.marco-publico {
  min-height: 100dvh;
}

.cabecera {
  display: flex;
  align-items: center;
  height: var(--barra-alto);
  padding: 0 var(--gutter);
  border-bottom: 1px solid var(--linea);
}

.contenido {
  display: grid;
  gap: 16px;
  width: min(100%, 640px);
  margin: 0 auto;
  padding: 20px var(--gutter) 40px;
}

.amplio .contenido {
  width: min(100%, 1100px);
}

h1 {
  margin: 0;
  font-size: clamp(24px, 6vw, 34px);
}

.subtitulo {
  margin: 4px 0 0;
  color: var(--texto-2);
}
</style>

<script setup lang="ts">
/**
 * Lista de adjuntos con subir, abrir y quitar. Solo emite: el padre sube con `subirArchivo` y
 * abre con `abrirArchivo` (`src/api/archivos.ts`).
 */
import { useId, useTemplateRef } from 'vue'
import IArchivo from '~icons/tabler/file'
import IBorrar from '~icons/tabler/trash'
import ISubir from '~icons/tabler/upload'

export interface Adjunto {
  id: string
  nombre: string
}

withDefaults(
  defineProps<{
    adjuntos: Adjunto[]
    /** Tipos que acepta el selector (p. ej. `application/pdf,image/*`). */
    acepta?: string
    subiendo?: boolean
    soloLectura?: boolean
  }>(),
  { acepta: undefined, subiendo: false, soloLectura: false },
)
const emit = defineEmits<{ subir: [archivos: File[]]; abrir: [id: string]; quitar: [id: string] }>()

const id = useId()
const selector = useTemplateRef<HTMLInputElement>('selector')

function elegidos(e: Event) {
  const lista = (e.target as HTMLInputElement).files
  if (lista?.length) emit('subir', [...lista])
  if (selector.value) selector.value.value = ''
}
</script>

<template>
  <div class="hud-adjuntos">
    <ul
      v-if="adjuntos.length"
      class="lista"
    >
      <li
        v-for="a in adjuntos"
        :key="a.id"
      >
        <button
          type="button"
          class="abrir"
          @click="emit('abrir', a.id)"
        >
          <IArchivo aria-hidden="true" /> {{ a.nombre }}
        </button>
        <button
          v-if="!soloLectura"
          type="button"
          class="quitar"
          @click="emit('quitar', a.id)"
        >
          <IBorrar aria-hidden="true" /><span class="solo-lector">Quitar {{ a.nombre }}</span>
        </button>
      </li>
    </ul>
    <p
      v-else
      class="vacio"
    >
      Sin adjuntos.
    </p>
    <template v-if="!soloLectura">
      <input
        :id="id"
        ref="selector"
        type="file"
        class="solo-lector"
        multiple
        :accept="acepta"
        :disabled="subiendo"
        @change="elegidos"
      >
      <label
        :for="id"
        class="subir"
        :class="{ ocupado: subiendo }"
      >
        <ISubir aria-hidden="true" /> {{ subiendo ? 'Subiendo…' : 'Adjuntar archivos' }}
      </label>
    </template>
  </div>
</template>

<style scoped>
.hud-adjuntos {
  display: grid;
  gap: 10px;
}

.lista {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--linea);
}

.abrir {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  background: none;
  color: var(--cian);
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.quitar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-left: 1px solid var(--linea);
  background: none;
  color: var(--texto-2);
  cursor: pointer;
}

.quitar:hover {
  color: var(--magenta);
}

.vacio {
  margin: 0;
  color: var(--texto-3);
}

.subir {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px dashed var(--linea-fuerte);
  color: var(--cian);
  cursor: pointer;
}

input:focus-visible + .subir {
  outline: 2px solid var(--cian);
  outline-offset: 2px;
}

.ocupado {
  color: var(--texto-3);
  cursor: progress;
}
</style>

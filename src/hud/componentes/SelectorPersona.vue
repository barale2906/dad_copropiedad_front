<script setup lang="ts">
/**
 * Buscar una persona por nombre o documento (desde 2 caracteres, con retardo) y emitir la elegida.
 * Genérico: no llama a la API; el padre le pasa la función de búsqueda.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import IBuscar from '~icons/tabler/search'
import HudCampo from './HudCampo.vue'

export interface OpcionPersona {
  id: string
  nombre: string
  /** Documento u otro dato para distinguir homónimos. */
  detalle?: string | null
}

const props = withDefaults(defineProps<{ etiqueta?: string; buscar: (q: string) => Promise<OpcionPersona[]> }>(), {
  etiqueta: 'Buscar persona',
})
const emit = defineEmits<{ elegir: [persona: OpcionPersona] }>()

const q = ref('')
const resultados = ref<OpcionPersona[]>([])
const estado = ref<'inicio' | 'buscando' | 'listo' | 'error'>('inicio')
let turno = 0
let temporizador: ReturnType<typeof setTimeout> | undefined

watch(q, (texto) => {
  clearTimeout(temporizador)
  const t = ++turno
  if (texto.trim().length < 2) {
    resultados.value = []
    estado.value = 'inicio'
    return
  }
  estado.value = 'buscando'
  temporizador = setTimeout(async () => {
    try {
      const r = await props.buscar(texto)
      if (t === turno) {
        resultados.value = r
        estado.value = 'listo'
      }
    } catch {
      if (t === turno) estado.value = 'error'
    }
  }, 300)
})

onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<template>
  <div class="selector-persona">
    <HudCampo
      v-model="q"
      :etiqueta="etiqueta"
      tipo="search"
      autocompletar="off"
      ayuda="Nombre (sin tildes) o número de documento; al menos 2 caracteres."
    >
      <template #antes>
        <IBuscar
          class="icono"
          aria-hidden="true"
        />
      </template>
    </HudCampo>
    <p
      v-if="estado === 'error'"
      class="nota"
      role="alert"
    >
      No se pudo buscar. Intente de nuevo.
    </p>
    <p
      v-else-if="estado === 'listo' && resultados.length === 0"
      class="nota"
    >
      Ninguna persona coincide.
    </p>
    <ul
      v-else-if="resultados.length"
      class="resultados"
      :aria-label="`Resultados de ${etiqueta}`"
    >
      <li
        v-for="p in resultados"
        :key="p.id"
      >
        <button
          type="button"
          @click="emit('elegir', p)"
        >
          <strong>{{ p.nombre }}</strong>
          <small v-if="p.detalle">{{ p.detalle }}</small>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.selector-persona {
  display: grid;
  gap: 8px;
}

.icono,
small,
.nota {
  color: var(--texto-3);
}

.nota {
  margin: 0;
}

.resultados {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.resultados button {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--linea);
  background: var(--superficie);
  color: var(--texto);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.resultados button:hover,
.resultados button:focus-visible {
  border-color: var(--cian);
  background: var(--cian-tenue);
}
</style>

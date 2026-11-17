<script setup lang="ts">
/**
 * Elegir un bien privado (`v-model` = id): lista de los propios si hay varios y, si se da
 * `buscar`, búsqueda por código con retardo. Genérico: no llama a la API ni lee stores; el padre
 * le pasa los bienes y la función de búsqueda (p. ej. `useBienes().buscar`).
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import HudCampo from './HudCampo.vue'
import HudSelector from './HudSelector.vue'

export interface OpcionBien {
  id: string
  codigo: string
}

const props = withDefaults(
  defineProps<{
    etiqueta?: string
    propios?: OpcionBien[]
    buscar?: (q: string) => Promise<OpcionBien[]>
    /** Código del bien elegido, para mostrarlo aunque no esté en la lista. */
    codigoElegido?: string | null
    error?: string | null
    /** Texto si no hay propios ni búsqueda. */
    sinBienes?: string
  }>(),
  { etiqueta: 'Bien', propios: () => [], buscar: undefined, codigoElegido: null, error: null, sinBienes: '' },
)
const bienId = defineModel<string>({ required: true })
const emit = defineEmits<{ elegido: [bien: OpcionBien] }>()

const id = useId()
const q = ref('')
const resultados = ref<OpcionBien[]>([])
const buscando = ref(false)
const errorBusqueda = ref<string | null>(null)
let turno = 0
let temporizador: ReturnType<typeof setTimeout> | undefined

const opciones = computed(() => props.propios.map((b) => ({ valor: b.id, etiqueta: b.codigo })))
const mostrarElegido = computed(() => !!bienId.value && props.propios.length <= 1)

function elegir(b: OpcionBien) {
  bienId.value = b.id
  emit('elegido', b)
  q.value = ''
}

watch(q, (texto) => {
  clearTimeout(temporizador)
  const t = ++turno
  if (!props.buscar || !texto.trim()) {
    resultados.value = []
    buscando.value = false
    return
  }
  buscando.value = true
  temporizador = setTimeout(async () => {
    try {
      const r = await props.buscar?.(texto)
      if (t === turno) {
        resultados.value = r ?? []
        errorBusqueda.value = null
      }
    } catch {
      if (t === turno) errorBusqueda.value = 'No se pudo buscar. Intente de nuevo.'
    } finally {
      if (t === turno) buscando.value = false
    }
  }, 300)
})

onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<template>
  <div class="selector-bien">
    <HudSelector
      v-if="propios.length > 1"
      v-model="bienId"
      :etiqueta="etiqueta"
      vacio="Elija el bien"
      :opciones="opciones"
      :error="error"
    />
    <p
      v-else-if="mostrarElegido"
      class="elegido"
    >
      {{ etiqueta }}: <strong>{{ codigoElegido ?? propios[0]?.codigo ?? 'Bien' }}</strong>
    </p>
    <template v-if="buscar">
      <HudCampo
        v-model="q"
        :etiqueta="propios.length ? 'O busque otro bien por código' : `Buscar ${etiqueta.toLowerCase()} por código`"
        tipo="search"
        autocompletar="off"
        :error="propios.length > 1 ? errorBusqueda : (errorBusqueda ?? error)"
      />
      <ul
        v-if="q.trim() && resultados.length"
        :id="id"
        class="resultados"
        aria-label="Bienes encontrados"
      >
        <li
          v-for="b in resultados"
          :key="b.id"
        >
          <button
            type="button"
            :aria-pressed="bienId === b.id"
            @click="elegir(b)"
          >
            {{ b.codigo }}
          </button>
        </li>
      </ul>
      <p
        v-else-if="q.trim() && !buscando && !errorBusqueda"
        class="nota"
      >
        Ningún bien coincide.
      </p>
    </template>
    <p
      v-else-if="!propios.length && sinBienes"
      class="nota"
    >
      {{ sinBienes }}
    </p>
    <p
      v-if="!buscar && propios.length <= 1 && error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.selector-bien {
  display: grid;
  gap: 8px;
}

.elegido,
.nota,
.error {
  margin: 0;
}

.nota {
  color: var(--texto-2);
}

.error {
  color: var(--magenta);
}

.resultados {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.resultados button {
  min-width: 80px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--linea);
  background: none;
  color: var(--texto);
  font: inherit;
  cursor: pointer;
}

.resultados button[aria-pressed='true'],
.resultados button:hover,
.resultados button:focus-visible {
  border-color: var(--cian);
  color: var(--cian);
}
</style>

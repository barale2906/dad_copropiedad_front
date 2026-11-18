<script setup lang="ts">
/**
 * Elegir una cuenta contable escribiendo su código o parte del nombre (combobox accesible):
 * flechas para moverse, `Enter` elige, `Escape` cierra y `F2` abre la lista. Genérico: no llama
 * a la API; el padre pasa las cuentas (p. ej. `usePlanCuentas().imputables`). Lo usan el editor
 * de comprobantes, tesorería, cartera y facturación.
 */
import { computed, ref, useId, watch } from 'vue'

export interface OpcionCuenta {
  codigo: string
  nombre: string
}

const props = withDefaults(
  defineProps<{
    opciones: OpcionCuenta[]
    etiqueta?: string
    /** La etiqueta queda solo para lectores de pantalla (celdas de una tabla). */
    etiquetaOculta?: boolean
    error?: string | null
    maximo?: number
  }>(),
  { etiqueta: 'Cuenta', etiquetaOculta: false, error: null, maximo: 8 },
)
const codigo = defineModel<string>({ required: true })
const emit = defineEmits<{ elegido: [codigo: string] }>()

const id = useId()
const abierto = ref(false)
const activo = ref(0)
const texto = ref('')
const editando = ref(false)

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const elegida = computed(() => props.opciones.find((o) => o.codigo === codigo.value) ?? null)
const mostrado = computed(() => (editando.value ? texto.value : elegida.value ? `${elegida.value.codigo} · ${elegida.value.nombre}` : codigo.value))

/** Primero las que empiezan por el código escrito; luego las que lo contienen en el nombre. */
const resultados = computed(() => {
  const t = sinTildes(texto.value.trim())
  if (!t) return props.opciones.slice(0, props.maximo)
  const porCodigo = props.opciones.filter((o) => o.codigo.startsWith(t))
  const porNombre = props.opciones.filter((o) => !o.codigo.startsWith(t) && sinTildes(o.nombre).includes(t))
  return [...porCodigo, ...porNombre].slice(0, props.maximo)
})

watch(resultados, () => (activo.value = 0))

function abrir() {
  if (!editando.value) {
    editando.value = true
    texto.value = codigo.value
  }
  abierto.value = true
}

function elegir(o: OpcionCuenta) {
  codigo.value = o.codigo
  abierto.value = false
  editando.value = false
  emit('elegido', o.codigo)
}

function alEscribir(e: Event) {
  texto.value = (e.target as HTMLInputElement).value
  editando.value = true
  abierto.value = true
}

function alSalir() {
  if (editando.value) {
    const exacta = props.opciones.find((o) => o.codigo === texto.value.trim())
    if (exacta) codigo.value = exacta.codigo
    else if (!texto.value.trim()) codigo.value = ''
  }
  abierto.value = false
  editando.value = false
}

function alTeclear(e: KeyboardEvent) {
  if (e.key === 'F2' || (e.key === 'ArrowDown' && !abierto.value)) {
    e.preventDefault()
    abrir()
    return
  }
  if (!abierto.value) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = resultados.value.length
    if (n) activo.value = (activo.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
  } else if (e.key === 'Enter') {
    const o = resultados.value[activo.value]
    if (o) {
      e.preventDefault()
      e.stopPropagation()
      elegir(o)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    abierto.value = false
    editando.value = false
  }
}
</script>

<template>
  <div
    class="selector-cuenta"
    :class="{ conError: !!error }"
  >
    <label
      :for="id"
      :class="etiquetaOculta ? 'solo-lector' : 'rotulo'"
    >{{ etiqueta }}</label>
    <input
      :id="id"
      :value="mostrado"
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-autocomplete="list"
      aria-keyshortcuts="F2"
      :aria-expanded="abierto"
      :aria-controls="`${id}-lista`"
      :aria-activedescendant="abierto && resultados.length ? `${id}-${activo}` : undefined"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error ? `${id}-error` : undefined"
      @input="alEscribir"
      @focus="abrir"
      @blur="alSalir"
      @keydown="alTeclear"
    >
    <ul
      v-show="abierto"
      :id="`${id}-lista`"
      role="listbox"
      :aria-label="etiqueta"
      class="lista"
    >
      <li
        v-for="(o, i) in resultados"
        :id="`${id}-${i}`"
        :key="o.codigo"
        role="option"
        :aria-selected="i === activo"
        @mousedown.prevent="elegir(o)"
      >
        <strong>{{ o.codigo }}</strong> {{ o.nombre }}
      </li>
      <li
        v-if="!resultados.length"
        class="vacio"
        role="option"
        aria-disabled="true"
        aria-selected="false"
      >
        Ninguna cuenta coincide.
      </li>
    </ul>
    <p
      v-if="error"
      :id="`${id}-error`"
      class="error"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.selector-cuenta {
  position: relative;
  display: grid;
  gap: 6px;
  min-width: 0;
}

input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--linea-fuerte);
  border-radius: var(--radio);
  background: var(--superficie-solida);
  color: var(--texto);
  font: inherit;
  font-size: 16px;
  text-overflow: ellipsis;
}

input:focus-visible {
  outline: 2px solid var(--cian);
  outline-offset: 1px;
}

.conError input {
  border-color: var(--magenta);
}

.lista {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  z-index: 20;
  min-width: min(360px, 90vw);
  max-height: 320px;
  margin: 4px 0 0;
  padding: 4px 0;
  overflow-y: auto;
  border: 1px solid var(--linea-fuerte);
  background: var(--superficie-solida);
  box-shadow: var(--sombra);
  list-style: none;
}

.lista li {
  padding: 10px 12px;
  cursor: pointer;
}

.lista li[aria-selected='true'] {
  background: var(--cian-tenue);
}

.lista .vacio {
  color: var(--texto-2);
  cursor: default;
}

.error {
  margin: 0;
  color: var(--magenta);
  font-size: 14px;
}
</style>

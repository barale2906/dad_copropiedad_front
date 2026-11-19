<script setup lang="ts">
/**
 * Elegir un tercero buscándolo por nombre o documento y, si no existe, **crearlo en línea** con
 * `FormularioTercero` (si el padre pasa `crear`). El elegido se muestra con «Cambiar». Genérico:
 * el padre pasa `buscar` y `crear` (p. ej. `buscarTerceros` y `crearTercero`).
 */
import { ref } from 'vue'
import type { NuevoTercero } from '@/api/tipos'
import FormularioTercero from './FormularioTercero.vue'
import HudBoton from './HudBoton.vue'
import HudDialogo from './HudDialogo.vue'
import SelectorPersona, { type OpcionPersona } from './SelectorPersona.vue'

const props = withDefaults(
  defineProps<{
    buscar: (q: string) => Promise<OpcionPersona[]>
    /** Crea el tercero y devuelve la opción para elegirlo; sin ella no se ofrece crear. */
    crear?: ((datos: NuevoTercero) => Promise<OpcionPersona>) | null
    etiqueta?: string
    opcional?: boolean
  }>(),
  { crear: null, etiqueta: 'Tercero', opcional: false },
)
const tercero = defineModel<OpcionPersona | null>({ required: true })

const creando = ref(false)
const guardando = ref(false)
const error = ref<string | null>(null)

async function alCrear(datos: NuevoTercero) {
  if (!props.crear) return
  guardando.value = true
  error.value = null
  try {
    tercero.value = await props.crear(datos)
    creando.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo crear el tercero. Intente de nuevo.'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="selector-tercero">
    <template v-if="!tercero">
      <SelectorPersona
        :etiqueta="`${etiqueta}${opcional ? ' (opcional)' : ''}`"
        :buscar="buscar"
        @elegir="(p) => (tercero = p)"
      />
      <HudBoton
        v-if="crear"
        variante="fantasma"
        @click="creando = true"
      >
        ¿No aparece? Crear {{ etiqueta.toLowerCase() }}
      </HudBoton>
    </template>
    <p
      v-else
      class="elegido"
    >
      <span><small>{{ etiqueta }}</small> <strong>{{ tercero.nombre }}</strong><template v-if="tercero.detalle"> · {{ tercero.detalle }}</template></span>
      <HudBoton
        variante="fantasma"
        @click="tercero = null"
      >
        Cambiar<span class="solo-lector"> {{ etiqueta.toLowerCase() }}</span>
      </HudBoton>
    </p>
    <HudDialogo
      v-model:abierto="creando"
      :titulo="`Crear ${etiqueta.toLowerCase()}`"
    >
      <FormularioTercero
        v-if="creando"
        :cargando="guardando"
        :error="error"
        @crear="alCrear"
        @cancelar="creando = false"
      />
    </HudDialogo>
  </div>
</template>

<style scoped>
.selector-tercero {
  display: grid;
  gap: 6px;
  justify-items: start;
  min-width: 0;
}

.selector-tercero > :first-child {
  justify-self: stretch;
}

.elegido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--linea-fuerte);
}

small {
  display: block;
  color: var(--texto-3);
}
</style>

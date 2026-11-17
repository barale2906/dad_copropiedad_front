<script setup lang="ts">
/**
 * Elegir el bien privado a cuyo nombre se hace algo (reservar, restringir, asignar, inscribir).
 * Ofrece los bienes de los que la cuenta es titular y, con `bienes_privados.ver`, buscar
 * cualquier bien por código. `v-model` = id del bien.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { BienPrivado } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { buscarBienes } from '../api'
import { useZonasComunes } from '../store'

const props = withDefaults(defineProps<{ etiqueta?: string; soloBusqueda?: boolean; error?: string | null }>(), {
  etiqueta: 'Bien',
  soloBusqueda: false,
  error: null,
})
const bienId = defineModel<string>({ required: true })

const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puedeBuscar = computed(() => entidad.tienePermiso('bienes_privados.ver'))

const propios = ref<BienPrivado[]>([])
const errorPropios = ref<string | null>(null)
const filtros = ref({ q: '' })
const resultados = useListado(
  (despues, f: { q: string }) =>
    f.q.trim() ? buscarBienes(id.value, f.q, despues) : Promise.resolve({ datos: [] as BienPrivado[], siguiente: null }),
  { filtros, inmediato: false },
)

const opcionesPropias = computed(() => propios.value.map((b) => ({ valor: b.id, etiqueta: b.codigo })))
const elegido = computed(() => (bienId.value ? zonas.codigoBien(bienId.value) : null))

function elegir(b: BienPrivado) {
  zonas.recordarBienes([b])
  bienId.value = b.id
  filtros.value = { q: '' }
}

onMounted(async () => {
  if (props.soloBusqueda) return
  try {
    propios.value = await zonas.asegurarPropios(id.value)
    if (!bienId.value && propios.value.length === 1) bienId.value = propios.value[0]!.id
  } catch (e) {
    errorPropios.value = mensajeDeError(e)
  }
})
</script>

<template>
  <div class="elegir-bien">
    <HudSelector
      v-if="!soloBusqueda && propios.length > 1"
      v-model="bienId"
      :etiqueta="etiqueta"
      vacio="Elija su bien"
      :opciones="opcionesPropias"
      :error="error"
    />
    <p
      v-else-if="elegido"
      class="elegido"
    >
      {{ etiqueta }}: <strong>{{ elegido }}</strong>
    </p>
    <template v-if="puedeBuscar">
      <HudCampo
        v-model="filtros.q"
        :etiqueta="propios.length ? 'O busque otro bien por código' : `Buscar ${etiqueta.toLowerCase()} por código`"
        tipo="search"
        autocompletar="off"
        :error="propios.length > 1 ? null : error"
      />
      <ul
        v-if="filtros.q.trim() && resultados.filas.value.length"
        class="resultados"
        aria-label="Bienes encontrados"
      >
        <li
          v-for="b in resultados.filas.value"
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
        v-else-if="filtros.q.trim() && resultados.estado.value === 'vacio'"
        class="nota"
      >
        Ningún bien coincide.
      </p>
    </template>
    <p
      v-else-if="!soloBusqueda && propios.length === 0 && !errorPropios"
      class="nota"
    >
      Su cuenta no figura como titular de ningún bien. Pida a la administración que haga la reserva a su nombre.
    </p>
    <p
      v-if="errorPropios"
      class="error"
      role="alert"
    >
      {{ errorPropios }}
    </p>
  </div>
</template>

<style scoped>
.elegir-bien {
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

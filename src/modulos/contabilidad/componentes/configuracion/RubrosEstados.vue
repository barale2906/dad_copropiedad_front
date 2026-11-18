<script setup lang="ts">
/** Rubros de los estados financieros: qué prefijos de cuenta suma cada renglón (se guardan todos juntos). */
import { onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Rubro } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/trash'
import { guardarRubros, rubros as pedirRubros } from '../../api'
import { ESTADO_RUBRO, leerPrefijos } from '../../reglas'

const props = defineProps<{ entidadId: string; editable: boolean }>()

interface RubroEditable {
  estado: string
  codigo: string
  nombre: string
  prefijos: string
}

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const filas = ref<RubroEditable[]>([])
const resultado = ref<string | null>(null)

const aEditable = (r: Rubro): RubroEditable => ({ estado: r.estado, codigo: r.codigo, nombre: r.nombre, prefijos: r.prefijos.join(', ') })
const peticion = (): Rubro[] => {
  const orden: Record<string, number> = {}
  return filas.value.map((f) => ({ estado: f.estado, codigo: f.codigo.trim(), nombre: f.nombre.trim(), orden: (orden[f.estado] = (orden[f.estado] ?? 0) + 1), prefijos: leerPrefijos(f.prefijos) }))
}
const guardar = useAccion(() => guardarRubros(props.entidadId, peticion()))

async function alGuardar() {
  const r = await guardar.ejecutar()
  if (!r.ok) return
  filas.value = r.valor.map(aEditable)
  resultado.value = 'Rubros guardados.'
}

async function cargar() {
  try {
    filas.value = (await pedirRubros(props.entidadId)).sort((a, b) => a.estado.localeCompare(b.estado) || a.orden - b.orden).map(aEditable)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error'"
    estado="error"
    :mensaje="error ?? undefined"
    @reintentar="cargar"
  />
  <form
    v-else
    class="campos"
    @submit.prevent="alGuardar"
  >
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <ol
      class="lista"
      aria-label="Rubros de los estados financieros"
    >
      <li
        v-for="(f, i) in filas"
        :key="i"
        class="rubro"
      >
        <HudSelector
          v-model="f.estado"
          :etiqueta="`Estado del rubro ${i + 1}`"
          :opciones="opcionesDe(ESTADO_RUBRO)"
        />
        <HudCampo
          v-model="f.codigo"
          :etiqueta="`Código del rubro ${i + 1}`"
        />
        <HudCampo
          v-model="f.nombre"
          :etiqueta="`Nombre del rubro ${i + 1}`"
        />
        <HudCampo
          v-model="f.prefijos"
          :etiqueta="`Prefijos del rubro ${i + 1}`"
          ayuda="Separados por coma, p. ej. 11, 12."
        />
        <HudBoton
          v-if="editable"
          variante="fantasma"
          @click="filas.splice(i, 1)"
        >
          <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar el rubro {{ i + 1 }}</span>
        </HudBoton>
      </li>
    </ol>
    <p
      v-if="guardar.error.value"
      class="error"
      role="alert"
    >
      {{ guardar.error.value }}
    </p>
    <div
      v-if="editable"
      class="botones"
    >
      <HudBoton
        variante="secundario"
        @click="filas.push({ estado: 'situacion_financiera', codigo: '', nombre: '', prefijos: '' })"
      >
        <IMas aria-hidden="true" /> Agregar rubro
      </HudBoton>
      <HudBoton
        tipo="submit"
        :cargando="guardar.cargando.value"
      >
        Guardar los rubros
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="../../vistas/contabilidad.css"></style>
<style scoped>
.lista > li.rubro {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
  align-items: end;
}
</style>

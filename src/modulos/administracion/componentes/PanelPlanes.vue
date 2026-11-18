<script setup lang="ts">
/** Planes preventivos: generan solos sus órdenes según la recurrencia. Crear, editar y pausar. */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Activo, Frecuencia, NuevoPlan, PlanMantenimiento } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { crearPlan, editarPlan, listarActivos, planes } from '../api'
import { OPCIONES_FRECUENCIA, textoRecurrencia } from '../reglas'

const props = defineProps<{ entidadId: string }>()

const entidad = useEntidad()
const puedePlanificar = computed(() => entidad.tienePermiso('mantenimiento.planificar'))
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<PlanMantenimiento[]>([])
const activos = ref<Activo[]>([])
const resultado = ref<string | null>(null)
const nombreActivo = (id?: string | null) => activos.value.find((a) => a.id === id)?.nombre

const editando = ref<PlanMantenimiento | 'nuevo' | null>(null)
const abierto = computed({ get: () => editando.value !== null, set: (si: boolean) => !si && (editando.value = null) })
const actividad = ref('')
const activoId = ref('')
const ubicacion = ref('')
const frecuencia = ref<Frecuencia>('meses')
const intervalo = ref('1')
const inicio = ref('')
const anticipacion = ref('3')
const puntos = ref('')
const errorForm = ref<string | null>(null)
const opcionesActivo = computed(() => activos.value.map((a) => ({ valor: a.id, etiqueta: `${a.codigo} · ${a.nombre}` })))

/** El PUT reemplaza el plan: lo que este formulario no edita se conserva del original. */
const datos = (base: PlanMantenimiento | null = null): NuevoPlan => ({
  responsable: base?.responsable ?? null,
  duracion_estimada_min: base?.duracion_estimada_min ?? null,
  actividad: actividad.value.trim(),
  activo_id: activoId.value || null,
  ubicacion: ubicacion.value.trim() || null,
  recurrencia: { frecuencia: frecuencia.value, intervalo: parseInt(intervalo.value, 10), inicio: inicio.value },
  anticipacion_dias: parseInt(anticipacion.value, 10) || 0,
  checklist: puntos.value.split('\n').map((p) => p.trim()).filter(Boolean),
  activo: base?.activo ?? true,
})

const guardar = useAccion((clave) => {
  const e = editando.value
  return e && e !== 'nuevo' ? editarPlan(props.entidadId, e.id, datos(e)) : crearPlan(props.entidadId, datos(), clave)
})
const pausar = useAccion((_c, p: PlanMantenimiento) =>
  editarPlan(props.entidadId, p.id, {
    actividad: p.actividad, activo_id: p.activo_id, ubicacion: p.ubicacion, recurrencia: p.recurrencia, anticipacion_dias: p.anticipacion_dias,
    responsable: p.responsable, duracion_estimada_min: p.duracion_estimada_min, checklist: p.checklist, activo: !p.activo,
  }),
)

function abrir(p: PlanMantenimiento | 'nuevo') {
  const b = p === 'nuevo' ? null : p
  actividad.value = b?.actividad ?? ''
  activoId.value = b?.activo_id ?? ''
  ubicacion.value = b?.ubicacion ?? ''
  frecuencia.value = b?.recurrencia.frecuencia ?? 'meses'
  intervalo.value = String(b?.recurrencia.intervalo ?? 1)
  inicio.value = b?.recurrencia.inicio ?? hoyEn(entidad.zonaHoraria)
  anticipacion.value = String(b?.anticipacion_dias ?? 3)
  puntos.value = (b?.checklist ?? []).join('\n')
  errorForm.value = null
  guardar.reiniciar()
  editando.value = p
}

async function enviar() {
  errorForm.value = !actividad.value.trim() ? 'Escriba la actividad.' : !/^[1-9]\d*$/.test(intervalo.value) ? 'El intervalo es un número mayor que cero.' : !inicio.value ? 'Elija desde cuándo.' : null
  if (errorForm.value) return
  if (!(await guardar.ejecutar()).ok) return
  editando.value = null
  resultado.value = 'Plan guardado.'
  await cargar()
}

async function cambiar(p: PlanMantenimiento) {
  if ((await pausar.ejecutar(p)).ok) await cargar()
}

async function cargar() {
  try {
    const [p, a] = await Promise.all([planes(props.entidadId), listarActivos(props.entidadId, undefined).catch(() => ({ datos: [] as Activo[] }))])
    lista.value = p
    activos.value = a.datos
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="campos">
    <div
      v-if="puedePlanificar"
      class="botones"
    >
      <HudBoton @click="abrir('nuevo')">
        <IMas aria-hidden="true" /> Nuevo plan
      </HudBoton>
    </div>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="pausar.error.value"
      class="error"
      role="alert"
    >
      {{ pausar.error.value }}
    </p>
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
    <HudEstado
      v-else-if="lista.length === 0"
      estado="vacio"
      mensaje="Aún no hay planes preventivos."
    />
    <ul
      v-else
      class="lista"
      aria-label="Planes preventivos"
    >
      <li
        v-for="p in lista"
        :key="p.id"
      >
        <HudInsignia :tono="p.activo ? 'exito' : 'neutro'">
          {{ p.activo ? 'Activo' : 'En pausa' }}
        </HudInsignia>
        <span class="crece">
          <strong>{{ p.actividad }}</strong>
          <small>
            {{ textoRecurrencia(p.recurrencia) }} desde {{ fechaCalendario(p.recurrencia.inicio) }}{{ nombreActivo(p.activo_id) ? ` · ${nombreActivo(p.activo_id)}` : p.ubicacion ? ` · ${p.ubicacion}` : '' }}
          </small>
        </span>
        <div
          v-if="puedePlanificar"
          class="botones"
        >
          <HudBoton
            variante="secundario"
            @click="abrir(p)"
          >
            Editar<span class="solo-lector"> {{ p.actividad }}</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            :cargando="pausar.cargando.value"
            @click="cambiar(p)"
          >
            {{ p.activo ? 'Pausar' : 'Reanudar' }}<span class="solo-lector"> {{ p.actividad }}</span>
          </HudBoton>
        </div>
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="editando === 'nuevo' ? 'Nuevo plan preventivo' : 'Editar el plan'"
    >
      <form
        id="formulario-plan"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudCampo
          v-model="actividad"
          etiqueta="Actividad"
          autocompletar="off"
        />
        <HudSelector
          v-model="activoId"
          etiqueta="Activo (opcional)"
          vacio="Ninguno"
          :opciones="opcionesActivo"
        />
        <HudCampo
          v-model="ubicacion"
          etiqueta="Ubicación (si no es un activo)"
          autocompletar="off"
        />
        <div class="filtros">
          <HudCampo
            v-model="intervalo"
            etiqueta="Cada"
            modo-entrada="numeric"
          />
          <HudSelector
            v-model="frecuencia"
            etiqueta="Periodo"
            :opciones="OPCIONES_FRECUENCIA"
          />
        </div>
        <HudFecha
          v-model="inicio"
          etiqueta="Desde"
        />
        <HudCampo
          v-model="anticipacion"
          etiqueta="Días de anticipación para crear la orden"
          modo-entrada="numeric"
        />
        <HudCampo
          v-model="puntos"
          etiqueta="Checklist (un punto por línea)"
          multilinea
        />
        <p
          v-if="errorForm || guardar.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? guardar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="editando = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-plan"
          :cargando="guardar.cargando.value"
        >
          Guardar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="../vistas/administracion.css"></style>

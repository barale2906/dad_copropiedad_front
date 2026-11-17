<script setup lang="ts">
/**
 * Solicitudes de los titulares (consultas y reclamos de la Ley 1581): listado con plazo en días
 * hábiles (lo calcula el backend), radicar, tramitar, prórroga única y responder.
 */
import { computed, ref, useTemplateRef, watch } from 'vue'
import { subirArchivo } from '@/api/archivos'
import type { EstadoSolicitudTitular, Persona, SolicitudTitular, TipoSolicitudTitular } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fechaCalendario, fechaHora, hoyEn } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import {
  listarSolicitudes,
  personaPorId,
  prorrogarSolicitud,
  radicarSolicitud,
  responderSolicitud,
  tramitarSolicitud,
} from '../api-proteccion'
import { accionesDeSolicitud, ESTADO_SOLICITUD, plazoVisible, TIPO_SOLICITUD, venceEl } from '../proteccion'
import BuscarPersona from './BuscarPersona.vue'

const props = defineProps<{ copropiedadId: string }>()

const entidad = useEntidad()
const selector = useTemplateRef<HTMLInputElement>('selector')
const puedeVerPersonas = computed(() => entidad.tienePermiso('personas.ver'))

const filtros = ref<{ estado: EstadoSolicitudTitular | ''; vencidas: boolean }>({ estado: '', vencidas: false })
const solicitudes = useListado(
  (despues, f: { estado: EstadoSolicitudTitular | ''; vencidas: boolean }) =>
    listarSolicitudes(props.copropiedadId, despues, {
      estado: f.estado || undefined,
      vencenHasta: f.vencidas ? hoyEn(entidad.zonaHoraria) : undefined,
    }),
  { filtros, retardo: 0 },
)

/** Nombres de los titulares (la solicitud solo trae `persona_id`; solicitud S12 al backend). */
const nombres = ref<Record<string, string>>({})
watch(solicitudes.filas, async (filas) => {
  if (!puedeVerPersonas.value) return
  const faltan = [...new Set(filas.map((s) => s.persona_id))].filter((id) => !(id in nombres.value))
  for (const id of faltan) {
    try {
      nombres.value = { ...nombres.value, [id]: (await personaPorId(props.copropiedadId, id)).nombre }
    } catch {
      nombres.value = { ...nombres.value, [id]: 'Titular' }
    }
  }
})
const titular = (s: SolicitudTitular) => nombres.value[s.persona_id] ?? 'Titular'

const opcionesEstado = (Object.keys(ESTADO_SOLICITUD) as EstadoSolicitudTitular[]).map((valor) => ({
  valor,
  etiqueta: ESTADO_SOLICITUD[valor].texto,
}))
const opcionesTipo = (Object.keys(TIPO_SOLICITUD) as TipoSolicitudTitular[]).map((valor) => ({
  valor,
  etiqueta: TIPO_SOLICITUD[valor],
}))

const COLUMNAS = [
  { clave: 'tipo', titulo: 'Solicitud' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'plazo', titulo: 'Plazo' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

// Radicar
const radicando = ref(false)
const persona = ref<Persona | null>(null)
const tipo = ref<TipoSolicitudTitular>('consulta')
const detalle = ref('')
const intentado = ref(false)
const radicar = useAccion((clave) =>
  radicarSolicitud(
    props.copropiedadId,
    { persona_id: persona.value?.id ?? '', tipo: tipo.value, detalle: detalle.value.trim() || null },
    clave,
  ),
)

function abrirRadicar() {
  persona.value = null
  tipo.value = 'consulta'
  detalle.value = ''
  intentado.value = false
  radicar.reiniciar()
  radicando.value = true
}

async function enviarRadicacion() {
  intentado.value = true
  if (!persona.value) return
  if (!(await radicar.ejecutar()).ok) return
  radicando.value = false
  await solicitudes.recargar()
}

// Acciones sobre una solicitud
const elegida = ref<SolicitudTitular | null>(null)
const prorrogando = ref(false)
const respondiendo = ref(false)
const respuesta = ref('')
const archivo = ref<File | null>(null)
const intentadoRespuesta = ref(false)

const tramitar = useAccion((_c, s: SolicitudTitular) => tramitarSolicitud(props.copropiedadId, s.id), {
  alConflicto: () => solicitudes.recargar(),
})
const prorrogar = useAccion((_c, motivo: string) => prorrogarSolicitud(props.copropiedadId, elegida.value?.id ?? '', motivo))
const responder = useAccion(async () => {
  const archivoId = archivo.value ? (await subirArchivo(props.copropiedadId, archivo.value, 'personal')).id : null
  return responderSolicitud(props.copropiedadId, elegida.value?.id ?? '', {
    respuesta: respuesta.value.trim() || null,
    archivo_id: archivoId,
  })
}, { alConflicto: () => solicitudes.recargar() })

const errorRespuesta = computed(() =>
  intentadoRespuesta.value && !respuesta.value.trim() && !archivo.value ? 'Escriba la respuesta o adjunte un documento.' : null,
)

async function ejecutarTramite(s: SolicitudTitular) {
  elegida.value = s
  if ((await tramitar.ejecutar(s)).ok) await solicitudes.recargar()
}

function abrirProrroga(s: SolicitudTitular) {
  elegida.value = s
  prorrogar.reiniciar()
  prorrogando.value = true
}

async function confirmarProrroga(motivo: string) {
  if (!(await prorrogar.ejecutar(motivo)).ok) return
  prorrogando.value = false
  await solicitudes.recargar()
}

function abrirRespuesta(s: SolicitudTitular) {
  elegida.value = s
  respuesta.value = ''
  archivo.value = null
  intentadoRespuesta.value = false
  responder.reiniciar()
  respondiendo.value = true
}

async function enviarRespuesta() {
  intentadoRespuesta.value = true
  if (errorRespuesta.value) return
  if (!(await responder.ejecutar()).ok) return
  respondiendo.value = false
  await solicitudes.recargar()
}
</script>

<template>
  <div class="solicitudes">
    <div class="barra">
      <HudSelector
        v-model="filtros.estado"
        etiqueta="Estado"
        vacio="Todos"
        :opciones="opcionesEstado"
      />
      <label class="casilla">
        <input
          v-model="filtros.vencidas"
          type="checkbox"
        >
        Solo vencidas sin responder
      </label>
      <HudBoton
        v-if="puedeVerPersonas"
        @click="abrirRadicar"
      >
        <IMas aria-hidden="true" /> Radicar solicitud
      </HudBoton>
    </div>

    <p
      v-if="tramitar.error.value"
      class="error"
      role="alert"
    >
      {{ tramitar.error.value }}
    </p>

    <HudEstado
      v-if="solicitudes.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="solicitudes.estado.value === 'error'"
      estado="error"
      :mensaje="solicitudes.error.value ?? undefined"
      :referencia="solicitudes.referencia.value"
      @reintentar="solicitudes.recargar()"
    />
    <HudEstado
      v-else-if="solicitudes.estado.value === 'vacio'"
      estado="vacio"
      mensaje="No hay solicitudes con esos filtros."
    />
    <template v-else>
      <HudTabla
        :filas="solicitudes.filas.value"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Solicitudes de los titulares"
      >
        <template #celda-tipo="{ fila }">
          <span class="celda">
            <strong>{{ TIPO_SOLICITUD[fila.tipo] }} · {{ titular(fila) }}</strong>
            <small>Radicada {{ fechaHora(fila.radicada_en, entidad.zonaHoraria) }}</small>
            <small v-if="fila.detalle">{{ fila.detalle }}</small>
          </span>
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="ESTADO_SOLICITUD[fila.estado].tono">
            {{ ESTADO_SOLICITUD[fila.estado].texto }}
          </HudInsignia>
        </template>
        <template #celda-plazo="{ fila }">
          <span class="celda">
            <HudInsignia :tono="plazoVisible(fila).tono">{{ plazoVisible(fila).texto }}</HudInsignia>
            <small v-if="fila.estado !== 'respondida'">
              Vence el {{ fechaCalendario(venceEl(fila)) }}{{ fila.prorrogada_hasta ? ' (prorrogada)' : '' }}
            </small>
          </span>
        </template>
        <template #celda-acciones="{ fila }">
          <span class="acciones">
            <HudBoton
              v-if="accionesDeSolicitud(fila).includes('tramitar')"
              variante="fantasma"
              :cargando="tramitar.cargando.value && elegida?.id === fila.id"
              @click="ejecutarTramite(fila)"
            >
              Tramitar<span class="solo-lector"> la solicitud de {{ titular(fila) }}</span>
            </HudBoton>
            <HudBoton
              v-if="accionesDeSolicitud(fila).includes('prorrogar')"
              variante="fantasma"
              @click="abrirProrroga(fila)"
            >
              Prorrogar<span class="solo-lector"> la solicitud de {{ titular(fila) }}</span>
            </HudBoton>
            <HudBoton
              v-if="accionesDeSolicitud(fila).includes('responder')"
              variante="secundario"
              @click="abrirRespuesta(fila)"
            >
              Responder<span class="solo-lector"> la solicitud de {{ titular(fila) }}</span>
            </HudBoton>
          </span>
        </template>
      </HudTabla>
      <HudCargarMas
        :hay-mas="solicitudes.hayMas.value"
        :cargando="solicitudes.cargando.value"
        @cargar="solicitudes.cargarMas()"
      />
    </template>

    <HudDialogo
      v-model:abierto="radicando"
      titulo="Radicar solicitud"
    >
      <div class="campos">
        <BuscarPersona
          v-if="!persona"
          :copropiedad-id="copropiedadId"
          etiqueta="Titular"
          @elegir="persona = $event"
        />
        <p
          v-else
          class="elegida"
        >
          Titular: <strong>{{ persona.nombre }}</strong>
          <button
            type="button"
            class="enlace"
            @click="persona = null"
          >
            Cambiar
          </button>
        </p>
        <p
          v-if="intentado && !persona"
          class="error"
          role="alert"
        >
          Elija el titular de la solicitud.
        </p>
        <form
          id="formulario-radicar"
          class="campos"
          @submit.prevent="enviarRadicacion"
        >
          <HudSelector
            v-model="tipo"
            etiqueta="Tipo de solicitud"
            :opciones="opcionesTipo"
          />
          <HudCampo
            v-model="detalle"
            etiqueta="Detalle (opcional)"
            multilinea
          />
          <p
            v-if="radicar.error.value"
            class="error"
            role="alert"
          >
            {{ radicar.error.value }}
          </p>
        </form>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="radicando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-radicar"
          :cargando="radicar.cargando.value"
        >
          Radicar
        </HudBoton>
      </template>
    </HudDialogo>

    <ConfirmarConMotivo
      v-model:abierto="prorrogando"
      titulo="Prorrogar la solicitud"
      accion="Prorrogar"
      descripcion="La prórroga es única: 5 días hábiles las consultas y 8 los reclamos. El titular verá el motivo."
      :cargando="prorrogar.cargando.value"
      :error="prorrogar.error.value"
      @confirmar="confirmarProrroga"
    />

    <HudDialogo
      v-model:abierto="respondiendo"
      titulo="Responder la solicitud"
    >
      <form
        id="formulario-respuesta"
        class="campos"
        novalidate
        @submit.prevent="enviarRespuesta"
      >
        <HudCampo
          v-model="respuesta"
          etiqueta="Respuesta"
          multilinea
          :error="errorRespuesta"
        />
        <div class="archivo">
          <input
            ref="selector"
            type="file"
            accept="application/pdf,image/*"
            class="solo-lector"
            tabindex="-1"
            aria-hidden="true"
            @change="archivo = ($event.target as HTMLInputElement).files?.[0] ?? null"
          >
          <HudBoton
            variante="secundario"
            @click="selector?.click()"
          >
            {{ archivo ? 'Cambiar documento' : 'Adjuntar documento (opcional)' }}
          </HudBoton>
          <span v-if="archivo">{{ archivo.name }}</span>
        </div>
        <p
          v-if="responder.error.value"
          class="error"
          role="alert"
        >
          {{ responder.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="respondiendo = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-respuesta"
          :cargando="responder.cargando.value"
        >
          Enviar respuesta
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped>
.solicitudes {
  display: grid;
  gap: 12px;
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
}

.barra > :first-child {
  flex: 0 1 220px;
}

.barra :deep(.hud-boton) {
  margin-left: auto;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.celda {
  display: grid;
  gap: 2px;
  justify-items: start;
  text-align: left;
}

.acciones {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

small {
  color: var(--texto-3);
}

.campos {
  display: grid;
  gap: 14px;
}

.archivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.elegida,
.error {
  margin: 0;
}

.error {
  color: var(--magenta);
}

.enlace {
  min-height: 40px;
  border: 0;
  background: none;
  color: var(--cian);
  text-decoration: underline;
  cursor: pointer;
}
</style>

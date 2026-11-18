<script setup lang="ts">
/**
 * Una orden de trabajo: datos, checklist, costos y evidencias. Iniciar y ejecutar (quien
 * planifica o la tiene asignada), verificar (con el permiso y **otra cuenta** que la que la
 * ejecutó: a esa cuenta no se le ofrece) y cancelar con motivo.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DetalleOrden, MomentoEvidencia, PuntoChecklist } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { moneda, sumar } from '@/formato/decimales'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { agregarEvidencia, avanzarOrden, detalleOrden } from '../api'
import { accionesOrden, ESTADO_ORDEN, MOMENTO_EVIDENCIA, TIPO_ORDEN } from '../reglas'

const props = defineProps<{ entidadId: string; ordenId: string }>()

const entidad = useEntidad()
const cuenta = useCuenta()
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleOrden | null>(null)
const resultado = ref<string | null>(null)
const o = computed(() => detalle.value?.orden ?? null)
const acciones = computed(() =>
  o.value
    ? accionesOrden(o.value, {
        cuentaId: cuenta.id,
        planificar: entidad.tienePermiso('mantenimiento.planificar'),
        ejecutar: entidad.tienePermiso('mantenimiento.ejecutar'),
        verificar: entidad.tienePermiso('mantenimiento.verificar'),
      })
    : [],
)
const laEjecuteYo = computed(() => o.value?.estado === 'ejecutada' && !!cuenta.id && o.value.ejecutada_por === cuenta.id)
const costoTotal = computed(() => (o.value ? sumar(o.value.costo_mano_obra, o.value.costo_repuestos) : '0'))

// Ejecutar
const ejecutando = ref(false)
const checklist = ref<PuntoChecklist[]>([])
const manoObra = ref('')
const repuestos = ref('')
const observaciones = ref('')
const recibido = ref('')

// Verificar y cancelar
const verificando = ref(false)
const aprobada = ref(true)
const observacionVerificacion = ref('')
const resolverTicket = ref(true)
const cancelando = ref(false)

// Evidencias
const evidencias = useAdjuntos(() => props.entidadId, 'interno')
const momento = ref<MomentoEvidencia>('antes')

const avance = useAccion((_c, cuerpo: Parameters<typeof avanzarOrden>[2]) => avanzarOrden(props.entidadId, props.ordenId, cuerpo), {
  alConflicto: () => cargar(),
})
const evidencia = useAccion((_c, archivo: string) => agregarEvidencia(props.entidadId, props.ordenId, archivo, momento.value))

async function avanzar(cuerpo: Parameters<typeof avanzarOrden>[2], texto: string) {
  const r = await avance.ejecutar(cuerpo)
  if (!r.ok) return false
  resultado.value = texto
  await cargar()
  return true
}

function abrirEjecucion() {
  checklist.value = (o.value?.checklist ?? []).map((p) => ({ ...p }))
  manoObra.value = repuestos.value = observaciones.value = recibido.value = ''
  avance.reiniciar()
  ejecutando.value = true
}

async function ejecutar() {
  const ok = await avanzar(
    {
      accion: 'ejecutar',
      checklist: checklist.value,
      costo_mano_obra: manoObra.value || '0',
      costo_repuestos: repuestos.value || '0',
      observaciones: observaciones.value.trim() || null,
      recibido_por: recibido.value.trim() || null,
    },
    'Orden ejecutada: otra cuenta debe verificarla.',
  )
  if (ok) ejecutando.value = false
}

async function verificar() {
  const ok = await avanzar(
    { accion: 'verificar', aprobada: aprobada.value, observacion: observacionVerificacion.value.trim() || null, resolver_ticket: !!o.value?.ticket_id && resolverTicket.value },
    aprobada.value ? 'Orden verificada.' : 'Orden devuelta a ejecución.',
  )
  if (ok) verificando.value = false
}

async function cancelar(motivo: string) {
  if (await avanzar({ accion: 'cancelar', motivo }, 'Orden cancelada.')) cancelando.value = false
}

async function subirEvidencias(archivos: File[]) {
  const antes = evidencias.adjuntos.value.length
  await evidencias.subir(archivos)
  for (const a of evidencias.adjuntos.value.slice(antes)) {
    if (!(await evidencia.ejecutar(a.id)).ok) return
  }
  evidencias.limpiar()
  resultado.value = 'Evidencia agregada.'
  await cargar()
}

async function cargar() {
  try {
    detalle.value = await detalleOrden(props.entidadId, props.ordenId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(() => {
  void cuenta.asegurar().catch(() => undefined)
  void cargar()
})
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error' || !o || !detalle"
    estado="error"
    :mensaje="error ?? undefined"
    @reintentar="cargar"
  />
  <template v-else>
    <header class="encabezado">
      <div>
        <small>{{ o.numero }} · {{ TIPO_ORDEN[o.tipo] }}</small>
        <h1>{{ o.descripcion }}</h1>
      </div>
      <HudInsignia :tono="ESTADO_ORDEN[o.estado].tono">
        {{ ESTADO_ORDEN[o.estado].texto }}
      </HudInsignia>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="laEjecuteYo"
      class="aviso"
    >
      Usted ejecutó esta orden: la verifica otra cuenta.
    </p>
    <p
      v-for="e in [avance.error.value, evidencia.error.value, evidencias.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>

    <HudPanel etiqueta="Orden">
      <dl class="datos">
        <div><dt>Programada para</dt><dd>{{ fechaCalendario(o.programada_para) }}</dd></div>
        <div v-if="o.ubicacion">
          <dt>Ubicación</dt><dd>{{ o.ubicacion }}</dd>
        </div>
        <div v-if="o.ejecutada_en">
          <dt>Ejecutada</dt><dd>{{ fechaHora(o.ejecutada_en, zona) }}</dd>
        </div>
        <div v-if="o.verificada_en">
          <dt>Verificada</dt><dd>{{ fechaHora(o.verificada_en, zona) }}</dd>
        </div>
        <div><dt>Costo</dt><dd>{{ moneda(costoTotal) }}</dd></div>
        <div v-if="o.recibido_por">
          <dt>Recibió</dt><dd>{{ o.recibido_por }}</dd>
        </div>
      </dl>
      <p
        v-if="o.observaciones"
        class="cuerpo"
      >
        {{ o.observaciones }}
      </p>
      <div
        v-if="acciones.length"
        class="botones acciones"
      >
        <HudBoton
          v-if="acciones.includes('iniciar')"
          :cargando="avance.cargando.value"
          @click="avanzar({ accion: 'iniciar' }, 'Orden en ejecución.')"
        >
          Iniciar
        </HudBoton>
        <HudBoton
          v-if="acciones.includes('ejecutar')"
          @click="abrirEjecucion"
        >
          Registrar la ejecución
        </HudBoton>
        <HudBoton
          v-if="acciones.includes('verificar')"
          @click="verificando = true"
        >
          Verificar
        </HudBoton>
        <HudBoton
          v-if="acciones.includes('cancelar')"
          variante="fantasma"
          @click="cancelando = true"
        >
          Cancelar la orden
        </HudBoton>
      </div>
    </HudPanel>

    <HudPanel
      v-if="o.checklist.length"
      etiqueta="Checklist"
    >
      <ul
        class="lista"
        aria-label="Checklist"
      >
        <li
          v-for="(p, i) in o.checklist"
          :key="i"
        >
          <HudInsignia :tono="p.cumplido ? 'exito' : 'neutro'">
            {{ p.cumplido ? 'Cumplido' : 'Pendiente' }}
          </HudInsignia>
          <span class="crece">{{ p.descripcion }}<small v-if="p.observacion"> · {{ p.observacion }}</small></span>
        </li>
      </ul>
    </HudPanel>

    <HudPanel etiqueta="Evidencias">
      <div class="campos">
        <p
          v-if="detalle.evidencias.length === 0"
          class="texto-2"
        >
          Aún no hay evidencias.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Evidencias"
        >
          <li
            v-for="(e, i) in detalle.evidencias"
            :key="e.archivo_id"
          >
            <span class="crece">{{ MOMENTO_EVIDENCIA[e.momento] }} · evidencia {{ i + 1 }}</span>
            <HudBoton
              variante="fantasma"
              @click="evidencias.abrir(e.archivo_id)"
            >
              Ver<span class="solo-lector"> evidencia {{ i + 1 }}</span>
            </HudBoton>
          </li>
        </ul>
        <template v-if="acciones.includes('evidencias')">
          <HudSelector
            v-model="momento"
            etiqueta="Momento de la evidencia"
            :opciones="opcionesDe(MOMENTO_EVIDENCIA)"
          />
          <HudAdjuntos
            :adjuntos="evidencias.adjuntos.value"
            acepta="image/*,application/pdf"
            :subiendo="evidencias.subiendo.value || evidencia.cargando.value"
            @subir="subirEvidencias"
            @abrir="evidencias.abrir"
            @quitar="evidencias.quitar"
          />
        </template>
      </div>
    </HudPanel>

    <HudDialogo
      v-model:abierto="ejecutando"
      titulo="Registrar la ejecución"
    >
      <form
        id="formulario-ejecucion"
        class="campos"
        @submit.prevent="ejecutar"
      >
        <fieldset
          v-if="checklist.length"
          class="opciones-radio"
        >
          <legend>Checklist (marque lo cumplido)</legend>
          <label
            v-for="(p, i) in checklist"
            :key="i"
          >
            <input
              v-model="p.cumplido"
              type="checkbox"
            > {{ p.descripcion }}
          </label>
        </fieldset>
        <HudCampoMonto
          v-model="manoObra"
          etiqueta="Costo de mano de obra"
        />
        <HudCampoMonto
          v-model="repuestos"
          etiqueta="Costo de repuestos"
        />
        <HudCampo
          v-model="observaciones"
          etiqueta="Observaciones"
          multilinea
        />
        <HudCampo
          v-model="recibido"
          etiqueta="Recibió el trabajo (opcional)"
          autocompletar="off"
        />
        <p
          v-if="avance.error.value"
          class="error"
          role="alert"
        >
          {{ avance.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="ejecutando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-ejecucion"
          :cargando="avance.cargando.value"
        >
          Marcar como ejecutada
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="verificando"
      titulo="Verificar la orden"
    >
      <form
        id="formulario-verificacion"
        class="campos"
        @submit.prevent="verificar"
      >
        <fieldset class="opciones-radio">
          <legend>¿El trabajo quedó bien?</legend>
          <label>
            <input
              v-model="aprobada"
              type="radio"
              name="aprobada"
              :value="true"
            > Sí, aprobarlo
          </label>
          <label>
            <input
              v-model="aprobada"
              type="radio"
              name="aprobada"
              :value="false"
            > No, devolverlo a ejecución
          </label>
        </fieldset>
        <HudCampo
          v-model="observacionVerificacion"
          etiqueta="Observación (opcional)"
          multilinea
        />
        <label
          v-if="o.ticket_id && aprobada"
          class="casilla"
        >
          <input
            v-model="resolverTicket"
            type="checkbox"
          > Resolver también la PQRS que la originó
        </label>
        <p
          v-if="avance.error.value"
          class="error"
          role="alert"
        >
          {{ avance.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="verificando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-verificacion"
          :cargando="avance.cargando.value"
        >
          {{ aprobada ? 'Aprobar' : 'Devolver' }}
        </HudBoton>
      </template>
    </HudDialogo>

    <ConfirmarConMotivo
      v-model:abierto="cancelando"
      titulo="Cancelar la orden"
      accion="Cancelar la orden"
      :cargando="avance.cargando.value"
      :error="avance.error.value"
      @confirmar="cancelar"
    />
  </template>
</template>

<style scoped src="../vistas/administracion.css"></style>
<style scoped>
.encabezado h1 {
  margin: 2px 0 0;
}

.cuerpo {
  margin: 12px 0 0;
  white-space: pre-wrap;
}

.acciones {
  margin-top: 14px;
}
</style>

<script setup lang="ts">
/**
 * Mis solicitudes (PQRS): radicar (tipo, categoría, asunto, descripción, bien y adjuntos), ver el
 * seguimiento con los mensajes públicos (nunca las notas internas), responder cuando la
 * administración lo pide, calificar al resolverse y cerrar o reabrir dentro del plazo.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import { abrirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { CategoriaTicket, DetalleTicket, TicketDeCuenta, TipoTicket } from '@/api/tipos'
import { TIPO_TICKET } from '@/composables/textos-gestion'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { fechaHora } from '@/formato/fechas'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HiloMensajes, { type MensajeHilo } from '@/hud/componentes/HiloMensajes.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { type BienCorto, useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { calificarTicket, cambiarEstadoTicket, categoriasTicket, detalleTicket, misTickets, radicarTicket, responderTicket } from '../api'
import { accionesDelSolicitante, ESTADO_TICKET, TIPOS_PARA_RESIDENTE } from '../reglas'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const ticketId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (t = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: t } })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<TicketDeCuenta[]>([])
const detalle = ref<DetalleTicket | null>(null)
const resultado = ref<string | null>(null)

const propias = computed(() => lista.value.filter((t) => t.copropiedad_id === id.value))
const hilo = computed<MensajeHilo[]>(() =>
  (detalle.value?.mensajes ?? [])
    .filter((m) => !m.interno)
    .map((m) => ({ id: m.id, texto: m.texto, autor: m.del_solicitante ? 'Usted' : 'Administración', hora: fechaHora(m.creado_en, zona.value), propio: m.del_solicitante })),
)
const adjuntosPublicos = computed(() => (detalle.value?.adjuntos ?? []).filter((a) => !a.interno))
const acciones = computed(() => (detalle.value ? accionesDelSolicitante(detalle.value.ticket) : null))

// Radicar
const radicando = ref(false)
const tipo = ref<TipoTicket>('solicitud_mantenimiento')
const categoria = ref('')
const asunto = ref('')
const descripcion = ref('')
const bienId = ref('')
const adjuntos = useAdjuntos(id, 'personal')
const categorias = ref<CategoriaTicket[]>([])
const propios = ref<BienCorto[]>([])
const intentado = ref(false)
const opcionesTipo = TIPOS_PARA_RESIDENTE.map((valor) => ({ valor, etiqueta: TIPO_TICKET[valor] }))
const opcionesCategoria = computed(() => categorias.value.filter((c) => c.activa).map((c) => ({ valor: c.id, etiqueta: c.nombre })))
const opcionesBien = computed(() => propios.value.map((b) => ({ valor: b.id, etiqueta: b.codigo })))
const errorRadicar = computed(() => (intentado.value && (!asunto.value.trim() || !descripcion.value.trim()) ? 'Escriba el asunto y la descripción.' : null))

const radicar = useAccion((clave) =>
  radicarTicket(
    id.value,
    {
      tipo: tipo.value,
      categoria_id: categoria.value || null,
      asunto: asunto.value.trim(),
      descripcion: descripcion.value.trim(),
      bien_privado_id: bienId.value || null,
      adjuntos: adjuntos.ids(),
      canal: 'web',
    },
    clave,
  ),
)

async function abrirRadicar() {
  tipo.value = 'solicitud_mantenimiento'
  categoria.value = asunto.value = descripcion.value = ''
  adjuntos.limpiar()
  intentado.value = false
  radicar.reiniciar()
  radicando.value = true
  const [c, p] = await Promise.all([categoriasTicket(id.value).catch(() => []), bienes.asegurarMisBienes().catch(() => [])])
  categorias.value = c
  propios.value = p
  bienId.value = p.length === 1 ? (p[0]?.id ?? '') : ''
}

async function enviarRadicacion() {
  intentado.value = true
  if (errorRadicar.value) return
  const r = await radicar.ejecutar()
  if (!r.ok) return
  radicando.value = false
  resultado.value = `Solicitud ${r.valor.numero} radicada. Le avisaremos cada avance.`
  await router.push(ruta(r.valor.id))
}

// Seguimiento
const respuesta = ref('')
const responder = useAccion(() => responderTicket(id.value, ticketId.value, respuesta.value.trim(), []))
const calificando = ref(false)
const calificacion = ref(0)
const comentario = ref('')
const calificar = useAccion(() => calificarTicket(id.value, ticketId.value, calificacion.value, comentario.value.trim() || null))
const transicion = useAccion((_c, hacia: 'cerrado' | 'reabierto') => cambiarEstadoTicket(id.value, ticketId.value, hacia))

async function enviarRespuesta() {
  if (!respuesta.value.trim()) return
  if (!(await responder.ejecutar()).ok) return
  respuesta.value = ''
  resultado.value = 'Respuesta enviada.'
  await cargarDetalle()
}

async function enviarCalificacion() {
  if (calificacion.value < 1) return
  if (!(await calificar.ejecutar()).ok) return
  calificando.value = false
  resultado.value = '¡Gracias por calificar la atención!'
  await cargarDetalle()
}

async function cambiar(hacia: 'cerrado' | 'reabierto') {
  if (!(await transicion.ejecutar(hacia)).ok) return
  resultado.value = hacia === 'cerrado' ? 'Solicitud cerrada.' : 'Solicitud reabierta: la administración la retomará.'
  await cargarDetalle()
}

async function cargarDetalle() {
  try {
    detalle.value = await detalleTicket(id.value, ticketId.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

async function cargar() {
  estado.value = 'cargando'
  if (ticketId.value) return cargarDetalle()
  try {
    lista.value = await misTickets()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(ticketId, () => {
  detalle.value = null
  cargar()
})
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-pqrs">
    <header class="encabezado">
      <div>
        <RouterLink
          v-if="ticketId"
          :to="ruta()"
          class="volver"
        >
          <IVolver aria-hidden="true" /> Mis solicitudes
        </RouterLink>
        <h1 id="titulo-pqrs">
          {{ detalle ? `Solicitud ${detalle.ticket.numero}` : 'Mis solicitudes' }}
        </h1>
      </div>
      <HudBoton
        v-if="!ticketId"
        @click="abrirRadicar"
      >
        <IMas aria-hidden="true" /> Nueva solicitud
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
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

    <template v-else-if="ticketId && detalle && acciones">
      <HudPanel :etiqueta="TIPO_TICKET[detalle.ticket.tipo]">
        <div class="cabecera">
          <h2>{{ detalle.ticket.asunto }}</h2>
          <HudInsignia :tono="ESTADO_TICKET[detalle.ticket.estado].tono">
            {{ ESTADO_TICKET[detalle.ticket.estado].texto }}
          </HudInsignia>
        </div>
        <p class="cuerpo">
          {{ detalle.ticket.descripcion }}
        </p>
        <small>Radicada {{ fechaHora(detalle.ticket.creado_en, zona) }}{{ detalle.ticket.vence_en ? ` · respuesta esperada antes del ${fechaHora(detalle.ticket.vence_en, zona)}` : '' }}</small>
        <ul
          v-if="adjuntosPublicos.length"
          class="adjuntos"
          aria-label="Adjuntos"
        >
          <li
            v-for="(a, i) in adjuntosPublicos"
            :key="a.archivo_id"
          >
            <button
              type="button"
              class="enlace"
              @click="abrirArchivo(id, a.archivo_id)"
            >
              Adjunto {{ i + 1 }}
            </button>
          </li>
        </ul>
      </HudPanel>

      <HudPanel etiqueta="Seguimiento">
        <HiloMensajes
          :mensajes="hilo"
          vacio="Aún no hay respuestas."
        />
        <form
          v-if="acciones.responder"
          class="campos"
          @submit.prevent="enviarRespuesta"
        >
          <HudCampo
            v-model="respuesta"
            etiqueta="Escribir a la administración"
            multilinea
          />
          <p
            v-if="responder.error.value"
            class="error"
            role="alert"
          >
            {{ responder.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="responder.cargando.value"
              :deshabilitado="!respuesta.trim()"
            >
              Enviar
            </HudBoton>
          </div>
        </form>
      </HudPanel>

      <HudPanel
        v-if="acciones.calificar || acciones.cerrar || acciones.reabrir || detalle.ticket.encuesta"
        etiqueta="¿Quedó resuelta?"
      >
        <p
          v-if="detalle.ticket.encuesta"
          class="texto-2"
        >
          Usted calificó la atención con {{ detalle.ticket.encuesta.calificacion }} de 5.
        </p>
        <p
          v-if="transicion.error.value"
          class="error"
          role="alert"
        >
          {{ transicion.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            v-if="acciones.calificar"
            @click="calificando = true"
          >
            Calificar la atención
          </HudBoton>
          <HudBoton
            v-if="acciones.cerrar"
            variante="secundario"
            :cargando="transicion.cargando.value"
            @click="cambiar('cerrado')"
          >
            Cerrar la solicitud
          </HudBoton>
          <HudBoton
            v-if="acciones.reabrir"
            variante="fantasma"
            :cargando="transicion.cargando.value"
            @click="cambiar('reabierto')"
          >
            No quedó resuelta: reabrir
          </HudBoton>
        </div>
      </HudPanel>
    </template>

    <template v-else>
      <HudEstado
        v-if="propias.length === 0"
        estado="vacio"
        mensaje="Aún no ha radicado solicitudes."
      />
      <ul
        v-else
        class="lista"
        aria-label="Solicitudes radicadas"
      >
        <li
          v-for="t in propias"
          :key="t.ticket_id"
        >
          <RouterLink :to="ruta(t.ticket_id)">
            <strong>{{ t.numero }} · {{ t.asunto }}</strong>
          </RouterLink>
          <HudInsignia :tono="ESTADO_TICKET[t.estado].tono">
            {{ ESTADO_TICKET[t.estado].texto }}
          </HudInsignia>
          <small>{{ TIPO_TICKET[t.tipo] }} · {{ fechaHora(t.actualizado_en, zona) }}</small>
        </li>
      </ul>
    </template>

    <HudDialogo
      v-model:abierto="radicando"
      titulo="Nueva solicitud"
    >
      <form
        id="formulario-pqrs"
        class="campos"
        novalidate
        @submit.prevent="enviarRadicacion"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesTipo"
        />
        <HudSelector
          v-if="opcionesCategoria.length"
          v-model="categoria"
          etiqueta="Categoría (opcional)"
          vacio="Sin categoría"
          :opciones="opcionesCategoria"
        />
        <HudSelector
          v-if="opcionesBien.length > 1"
          v-model="bienId"
          etiqueta="Bien"
          vacio="Ninguno en particular"
          :opciones="opcionesBien"
        />
        <HudCampo
          v-model="asunto"
          etiqueta="Asunto"
          :maximo="120"
          requerido
        />
        <HudCampo
          v-model="descripcion"
          etiqueta="Descripción"
          multilinea
          requerido
        />
        <div>
          <p class="texto-2">
            Fotos o documentos (opcional)
          </p>
          <HudAdjuntos
            :adjuntos="adjuntos.adjuntos.value"
            acepta="image/*,application/pdf"
            :subiendo="adjuntos.subiendo.value"
            @subir="adjuntos.subir"
            @abrir="adjuntos.abrir"
            @quitar="adjuntos.quitar"
          />
          <p
            v-if="adjuntos.error.value"
            class="error"
            role="alert"
          >
            {{ adjuntos.error.value }}
          </p>
        </div>
        <p
          v-if="errorRadicar || radicar.error.value"
          class="error"
          role="alert"
        >
          {{ errorRadicar ?? radicar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="radicando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-pqrs"
          :cargando="radicar.cargando.value"
          :deshabilitado="adjuntos.subiendo.value"
        >
          Radicar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="calificando"
      titulo="Calificar la atención"
    >
      <form
        id="formulario-encuesta"
        class="campos"
        @submit.prevent="enviarCalificacion"
      >
        <fieldset class="estrellas">
          <legend>¿Cómo fue la atención?</legend>
          <label
            v-for="n in 5"
            :key="n"
          >
            <input
              v-model="calificacion"
              type="radio"
              name="calificacion"
              :value="n"
            >
            {{ n }}
          </label>
        </fieldset>
        <HudCampo
          v-model="comentario"
          etiqueta="Comentario (opcional)"
          multilinea
        />
        <p
          v-if="calificar.error.value"
          class="error"
          role="alert"
        >
          {{ calificar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="calificando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-encuesta"
          :cargando="calificar.cargando.value"
          :deshabilitado="calificacion < 1"
        >
          Enviar calificación
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./portal.css"></style>
<style scoped>
.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

h2 {
  margin: 0;
  font-size: clamp(19px, 5vw, 24px);
}

.cuerpo {
  margin: 8px 0;
  white-space: pre-wrap;
}


.adjuntos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.enlace {
  min-height: 40px;
  border: 0;
  background: none;
  color: var(--cian);
  text-decoration: underline;
  cursor: pointer;
}

.lista a {
  color: var(--texto);
}

.estrellas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  border: 0;
}

.estrellas legend {
  width: 100%;
  margin-bottom: 6px;
  font-weight: 600;
}

.estrellas label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
}

.estrellas input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}
</style>

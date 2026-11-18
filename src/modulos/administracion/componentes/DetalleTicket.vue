<script setup lang="ts">
/**
 * Atención de un ticket: datos (la identidad del denunciante de convivencia llega oculta),
 * clasificar y asignar, los cambios de estado que el backend permite **a esta cuenta**
 * (`transiciones_permitidas`), el hilo con las notas internas marcadas y responder.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CategoriaTicket, DetalleTicket, EstadoTicket, PrioridadTicket, Ticket, TipoTicket } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { PRIORIDAD_TICKET, TIPO_TICKET } from '@/composables/textos-gestion'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { fechaHora } from '@/formato/fechas'
import HiloMensajes, { type MensajeHilo } from '@/hud/componentes/HiloMensajes.vue'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SemaforoVencimiento from '@/hud/componentes/SemaforoVencimiento.vue'
import { useBienes } from '@/stores/bienes'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { asignarTicket, categoriasTicket, clasificarTicket, detalleTicket, listarTickets, mensajeTicket, transicionTicket } from '../api'
import { ACCION_TICKET, ESTADO_TICKET, etiquetaMotivo, pideMotivo, ticketPendiente } from '../reglas'

const props = defineProps<{ entidadId: string; ticketId: string }>()

const entidad = useEntidad()
const cuenta = useCuenta()
const bienes = useBienes()
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleTicket | null>(null)
const categorias = ref<CategoriaTicket[]>([])
const resultado = ref<string | null>(null)
const t = computed(() => detalle.value?.ticket ?? null)
const puedeAsignar = computed(() => entidad.tienePermiso('tickets.asignar') && !!t.value && ticketPendiente(t.value.estado))
const nombreCategoria = computed(() => categorias.value.find((c) => c.id === t.value?.categoria_id)?.nombre ?? 'Sin categoría')

const hilo = computed<MensajeHilo[]>(() =>
  (detalle.value?.mensajes ?? []).map((m) => ({
    id: m.id,
    texto: m.texto,
    autor: m.del_solicitante ? 'Solicitante' : m.autor_cuenta_id && m.autor_cuenta_id === cuenta.id ? 'Usted' : 'Administración',
    hora: fechaHora(m.creado_en, zona.value),
    propio: !m.del_solicitante,
    interno: m.interno,
  })),
)

const opcionesPrioridad = (Object.keys(PRIORIDAD_TICKET) as PrioridadTicket[]).map((valor) => ({ valor, etiqueta: PRIORIDAD_TICKET[valor].texto }))
const opcionesCategoria = computed(() =>
  categorias.value.filter((c) => c.activa || c.id === t.value?.categoria_id).map((c) => ({ valor: c.id, etiqueta: c.nombre })),
)

// Clasificar
const tipo = ref<TipoTicket | ''>('')
const prioridad = ref<PrioridadTicket | ''>('')
const categoria = ref('')
const clasificar = useAccion(() =>
  clasificarTicket(props.entidadId, props.ticketId, {
    tipo: tipo.value || undefined,
    prioridad: prioridad.value || undefined,
    categoria_id: categoria.value || null,
  }),
)
const asignar = useAccion(() => asignarTicket(props.entidadId, props.ticketId, { cuenta_id: cuenta.id }))

// Transiciones
const hacia = ref<EstadoTicket | null>(null)
const motivo = ref('')
const original = ref('')
const candidatos = ref<Ticket[]>([])
const errorTransicion = ref<string | null>(null)
const transicion = useAccion((_c, e: EstadoTicket) => transicionTicket(props.entidadId, props.ticketId, e, motivo.value, original.value || undefined), {
  alConflicto: () => cargar(),
})
const opcionesOriginal = computed(() => candidatos.value.map((c) => ({ valor: c.id, etiqueta: `${c.numero} · ${c.asunto}` })))
const abiertaTransicion = computed({ get: () => hacia.value !== null, set: (si: boolean) => !si && (hacia.value = null) })

// Responder
const texto = ref('')
const interno = ref(false)
const adjuntos = useAdjuntos(() => props.entidadId, 'interno')
const responder = useAccion(() => mensajeTicket(props.entidadId, props.ticketId, texto.value.trim(), interno.value, adjuntos.ids()))

async function guardarClasificacion() {
  if ((await clasificar.ejecutar()).ok) {
    resultado.value = 'Clasificación guardada.'
    await cargar()
  }
}

async function asignarme() {
  if ((await asignar.ejecutar()).ok) {
    resultado.value = 'El ticket quedó asignado a usted.'
    await cargar()
  }
}

async function abrirTransicion(e: EstadoTicket) {
  resultado.value = errorTransicion.value = null
  motivo.value = original.value = ''
  transicion.reiniciar()
  if (!pideMotivo(e) && e !== 'duplicado') {
    await cambiar(e)
    return
  }
  if (e === 'duplicado') {
    const { datos } = await listarTickets(props.entidadId, undefined).catch(() => ({ datos: [] as Ticket[] }))
    candidatos.value = datos.filter((x) => x.id !== props.ticketId)
  }
  hacia.value = e
}

async function cambiar(e: EstadoTicket) {
  errorTransicion.value = pideMotivo(e) && !motivo.value.trim() ? `Escriba: ${etiquetaMotivo(e).toLowerCase()}.` : e === 'duplicado' && !original.value ? 'Elija el ticket original.' : null
  if (errorTransicion.value) return
  const r = await transicion.ejecutar(e)
  if (!r.ok) return
  hacia.value = null
  resultado.value = `Ticket: ${ESTADO_TICKET[r.valor.estado].texto.toLowerCase()}.`
  await cargar()
}

async function enviar() {
  if (!texto.value.trim()) return
  if (!(await responder.ejecutar()).ok) return
  resultado.value = interno.value ? 'Nota interna guardada (el solicitante no la ve).' : 'Respuesta enviada al solicitante.'
  texto.value = ''
  interno.value = false
  adjuntos.limpiar()
  await cargar()
}

async function cargar() {
  try {
    const [d, c] = await Promise.all([detalleTicket(props.entidadId, props.ticketId), categoriasTicket(props.entidadId).catch(() => [])])
    detalle.value = d
    categorias.value = c
    tipo.value = d.ticket.tipo
    prioridad.value = d.ticket.prioridad
    categoria.value = d.ticket.categoria_id ?? ''
    if (d.ticket.bien_privado_id) void bienes.resolver([d.ticket.bien_privado_id])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(() => props.ticketId, () => {
  estado.value = 'cargando'
  resultado.value = null
  void cargar()
})
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
    v-else-if="estado === 'error' || !t || !detalle"
    estado="error"
    :mensaje="error ?? undefined"
    @reintentar="cargar"
  />
  <template v-else>
    <header class="encabezado">
      <div>
        <small>{{ t.numero }} · {{ TIPO_TICKET[t.tipo] }}</small>
        <h1>{{ t.asunto }}</h1>
      </div>
      <div class="botones">
        <HudInsignia :tono="ESTADO_TICKET[t.estado].tono">
          {{ ESTADO_TICKET[t.estado].texto }}
        </HudInsignia>
        <SemaforoVencimiento
          v-if="ticketPendiente(t.estado)"
          :vence-en="t.vence_en"
          :vencido="t.vencido"
        />
      </div>
    </header>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-for="e in [clasificar.error.value, asignar.error.value, transicion.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>

    <HudPanel etiqueta="Solicitud">
      <p class="cuerpo">
        {{ t.descripcion }}
      </p>
      <dl class="datos">
        <div><dt>Prioridad</dt><dd>{{ PRIORIDAD_TICKET[t.prioridad].texto }}</dd></div>
        <div><dt>Categoría</dt><dd>{{ nombreCategoria }}</dd></div>
        <div><dt>Solicitante</dt><dd>{{ t.identidad_oculta ? 'Identidad reservada (convivencia)' : t.solicitante_persona_id ? 'Residente o propietario' : 'Sin solicitante' }}</dd></div>
        <div v-if="t.bien_privado_id">
          <dt>Bien</dt><dd>{{ bienes.codigo(t.bien_privado_id) }}</dd>
        </div>
        <div><dt>Radicado</dt><dd>{{ fechaHora(t.creado_en, zona) }} ({{ t.canal }})</dd></div>
        <div><dt>Asignado</dt><dd>{{ t.asignado?.cuenta_id ? (t.asignado.cuenta_id === cuenta.id ? 'Usted' : 'Otra cuenta') : t.asignado?.organizacion_id ? 'Proveedor' : 'Sin asignar' }}</dd></div>
      </dl>
      <div
        v-if="detalle.transiciones_permitidas.length || (puedeAsignar && t.asignado?.cuenta_id !== cuenta.id)"
        class="botones acciones"
      >
        <HudBoton
          v-if="puedeAsignar && t.asignado?.cuenta_id !== cuenta.id"
          variante="secundario"
          :cargando="asignar.cargando.value"
          @click="asignarme"
        >
          Asignármelo
        </HudBoton>
        <HudBoton
          v-for="e in detalle.transiciones_permitidas"
          :key="e"
          :variante="e === 'resuelto' ? 'primario' : e === 'rechazado' || e === 'duplicado' ? 'fantasma' : 'secundario'"
          :cargando="transicion.cargando.value"
          @click="abrirTransicion(e)"
        >
          {{ ACCION_TICKET[e] }}
        </HudBoton>
      </div>
    </HudPanel>

    <HudPanel
      v-if="puedeAsignar"
      etiqueta="Clasificación"
    >
      <form
        class="campos tres"
        @submit.prevent="guardarClasificacion"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesDe(TIPO_TICKET)"
        />
        <HudSelector
          v-model="prioridad"
          etiqueta="Prioridad"
          :opciones="opcionesPrioridad"
        />
        <HudSelector
          v-model="categoria"
          etiqueta="Categoría"
          vacio="Sin categoría"
          :opciones="opcionesCategoria"
        />
        <div class="botones">
          <HudBoton
            tipo="submit"
            variante="secundario"
            :cargando="clasificar.cargando.value"
          >
            Guardar clasificación
          </HudBoton>
        </div>
      </form>
    </HudPanel>

    <HudPanel etiqueta="Conversación">
      <div class="campos">
        <HiloMensajes
          :mensajes="hilo"
          etiqueta="Mensajes del ticket"
          vacio="Aún no hay mensajes."
        />
        <form
          v-if="ticketPendiente(t.estado) || t.estado === 'resuelto'"
          class="campos"
          @submit.prevent="enviar"
        >
          <HudCampo
            v-model="texto"
            :etiqueta="interno ? 'Nota interna' : 'Respuesta al solicitante'"
            multilinea
          />
          <label class="casilla">
            <input
              v-model="interno"
              type="checkbox"
            > Nota interna (el solicitante no la ve)
          </label>
          <HudAdjuntos
            :adjuntos="adjuntos.adjuntos.value"
            acepta="image/*,application/pdf"
            :subiendo="adjuntos.subiendo.value"
            @subir="adjuntos.subir"
            @abrir="adjuntos.abrir"
            @quitar="adjuntos.quitar"
          />
          <p
            v-if="responder.error.value || adjuntos.error.value"
            class="error"
            role="alert"
          >
            {{ responder.error.value ?? adjuntos.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="responder.cargando.value"
              :deshabilitado="!texto.trim() || adjuntos.subiendo.value"
            >
              {{ interno ? 'Guardar nota' : 'Enviar respuesta' }}
            </HudBoton>
          </div>
        </form>
      </div>
    </HudPanel>

    <HudPanel
      v-if="detalle.eventos.length"
      etiqueta="Historial"
    >
      <ol
        class="lista"
        aria-label="Historial del ticket"
      >
        <li
          v-for="(e, i) in detalle.eventos"
          :key="i"
        >
          <span class="crece">
            <strong>{{ ESTADO_TICKET[e.hacia].texto }}</strong>
            <small>{{ fechaHora(e.ocurrido_en, zona) }}{{ e.motivo ? ` · ${e.motivo}` : '' }}</small>
          </span>
        </li>
      </ol>
    </HudPanel>

    <HudDialogo
      v-model:abierto="abiertaTransicion"
      :titulo="hacia ? ACCION_TICKET[hacia] : ''"
    >
      <form
        v-if="hacia"
        id="formulario-transicion"
        class="campos"
        novalidate
        @submit.prevent="cambiar(hacia)"
      >
        <HudSelector
          v-if="hacia === 'duplicado'"
          v-model="original"
          etiqueta="Ticket original"
          vacio="Elija el ticket"
          :opciones="opcionesOriginal"
        />
        <HudCampo
          v-model="motivo"
          :etiqueta="etiquetaMotivo(hacia)"
          multilinea
          :ayuda="hacia === 'resuelto' || hacia === 'en_espera_solicitante' ? 'El solicitante la recibe.' : undefined"
        />
        <p
          v-if="errorTransicion || transicion.error.value"
          class="error"
          role="alert"
        >
          {{ errorTransicion ?? transicion.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="hacia = null"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-transicion"
          :cargando="transicion.cargando.value"
        >
          {{ hacia ? ACCION_TICKET[hacia] : '' }}
        </HudBoton>
      </template>
    </HudDialogo>
  </template>
</template>

<style scoped src="../vistas/administracion.css"></style>
<style scoped>
.encabezado h1 {
  margin: 2px 0 0;
}

.cuerpo {
  margin: 0 0 12px;
  white-space: pre-wrap;
}

.acciones {
  margin-top: 14px;
}

.tres {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  align-items: end;
}
</style>

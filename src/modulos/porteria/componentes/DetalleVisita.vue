<script setup lang="ts">
/**
 * Detalle de una visita: datos, línea de tiempo del aviso (responsable → todos → llamada) y
 * acciones por estado. En `requiere_llamada` se ven los teléfonos (consulta auditada) y se
 * registra la llamada. Refresca cada 15 s mientras espera.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { ContactoVisita, DetalleVisita, ResultadoLlamada } from '@/api/tipos'
import { TIPO_VISITA } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useRefresco } from '@/composables/useRefresco'
import { fechaHora, horaEn } from '@/formato/fechas'
import AvisoAuditado from '@/hud/componentes/AvisoAuditado.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import ITelefono from '~icons/tabler/phone'
import { cancelarVisita, contactosVisita, detalleVisita, ingresoVisita, registrarLlamada, salidaVisita } from '../api'
import { type AccionVisita, accionesDeVisita, ESTADO_VISITA, RESULTADO_LLAMADA, textoEvento, transcurrido } from '../reglas'
import { usePorteria } from '../store'

const props = defineProps<{ entidadId: string; visitaId: string }>()

const entidad = useEntidad()
const bienes = useBienes()
const porteria = usePorteria()
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleVisita | null>(null)
const resultado = ref<string | null>(null)
const visita = computed(() => detalle.value?.visita ?? null)
const acciones = computed(() => (visita.value ? accionesDeVisita(visita.value.estado) : []))
const puede = (a: AccionVisita) => acciones.value.includes(a)

// Contactos (auditado) y llamada
const avisoContactos = ref(false)
const contactos = ref<ContactoVisita[] | null>(null)
const verContactos = useAccion(() => contactosVisita(props.entidadId, props.visitaId))
const llamando = ref(false)
const resultadoLlamada = ref<ResultadoLlamada | ''>('')
const personaLlamada = ref('')
const llamada = useAccion((_c, r: ResultadoLlamada) =>
  registrarLlamada(props.entidadId, props.visitaId, r, r === 'autorizo' || r === 'rechazo' ? personaLlamada.value || undefined : undefined),
)

// Ingreso, salida y cancelación
const confirmarCancelar = ref(false)
const paso = useAccion(
  (_c, que: 'ingreso' | 'salida' | 'cancelar') =>
    que === 'ingreso' ? ingresoVisita(props.entidadId, props.visitaId)
      : que === 'salida' ? salidaVisita(props.entidadId, props.visitaId)
        : cancelarVisita(props.entidadId, props.visitaId),
  { alConflicto: () => cargar() },
)
const HECHO = { ingreso: 'Ingreso registrado.', salida: 'Salida registrada.', cancelar: 'Visita cancelada.' } as const

async function mostrarContactos() {
  const r = await verContactos.ejecutar()
  avisoContactos.value = false
  if (r.ok) contactos.value = r.valor
}

function abrirLlamada() {
  resultadoLlamada.value = ''
  personaLlamada.value = contactos.value?.[0]?.persona_id ?? ''
  llamada.reiniciar()
  llamando.value = true
}

async function guardarLlamada() {
  if (!resultadoLlamada.value) return
  const r = await llamada.ejecutar(resultadoLlamada.value)
  if (!r.ok) return
  llamando.value = false
  resultado.value = `Llamada registrada: ${RESULTADO_LLAMADA[resultadoLlamada.value].toLowerCase()}.`
  await cargar()
}

async function hacer(que: 'ingreso' | 'salida' | 'cancelar') {
  const r = await paso.ejecutar(que)
  confirmarCancelar.value = false
  if (!r.ok) return
  resultado.value = HECHO[que]
  await cargar()
}

async function cargar() {
  try {
    detalle.value = await detalleVisita(props.entidadId, props.visitaId)
    await porteria.asegurarCodigos(props.entidadId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    if (estado.value !== 'listo') estado.value = 'error'
  }
}

useRefresco(() => (visita.value && ['anunciada', 'requiere_llamada'].includes(visita.value.estado) ? cargar() : undefined), { cada: 15_000 })
watch(() => props.visitaId, () => {
  estado.value = 'cargando'
  contactos.value = null
  resultado.value = null
  void cargar()
})
onMounted(cargar)
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error' || !visita || !detalle"
    estado="error"
    :mensaje="error ?? undefined"
    @reintentar="cargar"
  />
  <template v-else>
    <header class="encabezado">
      <h1>{{ visita.visitante_nombre }}</h1>
      <HudInsignia :tono="ESTADO_VISITA[visita.estado].tono">
        {{ ESTADO_VISITA[visita.estado].texto }}
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
      v-for="e in [paso.error.value, verContactos.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>

    <HudPanel
      etiqueta="Visita"
      :resaltado="visita.estado === 'requiere_llamada'"
    >
      <dl class="datos">
        <div><dt>Bien</dt><dd>{{ bienes.codigo(visita.bien_privado_id) }}</dd></div>
        <div><dt>Tipo</dt><dd>{{ TIPO_VISITA[visita.tipo] }}</dd></div>
        <div><dt>Anunciada</dt><dd>{{ fechaHora(visita.creada_en, zona) }} ({{ transcurrido(visita.creada_en) }})</dd></div>
        <div v-if="visita.visitante_documento">
          <dt>Documento</dt><dd>{{ visita.visitante_documento }}</dd>
        </div>
        <div v-if="visita.placa">
          <dt>Placa</dt><dd>{{ visita.placa }}</dd>
        </div>
        <div v-if="visita.origen === 'preautorizada'">
          <dt>Ingresos</dt><dd>{{ visita.usos }} de {{ visita.usos_permitidos }}</dd>
        </div>
        <div v-if="visita.observacion">
          <dt>Observación</dt><dd>{{ visita.observacion }}</dd>
        </div>
      </dl>
      <div
        v-if="acciones.length"
        class="botones acciones"
      >
        <HudBoton
          v-if="puede('contactos') && !contactos"
          variante="secundario"
          @click="avisoContactos = true"
        >
          <ITelefono aria-hidden="true" /> Ver teléfonos
        </HudBoton>
        <HudBoton
          v-if="puede('llamada')"
          @click="abrirLlamada"
        >
          Registrar llamada
        </HudBoton>
        <HudBoton
          v-if="puede('ingreso')"
          :cargando="paso.cargando.value"
          @click="hacer('ingreso')"
        >
          Dejar pasar
        </HudBoton>
        <HudBoton
          v-if="puede('salida')"
          :cargando="paso.cargando.value"
          @click="hacer('salida')"
        >
          Registrar salida
        </HudBoton>
        <HudBoton
          v-if="puede('cancelar')"
          variante="fantasma"
          @click="confirmarCancelar = true"
        >
          Cancelar visita
        </HudBoton>
      </div>
    </HudPanel>

    <HudPanel
      v-if="contactos"
      etiqueta="Teléfonos para llamar"
    >
      <p
        v-if="contactos.length === 0"
        class="texto-2"
      >
        El bien no tiene teléfonos registrados.
      </p>
      <ul
        v-else
        class="lista"
        aria-label="Teléfonos para llamar"
      >
        <li
          v-for="c in contactos"
          :key="c.persona_id"
        >
          <span class="crece">{{ c.nombre }}</span>
          <a
            :href="`tel:${c.telefono.replace(/\s/g, '')}`"
            class="telefono"
          ><ITelefono aria-hidden="true" /> {{ c.telefono }}</a>
        </li>
      </ul>
    </HudPanel>

    <HudPanel etiqueta="Línea de tiempo">
      <ol
        class="tiempo"
        aria-label="Línea de tiempo de la visita"
      >
        <li
          v-for="(e, i) in detalle.eventos"
          :key="i"
        >
          <time :datetime="e.ocurrido_en">{{ horaEn(e.ocurrido_en, zona) }}</time>
          <span>{{ textoEvento(e) }}</span>
        </li>
      </ol>
      <p
        v-if="visita.estado === 'anunciada'"
        class="texto-2"
      >
        Si nadie responde, a los 2 minutos se avisa a todos los residentes y a los 5 minutos queda para llamar.
      </p>
    </HudPanel>

    <AvisoAuditado
      v-model:abierto="avisoContactos"
      que="los teléfonos de los residentes"
      :cargando="verContactos.cargando.value"
      @confirmar="mostrarContactos"
    />

    <HudDialogo
      v-model:abierto="llamando"
      titulo="Registrar llamada"
    >
      <form
        id="formulario-llamada"
        class="campos"
        @submit.prevent="guardarLlamada"
      >
        <fieldset class="opciones-radio">
          <legend>¿Qué respondió?</legend>
          <label
            v-for="(texto, r) in RESULTADO_LLAMADA"
            :key="r"
          >
            <input
              v-model="resultadoLlamada"
              type="radio"
              name="resultado"
              :value="r"
            > {{ texto }}
          </label>
        </fieldset>
        <fieldset
          v-if="contactos?.length && (resultadoLlamada === 'autorizo' || resultadoLlamada === 'rechazo')"
          class="opciones-radio"
        >
          <legend>¿Quién respondió?</legend>
          <label
            v-for="c in contactos"
            :key="c.persona_id"
          >
            <input
              v-model="personaLlamada"
              type="radio"
              name="persona"
              :value="c.persona_id"
            > {{ c.nombre }}
          </label>
        </fieldset>
        <p
          v-if="llamada.error.value"
          class="error"
          role="alert"
        >
          {{ llamada.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="llamando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-llamada"
          :deshabilitado="!resultadoLlamada"
          :cargando="llamada.cargando.value"
        >
          Guardar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="confirmarCancelar"
      titulo="Cancelar la visita"
    >
      <p>La visita de {{ visita.visitante_nombre }} quedará cancelada y no podrá ingresar con este anuncio.</p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmarCancelar = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="paso.cargando.value"
          @click="hacer('cancelar')"
        >
          Cancelar visita
        </HudBoton>
      </template>
    </HudDialogo>
  </template>
</template>

<style scoped src="../vistas/porteria.css"></style>
<style scoped>
.acciones {
  margin-top: 14px;
}

.acciones :deep(.hud-boton) {
  min-height: 56px;
}

.telefono {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid var(--cian);
  color: var(--cian);
  font-size: 18px;
}

.tiempo {
  display: grid;
  gap: 8px;
  margin: 0 0 10px;
  padding: 0 0 0 16px;
  border-left: 2px solid var(--linea-fuerte);
  list-style: none;
}

.tiempo li {
  display: flex;
  gap: 12px;
}

time {
  min-width: 52px;
  color: var(--texto-3);
  font-variant-numeric: tabular-nums;
}
</style>

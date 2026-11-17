<script setup lang="ts">
/**
 * Residentes (de un bien o de toda la PH): registrar, terminar y autorizar las reservas del
 * arrendatario cuando la política del recurso lo exige. Con `censo.editar`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CalidadResidencia, Residencia } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { autorizarReservas, registrarResidencia, residencias, terminarResidencia } from '../api'
import { CALIDAD } from '../censo'

const props = defineProps<{ bienId?: string }>()

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const editable = computed(() => entidad.tienePermiso('censo.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Residencia[]>([])
const resultado = ref<string | null>(null)

const columnas = computed(() => [
  { clave: 'persona', titulo: 'Residente' },
  ...(props.bienId ? [] : [{ clave: 'bien', titulo: 'Bien' }]),
  { clave: 'calidad', titulo: 'Calidad' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
])
/** Búsqueda de bienes para el selector (solo la primera página). */
const buscarBien = async (q: string) => (await bienes.buscar(q)).datos
const opcionesCalidad = (Object.keys(CALIDAD) as CalidadResidencia[]).map((valor) => ({ valor, etiqueta: CALIDAD[valor] }))

// Registrar
const registrando = ref(false)
const bienElegido = ref('')
const nombre = ref('')
const documento = ref('')
const telefono = ref('')
const calidad = ref<CalidadResidencia>('tenedor')
const responsable = ref(false)
const intentado = ref(false)
const errorForm = computed(() => {
  if (!intentado.value) return null
  if (!props.bienId && !bienElegido.value) return 'Elija el bien.'
  if (!nombre.value.trim() || !documento.value.trim()) return 'Escriba el nombre y el documento del residente.'
  return null
})
const registrar = useAccion((clave) =>
  registrarResidencia(
    id.value,
    {
      bien_privado_id: props.bienId ?? bienElegido.value,
      calidad: calidad.value,
      es_responsable: responsable.value,
      persona: { nombre: nombre.value.trim(), documento: documento.value.trim(), telefono: telefono.value.trim() || null },
    },
    clave,
  ),
)

function abrirRegistro() {
  bienElegido.value = nombre.value = documento.value = telefono.value = ''
  calidad.value = 'tenedor'
  responsable.value = false
  intentado.value = false
  registrar.reiniciar()
  registrando.value = true
}

async function enviar() {
  intentado.value = true
  if (errorForm.value) return
  const r = await registrar.ejecutar()
  if (!r.ok) return
  registrando.value = false
  lista.value = [...lista.value, r.valor]
  resultado.value = `${r.valor.persona.nombre} quedó registrado como residente.`
}

// Terminar y autorizar
const elegida = ref<Residencia | null>(null)
const terminando = ref(false)
const terminar = useAccion(() => terminarResidencia(id.value, elegida.value?.id ?? ''))
const autorizar = useAccion((_c, r: Residencia, si: boolean) => autorizarReservas(id.value, r.id, si))

function abrirTerminar(r: Residencia) {
  elegida.value = r
  terminar.reiniciar()
  terminando.value = true
}

async function confirmarTerminar() {
  const r = elegida.value
  if (!r || !(await terminar.ejecutar()).ok) return
  terminando.value = false
  lista.value = lista.value.filter((x) => x.id !== r.id)
  resultado.value = `${r.persona.nombre} ya no figura como residente.`
}

async function alternarAutorizacion(r: Residencia) {
  elegida.value = r
  const si = !r.autorizado_por
  if (!(await autorizar.ejecutar(r, si)).ok) return
  lista.value = lista.value.map((x) => (x.id === r.id ? { ...x, autorizado_por: si ? 'administracion' : null } : x))
  resultado.value = si ? `${r.persona.nombre} ya puede reservar zonas comunes.` : `Se retiró la autorización de reservas de ${r.persona.nombre}.`
}

watch(lista, (l) => {
  if (!props.bienId) bienes.resolver(l.map((r) => r.bien_privado_id))
})

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await residencias(id.value, props.bienId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="panel-censo">
    <div
      v-if="editable"
      class="barra"
    >
      <HudBoton
        variante="secundario"
        @click="abrirRegistro"
      >
        <IMas aria-hidden="true" /> Registrar residente
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
      v-if="autorizar.error.value"
      class="error"
      role="alert"
    >
      {{ autorizar.error.value }}
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
      mensaje="No hay residentes registrados."
    />
    <HudTabla
      v-else
      :filas="lista"
      :columnas="columnas"
      clave="id"
      titulo="Residentes"
    >
      <template #celda-persona="{ fila }">
        <span class="celda">
          <strong>{{ fila.persona.nombre }}</strong>
          <small>Desde {{ fecha(fila.vigente_desde, zona) }}{{ fila.es_responsable ? ' · responsable' : '' }}</small>
        </span>
      </template>
      <template #celda-bien="{ fila }">
        {{ bienes.codigo(fila.bien_privado_id) }}
      </template>
      <template #celda-calidad="{ fila }">
        <span class="celda">
          {{ CALIDAD[fila.calidad] }}
          <HudInsignia
            v-if="fila.calidad === 'tenedor'"
            :tono="fila.autorizado_por ? 'exito' : 'neutro'"
          >
            {{ fila.autorizado_por ? 'Puede reservar' : 'Sin autorización para reservar' }}
          </HudInsignia>
        </span>
      </template>
      <template #celda-acciones="{ fila }">
        <template v-if="editable">
          <HudBoton
            v-if="fila.calidad === 'tenedor'"
            variante="fantasma"
            :cargando="autorizar.cargando.value && elegida?.id === fila.id"
            @click="alternarAutorizacion(fila)"
          >
            {{ fila.autorizado_por ? 'Retirar reservas' : 'Autorizar reservas' }}<span class="solo-lector"> de {{ fila.persona.nombre }}</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="abrirTerminar(fila)"
          >
            Terminar<span class="solo-lector"> la residencia de {{ fila.persona.nombre }}</span>
          </HudBoton>
        </template>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="registrando"
      titulo="Registrar residente"
    >
      <div class="campos">
        <SelectorBien
          v-if="!bienId"
          v-model="bienElegido"
          :buscar="buscarBien"
          :codigo-elegido="bienElegido ? bienes.codigo(bienElegido) : null"
        />
        <form
          id="formulario-residente"
          class="campos"
          novalidate
          @submit.prevent="enviar"
        >
          <HudCampo
            v-model="nombre"
            etiqueta="Nombre completo"
            requerido
          />
          <HudCampo
            v-model="documento"
            etiqueta="Documento"
            requerido
          />
          <HudCampo
            v-model="telefono"
            etiqueta="Teléfono (opcional)"
            tipo="tel"
          />
          <HudSelector
            v-model="calidad"
            etiqueta="Calidad"
            :opciones="opcionesCalidad"
          />
          <label class="casilla">
            <input
              v-model="responsable"
              type="checkbox"
            >
            Es el responsable del bien ante la administración
          </label>
          <p
            v-if="errorForm || registrar.error.value"
            class="error"
            role="alert"
          >
            {{ errorForm ?? registrar.error.value }}
          </p>
        </form>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="registrando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-residente"
          :cargando="registrar.cargando.value"
        >
          Registrar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="terminando"
      titulo="Terminar la residencia"
    >
      <p>
        {{ elegida?.persona.nombre }} dejará de figurar como residente desde hoy y perderá el rol de residente.
      </p>
      <p
        v-if="terminar.error.value"
        class="error"
        role="alert"
      >
        {{ terminar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="terminando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="terminar.cargando.value"
          @click="confirmarTerminar"
        >
          Terminar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="./panel-censo.css"></style>

<script setup lang="ts">
/**
 * Preparar y convocar una asamblea, en pasos: datos y reglas → orden del día → anexos →
 * preguntas en borrador → convocar (el padrón queda fijo). Ya convocada: constancias de envío y bienes en mora.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { DetalleReunion, NuevaReunion, ResultadoConvocatoria } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPasos from '@/hud/componentes/HudPasos.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { crearReunion, detalleReunion, editarReunion } from '../api'
import AnexosReunion from '../componentes/AnexosReunion.vue'
import FormularioReunion from '../componentes/FormularioReunion.vue'
import OrdenDelDia from '../componentes/OrdenDelDia.vue'
import PanelConvocada from '../componentes/PanelConvocada.vue'
import PanelConvocar from '../componentes/PanelConvocar.vue'
import PreguntasReunion from '../componentes/PreguntasReunion.vue'
import { ESTADO_REUNION, preparable } from '../reglas'

const PASOS = [
  { id: 'datos', texto: 'Datos y reglas' },
  { id: 'orden', texto: 'Orden del día' },
  { id: 'anexos', texto: 'Anexos' },
  { id: 'preguntas', texto: 'Preguntas' },
  { id: 'convocar', texto: 'Convocatoria' },
]

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })

const paso = ref('datos')
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleReunion | null>(null)
const guardado = ref<string | null>(null)
const reunion = computed(() => detalle.value?.reunion ?? null)

const crear = useAccion((clave, datos: NuevaReunion) => crearReunion(id.value, datos, clave))
const editar = useAccion((_c, datos: NuevaReunion) =>
  editarReunion(id.value, reunionId.value, { datos, configuracion: datos.configuracion }),
)

async function guardarDatos(datos: NuevaReunion) {
  guardado.value = null
  if (!reunionId.value) {
    const r = await crear.ejecutar(datos)
    if (!r.ok) return
    paso.value = 'orden'
    await router.replace(ruta('convocar', r.valor.id))
    return
  }
  if (!(await editar.ejecutar(datos)).ok) return
  guardado.value = 'Datos guardados.'
  await cargar()
  paso.value = 'orden'
}

/** El aviso queda en la vista: al recargar, la reunión ya convocada cambia de pantalla. */
async function convocada(r: ResultadoConvocatoria) {
  guardado.value =
    `Convocada: ${r.bienes_padron} bienes en el padrón; ${r.envios_whatsapp} por WhatsApp, ` +
    `${r.envios_correo} por correo y ${r.sin_contacto} sin contacto.`
  await cargar()
}

async function cargar() {
  if (!reunionId.value) {
    detalle.value = null
    estado.value = 'listo'
    return
  }
  try {
    detalle.value = await detalleReunion(id.value, reunionId.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(reunionId, () => void cargar(), { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-convocar">
    <RouterLink
      :to="reunionId ? ruta('reuniones', reunionId) : ruta('reuniones')"
      class="volver"
    >
      <IVolver aria-hidden="true" /> {{ reunionId ? 'La reunión' : 'Reuniones' }}
    </RouterLink>
    <p
      v-if="guardado"
      class="ok"
      role="status"
    >
      {{ guardado }}
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

    <template v-else-if="!reunion || preparable(reunion.estado)">
      <header class="encabezado">
        <h1 id="titulo-convocar">
          {{ reunion ? `Preparar: ${reunion.titulo}` : 'Nueva asamblea' }}
        </h1>
      </header>
      <HudPasos
        :pasos="PASOS"
        :actual="paso"
        :libre="!!reunion"
        etiqueta="Pasos para convocar"
        @ir="(p) => (paso = p)"
      />
      <HudPanel
        v-if="paso === 'datos' || !reunion"
        etiqueta="Datos y reglas"
      >
        <FormularioReunion
          :key="reunion?.id ?? 'nueva'"
          :reunion="reunion"
          :accion="reunion ? 'Guardar y seguir' : 'Crear y seguir'"
          :cargando="crear.cargando.value || editar.cargando.value"
          :error="crear.error.value ?? editar.error.value"
          @guardar="guardarDatos"
        />
      </HudPanel>
      <template v-else-if="detalle">
        <HudPanel
          v-if="paso === 'orden'"
          etiqueta="Orden del día"
        >
          <OrdenDelDia
            :entidad-id="id"
            :reunion-id="reunion.id"
            :puntos="detalle.puntos"
            editable
            @cambio="cargar"
          />
        </HudPanel>
        <HudPanel
          v-else-if="paso === 'anexos'"
          etiqueta="Anexos"
        >
          <AnexosReunion
            :entidad-id="id"
            :reunion-id="reunion.id"
            :documentos="detalle.documentos"
            editable
            @cambio="cargar"
          />
        </HudPanel>
        <HudPanel
          v-else-if="paso === 'preguntas'"
          etiqueta="Preguntas"
        >
          <p class="texto-2">
            Prepare las votaciones; también puede agregarlas durante la asamblea.
          </p>
          <PreguntasReunion
            :entidad-id="id"
            :reunion="reunion"
            :puntos="detalle.puntos"
          />
        </HudPanel>
        <HudPanel
          v-else
          etiqueta="Convocar"
        >
          <PanelConvocar
            :entidad-id="id"
            :detalle="detalle"
            @convocada="convocada"
          />
        </HudPanel>
      </template>
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-convocar">
          {{ reunion.titulo }}
        </h1>
        <HudInsignia :tono="ESTADO_REUNION[reunion.estado].tono">
          {{ ESTADO_REUNION[reunion.estado].texto }}
        </HudInsignia>
      </header>
      <p class="texto-2">
        La reunión ya fue convocada: el padrón y los datos quedaron fijos.
      </p>
      <PanelConvocada
        :entidad-id="id"
        :reunion-id="reunion.id"
        :mora-editable="['convocada', 'en_registro'].includes(reunion.estado)"
      />
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>

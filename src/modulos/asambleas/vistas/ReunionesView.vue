<script setup lang="ts">
/** Reuniones por estado, actas publicadas y el detalle de una reunión (`:id`) con sus siguientes pasos. */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { DetalleReunion, EstadoReunion, Reunion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { actasPublicadas, detalleReunion, listarReuniones, transicionReunion } from '../api'
import AnexosReunion from '../componentes/AnexosReunion.vue'
import OrdenDelDia from '../componentes/OrdenDelDia.vue'
import ResumenReunion from '../componentes/ResumenReunion.vue'
import { accionesReunion, ESTADO_ACTA, ESTADO_REUNION, mesaAbierta, preparable } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })
const puede = (p: Parameters<typeof entidad.tienePermiso>[0]) => entidad.tienePermiso(p)

// Lista
const filtroEstado = ref<EstadoReunion | ''>('')
const filtros = computed(() => ({ estado: filtroEstado.value || undefined }))
const opcionesEstado = (Object.keys(ESTADO_REUNION) as EstadoReunion[]).map((valor) => ({ valor, etiqueta: ESTADO_REUNION[valor].texto }))
const listado = useListado((despues, f: { estado?: EstadoReunion }) => listarReuniones(id.value, despues, f), { filtros, retardo: 0 })
const actas = ref<Reunion[]>([])

// Detalle
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleReunion | null>(null)
const cancelando = ref(false)
const resultado = ref<string | null>(null)
const reunion = computed(() => detalle.value?.reunion ?? null)
const puedeCancelar = computed(() => !!reunion.value && accionesReunion(reunion.value.estado, { convocar: puede('asambleas.convocar'), conducir: false }).includes('cancelar'))
const puedeConducir = computed(() =>
  !!reunion.value && ['convocada', 'en_registro', 'instalada', 'suspendida'].includes(reunion.value.estado) && (puede('asambleas.conducir') || puede('asambleas.ver')),
)
const cancelar = useAccion((_c, motivo: string) => transicionReunion(id.value, reunionId.value, 'cancelar', motivo), { alConflicto: () => cargar() })

async function confirmarCancelacion(motivo: string) {
  const r = await cancelar.ejecutar(motivo)
  if (!r.ok) return
  cancelando.value = false
  resultado.value = 'Reunión cancelada.'
  await cargar()
}

async function cargar() {
  if (!reunionId.value) return
  try {
    detalle.value = await detalleReunion(id.value, reunionId.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(reunionId, () => {
  estado.value = 'cargando'
  resultado.value = null
  void cargar()
}, { immediate: true })
onMounted(async () => {
  actas.value = await actasPublicadas(id.value).catch(() => [])
})
</script>

<template>
  <section aria-labelledby="titulo-reuniones">
    <template v-if="reunionId">
      <RouterLink
        :to="ruta('reuniones')"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Reuniones
      </RouterLink>
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error' || !detalle || !reunion"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargar"
      />
      <template v-else>
        <header class="encabezado">
          <h1 id="titulo-reuniones">
            {{ reunion.titulo }}
          </h1>
          <HudInsignia :tono="ESTADO_REUNION[reunion.estado].tono">
            {{ ESTADO_REUNION[reunion.estado].texto }}
          </HudInsignia>
          <HudInsignia
            v-if="reunion.estado === 'cerrada'"
            :tono="ESTADO_ACTA[reunion.acta_estado].tono"
          >
            Acta: {{ ESTADO_ACTA[reunion.acta_estado].texto.toLowerCase() }}
          </HudInsignia>
        </header>
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <div class="botones">
          <HudBoton
            v-if="preparable(reunion.estado) && puede('asambleas.convocar')"
            :a="ruta('convocar', reunion.id)"
          >
            Preparar y convocar
          </HudBoton>
          <HudBoton
            v-if="reunion.estado === 'convocada' && puede('asambleas.convocar')"
            variante="secundario"
            :a="ruta('convocar', reunion.id)"
          >
            Constancias y morosos
          </HudBoton>
          <HudBoton
            v-if="mesaAbierta(reunion.estado) && puede('asambleas.registrar')"
            :a="ruta('registro', reunion.id)"
          >
            Mesa de registro
          </HudBoton>
          <HudBoton
            v-if="puedeConducir"
            variante="secundario"
            :a="ruta('en-vivo', reunion.id)"
          >
            Conducir
          </HudBoton>
          <HudBoton
            v-if="['instalada', 'suspendida', 'cerrada'].includes(reunion.estado) && puede('asambleas.ver')"
            variante="secundario"
            :a="ruta('resultados', reunion.id)"
          >
            Resultados
          </HudBoton>
          <HudBoton
            v-if="reunion.estado === 'cerrada' && puede('asambleas.ver')"
            variante="secundario"
            :a="ruta('acta', reunion.id)"
          >
            Acta
          </HudBoton>
          <HudBoton
            v-if="['en_registro', 'instalada', 'suspendida', 'cerrada'].includes(reunion.estado) && puede('asambleas.ver')"
            variante="fantasma"
            :a="ruta('reportes', reunion.id)"
          >
            Reportes
          </HudBoton>
          <HudBoton
            v-if="puedeCancelar"
            variante="fantasma"
            @click="cancelando = true"
          >
            Cancelar la reunión
          </HudBoton>
        </div>
        <HudPanel etiqueta="Datos">
          <ResumenReunion :reunion="reunion" />
        </HudPanel>
        <HudPanel etiqueta="Orden del día">
          <OrdenDelDia
            :entidad-id="id"
            :reunion-id="reunion.id"
            :puntos="detalle.puntos"
            :editable="false"
          />
        </HudPanel>
        <HudPanel etiqueta="Anexos">
          <AnexosReunion
            :entidad-id="id"
            :reunion-id="reunion.id"
            :documentos="detalle.documentos"
            :editable="false"
          />
        </HudPanel>
        <ConfirmarConMotivo
          v-model:abierto="cancelando"
          titulo="Cancelar la reunión"
          accion="Cancelar la reunión"
          descripcion="Se avisa a los convocados. La reunión no se podrá reabrir: para hacerla, prepare una nueva."
          :cargando="cancelar.cargando.value"
          :error="cancelar.error.value"
          @confirmar="confirmarCancelacion"
        />
      </template>
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-reuniones">
          Reuniones y actas
        </h1>
        <HudBoton
          v-if="puede('asambleas.convocar')"
          :a="ruta('convocar')"
        >
          <IMas aria-hidden="true" /> Nueva asamblea
        </HudBoton>
      </header>
      <HudSelector
        v-model="filtroEstado"
        etiqueta="Estado"
        vacio="Todas"
        :opciones="opcionesEstado"
      />
      <HudEstado
        v-if="listado.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'error'"
        estado="error"
        :mensaje="listado.error.value ?? undefined"
        @reintentar="listado.recargar()"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        mensaje="No hay reuniones con ese filtro."
      />
      <template v-else>
        <ul
          class="lista"
          aria-label="Reuniones"
        >
          <li
            v-for="r in listado.filas.value"
            :key="r.id"
          >
            <HudInsignia :tono="ESTADO_REUNION[r.estado].tono">
              {{ ESTADO_REUNION[r.estado].texto }}
            </HudInsignia>
            <span class="crece">
              <RouterLink
                :to="ruta('reuniones', r.id)"
                class="fila"
              ><strong>{{ r.titulo }}</strong></RouterLink>
              <small>{{ fechaHora(r.fecha_programada, zona) }}</small>
            </span>
          </li>
        </ul>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </template>
      <HudPanel
        v-if="actas.length"
        etiqueta="Actas publicadas"
      >
        <ul
          class="lista"
          aria-label="Actas publicadas"
        >
          <li
            v-for="a in actas"
            :key="a.id"
          >
            <span class="crece">
              <RouterLink
                :to="ruta('reuniones', a.id)"
                class="fila"
              ><strong>{{ a.titulo }}</strong></RouterLink>
              <small>{{ fechaHora(a.fecha_programada, zona) }}</small>
            </span>
          </li>
        </ul>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>

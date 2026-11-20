<script setup lang="ts">
/**
 * Un comercio: estado (verificar, rechazar o suspender, con motivo: lo decide moderación), datos,
 * ficha del directorio, campañas con su detalle (`?campana=`), leads y enlace de cupones. Cada
 * parte aparece solo con su permiso de plataforma.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { Anunciante, CategoriaDirectorio, DatosAnunciante, EstadoVerificacion, FichaAnunciante, NuevaCampana, TipoCobertura } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fecha } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { anunciante, campanas, cambiarEstadoAnunciante, crearCampana, editarAnunciante, leads } from '../api-publicidad'
import { cambiosAnunciante, COBERTURA, ESTADO_ANUNCIANTE, ESTADO_CAMPANA } from '../reglas'
import { usePermisosPlataforma } from '../store'
import DetalleCampana from './DetalleCampana.vue'
import EnlaceCupones from './EnlaceCupones.vue'
import FichaDirectorioComercio from './FichaDirectorioComercio.vue'
import FormularioCampana from './FormularioCampana.vue'
import FormularioComercio from './FormularioComercio.vue'

const props = defineProps<{ comercioId: string; categorias: CategoriaDirectorio[] }>()

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const { puede } = usePermisosPlataforma()

const comercio = ref<Anunciante | null>(null)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const editando = ref(false)
const creandoCampana = ref(false)
const pidiendoMotivo = ref<EstadoVerificacion | null>(null)
const resultado = ref<string | null>(null)

const puedeCampanas = computed(() => puede('plataforma.publicidad.gestionar'))
const campanaId = computed(() => (typeof route.query.campana === 'string' ? route.query.campana : ''))
const lista = useListado((d) => campanas(props.comercioId, d), { inmediato: false })
const contactos = useListado((d) => leads(props.comercioId, d), { inmediato: false })
const cambios = computed(() => (comercio.value ? cambiosAnunciante(comercio.value.estado) : []))
const categoriasFicha = computed(() =>
  (comercio.value?.ficha?.categorias ?? []).map((c) => ({ valor: c, etiqueta: props.categorias.find((x) => x.codigo === c)?.nombre ?? c })),
)
const cobertura = computed(() => {
  const c = comercio.value?.ficha?.cobertura
  return c ? (COBERTURA[c as TipoCobertura] ?? c) : null
})
const dialogoMotivo = computed({ get: () => pidiendoMotivo.value !== null, set: (v) => (v ? undefined : (pidiendoMotivo.value = null)) })

const moderar = useAccion((_clave, e: EstadoVerificacion, motivo: string | null) => cambiarEstadoAnunciante(props.comercioId, e, motivo), {
  alExito: (a) => {
    comercio.value = a
    pidiendoMotivo.value = null
    resultado.value = `El comercio quedó ${ESTADO_ANUNCIANTE[a.estado].texto.toLowerCase()}.`
  },
  /** 409 `conflicto_estado`: transición no permitida (el comercio cambió); se recarga. */
  alConflicto: () => void cargar(),
})
const guardar = useAccion((_clave, datos: DatosAnunciante) => editarAnunciante(props.comercioId, datos), {
  alExito: (a) => {
    comercio.value = a
    editando.value = false
    resultado.value = 'Datos del comercio guardados.'
  },
})
const nuevaCampana = useAccion((clave, datos: NuevaCampana) => crearCampana(props.comercioId, datos, clave))

async function cargar() {
  estado.value = 'cargando'
  try {
    comercio.value = await anunciante(props.comercioId)
    estado.value = 'listo'
    if (puedeCampanas.value) await Promise.all([lista.recargar(), contactos.recargar()])
  } catch (e) {
    error.value = e instanceof ErrorApi && e.estado === 404 ? 'El comercio no existe.' : mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

function pedirEstado(e: EstadoVerificacion, motivo: boolean) {
  moderar.reiniciar()
  resultado.value = null
  if (motivo) pidiendoMotivo.value = e
  else void moderar.ejecutar(e, null)
}

async function enviarCampana(datos: NuevaCampana) {
  const r = await nuevaCampana.ejecutar(datos)
  if (!r.ok) return
  creandoCampana.value = false
  await lista.recargar()
  await verCampana(r.valor.id)
}

function verCampana(id: string) {
  return router.replace({ query: { ...route.query, campana: id || undefined } })
}

function fichaGuardada(f: FichaAnunciante) {
  if (comercio.value) comercio.value = { ...comercio.value, ficha: f }
}

function abrirEdicion() {
  guardar.reiniciar()
  editando.value = true
}

function abrirCampana() {
  nuevaCampana.reiniciar()
  creandoCampana.value = true
}

watch(() => props.comercioId, cargar, { immediate: true })
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
    :referencia="referencia"
    @reintentar="cargar()"
  />
  <template v-else-if="comercio">
    <header class="encabezado">
      <div>
        <h1 id="titulo-comercios">
          {{ comercio.nombre_comercial }}
        </h1>
        <p class="texto-2">
          {{ comercio.direccion ?? 'Sin dirección' }}<template v-if="comercio.municipio_dane">
            · municipio {{ comercio.municipio_dane }}
          </template><template v-if="cobertura">
            · {{ cobertura }}
          </template>
        </p>
      </div>
      <HudInsignia :tono="ESTADO_ANUNCIANTE[comercio.estado].tono">
        {{ ESTADO_ANUNCIANTE[comercio.estado].texto }}
      </HudInsignia>
    </header>
    <p
      v-if="comercio.motivo_estado"
      class="aviso"
    >
      {{ comercio.motivo_estado }}
    </p>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudPanel
      v-if="puede('plataforma.publicidad.moderar') && cambios.length"
      etiqueta="Verificación"
    >
      <div class="botones">
        <HudBoton
          v-for="c in cambios"
          :key="c.estado"
          :variante="c.estado === 'verificado' ? 'primario' : 'secundario'"
          :cargando="moderar.cargando.value && !pidiendoMotivo"
          @click="pedirEstado(c.estado, c.motivo)"
        >
          {{ c.texto }}
        </HudBoton>
      </div>
      <p
        v-if="moderar.error.value && !pidiendoMotivo"
        class="error"
        role="alert"
      >
        {{ moderar.error.value }}
      </p>
    </HudPanel>

    <HudPanel
      v-if="puede('plataforma.directorio.gestionar')"
      etiqueta="Ficha en el directorio"
    >
      <div class="botones">
        <HudBoton
          variante="fantasma"
          @click="abrirEdicion"
        >
          Editar datos del comercio
        </HudBoton>
      </div>
      <FichaDirectorioComercio
        :comercio-id="comercio.id"
        :ficha="comercio.ficha ?? null"
        :categorias="categorias"
        @guardada="fichaGuardada"
      />
    </HudPanel>

    <template v-if="puedeCampanas">
      <HudPanel etiqueta="Campañas">
        <div class="campos">
          <div class="botones">
            <HudBoton
              :deshabilitado="categoriasFicha.length === 0"
              @click="abrirCampana"
            >
              Nueva campaña
            </HudBoton>
          </div>
          <p
            v-if="categoriasFicha.length === 0"
            class="texto-2"
          >
            Para crear campañas, primero guarde la ficha del directorio con sus categorías.
          </p>
          <HudEstado
            v-if="lista.estado.value === 'cargando'"
            estado="cargando"
            :filas="2"
          />
          <HudEstado
            v-else-if="lista.estado.value === 'error'"
            estado="error"
            :mensaje="lista.error.value ?? undefined"
            @reintentar="lista.recargar()"
          />
          <p
            v-else-if="lista.estado.value === 'vacio'"
            class="texto-2"
          >
            El comercio aún no tiene campañas.
          </p>
          <ul
            v-else
            class="lista"
          >
            <li
              v-for="c in lista.filas.value"
              :key="c.id"
            >
              <span class="crece">
                <strong>{{ c.nombre }}</strong>
                <small>Desde {{ fecha(c.inicio, entidad.zonaHoraria) }}</small>
              </span>
              <HudInsignia :tono="ESTADO_CAMPANA[c.estado].tono">
                {{ ESTADO_CAMPANA[c.estado].texto }}
              </HudInsignia>
              <HudBoton
                variante="fantasma"
                :aria-pressed="campanaId === c.id"
                @click="verCampana(campanaId === c.id ? '' : c.id)"
              >
                {{ campanaId === c.id ? 'Cerrar' : 'Abrir' }}<span class="solo-lector"> la campaña {{ c.nombre }}</span>
              </HudBoton>
            </li>
          </ul>
          <HudCargarMas
            :hay-mas="lista.hayMas.value"
            :cargando="lista.cargando.value"
            @cargar="lista.cargarMas()"
          />
        </div>
      </HudPanel>
      <DetalleCampana
        v-if="campanaId"
        :comercio-id="comercio.id"
        :campana-id="campanaId"
        :categorias="categoriasFicha"
        @cambio="lista.recargar()"
      />

      <HudPanel etiqueta="Contactos autorizados (leads)">
        <p
          v-if="contactos.estado.value === 'vacio'"
          class="texto-2"
        >
          Aún no hay residentes que hayan autorizado su contacto para este comercio.
        </p>
        <ul
          v-else-if="contactos.estado.value === 'listo'"
          class="lista"
        >
          <li
            v-for="l in contactos.filas.value"
            :key="l.solicitud_id"
          >
            <span class="crece">
              <strong>{{ l.nombre }}</strong>
              <small>{{ l.telefono ?? 'Sin celular' }}<template v-if="l.categoria"> · {{ l.categoria }}</template> · {{ fecha(l.creado_en, entidad.zonaHoraria) }}</small>
            </span>
          </li>
        </ul>
        <HudCargarMas
          :hay-mas="contactos.hayMas.value"
          :cargando="contactos.cargando.value"
          @cargar="contactos.cargarMas()"
        />
      </HudPanel>

      <HudPanel etiqueta="Cupones">
        <EnlaceCupones :comercio-id="comercio.id" />
      </HudPanel>
    </template>

    <FormularioComercio
      v-model:abierto="editando"
      :comercio="comercio"
      :cargando="guardar.cargando.value"
      :error="guardar.error.value"
      @editar="guardar.ejecutar"
    />
    <FormularioCampana
      v-model:abierto="creandoCampana"
      :categorias="categoriasFicha"
      :cargando="nuevaCampana.cargando.value"
      :error="nuevaCampana.error.value"
      @enviar="enviarCampana"
    />
    <ConfirmarConMotivo
      v-model:abierto="dialogoMotivo"
      :titulo="pidiendoMotivo === 'rechazado' ? 'Rechazar el comercio' : 'Suspender el comercio'"
      :accion="pidiendoMotivo === 'rechazado' ? 'Rechazar' : 'Suspender'"
      descripcion="El motivo queda en la ficha del comercio."
      :cargando="moderar.cargando.value"
      :error="moderar.error.value"
      @confirmar="(m) => pidiendoMotivo && moderar.ejecutar(pidiendoMotivo, m)"
    />
  </template>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

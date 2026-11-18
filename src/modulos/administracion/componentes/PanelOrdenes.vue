<script setup lang="ts">
/** Órdenes de trabajo: filtrar por estado o atrasadas, abrir el detalle y crear una correctiva. */
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { Activo, EstadoOrden, TipoOrden } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { crearOrden, listarActivos, listarOrdenes } from '../api'
import { ESTADO_ORDEN, ordenAtrasada, TIPO_ORDEN } from '../reglas'

const props = defineProps<{ entidadId: string; detalle: (ordenId: string) => RouteLocationRaw }>()

const entidad = useEntidad()
const hoy = computed(() => hoyEn(entidad.zonaHoraria))
const puedePlanificar = computed(() => entidad.tienePermiso('mantenimiento.planificar'))

const filtroEstado = ref<EstadoOrden | ''>('')
const atrasadas = ref(false)
const filtros = computed(() => ({ estado: filtroEstado.value || undefined, vencidas: atrasadas.value }))
const opcionesEstado = (Object.keys(ESTADO_ORDEN) as EstadoOrden[]).map((valor) => ({ valor, etiqueta: ESTADO_ORDEN[valor].texto }))
const listado = useListado((despues, f: { estado?: EstadoOrden; vencidas?: boolean }) => listarOrdenes(props.entidadId, despues, f), { filtros, retardo: 0 })

// Crear
const creando = ref(false)
const activos = ref<Activo[]>([])
const tipo = ref<TipoOrden>('correctivo')
const descripcion = ref('')
const activoId = ref('')
const ubicacion = ref('')
const programada = ref('')
const puntos = ref('')
const errorForm = ref<string | null>(null)
const resultado = ref<string | null>(null)
const opcionesActivo = computed(() => activos.value.filter((a) => a.estado !== 'dado_de_baja').map((a) => ({ valor: a.id, etiqueta: `${a.codigo} · ${a.nombre}` })))
const crear = useAccion((clave) =>
  crearOrden(
    props.entidadId,
    {
      tipo: tipo.value,
      descripcion: descripcion.value.trim(),
      activo_id: activoId.value || null,
      ubicacion: ubicacion.value.trim() || null,
      programada_para: programada.value,
      checklist: puntos.value.split('\n').map((p) => p.trim()).filter(Boolean),
    },
    clave,
  ),
)

async function abrir() {
  tipo.value = 'correctivo'
  descripcion.value = activoId.value = ubicacion.value = puntos.value = ''
  programada.value = hoy.value
  errorForm.value = null
  crear.reiniciar()
  creando.value = true
  if (!activos.value.length) activos.value = (await listarActivos(props.entidadId, undefined).catch(() => ({ datos: [] as Activo[] }))).datos
}

async function guardar() {
  errorForm.value = !descripcion.value.trim() ? 'Describa el trabajo.' : !programada.value ? 'Elija la fecha.' : null
  if (errorForm.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  resultado.value = `Orden ${r.valor.numero} creada.`
  await listado.recargar()
}

</script>

<template>
  <div class="campos">
    <div class="filtros">
      <HudSelector
        v-model="filtroEstado"
        etiqueta="Estado"
        vacio="Todos"
        :opciones="opcionesEstado"
      />
      <label class="casilla">
        <input
          v-model="atrasadas"
          type="checkbox"
        > Solo atrasadas
      </label>
      <HudBoton
        v-if="puedePlanificar"
        @click="abrir"
      >
        <IMas aria-hidden="true" /> Nueva orden
      </HudBoton>
    </div>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
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
      mensaje="No hay órdenes con ese filtro."
    />
    <template v-else>
      <ul
        class="lista"
        aria-label="Órdenes de trabajo"
      >
        <li
          v-for="o in listado.filas.value"
          :key="o.id"
          :class="{ urgente: ordenAtrasada(o, hoy) }"
        >
          <HudInsignia :tono="ESTADO_ORDEN[o.estado].tono">
            {{ ESTADO_ORDEN[o.estado].texto }}
          </HudInsignia>
          <span class="crece">
            <RouterLink
              :to="detalle(o.id)"
              class="fila"
            ><strong>{{ o.descripcion }}</strong></RouterLink>
            <small>{{ o.numero }} · {{ TIPO_ORDEN[o.tipo] }} · {{ fechaCalendario(o.programada_para) }}{{ ordenAtrasada(o, hoy) ? ' · atrasada' : '' }}</small>
          </span>
        </li>
      </ul>
      <HudCargarMas
        :hay-mas="listado.hayMas.value"
        :cargando="listado.cargando.value"
        @cargar="listado.cargarMas()"
      />
    </template>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Nueva orden de trabajo"
    >
      <form
        id="formulario-orden"
        class="campos"
        novalidate
        @submit.prevent="guardar"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesDe(TIPO_ORDEN)"
        />
        <HudCampo
          v-model="descripcion"
          etiqueta="Trabajo a realizar"
          multilinea
        />
        <HudSelector
          v-model="activoId"
          etiqueta="Activo (opcional)"
          vacio="Ninguno"
          :opciones="opcionesActivo"
        />
        <HudCampo
          v-model="ubicacion"
          etiqueta="Ubicación (opcional)"
          autocompletar="off"
        />
        <HudFecha
          v-model="programada"
          etiqueta="Programada para"
        />
        <HudCampo
          v-model="puntos"
          etiqueta="Checklist (un punto por línea, opcional)"
          multilinea
        />
        <p
          v-if="errorForm || crear.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-orden"
          :cargando="crear.cargando.value"
        >
          Crear orden
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="../vistas/administracion.css"></style>

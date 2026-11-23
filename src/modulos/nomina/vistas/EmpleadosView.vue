<script setup lang="ts">
/**
 * Empleados: tabla por cursor con búsqueda y filtro por estado; con `:id`, la ficha del
 * empleado (o `nuevo`, el asistente de alta con su primer contrato). Sin
 * `nomina.salarios.ver` los salarios y las cuentas no se muestran.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import { buscarPersonas } from '@/api/personas'
import type { EstadoEmpleado, FichaEmpleado as Ficha, NuevoEmpleado } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { opcionesDe } from '@/composables/textos-acceso'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import { ESTADO_EMPLEADO } from '@/formato/nomina'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { crearEmpleado, empleados as pedirEmpleados } from '../api'
import AltaEmpleado from '../componentes/AltaEmpleado.vue'
import FichaEmpleado from '../componentes/FichaEmpleado.vue'
import { useNomina } from '../store'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const nomina = useNomina()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const empleadoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (x = '') => ({ name: 'modulo', params: { ...route.params, accion: 'empleados', id: x }, query: {} })
const puedeGestionar = computed(() => entidad.tienePermiso('nomina.empleados.gestionar'))
const verSalarios = computed(() => entidad.tienePermiso('nomina.salarios.ver'))
const conContabilidad = computed(() => entidad.tieneModulo('contabilidad'))
const centros = computed(() => (conContabilidad.value ? plan.centros.map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}` })) : []))

const filtros = ref<{ q: string; estado: EstadoEmpleado | '' }>({ q: '', estado: 'activo' })
const listado = useListado((despues, f) => pedirEmpleados(id.value, despues, { q: f.q, estado: f.estado || undefined }), { filtros, inmediato: false })
const filas = computed(() => listado.filas.value.map((e) => ({ ...e, ingreso: e.fecha_ingreso ? fechaCalendario(e.fecha_ingreso) : '—' })))
const OPCIONES_ESTADO = opcionesDe<EstadoEmpleado>({ activo: 'Activos', retirado: 'Retirados' })
const COLUMNAS = [
  { clave: 'codigo', titulo: 'Código' },
  { clave: 'nombre', titulo: 'Empleado' },
  { clave: 'cargo', titulo: 'Cargo' },
  { clave: 'ingreso', titulo: 'Ingreso' },
  { clave: 'estado', titulo: 'Estado' },
]

const preparado = ref<'cargando' | 'listo' | 'error'>('cargando')
const errorPreparar = ref<string | null>(null)
const aviso = ref<string | null>(null)

/** Personas ya registradas: solo en la PH y con `personas.ver`. */
const buscarPersona = computed(() =>
  entidad.esPH && entidad.tienePermiso('personas.ver')
    ? async (q: string) => (await buscarPersonas(id.value, q)).datos.map((p) => ({ id: p.id, nombre: p.nombre, detalle: p.documento ?? null }))
    : null,
)

const crear = useAccion((_c, datos: NuevoEmpleado) => crearEmpleado(id.value, datos))

async function alCrear(datos: NuevoEmpleado) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  aviso.value = `${r.valor.nombre} quedó como empleado con su contrato.`
  nomina.recordar(r.valor)
  void nomina.recargar(id.value)
  await router.replace(ruta(r.valor.id))
}

function alCambiar(f: Ficha) {
  nomina.recordar(f)
}

async function preparar() {
  preparado.value = 'cargando'
  try {
    await Promise.all([nomina.asegurar(id.value), conContabilidad.value ? plan.asegurar().catch(() => undefined) : Promise.resolve()])
    preparado.value = 'listo'
    if (!empleadoId.value) void listado.recargar()
  } catch (e) {
    errorPreparar.value = mensajeDeError(e)
    preparado.value = 'error'
  }
}

watch(empleadoId, (nuevo, antes) => {
  if (antes !== 'nuevo') aviso.value = null
  if (!nuevo) void listado.recargar()
})
onMounted(preparar)
</script>

<template>
  <section aria-labelledby="titulo-empleados">
    <HudEstado
      v-if="preparado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="preparado === 'error'"
      estado="error"
      :mensaje="errorPreparar ?? undefined"
      @reintentar="preparar"
    />
    <template v-else-if="empleadoId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Empleados
      </RouterLink>
      <template v-if="empleadoId === 'nuevo'">
        <h1 id="titulo-empleados">
          Nuevo empleado
        </h1>
        <HudPanel etiqueta="Alta del empleado">
          <AltaEmpleado
            :administradoras="nomina.administradoras"
            :centros="centros"
            :buscar-persona="buscarPersona"
            :cargando="crear.cargando.value"
            :error="crear.error.value"
            @crear="alCrear"
          />
        </HudPanel>
      </template>
      <FichaEmpleado
        v-else
        :key="empleadoId"
        :entidad-id="id"
        :empleado-id="empleadoId"
        :administradoras="nomina.administradoras"
        :centros="centros"
        :hoy="hoy"
        :puede-gestionar="puedeGestionar"
        :ver-salarios="verSalarios"
        :aviso="aviso"
        @cambio="alCambiar"
      />
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-empleados">
          Empleados
        </h1>
        <HudBoton
          v-if="puedeGestionar"
          :a="ruta('nuevo')"
        >
          <IMas aria-hidden="true" /> Nuevo empleado
        </HudBoton>
      </header>
      <div class="filtros">
        <HudCampo
          v-model="filtros.q"
          etiqueta="Buscar"
          ayuda="Nombre, código o documento"
        />
        <HudSelector
          v-model="filtros.estado"
          etiqueta="Estado"
          vacio="Todos"
          :opciones="OPCIONES_ESTADO"
        />
      </div>
      <HudEstado
        v-if="listado.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'error'"
        estado="error"
        :mensaje="listado.error.value ?? undefined"
        @reintentar="listado.recargar"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        mensaje="No hay empleados con ese filtro."
      />
      <template v-else>
        <HudTabla
          :filas="filas"
          :columnas="COLUMNAS"
          clave="id"
          titulo="Empleados"
        >
          <template #celda-nombre="{ fila }">
            <RouterLink :to="ruta(fila.id)">
              {{ fila.nombre }}
            </RouterLink>
          </template>
          <template #celda-cargo="{ fila }">
            {{ fila.cargo ?? '—' }}
          </template>
          <template #celda-estado="{ fila }">
            <HudInsignia :tono="ESTADO_EMPLEADO[fila.estado].tono">
              {{ ESTADO_EMPLEADO[fila.estado].texto }}
            </HudInsignia>
          </template>
        </HudTabla>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas"
        />
      </template>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

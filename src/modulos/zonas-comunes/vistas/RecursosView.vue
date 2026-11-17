<script setup lang="ts">
/**
 * Recursos y reglas: los bienes comunes y herramientas prestables con su estado y política;
 * crear uno nuevo y, con `:id` en la ruta, su ficha (datos, horario, cobro y estado). Los
 * parqueaderos tienen su propia pantalla.
 */
import { computed, onMounted, ref } from 'vue'
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { TipoRecurso } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, moneda } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { crearRecurso } from '../api'
import FichaRecurso from '../componentes/FichaRecurso.vue'
import FormularioRecurso, { type DatosRecurso } from '../componentes/FormularioRecurso.vue'
import { CATEGORIA, ESTADO_RECURSO, MODO, TIPO_RECURSO } from '../recursos'
import { useZonasComunes } from '../store'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puedeCrear = computed(() => entidad.tienePermiso('bienes_comunes.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const creando = ref(false)
const tipo = ref<Extract<TipoRecurso, 'bien_comun' | 'herramienta'>>('bien_comun')

const recursoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const recurso = computed(() => (recursoId.value ? zonas.recurso(recursoId.value) : null))
const lista = computed(() =>
  zonas.recursos.filter((r) => r.tipo !== 'parqueadero').sort((a, b) => a.nombre.localeCompare(b.nombre)),
)

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Recurso' },
  { clave: 'modo', titulo: 'Reserva' },
  { clave: 'tarifa', titulo: 'Tarifa', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]
const opcionesTipo = [
  { valor: 'bien_comun' as const, etiqueta: TIPO_RECURSO.bien_comun },
  { valor: 'herramienta' as const, etiqueta: TIPO_RECURSO.herramienta },
]

const ruta = (rid = '', vista?: string): RouteLocationRaw => ({
  name: 'modulo',
  params: { ...route.params, id: rid },
  query: vista ? { vista } : {},
})

function abrirCrear() {
  crear.reiniciar()
  creando.value = true
}

const crear = useAccion((clave, d: DatosRecurso) =>
  crearRecurso(
    id.value,
    {
      tipo: tipo.value,
      nombre: d.nombre,
      ubicacion: d.ubicacion,
      descripcion: d.descripcion,
      politica: d.politica,
      horario: { franjas: [1, 2, 3, 4, 5, 6, 7].map((dia) => ({ dia, inicio: '08:00:00', fin: '20:00:00' })), excepciones: [] },
      bien_comun: tipo.value === 'bien_comun' && d.categoria ? { categoria: d.categoria, reglas: d.reglas } : null,
    },
    clave,
  ),
)

async function enviar(d: DatosRecurso) {
  const r = await crear.ejecutar(d)
  if (!r.ok) return
  creando.value = false
  zonas.recordarRecurso(r.valor)
  await router.push(ruta(r.valor.id, 'horario'))
}

async function cargar() {
  estado.value = 'cargando'
  try {
    await zonas.asegurarRecursos(id.value, true)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section
    class="recursos"
    aria-labelledby="titulo-recursos"
  >
    <header class="encabezado">
      <div>
        <RouterLink
          v-if="recursoId"
          :to="ruta()"
          class="volver"
        >
          <IVolver aria-hidden="true" /> Todos los recursos
        </RouterLink>
        <h1 id="titulo-recursos">
          Recursos y reglas
        </h1>
      </div>
      <HudBoton
        v-if="puedeCrear && !recursoId && !creando"
        @click="abrirCrear"
      >
        <IMas aria-hidden="true" /> Nuevo recurso
      </HudBoton>
    </header>

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
    <template v-else-if="recursoId">
      <FichaRecurso
        v-if="recurso"
        :recurso="recurso"
      />
      <HudEstado
        v-else
        estado="vacio"
        mensaje="Ese recurso no existe en la copropiedad."
      />
    </template>
    <HudPanel
      v-else-if="creando"
      etiqueta="Nuevo recurso"
    >
      <HudSelector
        v-model="tipo"
        etiqueta="Tipo"
        :opciones="opcionesTipo"
      />
      <p class="texto-2">
        Empieza con horario de 8:00 a. m. a 8:00 p. m. todos los días; ajústelo después en la pestaña Horario.
      </p>
      <FormularioRecurso
        :key="tipo"
        :cargando="crear.cargando.value"
        :error="crear.error.value"
        texto-boton="Crear recurso"
        @enviar="enviar"
        @cancelar="creando = false"
      />
    </HudPanel>
    <HudEstado
      v-else-if="lista.length === 0"
      estado="vacio"
      mensaje="Aún no hay recursos registrados."
    />
    <HudTabla
      v-else
      :filas="lista"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Recursos de la copropiedad"
    >
      <template #celda-nombre="{ fila }">
        <span class="celda">
          <strong>{{ fila.nombre }}</strong>
          <small>{{ fila.bien_comun ? CATEGORIA[fila.bien_comun.categoria] : TIPO_RECURSO[fila.tipo] }}</small>
        </span>
      </template>
      <template #celda-modo="{ fila }">
        {{ MODO[fila.politica.modo] }}
      </template>
      <template #celda-tarifa="{ fila }">
        {{ comparar(fila.politica.tarifa, '0') > 0 ? moneda(fila.politica.tarifa) : 'Sin costo' }}
      </template>
      <template #celda-estado="{ fila }">
        <HudInsignia :tono="ESTADO_RECURSO[fila.estado].tono">
          {{ ESTADO_RECURSO[fila.estado].texto }}
        </HudInsignia>
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          :a="ruta(fila.id)"
          variante="fantasma"
        >
          Ver ficha<span class="solo-lector"> de {{ fila.nombre }}</span>
        </HudBoton>
      </template>
    </HudTabla>
  </section>
</template>

<style scoped>
.recursos {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.volver {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}

.celda {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
}

.texto-2 {
  color: var(--texto-2);
}
</style>

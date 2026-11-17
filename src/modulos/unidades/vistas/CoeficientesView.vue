<script setup lang="ts">
/**
 * Cuadros de coeficientes: borrador → vigente → histórico. Crear un borrador (copiando el
 * vigente), editar la tabla con suma y diferencia en vivo, validar en el servidor y activar
 * (exige suma exactamente 1, todos los bienes activos y ninguna asamblea instalada).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Cuadro, DetalleCuadro, RevisionCuadro } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { activarCuadro, arbol, crearCuadro, cuadros, detalleCuadro, guardarCoeficientes, validarCuadro } from '../api'
import { aplanarArbol } from '../bienes'
import { ESTADO_CUADRO, textoDiferencia } from '../coeficientes'
import EditorCoeficientes from '../componentes/EditorCoeficientes.vue'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const puedeEditar = computed(() => entidad.tienePermiso('bienes_privados.coeficientes.editar'))
const puedeActivar = computed(() => entidad.tienePermiso('bienes_privados.coeficientes.activar'))

const cuadroId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (c = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: c }, query: {} })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Cuadro[]>([])
const detalle = ref<DetalleCuadro | null>(null)
const filas = ref<{ id: string; codigo: string }[]>([])
const valores = ref<Record<string, string>>({})
const revision = ref<RevisionCuadro | null>(null)
const resultado = ref<string | null>(null)

const hayBorrador = computed(() => lista.value.some((c) => c.estado === 'borrador'))
const editable = computed(() => puedeEditar.value && detalle.value?.cuadro.estado === 'borrador')
const COLUMNAS = [
  { clave: 'version', titulo: 'Cuadro' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

// Crear borrador
const creando = ref(false)
const copiar = ref(true)
const descripcion = ref('')
const crear = useAccion((clave) => crearCuadro(id.value, copiar.value, descripcion.value.trim() || null, clave))

function abrirCrear() {
  copiar.value = true
  descripcion.value = ''
  crear.reiniciar()
  creando.value = true
}

async function enviarCrear() {
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  await router.push(ruta(r.valor.id))
}

// Guardar, validar, activar
const guardar = useAccion(() =>
  guardarCoeficientes(
    id.value,
    cuadroId.value,
    Object.entries(valores.value)
      .filter(([, v]) => v !== '')
      .map(([bien_privado_id, coeficiente]) => ({ bien_privado_id, coeficiente })),
  ),
)
const validar = useAccion(() => validarCuadro(id.value, cuadroId.value))
const activar = useAccion(() => activarCuadro(id.value, cuadroId.value), { alConflicto: () => cargarDetalle() })
const activando = ref(false)
const errorAccion = computed(() => guardar.error.value ?? validar.error.value)

async function enviarGuardar() {
  const r = await guardar.ejecutar()
  if (!r.ok) return
  revision.value = r.valor
  resultado.value = r.valor.valido ? 'Cuadro guardado: suma exactamente 1.' : `Cuadro guardado. ${textoDiferencia(r.valor.diferencia)}.`
}

async function enviarValidar() {
  const r = await validar.ejecutar()
  if (!r.ok) return
  revision.value = r.valor
  resultado.value = r.valor.valido ? 'El cuadro es válido: se puede activar.' : `El cuadro aún no es válido. ${textoDiferencia(r.valor.diferencia)}.`
}

function abrirActivar() {
  activar.reiniciar()
  activando.value = true
}

async function confirmarActivar() {
  const r = await activar.ejecutar()
  if (!r.ok) return
  activando.value = false
  resultado.value = `Cuadro ${r.valor.version} vigente: cada bien tomó su coeficiente.`
  await cargarDetalle()
}

async function cargarDetalle() {
  if (!cuadroId.value) return
  estado.value = 'cargando'
  try {
    const [d, a] = await Promise.all([detalleCuadro(id.value, cuadroId.value), arbol(id.value)])
    detalle.value = d
    revision.value = d.revision
    const activos = aplanarArbol(a).flatMap((g) => g.bienes)
    bienes.recordar(activos)
    const ids = new Set(activos.map((b) => b.id))
    const sobrantes = d.coeficientes.filter((c) => !ids.has(c.bien_privado_id)).map((c) => c.bien_privado_id)
    await bienes.resolver(sobrantes)
    filas.value = [...activos.map((b) => ({ id: b.id, codigo: b.codigo })), ...sobrantes.map((s) => ({ id: s, codigo: bienes.codigo(s) }))].sort((x, y) =>
      x.codigo.localeCompare(y.codigo, 'es', { numeric: true }),
    )
    valores.value = Object.fromEntries(d.coeficientes.map((c) => [c.bien_privado_id, c.coeficiente]))
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

async function cargarLista() {
  estado.value = 'cargando'
  try {
    lista.value = await cuadros(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

const cargar = () => (cuadroId.value ? cargarDetalle() : cargarLista())

watch(cuadroId, () => {
  resultado.value = null
  detalle.value = null
  cargar()
})
onMounted(cargar)
</script>

<template>
  <section
    class="coeficientes"
    aria-labelledby="titulo-coeficientes"
  >
    <header class="encabezado">
      <div>
        <RouterLink
          v-if="cuadroId"
          :to="ruta()"
          class="volver"
        >
          <IVolver aria-hidden="true" /> Todos los cuadros
        </RouterLink>
        <h1 id="titulo-coeficientes">
          Coeficientes
        </h1>
        <p class="texto-2">
          Se cambian solo con un cuadro nuevo: borrador → revisión → activación.
        </p>
      </div>
      <HudBoton
        v-if="!cuadroId && puedeEditar && !hayBorrador && estado === 'listo'"
        @click="abrirCrear"
      >
        <IMas aria-hidden="true" /> Nuevo borrador
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

    <template v-else-if="cuadroId && detalle">
      <HudPanel :etiqueta="`Cuadro ${detalle.cuadro.version}`">
        <div class="cabecera">
          <HudInsignia :tono="ESTADO_CUADRO[detalle.cuadro.estado].tono">
            {{ ESTADO_CUADRO[detalle.cuadro.estado].texto }}
          </HudInsignia>
          <span class="texto-2">{{ detalle.cuadro.descripcion ?? '' }}</span>
          <span
            v-if="detalle.cuadro.vigente_desde"
            class="texto-2"
          >Vigente desde {{ fecha(detalle.cuadro.vigente_desde, zona) }}</span>
        </div>
        <p
          v-if="revision && (revision.faltantes.length || revision.sobrantes.length)"
          class="aviso"
        >
          Revisión del servidor: {{ revision.faltantes.length }} bienes activos sin coeficiente y
          {{ revision.sobrantes.length }} bienes que ya no están activos.
        </p>
      </HudPanel>

      <EditorCoeficientes
        v-model="valores"
        :bienes="filas"
        :solo-lectura="!editable"
        :faltantes="revision?.faltantes ?? []"
      />

      <p
        v-if="errorAccion"
        class="error"
        role="alert"
      >
        {{ errorAccion }}
      </p>
      <div
        v-if="editable"
        class="botones"
      >
        <HudBoton
          :cargando="guardar.cargando.value"
          @click="enviarGuardar"
        >
          Guardar borrador
        </HudBoton>
        <HudBoton
          variante="secundario"
          :cargando="validar.cargando.value"
          @click="enviarValidar"
        >
          Validar
        </HudBoton>
        <HudBoton
          v-if="puedeActivar"
          variante="secundario"
          @click="abrirActivar"
        >
          Activar cuadro
        </HudBoton>
      </div>
    </template>

    <template v-else-if="!cuadroId">
      <HudEstado
        v-if="lista.length === 0"
        estado="vacio"
        mensaje="Aún no hay cuadros de coeficientes. Puede crearlos al importar los bienes."
      />
      <HudTabla
        v-else
        :filas="lista"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Cuadros de coeficientes"
      >
        <template #celda-version="{ fila }">
          <span class="celda">
            <strong>Cuadro {{ fila.version }}</strong>
            <small>{{ fila.descripcion ?? '' }}{{ fila.vigente_desde ? ` · vigente desde ${fecha(fila.vigente_desde, zona)}` : '' }}</small>
          </span>
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="ESTADO_CUADRO[fila.estado].tono">
            {{ ESTADO_CUADRO[fila.estado].texto }}
          </HudInsignia>
        </template>
        <template #celda-acciones="{ fila }">
          <HudBoton
            :a="ruta(fila.id)"
            variante="fantasma"
          >
            {{ fila.estado === 'borrador' && puedeEditar ? 'Editar' : 'Ver' }}<span class="solo-lector"> el cuadro {{ fila.version }}</span>
          </HudBoton>
        </template>
      </HudTabla>
    </template>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Nuevo cuadro borrador"
    >
      <form
        id="formulario-cuadro"
        class="campos"
        @submit.prevent="enviarCrear"
      >
        <label class="casilla">
          <input
            v-model="copiar"
            type="checkbox"
          >
          Partir de los coeficientes del cuadro vigente
        </label>
        <HudCampo
          v-model="descripcion"
          etiqueta="Descripción (opcional)"
          ayuda="Por ejemplo, la reforma o escritura que lo origina."
        />
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
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
          form="formulario-cuadro"
          :cargando="crear.cargando.value"
        >
          Crear borrador
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="activando"
      titulo="Activar el cuadro"
    >
      <p>
        El cuadro vigente pasará a histórico y cada bien tomará su nuevo coeficiente. No se puede activar
        mientras haya una asamblea instalada.
      </p>
      <p
        v-if="activar.error.value"
        class="error"
        role="alert"
      >
        {{ activar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="activando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="activar.cargando.value"
          @click="confirmarActivar"
        >
          Activar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.coeficientes,
.campos {
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

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.celda {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.ok,
.aviso,
.error {
  margin: 0;
}

.ok {
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.aviso {
  margin-top: 10px;
  color: var(--ambar);
}

.error {
  color: var(--magenta);
}
</style>

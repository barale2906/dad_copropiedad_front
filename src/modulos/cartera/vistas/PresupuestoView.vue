<script setup lang="ts">
/**
 * Presupuesto anual: versiones del año (vigente, borradores, reemplazados), presupuesto nuevo,
 * proyecto del año siguiente (copia del vigente con un ajuste porcentual) y el detalle (`:id`):
 * rubros, edición mientras es borrador, aprobación por la asamblea y ejecución presupuestal
 * contra el mayor hasta un mes.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { EjecucionPresupuestal, NuevoRubroPresupuesto, Presupuesto } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, moneda } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IVolver from '~icons/tabler/arrow-left'
import * as api from '../api'
import EditorRubros from '../componentes/EditorRubros.vue'
import { ESTADO_PRESUPUESTO } from '../reglas'
import { useCartera } from '../store'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const plan = usePlanCuentas()
const cartera = useCartera()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const presupuestoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (p = '') => ({ name: 'modulo', params: { ...route.params, accion: 'presupuesto', id: p }, query: {} })
const hoy = hoyEn(entidad.zonaHoraria)
const anioActual = Number(hoy.slice(0, 4))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Presupuesto[]>([])
const actual = ref<Presupuesto | null>(null)
const ejecucion = ref<EjecucionPresupuestal | null>(null)
const hastaMes = ref(String(Number(hoy.slice(5, 7))))
const resultado = ref<string | null>(null)
const creando = ref(false)
const editando = ref(false)
const ajuste = ref('5')
const vigenteDesde = ref(`${anioActual}-01-01`)

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const opcionesMes = MESES.map((m, i) => ({ valor: String(i + 1), etiqueta: m }))
const vigente = computed(() => lista.value.find((p) => p.anio === anioActual && p.estado === 'vigente') ?? null)
const COLUMNAS_EJECUCION = [
  { clave: 'nombre', titulo: 'Rubro' },
  { clave: 'presupuestado', titulo: 'Presupuestado', alinear: 'fin' as const },
  { clave: 'ejecutado', titulo: 'Ejecutado', alinear: 'fin' as const },
  { clave: 'diferencia', titulo: 'Diferencia', alinear: 'fin' as const },
]

const crear = useAccion((_c, rubros: NuevoRubroPresupuesto[]) => api.crearPresupuesto(id.value, { anio: anioActual + 1, descripcion: `Presupuesto ${anioActual + 1}`, rubros }))
const proyecto = useAccion(() => api.proyectoPresupuesto(id.value, anioActual, ajuste.value))
const guardarRubros = useAccion((_c, rubros: NuevoRubroPresupuesto[]) => api.guardarRubros(id.value, presupuestoId.value, rubros))
const aprobar = useAccion(() => api.aprobarPresupuesto(id.value, presupuestoId.value, vigenteDesde.value), { alConflicto: () => cargar() })
const verEjecucion = useAccion(() => api.ejecucion(id.value, presupuestoId.value, Number(hastaMes.value)))

async function alCrear(rubros: NuevoRubroPresupuesto[]) {
  const r = await crear.ejecutar(rubros)
  if (r.ok) await router.push(ruta(r.valor.id))
}

async function alProyecto() {
  const r = await proyecto.ejecutar()
  if (r.ok) await router.push(ruta(r.valor.id))
}

async function alGuardarRubros(rubros: NuevoRubroPresupuesto[]) {
  const r = await guardarRubros.ejecutar(rubros)
  if (!r.ok) return
  actual.value = r.valor
  editando.value = false
  resultado.value = `Rubros guardados: total anual ${moneda(r.valor.total_anual)}.`
}

async function alAprobar() {
  const r = await aprobar.ejecutar()
  if (!r.ok) return
  actual.value = r.valor
  resultado.value = `Presupuesto ${r.valor.anio} aprobado: queda vigente y reemplaza la versión anterior.`
  await alEjecucion()
}

async function alEjecucion() {
  const r = await verEjecucion.ejecutar()
  if (r.ok) ejecucion.value = r.valor
}

async function cargar() {
  estado.value = 'cargando'
  resultado.value = null
  ejecucion.value = null
  editando.value = false
  try {
    await Promise.all([plan.asegurar(), cartera.asegurar(id.value)])
    if (presupuestoId.value) {
      actual.value = await api.presupuesto(id.value, presupuestoId.value)
      vigenteDesde.value = `${actual.value.anio}-01-01`
      if (actual.value.estado !== 'borrador') ejecucion.value = await api.ejecucion(id.value, presupuestoId.value, Number(hastaMes.value)).catch(() => null)
    } else lista.value = await api.presupuestos(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(presupuestoId, cargar, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-presupuesto">
    <RouterLink
      v-if="presupuestoId"
      class="volver"
      :to="ruta()"
    >
      <IVolver aria-hidden="true" /> Volver a los presupuestos
    </RouterLink>
    <header class="encabezado">
      <div>
        <h1 id="titulo-presupuesto">
          {{ actual && presupuestoId ? `Presupuesto ${actual.anio} · versión ${actual.version}` : 'Presupuesto' }}
        </h1>
        <p class="texto-2">
          La cuota ordinaria de cada unidad sale del presupuesto vigente y de su coeficiente.
        </p>
      </div>
      <HudInsignia
        v-if="actual && presupuestoId"
        :tono="ESTADO_PRESUPUESTO[actual.estado].tono"
      >
        {{ ESTADO_PRESUPUESTO[actual.estado].texto }}
      </HudInsignia>
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

    <template v-else-if="presupuestoId && actual">
      <dl class="datos">
        <div><dt>Total anual</dt><dd class="cifra"><strong>{{ moneda(actual.total_anual) }}</strong></dd></div>
        <div><dt>Rubros</dt><dd>{{ actual.rubros.length }}</dd></div>
        <div v-if="actual.vigente_desde"><dt>Vigente desde</dt><dd>{{ actual.vigente_desde }}</dd></div>
        <div v-if="actual.descripcion"><dt>Descripción</dt><dd>{{ actual.descripcion }}</dd></div>
      </dl>
      <EditorRubros
        v-if="editando"
        :rubros="actual.rubros"
        :cargando="guardarRubros.cargando.value"
        :error="guardarRubros.error.value"
        @guardar="alGuardarRubros"
        @cancelar="editando = false"
      />
      <ul
        v-else
        class="lista"
        aria-label="Rubros del presupuesto"
      >
        <li
          v-for="r in actual.rubros"
          :key="r.id"
        >
          <span class="crece">
            <strong>{{ r.nombre }}</strong>
            <small>{{ cartera.concepto(r.concepto_cobro_id)?.codigo ?? '' }} · cuenta {{ plan.porId.get(r.cuenta_contable_id)?.codigo ?? '—' }}</small>
          </span>
          <span class="cifra">{{ moneda(r.valor_anual) }}</span>
        </li>
      </ul>
      <HudPanel
        v-if="actual.estado === 'borrador' && !editando"
        etiqueta="Borrador"
      >
        <div class="campos">
          <div class="botones">
            <HudBoton
              variante="secundario"
              @click="editando = true"
            >
              Editar rubros
            </HudBoton>
          </div>
          <p class="texto-2">
            Cuando la asamblea lo apruebe, regístrelo aquí: queda vigente y reemplaza la versión del año.
          </p>
          <div class="filtros">
            <HudFecha
              v-model="vigenteDesde"
              etiqueta="Vigente desde"
            />
          </div>
          <p
            v-if="aprobar.error.value"
            class="error"
            role="alert"
          >
            {{ aprobar.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              :cargando="aprobar.cargando.value"
              @click="alAprobar"
            >
              Registrar la aprobación
            </HudBoton>
          </div>
        </div>
      </HudPanel>
      <HudPanel
        v-if="actual.estado !== 'borrador'"
        etiqueta="Ejecución presupuestal"
      >
        <div class="campos">
          <div class="filtros">
            <HudSelector
              v-model="hastaMes"
              etiqueta="Hasta el mes"
              :opciones="opcionesMes"
            />
            <HudBoton
              variante="secundario"
              :cargando="verEjecucion.cargando.value"
              @click="alEjecucion"
            >
              Ver ejecución
            </HudBoton>
          </div>
          <HudTabla
            v-if="ejecucion"
            :filas="ejecucion.rubros"
            :columnas="COLUMNAS_EJECUCION"
            clave="rubro_id"
            :titulo="`Ejecución de enero a ${MESES[ejecucion.hasta_mes - 1]?.toLowerCase() ?? ''}`"
          >
            <template #celda-nombre="{ fila }">
              <span class="crece"><strong>{{ fila.nombre }}</strong><small>{{ fila.cuenta_codigo }}</small></span>
            </template>
            <template #celda-presupuestado="{ fila }">
              <span class="cifra">{{ moneda(fila.presupuestado) }}</span>
            </template>
            <template #celda-ejecutado="{ fila }">
              <span class="cifra">{{ moneda(fila.ejecutado) }}</span>
            </template>
            <template #celda-diferencia="{ fila }">
              <HudInsignia :tono="comparar(fila.diferencia, '0') < 0 ? 'peligro' : 'exito'">
                {{ moneda(fila.diferencia) }}
              </HudInsignia>
            </template>
          </HudTabla>
        </div>
      </HudPanel>
    </template>

    <template v-else>
      <HudEstado
        v-if="lista.length === 0"
        estado="vacio"
        mensaje="Aún no hay presupuestos."
      />
      <ul
        v-else
        class="lista"
        aria-label="Presupuestos"
      >
        <li
          v-for="p in lista"
          :key="p.id"
        >
          <span class="crece">
            <RouterLink :to="ruta(p.id)">{{ p.anio }} · versión {{ p.version }}</RouterLink>
            <small>{{ p.descripcion }}</small>
          </span>
          <span class="cifra">{{ moneda(p.total_anual) }}</span>
          <HudInsignia :tono="ESTADO_PRESUPUESTO[p.estado].tono">
            {{ ESTADO_PRESUPUESTO[p.estado].texto }}
          </HudInsignia>
        </li>
      </ul>
      <HudPanel
        v-if="vigente"
        :etiqueta="`Proyecto de ${anioActual + 1}`"
      >
        <form
          class="campos"
          novalidate
          @submit.prevent="alProyecto"
        >
          <p class="texto-2">
            Copia el presupuesto vigente de {{ anioActual }} con un ajuste y lo deja en borrador para la asamblea.
          </p>
          <div class="filtros">
            <HudCampo
              v-model="ajuste"
              etiqueta="Ajuste (%)"
              modo-entrada="decimal"
              ayuda="Entre -50 y 100 (p. ej. el IPC)."
            />
          </div>
          <p
            v-if="proyecto.error.value"
            class="error"
            role="alert"
          >
            {{ proyecto.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="proyecto.cargando.value"
            >
              Crear el proyecto
            </HudBoton>
            <HudBoton
              v-if="!creando"
              variante="secundario"
              @click="creando = true"
            >
              Empezar uno desde cero
            </HudBoton>
          </div>
        </form>
      </HudPanel>
      <HudPanel
        v-if="creando || !vigente"
        :etiqueta="`Presupuesto nuevo de ${anioActual + 1}`"
      >
        <EditorRubros
          accion="Crear en borrador"
          :cargando="crear.cargando.value"
          :error="crear.error.value"
          @guardar="alCrear"
          @cancelar="creando = false"
        />
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

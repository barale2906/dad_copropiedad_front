<script setup lang="ts">
/**
 * Apertura y cierre (`?vista=`):
 * - **Saldos iniciales**: con el editor de comprobantes (o cargados desde un CSV `cuenta,
 *   débito, crédito[, centro]`), se registran ya contabilizados con el tipo `AP`.
 * - **Cierre anual**: vista previa del resultado del año (estados financieros al 31 de
 *   diciembre) y confirmación; lleva el resultado al patrimonio en el periodo 13.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Comprobante, EstadosFinancieros } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { moneda } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import ISubir from '~icons/tabler/upload'
import { cierreAnual, configuracion, estadosFinancieros, saldosIniciales } from '../api'
import EditorComprobante from '../componentes/EditorComprobante.vue'
import { avisosComprobante, type ComprobanteEditable, comprobanteVacio, leerCsvSaldos, peticionComprobante } from '../reglas'

const PESTANAS = [
  { id: 'saldos', texto: 'Saldos iniciales' },
  { id: 'cierre', texto: 'Cierre anual' },
] as const

const route = useRoute()
const entidad = useEntidad()
const plan = usePlanCuentas()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puede = computed(() => entidad.tienePermiso('contabilidad.comprobantes.contabilizar'))
const rutaComprobante = (c: string) => ({ name: 'modulo', params: { ...route.params, accion: 'comprobantes', id: c }, query: {} })
const hoy = hoyEn(entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)

// Saldos iniciales
const TIPO_APERTURA = [{ id: 'ap', codigo: 'AP', nombre: 'Saldos iniciales', manual: true, activo: true }]
const modelo = ref<ComprobanteEditable>({ ...comprobanteVacio(hoy, 'AP'), descripcion: 'Saldos iniciales' })
const erroresCsv = ref<string[]>([])
const confirmando = ref(false)
const registrado = ref<Comprobante | null>(null)
const avisos = computed(() => avisosComprobante(modelo.value, plan.porCodigo))
const registrar = useAccion((clave) => {
  const p = peticionComprobante(modelo.value)
  return saldosIniciales(id.value, { fecha: p.fecha, tipo: 'AP', descripcion: p.descripcion || null, lineas: p.lineas }, clave)
})

async function alElegirCsv(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return
  const { lineas, errores } = leerCsvSaldos(await archivo.text())
  erroresCsv.value = errores
  if (lineas.length) modelo.value = { ...modelo.value, lineas }
  ;(e.target as HTMLInputElement).value = ''
}

async function alRegistrar() {
  if (!confirmando.value) {
    confirmando.value = true
    return
  }
  const r = await registrar.ejecutar()
  confirmando.value = false
  if (r.ok) registrado.value = r.valor
}

// Cierre anual
const anioActual = Number(hoy.slice(0, 4))
const anio = ref(String(anioActual - 1))
const opcionesAnio = [anioActual, anioActual - 1, anioActual - 2].map((a) => ({ valor: String(a), etiqueta: String(a) }))
const paso = ref<PasoFlujo>('editar')
const previa = ref<EstadosFinancieros | null>(null)
const cierre = ref<Comprobante | null>(null)
const ver = useAccion(() => estadosFinancieros(id.value, `${anio.value}-12-31`))
const cerrar = useAccion((clave) => cierreAnual(id.value, Number(anio.value), clave))

async function previsualizarCierre() {
  const r = await ver.ejecutar()
  if (!r.ok) return
  previa.value = r.valor
  paso.value = 'revisar'
}

async function confirmarCierre() {
  const r = await cerrar.ejecutar()
  if (!r.ok) return
  cierre.value = r.valor
  paso.value = 'hecho'
}

async function cargar() {
  try {
    await plan.asegurar()
    const c = await configuracion(id.value)
    if (c) modelo.value = { ...modelo.value, fecha: c.vigente_desde }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-apertura">
    <h1 id="titulo-apertura">
      Apertura y cierre
    </h1>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Apertura y cierre"
    />
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
    <p
      v-else-if="!puede"
      class="aviso"
    >
      Registrar saldos iniciales y el cierre anual exige el permiso para contabilizar comprobantes.
    </p>

    <template v-else-if="pestana === 'saldos'">
      <p
        v-if="registrado"
        class="ok"
        role="status"
      >
        Saldos iniciales registrados como {{ registrado.tipo }}-{{ registrado.numero }}.
        <RouterLink :to="rutaComprobante(registrado.id)">
          Ver el comprobante
        </RouterLink>
      </p>
      <HudPanel etiqueta="Saldos iniciales">
        <p class="texto-2">
          Escriba los saldos con los que arranca la contabilidad o cárguelos desde un CSV con las columnas cuenta, débito, crédito y (opcional) centro de costo.
        </p>
        <div class="botones">
          <input
            id="csv-saldos"
            type="file"
            class="solo-lector"
            accept=".csv,text/csv"
            @change="alElegirCsv"
          >
          <label
            for="csv-saldos"
            class="subir"
          ><ISubir aria-hidden="true" /> Cargar desde CSV</label>
        </div>
        <ul
          v-if="erroresCsv.length"
          class="lista"
          aria-label="Filas del CSV con errores"
        >
          <li
            v-for="e in erroresCsv"
            :key="e"
            class="error"
          >
            {{ e }}
          </li>
        </ul>
        <EditorComprobante
          v-model="modelo"
          :entidad-id="id"
          :tipos="TIPO_APERTURA"
          :cuentas="plan.cuentas"
          :centros="plan.centros"
          @guardar="alRegistrar"
          @contabilizar="alRegistrar"
        />
        <p
          v-if="registrar.error.value"
          class="error"
          role="alert"
        >
          {{ registrar.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            :deshabilitado="avisos.length > 0"
            :cargando="registrar.cargando.value"
            @click="alRegistrar"
          >
            Registrar los saldos iniciales
          </HudBoton>
        </div>
      </HudPanel>
      <HudDialogo
        v-model:abierto="confirmando"
        titulo="Registrar los saldos iniciales"
      >
        <p>Se registran ya contabilizados (tipo AP). Si hay que corregirlos, se revierten.</p>
        <template #acciones>
          <HudBoton
            variante="fantasma"
            @click="confirmando = false"
          >
            Volver
          </HudBoton>
          <HudBoton
            :cargando="registrar.cargando.value"
            @click="alRegistrar"
          >
            Registrar
          </HudBoton>
        </template>
      </HudDialogo>
    </template>

    <HudPanel
      v-else
      etiqueta="Cierre anual"
    >
      <FlujoDosPasos
        v-model:paso="paso"
        accion="Contabilizar el cierre"
        :cargando="ver.cargando.value || cerrar.cargando.value"
        :error="ver.error.value ?? cerrar.error.value"
        :bloqueado="!!previa?.cierre_contabilizado"
        @previsualizar="previsualizarCierre"
        @confirmar="confirmarCierre"
        @reiniciar="paso = 'editar'"
      >
        <template #formulario>
          <HudSelector
            v-model="anio"
            etiqueta="Año que se cierra"
            :opciones="opcionesAnio"
          />
          <p class="texto-2">
            Antes del cierre, deje contabilizados los comprobantes del año y cerrados sus periodos.
          </p>
        </template>
        <template #vista-previa>
          <template v-if="previa">
            <p
              v-if="previa.cierre_contabilizado"
              class="aviso"
            >
              El cierre de {{ anio }} ya está contabilizado.
            </p>
            <dl
              v-else
              class="datos"
            >
              <div>
                <dt>{{ previa.resultado_ejercicio.startsWith('-') ? 'Déficit' : 'Excedente' }} de {{ anio }}</dt>
                <dd class="cifra">
                  {{ moneda(previa.resultado_ejercicio) }}
                </dd>
              </div>
              <div
                v-for="r in previa.resultados"
                :key="r.codigo"
              >
                <dt>{{ r.nombre }}</dt>
                <dd class="cifra">
                  {{ moneda(r.valor) }}
                </dd>
              </div>
            </dl>
            <p class="texto-2">
              El cierre salda las cuentas de ingresos, gastos y costos contra la cuenta de resultado del ejercicio (periodo 13).
            </p>
          </template>
        </template>
        <template #hecho>
          <p
            v-if="cierre"
            class="ok"
          >
            Cierre de {{ anio }} contabilizado como {{ cierre.tipo }}-{{ cierre.numero }}.
            <RouterLink :to="rutaComprobante(cierre.id)">
              Ver el comprobante
            </RouterLink>
          </p>
        </template>
      </FlujoDosPasos>
    </HudPanel>
  </section>
</template>

<style scoped src="./contabilidad.css"></style>
<style scoped>
.subir {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid var(--linea-fuerte);
  color: var(--cian);
  cursor: pointer;
}

input:focus-visible + .subir {
  outline: 2px solid var(--cian);
  outline-offset: 2px;
}
</style>

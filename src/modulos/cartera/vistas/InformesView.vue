<script setup lang="ts">
/**
 * Informes de la cartera: estado del fondo de imprevistos frente al presupuesto (art. 35), flujo
 * de caja mensual de las cuentas de tesorería y el paquete en PDF para la asamblea (ejecución
 * presupuestal, cartera por edades y fondo), que se ve dentro de la app.
 */
import { computed, onMounted, ref } from 'vue'
import { type ArchivoRecibido, guardarBlob } from '@/api/archivos'
import type { EstadoFondo, MesFlujo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda, porcentaje } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import VisorPdf from '@/hud/componentes/VisorPdf.vue'
import { useEntidad } from '@/stores/entidad'
import { flujoCaja, informeAsamblea, informeFondo } from '../api'
import { moverPeriodo, periodoDe, textoPeriodo } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const anio = Number(hoy.slice(0, 4))
const actual = periodoDe(hoy)

const fondo = ref<EstadoFondo | null>(null)
const meses = ref<MesFlujo[]>([])
const desde = ref(moverPeriodo(actual, -5))
const hasta = ref(actual)
const hastaMes = ref(String(Number(hoy.slice(5, 7))))
const pdf = ref<ArchivoRecibido | null>(null)

const opcionesPeriodo = Array.from({ length: 24 }, (_, i) => moverPeriodo(actual, -i)).map((p) => ({ valor: p, etiqueta: textoPeriodo(p) }))
const opcionesMes = Array.from({ length: 12 }, (_, i) => ({ valor: String(i + 1), etiqueta: textoPeriodo(`${anio}-${String(i + 1).padStart(2, '0')}-01`) }))
const COLUMNAS = [
  { clave: 'mes', titulo: 'Mes' },
  { clave: 'saldo_inicial', titulo: 'Saldo inicial', alinear: 'fin' as const },
  { clave: 'entradas', titulo: 'Entradas', alinear: 'fin' as const },
  { clave: 'salidas', titulo: 'Salidas', alinear: 'fin' as const },
  { clave: 'saldo_final', titulo: 'Saldo final', alinear: 'fin' as const },
]

const verFondo = useAccion(() => informeFondo(id.value, anio))
const verFlujo = useAccion(() => flujoCaja(id.value, desde.value, hasta.value))
const verAsamblea = useAccion(() => informeAsamblea(id.value, anio, Number(hastaMes.value)))

async function alFlujo() {
  const r = await verFlujo.ejecutar()
  if (r.ok) meses.value = r.valor
}

async function alAsamblea() {
  const r = await verAsamblea.ejecutar()
  if (r.ok) pdf.value = r.valor
}

onMounted(async () => {
  const r = await verFondo.ejecutar()
  if (r.ok) fondo.value = r.valor
  await alFlujo()
})
</script>

<template>
  <section aria-labelledby="titulo-informes">
    <header>
      <h1 id="titulo-informes">
        Informes de la cartera
      </h1>
      <p class="texto-2">
        Para la junta, el consejo y la asamblea.
      </p>
    </header>

    <HudPanel :etiqueta="`Fondo de imprevistos ${anio}`">
      <p
        v-if="verFondo.error.value"
        class="error"
        role="alert"
      >
        {{ verFondo.error.value }}
      </p>
      <div
        v-if="fondo"
        class="campos"
      >
        <div class="filtros">
          <TarjetaResumen
            titulo="Liquidado"
            :valor="moneda(fondo.liquidado)"
            :detalle="`${porcentaje(fondo.porcentaje)} del presupuesto anual`"
            tono="info"
          />
          <TarjetaResumen
            titulo="Recaudado"
            :valor="moneda(fondo.recaudado)"
            tono="exito"
          />
          <TarjetaResumen
            titulo="Aporte de la política"
            :valor="porcentaje(fondo.porcentaje_politica)"
            :detalle="fondo.suspendido ? 'Aportes suspendidos por la asamblea' : 'Sobre lo ordinario de cada periodo'"
            tono="neutro"
          />
        </div>
        <p
          v-if="fondo.llego_a_la_mitad"
          class="aviso"
        >
          El fondo llegó al 50 % del presupuesto anual: la asamblea puede suspender los aportes (art. 35).
        </p>
      </div>
    </HudPanel>

    <HudPanel etiqueta="Flujo de caja">
      <form
        class="filtros"
        novalidate
        @submit.prevent="alFlujo"
      >
        <HudSelector
          v-model="desde"
          etiqueta="Desde"
          :opciones="opcionesPeriodo"
        />
        <HudSelector
          v-model="hasta"
          etiqueta="Hasta"
          :opciones="opcionesPeriodo"
        />
        <HudBoton
          tipo="submit"
          variante="secundario"
          :cargando="verFlujo.cargando.value"
        >
          Ver flujo
        </HudBoton>
      </form>
      <p
        v-if="verFlujo.error.value"
        class="error"
        role="alert"
      >
        {{ verFlujo.error.value }}
      </p>
      <HudTabla
        v-if="meses.length"
        :filas="meses"
        :columnas="COLUMNAS"
        clave="mes"
        titulo="Flujo de caja mensual"
      >
        <template #celda-mes="{ fila }">
          {{ textoPeriodo(fila.mes) }}
        </template>
        <template #celda-saldo_inicial="{ fila }">
          <span class="cifra">{{ moneda(fila.saldo_inicial) }}</span>
        </template>
        <template #celda-entradas="{ fila }">
          <span class="cifra">{{ moneda(fila.entradas) }}</span>
        </template>
        <template #celda-salidas="{ fila }">
          <span class="cifra">{{ moneda(fila.salidas) }}</span>
        </template>
        <template #celda-saldo_final="{ fila }">
          <strong class="cifra">{{ moneda(fila.saldo_final) }}</strong>
        </template>
      </HudTabla>
    </HudPanel>

    <HudPanel etiqueta="Informe para la asamblea">
      <form
        class="filtros"
        novalidate
        @submit.prevent="alAsamblea"
      >
        <HudSelector
          v-model="hastaMes"
          etiqueta="Hasta el mes"
          :opciones="opcionesMes"
        />
        <HudBoton
          tipo="submit"
          :cargando="verAsamblea.cargando.value"
        >
          Generar el informe (PDF)
        </HudBoton>
      </form>
      <p
        v-if="verAsamblea.error.value"
        class="error"
        role="alert"
      >
        {{ verAsamblea.error.value }}
      </p>
      <VisorPdf
        v-if="pdf"
        :archivo="pdf.blob"
        :titulo="`Informe para la asamblea ${anio}`"
        @descargar="pdf && guardarBlob(pdf.blob, pdf.nombre)"
      />
    </HudPanel>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

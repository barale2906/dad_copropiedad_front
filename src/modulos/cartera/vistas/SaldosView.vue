<script setup lang="ts">
/**
 * Saldos de la cartera (`?vista=`): unidades con saldo a una fecha de corte, cartera por edades y
 * cuadre contra el mayor. El detalle (`:id` = unidad) es su estado de cuenta con las cuentas de
 * cobro en PDF. Los saldos nunca se editan: se corrigen con ajustes.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { type ArchivoRecibido, guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { CarteraEdades, CuadreCartera, CuentaCobro, EstadoCuenta as TipoEstadoCuenta, SaldoBien } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { comparar, moneda, sumar } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import EstadoCuenta from '@/hud/componentes/EstadoCuenta.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import TablaEdades from '@/hud/componentes/TablaEdades.vue'
import VisorPdf from '@/hud/componentes/VisorPdf.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { cuadre as pedirCuadre, cuentasCobro, edades as pedirEdades, estadoCuenta, pdfCuentaCobro, saldos as pedirSaldos } from '../api'
import { textoPeriodo } from '../reglas'

const PESTANAS = [
  { id: 'saldos', texto: 'Saldos' },
  { id: 'edades', texto: 'Por edades' },
  { id: 'cuadre', texto: 'Cuadre con el mayor' },
] as const

const route = useRoute()
const entidad = useEntidad()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const bienId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (b = '') => ({ name: 'modulo', params: { ...route.params, accion: 'saldos', id: b }, query: {} })

const corte = ref(hoyEn(entidad.zonaHoraria))
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const saldos = ref<SaldoBien[]>([])
const edades = ref<CarteraEdades | null>(null)
const cuadre = ref<CuadreCartera[]>([])
const cuenta = ref<TipoEstadoCuenta | null>(null)
const cobros = ref<CuentaCobro[]>([])
const pdf = ref<{ archivo: ArchivoRecibido; numero: string } | null>(null)

const totalSaldo = computed(() => sumar('0', ...saldos.value.map((s) => s.saldo)))
const totalVencido = computed(() => sumar('0', ...saldos.value.map((s) => s.vencido)))
const filasEdades = computed(() => (edades.value?.bienes ?? []).map((b) => ({ ...b, clave: b.bien_privado_id ?? b.codigo, nombre: b.codigo })))
const COLUMNAS = [
  { clave: 'codigo', titulo: 'Unidad' },
  { clave: 'saldo', titulo: 'Saldo', alinear: 'fin' as const },
  { clave: 'vencido', titulo: 'Vencido', alinear: 'fin' as const },
]
const COLUMNAS_CUADRE = [
  { clave: 'cuenta', titulo: 'Cuenta' },
  { clave: 'saldo_mayor', titulo: 'Mayor', alinear: 'fin' as const },
  { clave: 'saldo_cartera', titulo: 'Cartera', alinear: 'fin' as const },
  { clave: 'diferencia', titulo: 'Diferencia', alinear: 'fin' as const },
]

const verPdf = useAccion((_c, c: CuentaCobro) => pdfCuentaCobro(id.value, c.id))

async function alVerPdf(c: CuentaCobro) {
  const r = await verPdf.ejecutar(c)
  if (r.ok) pdf.value = { archivo: r.valor, numero: c.numero }
}

async function cargar() {
  estado.value = 'cargando'
  pdf.value = null
  try {
    if (bienId.value) {
      ;[cuenta.value, cobros.value] = await Promise.all([estadoCuenta(id.value, bienId.value, corte.value), cuentasCobro(id.value, { bienId: bienId.value })])
    } else if (pestana.value === 'edades') edades.value = await pedirEdades(id.value, corte.value)
    else if (pestana.value === 'cuadre') cuadre.value = await pedirCuadre(id.value)
    else saldos.value = await pedirSaldos(id.value, corte.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([bienId, pestana, corte], cargar, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-saldos">
    <template v-if="bienId">
      <RouterLink
        class="volver"
        :to="ruta()"
      >
        <IVolver aria-hidden="true" /> Volver a los saldos
      </RouterLink>
      <h1 id="titulo-saldos">
        Estado de cuenta{{ cuenta ? ` de ${cuenta.bien.codigo}` : '' }}
      </h1>
    </template>
    <template v-else>
      <header>
        <h1 id="titulo-saldos">
          Saldos de la cartera
        </h1>
        <p class="texto-2">
          Se calculan con lo liquidado, lo pagado y los ajustes; para corregir un saldo use «Ajustes».
        </p>
      </header>
      <HudPestanas
        :pestanas="PESTANAS"
        etiqueta="Vistas de los saldos"
      />
    </template>
    <div
      v-if="bienId || pestana !== 'cuadre'"
      class="filtros"
    >
      <HudFecha
        v-model="corte"
        etiqueta="Fecha de corte"
      />
    </div>

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

    <template v-else-if="bienId && cuenta">
      <EstadoCuenta :estado="cuenta" />
      <HudPanel etiqueta="Cuentas de cobro">
        <p
          v-if="verPdf.error.value"
          class="error"
          role="alert"
        >
          {{ verPdf.error.value }}
        </p>
        <p
          v-if="cobros.length === 0"
          class="texto-2"
        >
          Aún no hay cuentas de cobro.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Cuentas de cobro"
        >
          <li
            v-for="c in cobros"
            :key="c.id"
          >
            <span class="crece">
              <strong>{{ c.numero }} · {{ textoPeriodo(c.periodo) }}</strong>
              <small>Vence el {{ fechaCalendario(c.vencimiento) }} · saldo anterior {{ moneda(c.saldo_anterior) }}</small>
            </span>
            <span class="cifra">{{ moneda(c.total) }}</span>
            <HudBoton
              variante="fantasma"
              @click="alVerPdf(c)"
            >
              PDF<span class="solo-lector"> de la cuenta de cobro {{ c.numero }}</span>
            </HudBoton>
          </li>
        </ul>
        <VisorPdf
          v-if="pdf"
          :archivo="pdf.archivo.blob"
          :titulo="`Cuenta de cobro ${pdf.numero}`"
          @descargar="pdf && guardarBlob(pdf.archivo.blob, pdf.archivo.nombre)"
        />
      </HudPanel>
    </template>

    <template v-else-if="pestana === 'saldos'">
      <p class="texto-2 cifra">
        {{ saldos.length }} unidades con saldo · total {{ moneda(totalSaldo) }} · vencido {{ moneda(totalVencido) }}
      </p>
      <HudEstado
        v-if="saldos.length === 0"
        estado="vacio"
        mensaje="Ninguna unidad tiene saldo a esa fecha."
      />
      <HudTabla
        v-else
        :filas="saldos"
        :columnas="COLUMNAS"
        clave="bien_privado_id"
        titulo="Saldos por unidad"
      >
        <template #celda-codigo="{ fila }">
          <RouterLink :to="ruta(fila.bien_privado_id)">
            {{ fila.codigo }}
          </RouterLink>
        </template>
        <template #celda-saldo="{ fila }">
          <span class="cifra">{{ moneda(fila.saldo) }}</span>
        </template>
        <template #celda-vencido="{ fila }">
          <span class="cifra">{{ moneda(fila.vencido) }}</span>
        </template>
      </HudTabla>
    </template>

    <template v-else-if="pestana === 'edades' && edades">
      <HudEstado
        v-if="filasEdades.length === 0"
        estado="vacio"
        mensaje="Ninguna unidad tiene saldo a esa fecha."
      />
      <TablaEdades
        v-else
        :filas="filasEdades"
        :total="{ ...edades.total, clave: 'total', nombre: 'Total' }"
      >
        <template #nombre="{ fila }">
          <RouterLink :to="ruta(fila.clave)">
            {{ fila.nombre }}
          </RouterLink>
        </template>
      </TablaEdades>
    </template>

    <template v-else-if="pestana === 'cuadre'">
      <p class="texto-2">
        Compara la cartera con el saldo de sus cuentas en el mayor. Una diferencia indica un comprobante manual sobre esas cuentas.
      </p>
      <HudTabla
        :filas="cuadre"
        :columnas="COLUMNAS_CUADRE"
        clave="cuenta_contable_id"
        titulo="Cuadre de la cartera con el mayor"
      >
        <template #celda-cuenta="{ fila }">
          <span class="crece">
            <strong>{{ fila.codigo }}</strong>
            <small>{{ fila.nombre }}</small>
          </span>
        </template>
        <template #celda-saldo_mayor="{ fila }">
          <span class="cifra">{{ moneda(fila.saldo_mayor) }}</span>
        </template>
        <template #celda-saldo_cartera="{ fila }">
          <span class="cifra">{{ moneda(fila.saldo_cartera) }}</span>
        </template>
        <template #celda-diferencia="{ fila }">
          <HudInsignia :tono="comparar(fila.diferencia, '0') === 0 ? 'exito' : 'peligro'">
            {{ comparar(fila.diferencia, '0') === 0 ? 'Cuadra' : moneda(fila.diferencia) }}
          </HudInsignia>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

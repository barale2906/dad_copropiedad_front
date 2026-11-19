<script setup lang="ts">
/**
 * Preparación de retención en la fuente, IVA e ICA por rango de fechas (`?vista=`), con su
 * conciliación contra el mayor. Se imprime o se exporta a CSV para el formulario de la DIAN o del
 * municipio: el sistema prepara; presentar y firmar lo hace el responsable tributario.
 */
import { computed, ref, watch } from 'vue'
import { guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { PreparacionIca, PreparacionIva, PreparacionRetencion } from '@/api/tipos'
import { usePestana } from '@/composables/usePestana'
import { comparar, moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IImprimir from '~icons/tabler/printer'
import { prepararIca, prepararIva, prepararRetencion } from '../api'
import { aCsv } from '../reglas'

const PESTANAS = [
  { id: 'retencion', texto: 'Retención en la fuente' },
  { id: 'iva', texto: 'IVA' },
  { id: 'ica', texto: 'ICA' },
] as const
const IMPUESTO: Record<string, string> = { renta: 'Renta', iva: 'IVA', ica: 'ICA' }

const entidad = useEntidad()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const desde = ref(`${hoy.slice(0, 8)}01`)
const hasta = ref(hoy)
const rango = computed(() => ({ desde: desde.value, hasta: hasta.value }))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const retencion = ref<PreparacionRetencion | null>(null)
const iva = ref<PreparacionIva | null>(null)
const ica = ref<PreparacionIca | null>(null)
const cuadra = computed(() => !!retencion.value && comparar(retencion.value.diferencia, '0') === 0)

const COL_RET = [
  { clave: 'impuestoTexto', titulo: 'Impuesto' },
  { clave: 'concepto', titulo: 'Concepto' },
  { clave: 'tarifa', titulo: 'Tarifa', alinear: 'fin' as const },
  { clave: 'base', titulo: 'Base', alinear: 'fin' as const },
  { clave: 'valor', titulo: 'Retenido', alinear: 'fin' as const },
]
const filasRet = computed(() => (retencion.value?.detalle ?? []).map((d, i) => ({ ...d, clave: String(i), impuestoTexto: IMPUESTO[d.impuesto] ?? d.impuesto })))
const COL_IVA = [
  { clave: 'tarifa', titulo: 'Tarifa', alinear: 'fin' as const },
  { clave: 'base', titulo: 'Base', alinear: 'fin' as const },
  { clave: 'iva', titulo: 'IVA', alinear: 'fin' as const },
]
const generado = computed(() => (iva.value?.generado ?? []).map((x, i) => ({ ...x, clave: `g${i}` })))
const descontable = computed(() => (iva.value?.descontable ?? []).map((x, i) => ({ ...x, clave: `d${i}` })))
const COL_ICA = [
  { clave: 'municipio_dane', titulo: 'Municipio (DANE)' },
  { clave: 'actividad', titulo: 'Actividad (CIIU)' },
  { clave: 'tarifa', titulo: 'Tarifa (por mil)', alinear: 'fin' as const },
  { clave: 'base', titulo: 'Base', alinear: 'fin' as const },
  { clave: 'impuesto', titulo: 'Impuesto', alinear: 'fin' as const },
]
const filasIca = computed(() => (ica.value?.lineas ?? []).map((l, i) => ({ ...l, clave: String(i), tarifa: l.tarifa_por_mil ?? 'Sin tarifa vigente', impuesto: l.impuesto ?? '' })))

function exportar() {
  let filas: (string | number)[][] = []
  if (pestana.value === 'retencion' && retencion.value) filas = [['impuesto', 'concepto', 'tarifa', 'base', 'valor'], ...retencion.value.detalle.map((d) => [d.impuesto, d.concepto, d.tarifa, d.base, d.valor])]
  else if (pestana.value === 'iva' && iva.value) filas = [['tipo', 'tarifa', 'base', 'iva'], ...iva.value.generado.map((x) => ['generado', x.tarifa, x.base, x.iva]), ...iva.value.descontable.map((x) => ['descontable', x.tarifa, x.base, x.iva])]
  else if (ica.value) filas = [['municipio', 'actividad', 'tarifa_por_mil', 'base', 'impuesto'], ...ica.value.lineas.map((l) => [l.municipio_dane, l.actividad, l.tarifa_por_mil ?? '', l.base, l.impuesto ?? ''])]
  guardarBlob(new Blob([aCsv(filas)], { type: 'text/csv;charset=utf-8' }), `${pestana.value}-${desde.value}-a-${hasta.value}.csv`)
}

function imprimir() {
  window.print()
}

async function cargar() {
  estado.value = 'cargando'
  try {
    if (pestana.value === 'retencion') retencion.value = await prepararRetencion(id.value, rango.value)
    else if (pestana.value === 'iva') iva.value = await prepararIva(id.value, rango.value)
    else ica.value = await prepararIca(id.value, rango.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([pestana, desde, hasta], cargar, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-impuestos">
    <header class="encabezado">
      <h1 id="titulo-impuestos">
        Retención, IVA e ICA
      </h1>
      <div class="botones">
        <HudBoton
          variante="secundario"
          :deshabilitado="estado !== 'listo'"
          @click="imprimir"
        >
          <IImprimir aria-hidden="true" /> Imprimir o guardar como PDF
        </HudBoton>
        <HudBoton
          variante="fantasma"
          :deshabilitado="estado !== 'listo'"
          @click="exportar"
        >
          Exportar CSV
        </HudBoton>
      </div>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Impuestos"
    />
    <div class="filtros">
      <HudFecha
        v-model="desde"
        etiqueta="Desde"
      />
      <HudFecha
        v-model="hasta"
        etiqueta="Hasta"
      />
    </div>
    <p class="texto-2">
      El sistema prepara los valores; presentar y firmar la declaración lo hace el responsable tributario.
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
    <div
      v-else
      class="area-impresion"
    >
      <div class="solo-impresion">
        <strong>{{ entidad.activa?.nombre }}</strong>
        <p>{{ PESTANAS.find((p) => p.id === pestana)?.texto }} · del {{ fechaCalendario(desde) }} al {{ fechaCalendario(hasta) }}</p>
      </div>
      <HudPanel
        v-if="pestana === 'retencion' && retencion"
        etiqueta="Retenciones practicadas"
      >
        <p
          v-if="!retencion.obligada"
          class="texto-2"
        >
          No hay obligación de declarar en el periodo (no es agente de retención o no practicó retenciones).
        </p>
        <HudTabla
          v-if="filasRet.length"
          :filas="filasRet"
          :columnas="COL_RET"
          clave="clave"
          titulo="Retenciones por concepto"
        >
          <template #celda-tarifa="{ fila }">
            <span class="cifra">{{ fila.tarifa }} %</span>
          </template>
          <template #celda-base="{ fila }">
            <span class="cifra">{{ moneda(fila.base) }}</span>
          </template>
          <template #celda-valor="{ fila }">
            <span class="cifra">{{ moneda(fila.valor) }}</span>
          </template>
        </HudTabla>
        <dl class="datos">
          <div>
            <dt>Total practicado</dt>
            <dd class="cifra">
              {{ moneda(retencion.total_practicado) }}
            </dd>
          </div>
          <div>
            <dt>Según el mayor</dt>
            <dd class="cifra">
              {{ moneda(retencion.total_mayor) }}
            </dd>
          </div>
          <div>
            <dt>Conciliación</dt>
            <dd>
              <HudInsignia :tono="cuadra ? 'exito' : 'peligro'">
                {{ cuadra ? 'Cuadra con el mayor' : `Diferencia ${moneda(retencion.diferencia)}` }}
              </HudInsignia>
            </dd>
          </div>
        </dl>
      </HudPanel>
      <template v-else-if="pestana === 'iva' && iva">
        <p
          v-if="!iva.responsable"
          class="aviso"
        >
          Según el perfil tributario, la entidad no es responsable de IVA en el periodo.
        </p>
        <HudPanel etiqueta="IVA generado">
          <HudEstado
            v-if="!generado.length"
            estado="vacio"
            mensaje="Sin IVA generado."
          />
          <HudTabla
            v-else
            :filas="generado"
            :columnas="COL_IVA"
            clave="clave"
            titulo="IVA generado por tarifa"
          >
            <template #celda-base="{ fila }">
              <span class="cifra">{{ moneda(fila.base) }}</span>
            </template>
            <template #celda-iva="{ fila }">
              <span class="cifra">{{ moneda(fila.iva) }}</span>
            </template>
          </HudTabla>
        </HudPanel>
        <HudPanel etiqueta="IVA descontable">
          <HudEstado
            v-if="!descontable.length"
            estado="vacio"
            mensaje="Sin IVA descontable."
          />
          <HudTabla
            v-else
            :filas="descontable"
            :columnas="COL_IVA"
            clave="clave"
            titulo="IVA descontable por tarifa"
          >
            <template #celda-base="{ fila }">
              <span class="cifra">{{ moneda(fila.base) }}</span>
            </template>
            <template #celda-iva="{ fila }">
              <span class="cifra">{{ moneda(fila.iva) }}</span>
            </template>
          </HudTabla>
        </HudPanel>
        <p class="texto-2 cifra">
          Generado {{ moneda(iva.total_generado) }} − descontable {{ moneda(iva.total_descontable) }} =
          <strong>{{ iva.saldo.startsWith('-') ? `saldo a favor ${moneda(iva.saldo.slice(1))}` : `a pagar ${moneda(iva.saldo)}` }}</strong>
        </p>
      </template>
      <HudPanel
        v-else-if="ica"
        etiqueta="ICA por municipio y actividad"
      >
        <HudTabla
          :filas="filasIca"
          :columnas="COL_ICA"
          clave="clave"
          titulo="ICA estimado"
        >
          <template #celda-base="{ fila }">
            <span class="cifra">{{ moneda(fila.base) }}</span>
          </template>
          <template #celda-impuesto="{ fila }">
            <span class="cifra">{{ fila.impuesto ? moneda(fila.impuesto) : '—' }}</span>
          </template>
        </HudTabla>
        <p class="texto-2 cifra">
          Ingresos del periodo {{ moneda(ica.ingresos) }} · ReteICA practicada {{ moneda(ica.reteica_practicada) }}
        </p>
      </HudPanel>
    </div>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

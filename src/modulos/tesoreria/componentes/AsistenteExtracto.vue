<script setup lang="ts">
/**
 * Cargar un extracto bancario: elegir el archivo → **mapear las columnas** del banco (se
 * prellena con el mapeo guardado de la cuenta) → vista previa con los errores por fila →
 * importar (el backend guarda el mapeo para la próxima vez).
 */
import { computed, onMounted, ref } from 'vue'
import { aBase64 } from '@/api/archivos'
import type { MapeoColumnas, SeparadorDecimal, VistaPreviaExtracto } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import MapeoColumnasHud, { type CampoMapeo } from '@/hud/componentes/MapeoColumnas.vue'
import TablaErroresImportacion from '@/hud/componentes/TablaErroresImportacion.vue'
import ISubir from '~icons/tabler/upload'
import { type ArchivoExtracto, importarExtracto, mapeoGuardado, vistaPreviaExtracto } from '../api'
import { encabezadosCsv } from '../reglas'

const props = defineProps<{ entidadId: string; cuentaId: string }>()
const emit = defineEmits<{ importado: [] }>()

const CAMPOS: CampoMapeo[] = [
  { clave: 'fecha', etiqueta: 'Fecha', obligatorio: true },
  { clave: 'descripcion', etiqueta: 'Descripción', obligatorio: true },
  { clave: 'referencia', etiqueta: 'Referencia' },
  { clave: 'valor', etiqueta: 'Valor con signo', ayuda: 'Positivo = entra dinero. O use débito y crédito.' },
  { clave: 'debito', etiqueta: 'Salidas (débito)' },
  { clave: 'credito', etiqueta: 'Entradas (crédito)' },
]
const FORMATOS_FECHA = [
  { valor: '%d/%m/%Y', etiqueta: 'día/mes/año (31/12/2026)' },
  { valor: '%Y-%m-%d', etiqueta: 'año-mes-día (2026-12-31)' },
]
const SEPARADORES: { valor: SeparadorDecimal; etiqueta: string }[] = [
  { valor: 'coma', etiqueta: 'Coma (1.234,56)' },
  { valor: 'punto', etiqueta: 'Punto (1,234.56)' },
]

const paso = ref<PasoFlujo>('editar')
const archivo = ref<File | null>(null)
const texto = ref('')
const fila = ref('1')
const columnas = ref<Record<string, string>>({})
const formatoFecha = ref('%d/%m/%Y')
const separador = ref<SeparadorDecimal | ''>('coma')
const saldoInicial = ref('')
const saldoFinal = ref('')
const previa = ref<VistaPreviaExtracto | null>(null)
const problema = ref<string | null>(null)

const encabezados = computed(() => (texto.value ? encabezadosCsv(texto.value, Number.parseInt(fila.value, 10) || 1) : []))
const mapeo = computed<MapeoColumnas>(() => ({
  fila_encabezado: Number.parseInt(fila.value, 10) || 1, fecha: columnas.value.fecha ?? '', formato_fecha: formatoFecha.value, descripcion: columnas.value.descripcion ?? '',
  referencia: columnas.value.referencia || null, valor: columnas.value.valor || null, debito: columnas.value.debito || null, credito: columnas.value.credito || null,
  separador_decimal: separador.value || 'coma',
}))
const filasPrevia = computed(() => (previa.value?.movimientos ?? []).map((m, i) => ({ ...m, clave: String(i), fechaTexto: fechaCalendario(m.fecha) })))
const COLUMNAS = [
  { clave: 'fechaTexto', titulo: 'Fecha' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'referencia', titulo: 'Referencia' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
]

async function peticion(): Promise<ArchivoExtracto> {
  if (!archivo.value) throw new Error('sin archivo')
  return {
    nombre_archivo: archivo.value.name, archivo_base64: await aBase64(archivo.value), formato: 'planilla', mapeo: mapeo.value,
    saldo_inicial: saldoInicial.value || null, saldo_final: saldoFinal.value || null,
  }
}

const vista = useAccion(async () => vistaPreviaExtracto(props.entidadId, props.cuentaId, await peticion()))
const importar = useAccion(async () => importarExtracto(props.entidadId, props.cuentaId, await peticion()))

async function alElegir(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  archivo.value = f
  texto.value = f && /\.(csv|txt)$/i.test(f.name) ? await f.text() : ''
}

async function previsualizar() {
  if (!archivo.value) {
    problema.value = 'Elija el archivo del extracto.'
    return
  }
  if (!mapeo.value.fecha || !mapeo.value.descripcion || (!mapeo.value.valor && !(mapeo.value.debito && mapeo.value.credito))) {
    problema.value = 'Indique las columnas de fecha, descripción y el valor (o débito y crédito).'
    return
  }
  problema.value = null
  const r = await vista.ejecutar()
  if (!r.ok) return
  previa.value = r.valor
  paso.value = 'revisar'
}

async function confirmar() {
  const r = await importar.ejecutar()
  if (!r.ok) return
  paso.value = 'hecho'
  emit('importado')
}

function reiniciar() {
  paso.value = 'editar'
  previa.value = null
}

onMounted(async () => {
  const m = await mapeoGuardado(props.entidadId, props.cuentaId).catch(() => null)
  if (!m) return
  fila.value = String(m.fila_encabezado ?? 1)
  formatoFecha.value = m.formato_fecha
  separador.value = m.separador_decimal ?? 'coma'
  columnas.value = { fecha: m.fecha, descripcion: m.descripcion, referencia: m.referencia ?? '', valor: m.valor ?? '', debito: m.debito ?? '', credito: m.credito ?? '' }
})
</script>

<template>
  <FlujoDosPasos
    v-model:paso="paso"
    accion="Importar el extracto"
    :cargando="vista.cargando.value || importar.cargando.value"
    :error="problema ?? vista.error.value ?? importar.error.value"
    :bloqueado="!!previa?.errores.length || !previa?.movimientos.length"
    @previsualizar="previsualizar"
    @confirmar="confirmar"
    @reiniciar="reiniciar"
  >
    <template #formulario>
      <div class="botones">
        <input
          id="archivo-extracto"
          type="file"
          class="solo-lector"
          accept=".csv,.txt,.xlsx"
          @change="alElegir"
        >
        <label
          for="archivo-extracto"
          class="subir"
        ><ISubir aria-hidden="true" /> {{ archivo ? archivo.name : 'Elegir el archivo del extracto' }}</label>
      </div>
      <div class="filtros">
        <HudCampo
          v-model="fila"
          etiqueta="Fila de los encabezados"
          modo-entrada="numeric"
        />
        <HudSelector
          v-model="formatoFecha"
          etiqueta="Formato de la fecha"
          :opciones="FORMATOS_FECHA"
        />
        <HudSelector
          v-model="separador"
          etiqueta="Separador decimal"
          :opciones="SEPARADORES"
        />
        <HudCampoMonto
          v-model="saldoInicial"
          etiqueta="Saldo inicial del extracto (opcional)"
        />
        <HudCampoMonto
          v-model="saldoFinal"
          etiqueta="Saldo final del extracto (opcional)"
        />
      </div>
      <MapeoColumnasHud
        v-model="columnas"
        :campos="CAMPOS"
        :columnas="encabezados"
        etiqueta="Columnas del banco"
      />
    </template>
    <template #vista-previa>
      <TablaErroresImportacion
        v-if="previa?.errores.length"
        :errores="previa.errores"
        titulo="Corrija el mapeo o el archivo: estas filas no se pudieron leer"
      />
      <p
        v-else
        class="texto-2"
      >
        {{ previa?.movimientos.length }} movimientos listos para importar.
      </p>
      <HudTabla
        v-if="filasPrevia.length"
        :filas="filasPrevia"
        :columnas="COLUMNAS"
        clave="clave"
        titulo="Movimientos leídos"
      >
        <template #celda-valor="{ fila: f }">
          <span class="cifra">{{ moneda(f.valor) }}</span>
        </template>
      </HudTabla>
    </template>
    <template #hecho>
      <p class="ok">
        Extracto importado: ya puede conciliar sus movimientos.
      </p>
    </template>
  </FlujoDosPasos>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
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

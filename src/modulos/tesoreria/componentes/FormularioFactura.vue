<script setup lang="ts">
/**
 * Factura de proveedor nueva: proveedor, número, fechas y líneas (cuenta de gasto, centro, base,
 * IVA y conceptos de retención, uno por impuesto). Las retenciones se sugieren con las tarifas y
 * la base mínima en UVT vigentes (el backend las recalcula). Si el proveedor ya usó el número,
 * quien autoriza egresos puede registrarla con el motivo de la excepción.
 */
import { computed, onMounted, ref } from 'vue'
import type { ConceptoRetencion, ImpuestoRetencion, NuevaFacturaProveedor } from '@/api/tipos'
import { moneda } from '@/formato/decimales'
import { hoyEn, sumarDias } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/trash'
import { retenciones as pedirRetenciones, uvt as pedirUvt } from '../api'
import { calcularRetenciones, IMPUESTO, totalesFactura } from '../reglas'
import ElegirTercero from './ElegirTercero.vue'

const props = withDefaults(
  defineProps<{ entidadId: string; cargando?: boolean; error?: string | null; duplicada?: boolean }>(),
  { cargando: false, error: null, duplicada: false },
)
const emit = defineEmits<{ guardar: [datos: NuevaFacturaProveedor] }>()

interface LineaForm {
  descripcion: string
  cuenta: string
  centro: string
  base: string
  iva: string
  descontable: boolean
  ret: Record<ImpuestoRetencion, string>
}

const entidad = useEntidad()
const plan = usePlanCuentas()
const hoy = hoyEn(entidad.zonaHoraria)
const proveedor = ref<OpcionPersona | null>(null)
const prefijo = ref('')
const numero = ref('')
const fecha = ref(hoy)
const vencimiento = ref(sumarDias(hoy, 30))
const descripcion = ref('')
const excepcion = ref('')
const nuevaLinea = (): LineaForm => ({ descripcion: '', cuenta: '', centro: '', base: '', iva: '', descontable: true, ret: { renta: '', iva: '', ica: '' } })
const lineas = ref<LineaForm[]>([nuevaLinea()])
const conceptos = ref<ConceptoRetencion[]>([])
const valorUvt = ref('0')
const problema = ref<string | null>(null)

const opcionesGasto = computed(() => plan.imputables.filter((c) => /^[156]/.test(c.codigo)).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const opcionesCentro = computed(() => plan.centros.filter((c) => c.activo).map((c) => ({ valor: c.codigo, etiqueta: `${c.codigo} · ${c.nombre}` })))
const opcionesDe = (impuesto: ImpuestoRetencion) => conceptos.value.filter((c) => c.impuesto === impuesto).map((c) => ({ valor: c.codigo, etiqueta: `${c.nombre} (${c.tarifa} %)` }))
const calculo = (l: LineaForm) => ({ base: l.base, iva: l.iva, retenciones: Object.values(l.ret).filter(Boolean) })
const totales = computed(() => totalesFactura(lineas.value.map(calculo), conceptos.value, valorUvt.value))
const puedeExcepcion = computed(() => props.duplicada && entidad.tienePermiso('tesoreria.egresos.autorizar'))

function guardar() {
  if (!proveedor.value || !numero.value.trim() || !descripcion.value.trim()) {
    problema.value = 'Elija el proveedor y escriba el número y la descripción.'
    return
  }
  if (lineas.value.some((l) => !l.base || !l.cuenta)) {
    problema.value = 'Cada línea lleva cuenta y base.'
    return
  }
  problema.value = null
  emit('guardar', {
    persona_id: proveedor.value.id, prefijo: prefijo.value.trim(), numero: numero.value.trim(), fecha: fecha.value, vencimiento: vencimiento.value, descripcion: descripcion.value.trim(),
    excepcion_duplicado: puedeExcepcion.value && excepcion.value.trim() ? excepcion.value.trim() : null,
    lineas: lineas.value.map((l) => ({
      descripcion: l.descripcion.trim() || descripcion.value.trim(), cuenta: l.cuenta, centro_costo: l.centro || null, base: l.base, iva: l.iva || '0',
      iva_descontable: l.descontable, retenciones: Object.values(l.ret).filter(Boolean),
    })),
  })
}

onMounted(async () => {
  const [c, u] = await Promise.all([pedirRetenciones(props.entidadId, fecha.value).catch(() => []), pedirUvt(props.entidadId).catch(() => [])])
  conceptos.value = c
  valorUvt.value = u.find((x) => String(x.anio) === hoy.slice(0, 4))?.valor ?? u.at(-1)?.valor ?? '0'
  await plan.asegurar().catch(() => undefined)
})
</script>

<template>
  <form
    class="campos"
    novalidate
    @submit.prevent="guardar"
  >
    <ElegirTercero
      v-model="proveedor"
      :entidad-id="entidadId"
      etiqueta="Proveedor"
    />
    <div class="filtros">
      <HudCampo
        v-model="prefijo"
        etiqueta="Prefijo (opcional)"
      />
      <HudCampo
        v-model="numero"
        etiqueta="Número de la factura"
      />
      <HudFecha
        v-model="fecha"
        etiqueta="Fecha de la factura"
      />
      <HudFecha
        v-model="vencimiento"
        etiqueta="Vence"
      />
    </div>
    <HudCampo
      v-model="descripcion"
      etiqueta="Descripción"
    />
    <fieldset class="grupo">
      <legend>Líneas</legend>
      <div
        v-for="(l, i) in lineas"
        :key="i"
        class="linea"
      >
        <SelectorCuenta
          v-model="l.cuenta"
          :opciones="opcionesGasto"
          :etiqueta="`Cuenta de la línea ${i + 1}`"
        />
        <HudSelector
          v-model="l.centro"
          :etiqueta="`Centro de la línea ${i + 1}`"
          vacio="—"
          :opciones="opcionesCentro"
        />
        <HudCampoMonto
          v-model="l.base"
          :etiqueta="`Base de la línea ${i + 1}`"
        />
        <HudCampoMonto
          v-model="l.iva"
          :etiqueta="`IVA de la línea ${i + 1}`"
        />
        <HudSelector
          v-for="imp in (['renta', 'iva', 'ica'] as const)"
          :key="imp"
          v-model="l.ret[imp]"
          :etiqueta="`${IMPUESTO[imp]} de la línea ${i + 1}`"
          vacio="No aplica"
          :opciones="opcionesDe(imp)"
        />
        <label class="casilla">
          <input
            v-model="l.descontable"
            type="checkbox"
          > IVA descontable
        </label>
        <ul
          v-if="calcularRetenciones(calculo(l), conceptos, valorUvt).length"
          class="retenciones"
          :aria-label="`Retenciones sugeridas de la línea ${i + 1}`"
        >
          <li
            v-for="r in calcularRetenciones(calculo(l), conceptos, valorUvt)"
            :key="r.codigo"
          >
            {{ IMPUESTO[r.impuesto] }} {{ r.tarifa }} %: {{ r.bajoMinimo ? 'no aplica (la base no llega al mínimo en UVT)' : moneda(r.valor) }}
          </li>
        </ul>
        <HudBoton
          v-if="lineas.length > 1"
          variante="fantasma"
          @click="lineas.splice(i, 1)"
        >
          <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar la línea {{ i + 1 }}</span>
        </HudBoton>
      </div>
      <HudBoton
        variante="secundario"
        @click="lineas.push(nuevaLinea())"
      >
        <IMas aria-hidden="true" /> Agregar línea
      </HudBoton>
    </fieldset>
    <dl
      class="datos"
      aria-label="Totales de la factura"
    >
      <div>
        <dt>Subtotal</dt>
        <dd class="cifra">
          {{ moneda(totales.subtotal) }}
        </dd>
      </div>
      <div>
        <dt>IVA</dt>
        <dd class="cifra">
          {{ moneda(totales.iva) }}
        </dd>
      </div>
      <div>
        <dt>Retenciones</dt>
        <dd class="cifra">
          {{ moneda(totales.retenciones) }}
        </dd>
      </div>
      <div>
        <dt>Neto a pagar</dt>
        <dd class="cifra">
          <strong>{{ moneda(totales.neto) }}</strong>
        </dd>
      </div>
    </dl>
    <HudCampo
      v-if="puedeExcepcion"
      v-model="excepcion"
      etiqueta="Motivo para aceptar el número repetido"
      ayuda="Ej.: el proveedor reinició la numeración. Queda en la auditoría."
    />
    <p
      v-if="problema ?? error"
      class="error"
      role="alert"
    >
      {{ problema ?? error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        Registrar la factura
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.grupo {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.grupo legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}

.linea {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 10px;
  align-items: end;
  padding: 10px;
  border: 1px solid var(--linea);
}

.retenciones {
  grid-column: 1 / -1;
  margin: 0;
  padding-left: 20px;
  color: var(--texto-2);
}
</style>

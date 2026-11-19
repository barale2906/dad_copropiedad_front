<script setup lang="ts">
/**
 * Egreso nuevo: cuenta que paga, beneficiario, fecha, medio (con cheque, su número) y qué paga:
 * facturas del proveedor por pagar y gastos directos (cuenta, valor, descripción). Queda por
 * autorizar: lo autoriza otra cuenta.
 */
import { computed, ref, watch } from 'vue'
import type { CuentaTesoreria, FacturaProveedor, GastoEgreso, MedioEgreso, NuevoEgreso } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { comparar, moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
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
import { facturasProveedor } from '../api'
import { MEDIO_EGRESO, porPagar, totalEgreso } from '../reglas'
import ElegirTercero from './ElegirTercero.vue'

const props = withDefaults(defineProps<{ entidadId: string; cuentas: CuentaTesoreria[]; cargando?: boolean; error?: string | null }>(), { cargando: false, error: null })
const emit = defineEmits<{ guardar: [datos: NuevoEgreso] }>()

const entidad = useEntidad()
const plan = usePlanCuentas()
const cuenta = ref(props.cuentas.find((c) => c.activa)?.id ?? '')
const beneficiario = ref<OpcionPersona | null>(null)
const fecha = ref(hoyEn(entidad.zonaHoraria))
const medio = ref<MedioEgreso | ''>('transferencia')
const referencia = ref('')
const descripcion = ref('')
const facturas = ref<FacturaProveedor[]>([])
const pagos = ref<Record<string, string>>({})
const gastos = ref<GastoEgreso[]>([])
const problema = ref<string | null>(null)

const opcionesCuenta = computed(() => props.cuentas.filter((c) => c.activa).map((c) => ({ valor: c.id, etiqueta: c.nombre })))
const opcionesGasto = computed(() => plan.imputables.map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const pagables = computed(() => facturas.value.filter((f) => (f.estado === 'causada' || f.estado === 'pagada_parcial') && comparar(porPagar(f), '0') > 0))
const facturasElegidas = computed(() => Object.entries(pagos.value).filter(([, v]) => v && comparar(v, '0') > 0).map(([factura_proveedor_id, valor]) => ({ factura_proveedor_id, valor })))
const total = computed(() => totalEgreso(facturasElegidas.value, gastos.value))

watch(beneficiario, async (b) => {
  pagos.value = {}
  facturas.value = b ? await facturasProveedor(props.entidadId, { persona_id: b.id }).catch(() => []) : []
})

function guardar() {
  if (!cuenta.value || !beneficiario.value || !descripcion.value.trim()) {
    problema.value = 'Elija la cuenta y el beneficiario y escriba la descripción.'
    return
  }
  if (medio.value === 'cheque' && !referencia.value.trim()) {
    problema.value = 'Con cheque, escriba su número en la referencia.'
    return
  }
  if (comparar(total.value, '0') <= 0) {
    problema.value = 'Agregue al menos una factura o un gasto con valor.'
    return
  }
  problema.value = null
  emit('guardar', {
    cuenta_tesoreria_id: cuenta.value, persona_id: beneficiario.value.id, fecha: fecha.value, medio: medio.value || 'transferencia',
    referencia: referencia.value.trim() || null, descripcion: descripcion.value.trim(), facturas: facturasElegidas.value,
    gastos: gastos.value.filter((g) => g.cuenta && g.valor).map((g) => ({ ...g, descripcion: g.descripcion.trim() || descripcion.value.trim(), centro_costo: g.centro_costo || null })),
  })
}
</script>

<template>
  <form
    class="campos"
    novalidate
    @submit.prevent="guardar"
  >
    <div class="filtros">
      <HudSelector
        v-model="cuenta"
        etiqueta="Cuenta que paga"
        :opciones="opcionesCuenta"
      />
      <HudFecha
        v-model="fecha"
        etiqueta="Fecha"
      />
      <HudSelector
        v-model="medio"
        etiqueta="Medio de pago"
        :opciones="opcionesDe(MEDIO_EGRESO)"
      />
      <HudCampo
        v-model="referencia"
        :etiqueta="medio === 'cheque' ? 'Número del cheque' : 'Referencia (opcional)'"
      />
    </div>
    <ElegirTercero
      v-model="beneficiario"
      :entidad-id="entidadId"
      etiqueta="Beneficiario"
    />
    <HudCampo
      v-model="descripcion"
      etiqueta="Descripción"
    />
    <fieldset
      v-if="pagables.length"
      class="grupo"
    >
      <legend>Facturas del proveedor por pagar</legend>
      <div
        v-for="f in pagables"
        :key="f.id"
        class="fila"
      >
        <span class="crece">
          <strong>{{ f.prefijo }}{{ f.numero }} · {{ f.descripcion }}</strong>
          <small>Vence el {{ fechaCalendario(f.vencimiento) }} · por pagar {{ moneda(porPagar(f)) }}</small>
        </span>
        <HudCampoMonto
          :model-value="pagos[f.id] ?? ''"
          :etiqueta="`Pagar de ${f.prefijo}${f.numero}`"
          @update:model-value="(v) => (pagos = { ...pagos, [f.id]: v })"
        />
        <HudBoton
          variante="fantasma"
          @click="pagos = { ...pagos, [f.id]: porPagar(f) }"
        >
          Todo<span class="solo-lector"> lo de {{ f.prefijo }}{{ f.numero }}</span>
        </HudBoton>
      </div>
    </fieldset>
    <fieldset class="grupo">
      <legend>Gastos directos (caja menor, gastos bancarios, anticipos)</legend>
      <div
        v-for="(g, i) in gastos"
        :key="i"
        class="fila gasto"
      >
        <SelectorCuenta
          v-model="g.cuenta"
          :opciones="opcionesGasto"
          :etiqueta="`Cuenta del gasto ${i + 1}`"
        />
        <HudCampoMonto
          v-model="g.valor"
          :etiqueta="`Valor del gasto ${i + 1}`"
        />
        <HudCampo
          v-model="g.descripcion"
          :etiqueta="`Detalle del gasto ${i + 1}`"
        />
        <HudBoton
          variante="fantasma"
          @click="gastos.splice(i, 1)"
        >
          <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar el gasto {{ i + 1 }}</span>
        </HudBoton>
      </div>
      <HudBoton
        variante="secundario"
        @click="gastos.push({ cuenta: '', valor: '', descripcion: '', centro_costo: null })"
      >
        <IMas aria-hidden="true" /> Agregar gasto
      </HudBoton>
    </fieldset>
    <p class="texto-2">
      Total del egreso: <strong class="cifra">{{ moneda(total) }}</strong>
    </p>
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
        Registrar el egreso
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="../vistas/tesoreria.css"></style>
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

.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

.gasto > :first-child {
  flex: 2 1 240px;
}
</style>

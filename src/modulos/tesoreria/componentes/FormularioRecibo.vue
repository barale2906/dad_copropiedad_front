<script setup lang="ts">
/**
 * Recibo de caja nuevo: cuenta, pagador (sin él queda por identificar), fecha, valor, medio y
 * descripción; con `facturacion.ver`, aplicación a las facturas de venta del pagador. Lo no
 * aplicado queda como anticipo o por identificar.
 */
import { computed, ref, watch } from 'vue'
import type { CuentaTesoreria, FacturaVenta, MedioRecibo, NuevoRecibo } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { comparar, moneda, restar, sumar } from '@/formato/decimales'
import { numeroFacturaVenta } from '@/formato/facturacion'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { useEntidad } from '@/stores/entidad'
import { facturasVenta } from '../api'
import { MEDIO_RECIBO } from '../reglas'
import ElegirTercero from './ElegirTercero.vue'

const props = withDefaults(defineProps<{ entidadId: string; cuentas: CuentaTesoreria[]; cargando?: boolean; error?: string | null }>(), { cargando: false, error: null })
const emit = defineEmits<{ guardar: [datos: NuevoRecibo] }>()

const entidad = useEntidad()
const cuenta = ref(props.cuentas.find((c) => c.activa)?.id ?? '')
const pagador = ref<OpcionPersona | null>(null)
const fecha = ref(hoyEn(entidad.zonaHoraria))
const valor = ref('')
const medio = ref<MedioRecibo | ''>('transferencia')
const referencia = ref('')
const descripcion = ref('')
const facturas = ref<FacturaVenta[]>([])
const aplicar = ref<Record<string, string>>({})
const problema = ref<string | null>(null)

const opcionesCuenta = computed(() => props.cuentas.filter((c) => c.activa).map((c) => ({ valor: c.id, etiqueta: c.nombre })))
const conFacturas = computed(() => entidad.tienePermiso('facturacion.ver'))
const saldo = (f: FacturaVenta) => restar(f.total, f.pagado)
const pendientes = computed(() => facturas.value.filter((f) => comparar(saldo(f), '0') > 0))
const aplicado = computed(() => sumar('0', ...Object.values(aplicar.value).map((v) => v || '0')))
const sinAplicar = computed(() => (valor.value ? restar(valor.value, aplicado.value) : '0'))

watch(pagador, async (p) => {
  aplicar.value = {}
  facturas.value = p && conFacturas.value ? await facturasVenta(props.entidadId, p.id).catch(() => []) : []
})

function guardar() {
  if (!cuenta.value || !valor.value || !descripcion.value.trim()) {
    problema.value = 'Elija la cuenta y escriba el valor y la descripción.'
    return
  }
  if (comparar(sinAplicar.value, '0') < 0) {
    problema.value = 'Lo aplicado supera el valor del recibo.'
    return
  }
  problema.value = null
  emit('guardar', {
    cuenta_tesoreria_id: cuenta.value, persona_id: pagador.value?.id ?? null, fecha: fecha.value, valor: valor.value, medio: medio.value || 'transferencia',
    referencia: referencia.value.trim() || null, descripcion: descripcion.value.trim(),
    aplicaciones: Object.entries(aplicar.value).filter(([, v]) => v && comparar(v, '0') > 0).map(([factura_venta_id, v]) => ({ factura_venta_id, valor: v })),
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
        etiqueta="Cuenta que recibe"
        :opciones="opcionesCuenta"
      />
      <HudFecha
        v-model="fecha"
        etiqueta="Fecha"
      />
      <HudCampoMonto
        v-model="valor"
        etiqueta="Valor recibido"
      />
      <HudSelector
        v-model="medio"
        etiqueta="Medio"
        :opciones="opcionesDe(MEDIO_RECIBO)"
      />
      <HudCampo
        v-model="referencia"
        etiqueta="Referencia (opcional)"
      />
    </div>
    <ElegirTercero
      v-model="pagador"
      :entidad-id="entidadId"
      etiqueta="Pagador"
      opcional
    />
    <HudCampo
      v-model="descripcion"
      etiqueta="Descripción"
    />
    <fieldset
      v-if="pendientes.length"
      class="aplicaciones"
    >
      <legend>Aplicar a facturas de venta del pagador</legend>
      <div
        v-for="f in pendientes"
        :key="f.id"
        class="aplicacion"
      >
        <span class="crece">
          <strong>{{ numeroFacturaVenta(f) }} · {{ f.descripcion }}</strong>
          <small>Vence el {{ fechaCalendario(f.vencimiento) }} · saldo {{ moneda(saldo(f)) }}</small>
        </span>
        <HudCampoMonto
          :model-value="aplicar[f.id] ?? ''"
          :etiqueta="`Aplicar a ${numeroFacturaVenta(f)}`"
          @update:model-value="(v) => (aplicar = { ...aplicar, [f.id]: v })"
        />
      </div>
    </fieldset>
    <p class="texto-2">
      Aplicado {{ moneda(aplicado) }} · queda sin aplicar {{ moneda(sinAplicar) }}{{ !pagador ? ' (por identificar)' : '' }}.
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
        Registrar el recibo
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.aplicaciones {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.aplicaciones legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}

.aplicacion {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}
</style>

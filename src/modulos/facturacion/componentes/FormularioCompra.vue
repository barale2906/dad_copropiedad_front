<script setup lang="ts">
/**
 * Compra a un proveedor: proveedor (búsqueda y alta en línea), número, fechas, descripción y
 * líneas con base e IVA. Sin contabilidad no lleva cuentas ni retenciones; con contabilidad
 * cada línea lleva su cuenta de gasto (es la misma factura de proveedor de las cuentas por
 * pagar). Se precarga desde una factura recibida (`inicial`). Emite la petición lista.
 */
import { computed, ref } from 'vue'
import type { NuevaFacturaProveedor } from '@/api/tipos'
import { useBuscarTerceros } from '@/composables/useBuscarTerceros'
import { comparar, esDecimal, moneda, sumar } from '@/formato/decimales'
import { hoyEn, sumarDias } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import SelectorCuenta, { type OpcionCuenta } from '@/hud/componentes/SelectorCuenta.vue'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import SelectorTercero from '@/hud/componentes/SelectorTercero.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/trash'

export interface CompraInicial {
  proveedor: OpcionPersona | null
  prefijo: string
  numero: string
  fecha: string
  vencimiento: string
  descripcion: string
  cufe: string | null
  base: string
  iva: string
}

const props = withDefaults(
  defineProps<{
    entidadId: string
    inicial?: CompraInicial | null
    contabilidad?: boolean
    cuentas?: OpcionCuenta[]
    accion?: string
    cargando?: boolean
    error?: string | null
  }>(),
  { inicial: null, contabilidad: false, cuentas: () => [], accion: 'Registrar compra', cargando: false, error: null },
)
const emit = defineEmits<{ guardar: [datos: NuevaFacturaProveedor]; cancelar: [] }>()

interface LineaCompra {
  clave: number
  descripcion: string
  base: string
  iva: string
  cuenta: string
}

const entidad = useEntidad()
const { buscar, crearSiPuede } = useBuscarTerceros(() => props.entidadId)
const hoy = hoyEn(entidad.zonaHoraria)
const i = props.inicial
const proveedor = ref<OpcionPersona | null>(i?.proveedor ?? null)
const prefijo = ref(i?.prefijo ?? '')
const numero = ref(i?.numero ?? '')
const fecha = ref(i?.fecha ?? hoy)
const vencimiento = ref(i?.vencimiento ?? sumarDias(hoy, 30))
const descripcion = ref(i?.descripcion ?? '')
let consecutivo = 0
const nueva = (base = '', iva = ''): LineaCompra => ({ clave: ++consecutivo, descripcion: '', base, iva, cuenta: '' })
const lineas = ref<LineaCompra[]>([nueva(i?.base ?? '', i?.iva ?? '')])
const problema = ref<string | null>(null)

const valor = (t: string) => (esDecimal(t.trim()) ? t.trim() : '0')
const total = computed(() => sumar('0', ...lineas.value.flatMap((l) => [valor(l.base), valor(l.iva)])))

function guardar() {
  if (!proveedor.value || !numero.value.trim() || !descripcion.value.trim()) {
    problema.value = 'Elija el proveedor y escriba el número y la descripción.'
    return
  }
  if (lineas.value.some((l) => comparar(valor(l.base), '0') <= 0)) {
    problema.value = 'Cada línea lleva una base mayor que cero.'
    return
  }
  if (props.contabilidad && lineas.value.some((l) => !l.cuenta)) {
    problema.value = 'Con contabilidad, cada línea lleva su cuenta de gasto.'
    return
  }
  problema.value = null
  emit('guardar', {
    persona_id: proveedor.value.id,
    prefijo: prefijo.value.trim(),
    numero: numero.value.trim(),
    fecha: fecha.value,
    vencimiento: vencimiento.value,
    descripcion: descripcion.value.trim(),
    cufe: i?.cufe ?? null,
    lineas: lineas.value.map((l) => ({
      descripcion: l.descripcion.trim() || descripcion.value.trim(),
      base: valor(l.base),
      iva: valor(l.iva),
      ...(props.contabilidad ? { cuenta: l.cuenta } : {}),
    })),
  })
}
</script>

<template>
  <form
    class="campos"
    novalidate
    aria-label="Compra"
    @submit.prevent="guardar"
  >
    <SelectorTercero
      v-model="proveedor"
      :buscar="buscar"
      :crear="crearSiPuede"
      etiqueta="Proveedor"
    />
    <div class="filtros">
      <HudCampo
        v-model="prefijo"
        etiqueta="Prefijo (opcional)"
        autocompletar="off"
      />
      <HudCampo
        v-model="numero"
        etiqueta="Número"
        autocompletar="off"
      />
      <HudFecha
        v-model="fecha"
        etiqueta="Fecha"
      />
      <HudFecha
        v-model="vencimiento"
        etiqueta="Vence"
        :minimo="fecha || undefined"
      />
    </div>
    <HudCampo
      v-model="descripcion"
      etiqueta="Descripción de la compra"
    />
    <ol
      class="lista"
      aria-label="Líneas de la compra"
    >
      <li
        v-for="(l, n) in lineas"
        :key="l.clave"
      >
        <div class="filtros crece">
          <HudCampo
            v-model="l.descripcion"
            :etiqueta="`Detalle de la línea ${n + 1} (opcional)`"
          />
          <HudCampoMonto
            v-model="l.base"
            :etiqueta="`Base de la línea ${n + 1}`"
          />
          <HudCampoMonto
            v-model="l.iva"
            :etiqueta="`IVA de la línea ${n + 1}`"
          />
          <SelectorCuenta
            v-if="contabilidad"
            v-model="l.cuenta"
            :opciones="cuentas"
            :etiqueta="`Cuenta de gasto de la línea ${n + 1}`"
          />
        </div>
        <HudBoton
          variante="fantasma"
          :deshabilitado="lineas.length <= 1"
          @click="lineas.splice(n, 1)"
        >
          <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar la línea {{ n + 1 }}</span>
        </HudBoton>
      </li>
    </ol>
    <div class="botones">
      <HudBoton
        variante="secundario"
        @click="lineas.push(nueva())"
      >
        <IMas aria-hidden="true" /> Agregar línea
      </HudBoton>
    </div>
    <p class="texto-2 cifra">
      Total de la compra: <strong>{{ moneda(total) }}</strong>
    </p>
    <p
      v-if="problema || error"
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
        {{ accion }}
      </HudBoton>
      <HudBoton
        variante="secundario"
        @click="emit('cancelar')"
      >
        Cancelar
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

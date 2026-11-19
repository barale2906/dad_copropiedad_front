<script setup lang="ts">
/**
 * Producto o servicio del catálogo: código (solo al crear; no cambia), descripción, unidad de la
 * DIAN, precio sugerido, clasificación, IVA (solo venta o alquiler/servicio) y, con
 * contabilidad, la cuenta de ingreso. Emite los datos listos para la API.
 */
import { computed, ref } from 'vue'
import type { ClasificacionTributaria, DatosItemFacturacion, ItemFacturacion } from '@/api/tipos'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta, { type OpcionCuenta } from '@/hud/componentes/SelectorCuenta.vue'
import { admiteIva, CLASIFICACION, UNIDADES } from '../reglas'

const props = withDefaults(
  defineProps<{
    item?: ItemFacturacion | null
    contabilidad?: boolean
    cuentas?: OpcionCuenta[]
    codigoCuenta?: (id: string) => string | undefined
    cargando?: boolean
    error?: string | null
  }>(),
  { item: null, contabilidad: false, cuentas: () => [], codigoCuenta: () => undefined, cargando: false, error: null },
)
const emit = defineEmits<{ guardar: [codigo: string, datos: DatosItemFacturacion]; cancelar: [] }>()

const codigo = ref(props.item?.codigo ?? '')
const descripcion = ref(props.item?.descripcion ?? '')
const unidad = ref(props.item?.unidad ?? '94')
const precio = ref(props.item?.precio ?? '')
const clasificacion = ref<ClasificacionTributaria>(props.item?.clasificacion ?? 'venta')
const tarifa = ref(props.item?.tarifa_iva ?? '19')
const cuenta = ref(props.item?.cuenta_id ? (props.codigoCuenta(props.item.cuenta_id) ?? '') : '')
const activo = ref(props.item?.activo ?? true)
const intentado = ref(false)

const opcionesClasificacion = (Object.keys(CLASIFICACION) as ClasificacionTributaria[]).map((valor) => ({ valor, etiqueta: CLASIFICACION[valor] }))
const opcionesUnidad = Object.entries(UNIDADES).map(([valor, etiqueta]) => ({ valor, etiqueta: `${etiqueta} (${valor})` }))
const errorCodigo = computed(() =>
  intentado.value && !props.item && !/^[A-Za-z0-9._-]{1,30}$/.test(codigo.value.trim()) ? 'De 1 a 30 letras, números, punto, guion o guion bajo.' : null,
)
const errorDescripcion = computed(() => (intentado.value && !descripcion.value.trim() ? 'Escriba la descripción.' : null))

function guardar() {
  intentado.value = true
  if (errorCodigo.value || errorDescripcion.value) return
  const datos: DatosItemFacturacion = {
    descripcion: descripcion.value.trim(),
    unidad: unidad.value,
    precio: precio.value.trim() || null,
    clasificacion: clasificacion.value,
    tarifa_iva: admiteIva(clasificacion.value) ? tarifa.value.trim() || '0' : '0',
    activo: activo.value,
  }
  if (props.contabilidad) datos.cuenta = cuenta.value || null
  emit('guardar', codigo.value.trim(), datos)
}
</script>

<template>
  <form
    class="campos"
    novalidate
    :aria-label="item ? `Editar ${item.codigo}` : 'Producto nuevo'"
    @submit.prevent="guardar"
  >
    <HudCampo
      v-if="!item"
      v-model="codigo"
      etiqueta="Código"
      autocompletar="off"
      ayuda="Único en la entidad; no se puede cambiar después."
      :error="errorCodigo"
    />
    <HudCampo
      v-model="descripcion"
      etiqueta="Descripción"
      :error="errorDescripcion"
    />
    <div class="filtros">
      <HudSelector
        v-model="unidad"
        etiqueta="Unidad"
        :opciones="opcionesUnidad"
      />
      <HudCampoMonto
        v-model="precio"
        etiqueta="Precio sugerido (opcional)"
      />
      <HudSelector
        v-model="clasificacion"
        etiqueta="Clasificación tributaria"
        :opciones="opcionesClasificacion"
      />
      <HudCampo
        v-if="admiteIva(clasificacion)"
        v-model="tarifa"
        etiqueta="IVA %"
        modo-entrada="decimal"
      />
    </div>
    <p
      v-if="!admiteIva(clasificacion)"
      class="texto-2"
    >
      Esta clasificación no lleva IVA.
    </p>
    <SelectorCuenta
      v-if="contabilidad"
      v-model="cuenta"
      :opciones="cuentas"
      etiqueta="Cuenta de ingreso (opcional)"
    />
    <label
      v-if="item"
      class="casilla"
    >
      <input
        v-model="activo"
        type="checkbox"
      >
      Activo (se ofrece en las facturas nuevas)
    </label>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        {{ item ? 'Guardar cambios' : 'Crear producto' }}
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

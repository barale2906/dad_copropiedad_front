<script setup lang="ts">
/**
 * Editor de una factura de venta: cliente (búsqueda y alta en línea), fechas, descripción y
 * líneas. Una línea con producto del catálogo toma su descripción, precio, IVA y clasificación
 * (y la cuenta, con contabilidad). Solo una venta o un alquiler/servicio admite IVA. Sin
 * contabilidad no se muestran cuentas ni centros de costo. Los totales son estimados (el
 * backend calcula los definitivos). El padre guarda.
 */
import { computed, ref, watch } from 'vue'
import type { ClasificacionTributaria, ItemFacturacion } from '@/api/tipos'
import { useBuscarTerceros } from '@/composables/useBuscarTerceros'
import { moneda } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta, { type OpcionCuenta } from '@/hud/componentes/SelectorCuenta.vue'
import SelectorTercero from '@/hud/componentes/SelectorTercero.vue'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/trash'
import { admiteIva, calcularLinea, CLASIFICACION, conItem, type FacturaEditable, lineaVacia, totalesFactura } from '../reglas'

const props = withDefaults(
  defineProps<{
    entidadId: string
    items: ItemFacturacion[]
    /** La entidad lleva contabilidad: se muestran la cuenta de ingreso y el centro de costo. */
    contabilidad?: boolean
    cuentas?: OpcionCuenta[]
    centros?: { codigo: string; nombre: string }[]
    /** Código de una cuenta por su id (para tomar la del producto). */
    codigoCuenta?: (id: string) => string | undefined
  }>(),
  { contabilidad: false, cuentas: () => [], centros: () => [], codigoCuenta: () => undefined },
)
const entrada = defineModel<FacturaEditable>({ required: true })

// Se edita una copia (no se mutan las props) y cada cambio sube completo.
const copiar = (f: FacturaEditable): FacturaEditable => JSON.parse(JSON.stringify(f)) as FacturaEditable
const modelo = ref(copiar(entrada.value))
watch(modelo, (v) => (entrada.value = copiar(v)), { deep: true })
watch(entrada, (v) => {
  if (JSON.stringify(v) !== JSON.stringify(modelo.value)) modelo.value = copiar(v)
})

const { buscar, crearSiPuede } = useBuscarTerceros(() => props.entidadId)

const activos = computed(() => props.items.filter((i) => i.activo))
const opcionesItem = computed(() => activos.value.map((i) => ({ valor: i.id, etiqueta: `${i.codigo} · ${i.descripcion}` })))
const opcionesClasificacion = (Object.keys(CLASIFICACION) as ClasificacionTributaria[]).map((valor) => ({ valor, etiqueta: CLASIFICACION[valor] }))
const opcionesCentro = computed(() => props.centros.map((c) => ({ valor: c.codigo, etiqueta: `${c.codigo} · ${c.nombre}` })))
const totales = computed(() => totalesFactura(modelo.value.lineas))
const subtotal = (i: number) => {
  const l = modelo.value.lineas[i]
  return l ? calcularLinea(l) : { subtotal: '0', iva: '0' }
}

function elegirItem(i: number, itemId: string) {
  const l = modelo.value.lineas[i]
  if (!l) return
  const it = props.items.find((x) => x.id === itemId)
  modelo.value.lineas[i] = it ? conItem(l, it, props.codigoCuenta) : { ...l, item_id: '' }
}

function cambiarClasificacion(i: number, c: ClasificacionTributaria) {
  const l = modelo.value.lineas[i]
  if (l) modelo.value.lineas[i] = { ...l, clasificacion: c, tarifa_iva: admiteIva(c) ? l.tarifa_iva : '0' }
}

function agregar() {
  modelo.value.lineas.push(lineaVacia())
}

function quitar(i: number) {
  if (modelo.value.lineas.length > 1) modelo.value.lineas.splice(i, 1)
}
</script>

<template>
  <div class="editor-factura">
    <div class="encabezado-factura">
      <SelectorTercero
        v-model="modelo.cliente"
        :buscar="buscar"
        :crear="crearSiPuede"
        etiqueta="Cliente"
      />
      <HudFecha
        v-model="modelo.fecha"
        etiqueta="Fecha"
      />
      <HudFecha
        v-model="modelo.vencimiento"
        etiqueta="Vence"
        :minimo="modelo.fecha || undefined"
      />
      <HudCampo
        v-model="modelo.descripcion"
        class="ancho"
        etiqueta="Descripción de la factura"
      />
    </div>

    <ol
      class="lineas"
      aria-label="Líneas de la factura"
    >
      <li
        v-for="(l, i) in modelo.lineas"
        :key="l.clave"
        class="linea"
      >
        <HudSelector
          :model-value="l.item_id"
          :etiqueta="`Producto de la línea ${i + 1}`"
          vacio="Sin producto del catálogo"
          :opciones="opcionesItem"
          @update:model-value="elegirItem(i, String($event))"
        />
        <HudCampo
          v-model="l.descripcion"
          class="ancho"
          :etiqueta="`Descripción de la línea ${i + 1}`"
          :ayuda="l.item_id ? 'Si la deja vacía, se usa la del producto.' : undefined"
        />
        <HudCampo
          v-model="l.cantidad"
          :etiqueta="`Cantidad de la línea ${i + 1}`"
          modo-entrada="decimal"
        />
        <HudCampoMonto
          v-model="l.valor_unitario"
          :etiqueta="`Valor unitario de la línea ${i + 1}`"
        />
        <HudSelector
          :model-value="l.clasificacion"
          :etiqueta="`Clasificación de la línea ${i + 1}`"
          :opciones="opcionesClasificacion"
          @update:model-value="cambiarClasificacion(i, $event as ClasificacionTributaria)"
        />
        <HudCampo
          v-if="admiteIva(l.clasificacion)"
          v-model="l.tarifa_iva"
          :etiqueta="`IVA % de la línea ${i + 1}`"
          modo-entrada="decimal"
        />
        <p
          v-else
          class="sin-iva"
        >
          Sin IVA<span class="solo-lector"> en la línea {{ i + 1 }}: su clasificación no lo admite</span>
        </p>
        <template v-if="contabilidad">
          <SelectorCuenta
            v-model="l.cuenta"
            :opciones="cuentas"
            :etiqueta="`Cuenta de ingreso de la línea ${i + 1}`"
          />
          <HudSelector
            v-model="l.centro"
            :etiqueta="`Centro de costo de la línea ${i + 1}`"
            vacio="Sin centro de costo"
            :opciones="opcionesCentro"
          />
        </template>
        <p class="cifra subtotal">
          {{ moneda(subtotal(i).subtotal) }}<small v-if="admiteIva(l.clasificacion)"> + IVA {{ moneda(subtotal(i).iva) }}</small>
        </p>
        <HudBoton
          variante="fantasma"
          :deshabilitado="modelo.lineas.length <= 1"
          @click="quitar(i)"
        >
          <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar la línea {{ i + 1 }}</span>
        </HudBoton>
      </li>
    </ol>
    <div>
      <HudBoton
        variante="secundario"
        @click="agregar"
      >
        <IMas aria-hidden="true" /> Agregar línea
      </HudBoton>
    </div>

    <dl
      class="totales"
      aria-label="Totales estimados"
    >
      <div>
        <dt>Subtotal</dt><dd class="cifra">
          {{ moneda(totales.subtotal) }}
        </dd>
      </div>
      <div>
        <dt>IVA</dt><dd class="cifra">
          {{ moneda(totales.iva) }}
        </dd>
      </div>
      <div class="total">
        <dt>Total</dt><dd class="cifra">
          {{ moneda(totales.total) }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.editor-factura {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.encabezado-factura {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 12px;
  align-items: start;
}

.ancho {
  grid-column: 1 / -1;
}

/* Sin esto, un campo de la grilla no se encoge por debajo de su contenido y desborda en móvil. */
.encabezado-factura > *,
.linea > * {
  min-width: 0;
}

.lineas {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.linea {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
  gap: 10px 12px;
  align-items: end;
  padding: 12px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.linea .ancho {
  grid-column: span 2;
}

.sin-iva {
  display: flex;
  align-items: center;
  min-height: 44px;
  margin: 0;
  color: var(--texto-3);
}

.cifra {
  margin: 0;
  font-family: var(--fuente-mono);
  text-align: right;
  overflow-wrap: anywhere;
}

.subtotal {
  display: grid;
  align-content: center;
  min-height: 44px;
}

small {
  color: var(--texto-3);
}

.totales {
  display: grid;
  justify-content: end;
  gap: 4px;
  margin: 0;
}

.totales > div {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  min-width: min(100%, 260px);
}

dt {
  color: var(--texto-3);
}

dd {
  margin: 0;
}

.total {
  font-weight: 600;
  font-size: 18px;
}

/* En móvil, una columna: los rótulos espaciados no caben en dos. */
@media (width < 560px) {
  .linea {
    grid-template-columns: minmax(0, 1fr);
  }

  .linea .ancho {
    grid-column: auto;
  }
}
</style>

<script setup lang="ts">
/**
 * Catálogo de productos y servicios que se facturan: buscar, crear y editar (con
 * `facturacion.items.gestionar`). Un producto inactivo no se ofrece en las facturas nuevas.
 * En la PH sirve para lo que se factura (alquiler de zonas, parqueadero de visitantes…).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DatosItemFacturacion, ItemFacturacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import { crearItem, guardarItem, items as pedirItems } from '../api'
import FormularioItem from '../componentes/FormularioItem.vue'
import { admiteIva, CLASIFICACION, UNIDADES } from '../reglas'

const entidad = useEntidad()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const gestiona = computed(() => entidad.tienePermiso('facturacion.items.gestionar'))
const contabilidad = computed(() => entidad.tieneModulo('contabilidad'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<ItemFacturacion[]>([])
const texto = ref('')
const resultado = ref<string | null>(null)
const editando = ref<ItemFacturacion | null>(null)
const abierto = ref(false)

const cuentas = computed(() => plan.imputables.filter((c) => c.codigo.startsWith('4')).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const codigoCuenta = (cuentaId: string) => plan.porId.get(cuentaId)?.codigo
const filas = computed(() => {
  const t = texto.value.trim().toLowerCase()
  return lista.value.filter((i) => !t || i.codigo.toLowerCase().includes(t) || i.descripcion.toLowerCase().includes(t))
})
const COLUMNAS = [
  { clave: 'codigo', titulo: 'Código' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'clasificacion', titulo: 'Clasificación' },
  { clave: 'precio', titulo: 'Precio', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
  ...(gestiona.value ? [{ clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const }] : []),
]

const guardar = useAccion((clave, codigo: string, datos: DatosItemFacturacion) =>
  editando.value ? guardarItem(id.value, editando.value.id, datos) : crearItem(id.value, { ...datos, codigo }, clave),
)

function abrir(i: ItemFacturacion | null) {
  editando.value = i
  guardar.reiniciar()
  abierto.value = true
}

async function alGuardar(codigo: string, datos: DatosItemFacturacion) {
  const r = await guardar.ejecutar(codigo, datos)
  if (!r.ok) return
  abierto.value = false
  resultado.value = editando.value ? `Se guardó ${r.valor.codigo}.` : `Se creó ${r.valor.codigo}.`
  await cargar()
}

async function cargar() {
  try {
    const [l] = await Promise.all([pedirItems(id.value, true), contabilidad.value ? plan.asegurar().catch(() => undefined) : Promise.resolve()])
    lista.value = l
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-catalogo">
    <header class="encabezado">
      <div>
        <h1 id="titulo-catalogo">
          Catálogo de productos
        </h1>
        <p class="texto-2">
          Lo que se factura: al elegirlo en una línea se toman su descripción, precio, IVA y clasificación.
        </p>
      </div>
      <HudBoton
        v-if="gestiona"
        @click="abrir(null)"
      >
        <IMas aria-hidden="true" /> Producto nuevo
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <div class="filtros">
      <HudCampo
        v-model="texto"
        etiqueta="Buscar por código o descripción"
        autocompletar="off"
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
    <HudEstado
      v-else-if="filas.length === 0"
      estado="vacio"
      :mensaje="texto ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos en el catálogo.'"
    />
    <HudTabla
      v-else
      :filas="filas"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Productos y servicios"
    >
      <template #celda-descripcion="{ fila }">
        <span class="crece">
          <strong>{{ fila.descripcion }}</strong>
          <small>{{ UNIDADES[fila.unidad] ?? fila.unidad }}</small>
        </span>
      </template>
      <template #celda-clasificacion="{ fila }">
        {{ CLASIFICACION[fila.clasificacion] }}<small v-if="admiteIva(fila.clasificacion)"> · IVA {{ fila.tarifa_iva }} %</small>
      </template>
      <template #celda-precio="{ fila }">
        <span class="cifra">{{ fila.precio ? moneda(fila.precio) : '—' }}</span>
      </template>
      <template #celda-estado="{ fila }">
        <HudInsignia :tono="fila.activo ? 'exito' : 'neutro'">
          {{ fila.activo ? 'Activo' : 'Inactivo' }}
        </HudInsignia>
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          variante="fantasma"
          @click="abrir(fila)"
        >
          Editar<span class="solo-lector"> {{ fila.codigo }}</span>
        </HudBoton>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="editando ? `Editar ${editando.codigo}` : 'Producto nuevo'"
    >
      <FormularioItem
        v-if="abierto"
        :item="editando"
        :contabilidad="contabilidad"
        :cuentas="cuentas"
        :codigo-cuenta="codigoCuenta"
        :cargando="guardar.cargando.value"
        :error="guardar.error.value"
        @guardar="alGuardar"
        @cancelar="abierto = false"
      />
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

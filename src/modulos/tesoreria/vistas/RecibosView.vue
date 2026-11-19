<script setup lang="ts">
/**
 * Recibos de caja: lista (filtros por cuenta y por identificar) y, con `:id`, el detalle (o
 * `nuevo`). Un recibo no se edita: se aplica lo que falta a una factura de venta o se **anula**
 * con motivo (se revierte su comprobante).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { CuentaTesoreria, FacturaVenta, NuevoRecibo, Recibo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, moneda, restar } from '@/formato/decimales'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { useTercerosConocidos } from '@/stores/terceros'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { anularRecibo, aplicarRecibo, crearRecibo, cuentasTesoreria, facturasVenta, recibo as pedirRecibo, recibos as pedirRecibos } from '../api'
import FormularioRecibo from '../componentes/FormularioRecibo.vue'
import { ESTADO_RECIBO, MEDIO_RECIBO } from '../reglas'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const terceros = useTercerosConocidos()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const reciboId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (r = '') => ({ name: 'modulo', params: { ...route.params, accion: 'recibos', id: r }, query: {} })
const registra = computed(() => entidad.tienePermiso('tesoreria.recibos.registrar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const cuentas = ref<CuentaTesoreria[]>([])
const lista = ref<Recibo[]>([])
const actual = ref<Recibo | null>(null)
const resultado = ref<string | null>(null)
const filtroCuenta = ref('')
const soloSinIdentificar = ref(false)

const nombreCuenta = (c: string) => cuentas.value.find((x) => x.id === c)?.nombre ?? ''
const opcionesCuenta = computed(() => cuentas.value.map((c) => ({ valor: c.id, etiqueta: c.nombre })))
const filas = computed(() => lista.value.map((r) => ({ ...r, fechaTexto: fechaCalendario(r.fecha), pagador: r.persona_id ? terceros.nombre(r.persona_id) : 'Por identificar', cuenta: nombreCuenta(r.cuenta_tesoreria_id) })))
const COLUMNAS = [
  { clave: 'fechaTexto', titulo: 'Fecha' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'pagador', titulo: 'Pagador' },
  { clave: 'cuenta', titulo: 'Cuenta' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
]

// Detalle
const anulando = ref(false)
const facturas = ref<FacturaVenta[]>([])
const facturaElegida = ref('')
const valorAplicar = ref('')
const crear = useAccion((clave, datos: NuevoRecibo) => crearRecibo(id.value, datos, clave))
const anular = useAccion((_c, motivo: string) => anularRecibo(id.value, reciboId.value, motivo))
const aplicar = useAccion(() => aplicarRecibo(id.value, reciboId.value, facturaElegida.value, valorAplicar.value))
const pendientes = computed(() => facturas.value.filter((f) => comparar(restar(f.total, f.pagado), '0') > 0))
const opcionesFactura = computed(() => pendientes.value.map((f) => ({ valor: f.id, etiqueta: `${f.numero} · saldo ${moneda(restar(f.total, f.pagado))}` })))
const puedeAplicar = computed(() => !!actual.value && actual.value.estado === 'registrado' && !!actual.value.persona_id && comparar(actual.value.sin_aplicar, '0') > 0 && registra.value && entidad.tienePermiso('facturacion.ver'))

async function alCrear(datos: NuevoRecibo) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  resultado.value = `Recibo registrado por ${moneda(r.valor.valor)}.`
  await router.replace(ruta(r.valor.id))
}

async function alAnular(motivo: string) {
  const r = await anular.ejecutar(motivo)
  if (!r.ok) return
  anulando.value = false
  actual.value = r.valor
  resultado.value = 'Recibo anulado: su comprobante se revirtió.'
}

async function alAplicar() {
  const r = await aplicar.ejecutar()
  if (!r.ok) return
  actual.value = r.valor
  valorAplicar.value = facturaElegida.value = ''
  resultado.value = `Aplicado. Queda sin aplicar ${moneda(r.valor.sin_aplicar)}.`
  if (r.valor.persona_id) facturas.value = await facturasVenta(id.value, r.valor.persona_id).catch(() => [])
}

// Las respuestas traen solo `persona_id`: se piden los nombres que aún no se conocen.
watch([lista, actual], ([l, a]) => void terceros.resolver(id.value, [...l.map((x) => x.persona_id), a?.persona_id]))

async function cargar() {
  estado.value = 'cargando'
  try {
    cuentas.value = await cuentasTesoreria(id.value)
    if (reciboId.value && reciboId.value !== 'nuevo') {
      actual.value = await pedirRecibo(id.value, reciboId.value)
      facturas.value = actual.value.persona_id && entidad.tienePermiso('facturacion.ver') ? await facturasVenta(id.value, actual.value.persona_id).catch(() => []) : []
    } else if (!reciboId.value) {
      lista.value = await pedirRecibos(id.value, { cuenta_tesoreria_id: filtroCuenta.value || undefined, sin_identificar: soloSinIdentificar.value || undefined })
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(reciboId, (nuevo, antes) => {
  if (antes !== 'nuevo') resultado.value = null
  void cargar()
})
watch([filtroCuenta, soloSinIdentificar], () => void cargar())
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-recibos">
    <template v-if="reciboId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Recibos
      </RouterLink>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
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
      <template v-else-if="reciboId === 'nuevo'">
        <h1 id="titulo-recibos">
          Nuevo recibo de caja
        </h1>
        <HudPanel etiqueta="Recibo">
          <FormularioRecibo
            :entidad-id="id"
            :cuentas="cuentas"
            :cargando="crear.cargando.value"
            :error="crear.error.value"
            @guardar="alCrear"
          />
        </HudPanel>
      </template>
      <template v-else-if="actual">
        <header class="encabezado">
          <h1 id="titulo-recibos">
            Recibo por {{ moneda(actual.valor) }}
          </h1>
          <HudInsignia :tono="ESTADO_RECIBO[actual.estado].tono">
            {{ ESTADO_RECIBO[actual.estado].texto }}
          </HudInsignia>
        </header>
        <HudPanel etiqueta="Datos">
          <dl class="datos">
            <div>
              <dt>Fecha</dt>
              <dd>{{ fechaCalendario(actual.fecha) }}</dd>
            </div>
            <div>
              <dt>Pagador</dt>
              <dd>{{ actual.persona_id ? terceros.nombre(actual.persona_id) : 'Por identificar' }}</dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{{ nombreCuenta(actual.cuenta_tesoreria_id) }}</dd>
            </div>
            <div>
              <dt>Medio</dt>
              <dd>{{ MEDIO_RECIBO[actual.medio] }}{{ actual.referencia ? ` · ${actual.referencia}` : '' }}</dd>
            </div>
            <div>
              <dt>Descripción</dt>
              <dd>{{ actual.descripcion }}</dd>
            </div>
            <div>
              <dt>Sin aplicar</dt>
              <dd class="cifra">
                {{ moneda(actual.sin_aplicar) }}
              </dd>
            </div>
            <div v-if="actual.motivo_anulacion">
              <dt>Motivo de la anulación</dt>
              <dd>{{ actual.motivo_anulacion }}</dd>
            </div>
          </dl>
        </HudPanel>
        <HudPanel
          v-if="actual.aplicaciones.length || puedeAplicar"
          etiqueta="Aplicaciones"
        >
          <ul
            v-if="actual.aplicaciones.length"
            class="lista"
            aria-label="Aplicaciones del recibo"
          >
            <li
              v-for="a in actual.aplicaciones"
              :key="a.id"
            >
              <span class="crece">
                <strong>{{ facturas.find((f) => f.id === a.factura_venta_id)?.numero ?? 'Factura de venta' }}</strong>
                <small>{{ fechaHora(a.aplicada_en, zona) }}{{ a.anulada_en ? ' · anulada' : '' }}</small>
              </span>
              <span class="cifra">{{ moneda(a.valor) }}</span>
            </li>
          </ul>
          <form
            v-if="puedeAplicar && opcionesFactura.length"
            class="filtros"
            @submit.prevent="alAplicar"
          >
            <HudSelector
              v-model="facturaElegida"
              etiqueta="Factura de venta"
              :opciones="opcionesFactura"
            />
            <HudCampoMonto
              v-model="valorAplicar"
              etiqueta="Valor a aplicar"
            />
            <HudBoton
              tipo="submit"
              :cargando="aplicar.cargando.value"
              :deshabilitado="!facturaElegida || !valorAplicar"
            >
              Aplicar
            </HudBoton>
          </form>
          <p
            v-if="aplicar.error.value"
            class="error"
            role="alert"
          >
            {{ aplicar.error.value }}
          </p>
        </HudPanel>
        <div
          v-if="actual.estado === 'registrado' && registra"
          class="botones"
        >
          <HudBoton
            variante="fantasma"
            @click="anulando = true"
          >
            Anular el recibo
          </HudBoton>
        </div>
        <ConfirmarConMotivo
          v-model:abierto="anulando"
          titulo="Anular el recibo"
          accion="Anular"
          descripcion="El recibo queda anulado y su comprobante se revierte. Sus aplicaciones se deshacen."
          :cargando="anular.cargando.value"
          :error="anular.error.value"
          @confirmar="alAnular"
        />
      </template>
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-recibos">
          Recibos de caja
        </h1>
        <HudBoton
          v-if="registra"
          :a="ruta('nuevo')"
        >
          <IMas aria-hidden="true" /> Nuevo recibo
        </HudBoton>
      </header>
      <div class="filtros">
        <HudSelector
          v-model="filtroCuenta"
          etiqueta="Cuenta"
          vacio="Todas"
          :opciones="opcionesCuenta"
        />
        <label class="casilla">
          <input
            v-model="soloSinIdentificar"
            type="checkbox"
          > Solo por identificar
        </label>
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
        v-else-if="!filas.length"
        estado="vacio"
        mensaje="No hay recibos con esos filtros."
      />
      <HudTabla
        v-else
        :filas="filas"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Recibos de caja"
      >
        <template #celda-descripcion="{ fila }">
          <RouterLink :to="ruta(fila.id)">
            {{ fila.descripcion }}
          </RouterLink>
        </template>
        <template #celda-valor="{ fila }">
          <span class="cifra">{{ moneda(fila.valor) }}</span>
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="ESTADO_RECIBO[fila.estado].tono">
            {{ ESTADO_RECIBO[fila.estado].texto }}
          </HudInsignia>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="./tesoreria.css"></style>

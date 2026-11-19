<script setup lang="ts">
/**
 * Cuentas por pagar (`?vista=`): facturas de proveedor (registrar con retenciones sugeridas,
 * causar, anular; detalle `:id` o `nueva`) y certificados de retenciones por proveedor.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { EstadoFacturaProveedor, FacturaProveedor, NuevaFacturaProveedor } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { useTercerosConocidos } from '@/stores/terceros'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { anularFactura, causarFactura, crearFacturaProveedor, facturaProveedor, facturasProveedor } from '../api'
import CertificadoRetenciones from '../componentes/CertificadoRetenciones.vue'
import FormularioFactura from '../componentes/FormularioFactura.vue'
import { accionesFactura, ESTADO_FACTURA, IMPUESTO, porPagar } from '../reglas'

const PESTANAS = [
  { id: 'facturas', texto: 'Facturas de proveedor' },
  { id: 'certificados', texto: 'Certificados de retención' },
] as const

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const plan = usePlanCuentas()
const terceros = useTercerosConocidos()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const facturaId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (f = '') => ({ name: 'modulo', params: { ...route.params, accion: 'cuentas-por-pagar', id: f }, query: {} })
const gestiona = computed(() => entidad.tienePermiso('tesoreria.facturas_proveedor.gestionar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<FacturaProveedor[]>([])
const actual = ref<FacturaProveedor | null>(null)
const resultado = ref<string | null>(null)
const filtro = ref<EstadoFacturaProveedor | ''>('')
const opcionesEstado = (Object.keys(ESTADO_FACTURA) as EstadoFacturaProveedor[]).map((valor) => ({ valor, etiqueta: ESTADO_FACTURA[valor].texto }))
const filas = computed(() => lista.value.map((f) => ({ ...f, numeroTexto: `${f.prefijo}${f.numero}`, proveedor: terceros.nombre(f.persona_id), vence: fechaCalendario(f.vencimiento), saldo: porPagar(f) })))
const COLUMNAS = [
  { clave: 'numeroTexto', titulo: 'Factura' },
  { clave: 'proveedor', titulo: 'Proveedor' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'vence', titulo: 'Vence' },
  { clave: 'saldo', titulo: 'Por pagar', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
]

const anulando = ref(false)
const duplicada = ref(false)
const crear = useAccion((clave, datos: NuevaFacturaProveedor) => crearFacturaProveedor(id.value, datos, clave))
const causar = useAccion(() => causarFactura(id.value, facturaId.value), { alConflicto: () => cargar() })
const anular = useAccion((_c, motivo: string) => anularFactura(id.value, facturaId.value, motivo), { alConflicto: () => cargar() })

async function alCrear(datos: NuevaFacturaProveedor) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) {
    duplicada.value = crear.codigo.value === 'conflicto'
    return
  }
  resultado.value = `Factura registrada: neto a pagar ${moneda(r.valor.neto_pagar)}.`
  await router.replace(ruta(r.valor.id))
}

async function alCausar() {
  const r = await causar.ejecutar()
  if (!r.ok) return
  actual.value = { ...r.valor, lineas: r.valor.lineas.length ? r.valor.lineas : (actual.value?.lineas ?? []) }
  resultado.value = 'Factura causada: ya se puede pagar con un egreso.'
}

async function alAnular(motivo: string) {
  const r = await anular.ejecutar(motivo)
  if (!r.ok) return
  anulando.value = false
  actual.value = { ...r.valor, lineas: actual.value?.lineas ?? [] }
  resultado.value = 'Factura anulada.'
}

// Las respuestas traen solo `persona_id`: se piden los nombres que aún no se conocen.
watch([lista, actual], ([l, a]) => void terceros.resolver(id.value, [...l.map((x) => x.persona_id), a?.persona_id]))

async function cargar() {
  estado.value = 'cargando'
  try {
    await plan.asegurar()
    if (facturaId.value && facturaId.value !== 'nueva') actual.value = await facturaProveedor(id.value, facturaId.value)
    else if (!facturaId.value) lista.value = await facturasProveedor(id.value, { estado: filtro.value || undefined })
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(facturaId, (nuevo, antes) => {
  if (antes !== 'nueva') resultado.value = null
  duplicada.value = false
  void cargar()
})
watch(filtro, () => void cargar())
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-cxp">
    <template v-if="facturaId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Cuentas por pagar
      </RouterLink>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-if="causar.error.value"
        class="error"
        role="alert"
      >
        {{ causar.error.value }}
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
      <template v-else-if="facturaId === 'nueva'">
        <h1 id="titulo-cxp">
          Nueva factura de proveedor
        </h1>
        <HudPanel etiqueta="Factura">
          <FormularioFactura
            :entidad-id="id"
            :cargando="crear.cargando.value"
            :error="crear.error.value"
            :duplicada="duplicada"
            @guardar="alCrear"
          />
        </HudPanel>
      </template>
      <template v-else-if="actual">
        <header class="encabezado">
          <h1 id="titulo-cxp">
            Factura {{ actual.prefijo }}{{ actual.numero }}
          </h1>
          <HudInsignia :tono="ESTADO_FACTURA[actual.estado].tono">
            {{ ESTADO_FACTURA[actual.estado].texto }}
          </HudInsignia>
        </header>
        <HudPanel etiqueta="Datos">
          <dl class="datos">
            <div>
              <dt>Proveedor</dt>
              <dd>{{ terceros.nombre(actual.persona_id) }}</dd>
            </div>
            <div>
              <dt>Fecha y vencimiento</dt>
              <dd>{{ fechaCalendario(actual.fecha) }} · {{ fechaCalendario(actual.vencimiento) }}</dd>
            </div>
            <div>
              <dt>Descripción</dt>
              <dd>{{ actual.descripcion }}</dd>
            </div>
            <div>
              <dt>Subtotal + IVA</dt>
              <dd class="cifra">
                {{ moneda(actual.subtotal) }} + {{ moneda(actual.iva) }}
              </dd>
            </div>
            <div>
              <dt>Retenciones</dt>
              <dd class="cifra">
                {{ moneda(actual.retenciones) }}
              </dd>
            </div>
            <div>
              <dt>Neto · pagado</dt>
              <dd class="cifra">
                {{ moneda(actual.neto_pagar) }} · {{ moneda(actual.pagado) }}
              </dd>
            </div>
            <div v-if="actual.excepcion_duplicado">
              <dt>Excepción por número repetido</dt>
              <dd>{{ actual.excepcion_duplicado }}</dd>
            </div>
            <div v-if="actual.motivo_anulacion">
              <dt>Motivo de la anulación</dt>
              <dd>{{ actual.motivo_anulacion }}</dd>
            </div>
          </dl>
        </HudPanel>
        <HudPanel
          v-if="actual.lineas.length"
          etiqueta="Líneas"
        >
          <ul
            class="lista"
            aria-label="Líneas de la factura"
          >
            <li
              v-for="(l, i) in actual.lineas"
              :key="i"
            >
              <span class="crece">
                <strong>{{ l.descripcion }}</strong>
                <small>{{ l.cuenta_id ? `${plan.porId.get(l.cuenta_id)?.codigo ?? ''} · ${plan.porId.get(l.cuenta_id)?.nombre ?? ''}` : 'Sin cuenta' }}</small>
                <small
                  v-for="r in l.retenciones"
                  :key="r.concepto_id"
                >{{ IMPUESTO[r.impuesto] }} {{ r.tarifa }} % sobre {{ moneda(r.base) }}: {{ moneda(r.valor) }}</small>
              </span>
              <span class="cifra">{{ moneda(l.base) }}</span>
            </li>
          </ul>
        </HudPanel>
        <div
          v-if="accionesFactura(actual.estado, gestiona).length"
          class="botones"
        >
          <HudBoton
            v-if="accionesFactura(actual.estado, gestiona).includes('causar')"
            :cargando="causar.cargando.value"
            @click="alCausar"
          >
            Causar la factura
          </HudBoton>
          <HudBoton
            v-if="accionesFactura(actual.estado, gestiona).includes('anular')"
            variante="fantasma"
            @click="anulando = true"
          >
            Anular la factura
          </HudBoton>
        </div>
        <ConfirmarConMotivo
          v-model:abierto="anulando"
          titulo="Anular la factura"
          accion="Anular"
          descripcion="La factura queda anulada; si estaba causada, su comprobante se revierte."
          :cargando="anular.cargando.value"
          :error="anular.error.value"
          @confirmar="alAnular"
        />
      </template>
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-cxp">
          Cuentas por pagar
        </h1>
        <HudBoton
          v-if="gestiona && pestana === 'facturas'"
          :a="ruta('nueva')"
        >
          <IMas aria-hidden="true" /> Nueva factura
        </HudBoton>
      </header>
      <HudPestanas
        :pestanas="PESTANAS"
        etiqueta="Cuentas por pagar"
      />
      <HudPanel
        v-if="pestana === 'certificados'"
        etiqueta="Certificado de retenciones"
      >
        <CertificadoRetenciones :entidad-id="id" />
      </HudPanel>
      <template v-else>
        <div class="filtros">
          <HudSelector
            v-model="filtro"
            etiqueta="Estado"
            vacio="Todos"
            :opciones="opcionesEstado"
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
          v-else-if="!filas.length"
          estado="vacio"
          mensaje="No hay facturas con ese filtro."
        />
        <HudTabla
          v-else
          :filas="filas"
          :columnas="COLUMNAS"
          clave="id"
          titulo="Facturas de proveedor"
        >
          <template #celda-numeroTexto="{ fila }">
            <RouterLink :to="ruta(fila.id)">
              {{ fila.numeroTexto }}
            </RouterLink>
          </template>
          <template #celda-saldo="{ fila }">
            <span class="cifra">{{ moneda(fila.saldo) }}</span>
          </template>
          <template #celda-estado="{ fila }">
            <HudInsignia :tono="ESTADO_FACTURA[fila.estado].tono">
              {{ ESTADO_FACTURA[fila.estado].texto }}
            </HudInsignia>
          </template>
        </HudTabla>
      </template>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

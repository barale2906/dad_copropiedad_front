<script setup lang="ts">
/**
 * Egresos: lista por estado y, con `:id`, el detalle (o `nuevo`). Registrar → **por autorizar**
 * → autorizado (otra cuenta: a quien lo registró no se le ofrece el botón) → pagado (se
 * contabiliza). Se anula con motivo antes de pagarse.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { CuentaTesoreria, Egreso, EstadoEgreso, NuevoEgreso } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { useTercerosConocidos } from '@/stores/terceros'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { anularEgreso, autorizarEgreso, crearEgreso, cuentasTesoreria, egreso as pedirEgreso, egresos as pedirEgresos, pagarEgreso } from '../api'
import FormularioEgreso from '../componentes/FormularioEgreso.vue'
import { accionesEgreso, ESTADO_EGRESO, MEDIO_EGRESO, registradoPorMi } from '../reglas'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const cuenta = useCuenta()
const plan = usePlanCuentas()
const terceros = useTercerosConocidos()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const egresoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (x = '') => ({ name: 'modulo', params: { ...route.params, accion: 'egresos', id: x }, query: {} })
const q = computed(() => ({ registrar: entidad.tienePermiso('tesoreria.egresos.registrar'), autorizar: entidad.tienePermiso('tesoreria.egresos.autorizar') }))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const cuentas = ref<CuentaTesoreria[]>([])
const lista = ref<Egreso[]>([])
const actual = ref<Egreso | null>(null)
const resultado = ref<string | null>(null)
const filtro = ref<EstadoEgreso | ''>('')
const opcionesEstado = (Object.keys(ESTADO_EGRESO) as EstadoEgreso[]).map((valor) => ({ valor, etiqueta: ESTADO_EGRESO[valor].texto }))
const nombreCuenta = (c: string) => cuentas.value.find((x) => x.id === c)?.nombre ?? ''
const filas = computed(() =>
  [...lista.value]
    .sort((a, b) => (a.estado === 'por_autorizar' ? -1 : 0) - (b.estado === 'por_autorizar' ? -1 : 0))
    .map((x) => ({ ...x, fechaTexto: fechaCalendario(x.fecha), beneficiario: terceros.nombre(x.persona_id), mio: registradoPorMi(x, cuenta.id) })),
)
const COLUMNAS = [
  { clave: 'fechaTexto', titulo: 'Fecha' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'beneficiario', titulo: 'Beneficiario' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
]
const acciones = computed(() => (actual.value ? accionesEgreso(actual.value, q.value, cuenta.id) : []))

// Acciones
const pagando = ref(false)
const anulando = ref(false)
const crear = useAccion((clave, datos: NuevoEgreso) => crearEgreso(id.value, datos, clave))
const autorizar = useAccion(() => autorizarEgreso(id.value, egresoId.value), { alConflicto: () => cargar() })
const pagar = useAccion(() => pagarEgreso(id.value, egresoId.value), { alConflicto: () => cargar() })
const anular = useAccion((_c, motivo: string) => anularEgreso(id.value, egresoId.value, motivo), { alConflicto: () => cargar() })
const errores = computed(() => [autorizar.error.value, pagar.error.value].filter(Boolean))

async function alCrear(datos: NuevoEgreso) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  resultado.value = `Egreso registrado por ${moneda(r.valor.valor)}: queda por autorizar por otra persona.`
  await router.replace(ruta(r.valor.id))
}

async function alAutorizar() {
  const r = await autorizar.ejecutar()
  if (!r.ok) return
  actual.value = r.valor
  resultado.value = 'Egreso autorizado: ya se puede pagar.'
}

async function alPagar() {
  const r = await pagar.ejecutar()
  pagando.value = false
  if (!r.ok) return
  actual.value = r.valor
  resultado.value = 'Egreso pagado y contabilizado.'
}

async function alAnular(motivo: string) {
  const r = await anular.ejecutar(motivo)
  if (!r.ok) return
  anulando.value = false
  actual.value = r.valor
  resultado.value = 'Egreso anulado.'
}

// Las respuestas traen solo `persona_id`: se piden los nombres que aún no se conocen.
watch([lista, actual], ([l, a]) => void terceros.resolver(id.value, [...l.map((x) => x.persona_id), a?.persona_id]))

async function cargar() {
  estado.value = 'cargando'
  try {
    await Promise.all([cuenta.asegurar().catch(() => undefined), plan.asegurar()])
    cuentas.value = await cuentasTesoreria(id.value)
    if (egresoId.value && egresoId.value !== 'nuevo') actual.value = await pedirEgreso(id.value, egresoId.value)
    else if (!egresoId.value) lista.value = await pedirEgresos(id.value, filtro.value || undefined)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(egresoId, (nuevo, antes) => {
  if (antes !== 'nuevo') resultado.value = null
  void cargar()
})
watch(filtro, () => void cargar())
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-egresos">
    <template v-if="egresoId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Egresos
      </RouterLink>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-for="e in errores"
        :key="e ?? ''"
        class="error"
        role="alert"
      >
        {{ e }}
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
      <template v-else-if="egresoId === 'nuevo'">
        <h1 id="titulo-egresos">
          Nuevo egreso
        </h1>
        <HudPanel etiqueta="Egreso">
          <FormularioEgreso
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
          <h1 id="titulo-egresos">
            Egreso por {{ moneda(actual.valor) }}
          </h1>
          <HudInsignia :tono="ESTADO_EGRESO[actual.estado].tono">
            {{ ESTADO_EGRESO[actual.estado].texto }}
          </HudInsignia>
        </header>
        <p
          v-if="actual.estado === 'por_autorizar' && registradoPorMi(actual, cuenta.id)"
          class="aviso"
        >
          Usted registró este egreso: lo autoriza otra persona con permiso para hacerlo.
        </p>
        <HudPanel etiqueta="Datos">
          <dl class="datos">
            <div>
              <dt>Fecha</dt>
              <dd>{{ fechaCalendario(actual.fecha) }}</dd>
            </div>
            <div>
              <dt>Beneficiario</dt>
              <dd>{{ terceros.nombre(actual.persona_id) }}</dd>
            </div>
            <div>
              <dt>Cuenta que paga</dt>
              <dd>{{ nombreCuenta(actual.cuenta_tesoreria_id) }}</dd>
            </div>
            <div>
              <dt>Medio</dt>
              <dd>{{ MEDIO_EGRESO[actual.medio] }}{{ actual.referencia ? ` · ${actual.referencia}` : '' }}</dd>
            </div>
            <div>
              <dt>Descripción</dt>
              <dd>{{ actual.descripcion }}</dd>
            </div>
            <div>
              <dt>Registrado</dt>
              <dd>{{ fechaHora(actual.registrado_en, zona) }}{{ registradoPorMi(actual, cuenta.id) ? ' por usted' : '' }}</dd>
            </div>
            <div v-if="actual.autorizado_en">
              <dt>Autorizado</dt>
              <dd>{{ fechaHora(actual.autorizado_en, zona) }}</dd>
            </div>
            <div v-if="actual.pagado_en">
              <dt>Pagado</dt>
              <dd>{{ fechaHora(actual.pagado_en, zona) }}</dd>
            </div>
            <div v-if="actual.motivo_anulacion">
              <dt>Motivo de la anulación</dt>
              <dd>{{ actual.motivo_anulacion }}</dd>
            </div>
          </dl>
        </HudPanel>
        <HudPanel etiqueta="Qué paga">
          <ul
            class="lista"
            aria-label="Conceptos del egreso"
          >
            <li
              v-for="f in actual.facturas"
              :key="f.factura_proveedor_id"
            >
              <span class="crece">Factura de proveedor</span>
              <span class="cifra">{{ moneda(f.valor) }}</span>
            </li>
            <li
              v-for="(g, i) in actual.gastos"
              :key="i"
            >
              <span class="crece">
                <strong>{{ g.descripcion }}</strong>
                <small>{{ plan.porId.get(g.cuenta_id)?.codigo }} · {{ plan.porId.get(g.cuenta_id)?.nombre }}</small>
              </span>
              <span class="cifra">{{ moneda(g.valor) }}</span>
            </li>
          </ul>
        </HudPanel>
        <div
          v-if="acciones.length"
          class="botones"
        >
          <HudBoton
            v-if="acciones.includes('autorizar')"
            :cargando="autorizar.cargando.value"
            @click="alAutorizar"
          >
            Autorizar el egreso
          </HudBoton>
          <HudBoton
            v-if="acciones.includes('pagar')"
            @click="pagando = true"
          >
            Pagar
          </HudBoton>
          <HudBoton
            v-if="acciones.includes('anular')"
            variante="fantasma"
            @click="anulando = true"
          >
            Anular el egreso
          </HudBoton>
        </div>
        <HudDialogo
          v-model:abierto="pagando"
          titulo="Pagar el egreso"
        >
          <p>Se registra el pago de {{ moneda(actual.valor) }} desde {{ nombreCuenta(actual.cuenta_tesoreria_id) }} y se contabiliza.</p>
          <template #acciones>
            <HudBoton
              variante="fantasma"
              @click="pagando = false"
            >
              Volver
            </HudBoton>
            <HudBoton
              :cargando="pagar.cargando.value"
              @click="alPagar"
            >
              Registrar el pago
            </HudBoton>
          </template>
        </HudDialogo>
        <ConfirmarConMotivo
          v-model:abierto="anulando"
          titulo="Anular el egreso"
          accion="Anular"
          descripcion="El egreso queda anulado y no se paga."
          :cargando="anular.cargando.value"
          :error="anular.error.value"
          @confirmar="alAnular"
        />
      </template>
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-egresos">
          Egresos
        </h1>
        <HudBoton
          v-if="q.registrar"
          :a="ruta('nuevo')"
        >
          <IMas aria-hidden="true" /> Nuevo egreso
        </HudBoton>
      </header>
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
        mensaje="No hay egresos con ese filtro."
      />
      <HudTabla
        v-else
        :filas="filas"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Egresos"
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
          <HudInsignia :tono="ESTADO_EGRESO[fila.estado].tono">
            {{ ESTADO_EGRESO[fila.estado].texto }}
          </HudInsignia>
          <small v-if="fila.estado === 'por_autorizar' && fila.mio"> · lo registró usted</small>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="./tesoreria.css"></style>

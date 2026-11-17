<script setup lang="ts">
/**
 * Mi cartera: saldo y estado de cuenta de cada bien propio (titular o pagador), cuentas de cobro
 * en PDF, referencia de pago y paz y salvo. Si debe (409), se muestra el saldo pendiente y la
 * cuenta de cobro; si no, el PDF se guarda de inmediato (el backend lo entrega una sola vez).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import { guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { BienCartera, CuentaCobro, EstadoCuenta } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IDescargar from '~icons/tabler/download'
import { bienesCartera, cuentasCobro, descargarCuentaCobro, estadoCuenta, pedirPazYSalvo } from '../api'
import { situacionCartera } from '../reglas'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const bienes = ref<BienCartera[]>([])
const cuenta = ref<EstadoCuenta | null>(null)
const cobros = ref<CuentaCobro[]>([])
const codigoPaz = ref<string | null>(null)
const debe = ref(false)
const errorDescarga = ref<string | null>(null)

const bienId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (b = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: b } })
const pendientes = computed(() => (cuenta.value?.obligaciones ?? []).filter((o) => o.estado === 'vigente' && comparar(o.saldo, '0') > 0))
const ultimaCuenta = computed(() => cobros.value[0] ?? null)

const paz = useAccion(() => pedirPazYSalvo(id.value, bienId.value))

async function pedirPaz() {
  codigoPaz.value = null
  debe.value = false
  const r = await paz.ejecutar()
  if (r.ok) {
    const bytes = Uint8Array.from(atob(r.valor.pdf_base64), (c) => c.charCodeAt(0))
    guardarBlob(new Blob([bytes], { type: 'application/pdf' }), `paz-y-salvo-${cuenta.value?.bien.codigo ?? 'bien'}.pdf`)
    codigoPaz.value = r.valor.codigo
    return
  }
  // 409: el bien tiene saldo. Se muestra lo pendiente en lugar del error genérico.
  if (paz.codigo.value === 'conflicto') debe.value = true
}

async function bajar(c: CuentaCobro) {
  errorDescarga.value = null
  try {
    await descargarCuentaCobro(id.value, c)
  } catch (e) {
    errorDescarga.value = mensajeDeError(e)
  }
}

async function cargar() {
  estado.value = 'cargando'
  codigoPaz.value = null
  debe.value = false
  paz.reiniciar()
  try {
    if (!bienId.value) {
      bienes.value = await bienesCartera(id.value)
      if (bienes.value.length === 1) {
        await router.replace(ruta(bienes.value[0]!.id))
        return
      }
    } else {
      ;[cuenta.value, cobros.value] = await Promise.all([estadoCuenta(id.value, bienId.value), cuentasCobro(id.value, bienId.value)])
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(bienId, cargar)
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-cartera">
    <header>
      <RouterLink
        v-if="bienId && bienes.length > 1"
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Mis bienes en cartera
      </RouterLink>
      <h1 id="titulo-cartera">
        {{ cuenta && bienId ? `Mi cartera: ${cuenta.bien.codigo}` : 'Mi cartera' }}
      </h1>
    </header>
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

    <template v-else-if="bienId && cuenta">
      <HudPanel
        etiqueta="Saldo"
        resaltado
      >
        <div class="saldo">
          <strong>{{ moneda(cuenta.saldo) }}</strong>
          <HudInsignia :tono="situacionCartera(cuenta).tono">
            {{ situacionCartera(cuenta).texto }}
          </HudInsignia>
        </div>
        <dl class="datos">
          <div><dt>Vencido</dt><dd>{{ moneda(cuenta.vencido) }}</dd></div>
          <div v-if="comparar(cuenta.anticipos, '0') > 0">
            <dt>Anticipos</dt><dd>{{ moneda(cuenta.anticipos) }}</dd>
          </div>
          <div><dt>Corte</dt><dd>{{ fechaCalendario(cuenta.corte) }}</dd></div>
          <div v-if="cuenta.bien.referencia_pago">
            <dt>Referencia de pago</dt><dd><strong>{{ cuenta.bien.referencia_pago }}</strong></dd>
          </div>
        </dl>
      </HudPanel>

      <HudPanel etiqueta="Paz y salvo">
        <p
          v-if="codigoPaz"
          class="ok"
          role="status"
        >
          Paz y salvo descargado. Código de verificación: <strong>{{ codigoPaz }}</strong> (guárdelo: solo se muestra esta vez).
        </p>
        <div
          v-else-if="debe"
          class="aviso"
          role="alert"
        >
          <p>
            No se puede emitir el paz y salvo: el bien tiene un saldo de <strong>{{ moneda(cuenta.saldo) }}</strong>
            ({{ moneda(cuenta.vencido) }} vencido).
          </p>
          <HudBoton
            v-if="ultimaCuenta"
            variante="secundario"
            @click="bajar(ultimaCuenta)"
          >
            <IDescargar aria-hidden="true" /> Descargar la cuenta de cobro {{ ultimaCuenta.numero }}
          </HudBoton>
        </div>
        <template v-else>
          <p class="texto-2">
            Certifica que el bien está al día. Se descarga en PDF con un código para verificarlo.
          </p>
          <p
            v-if="paz.error.value"
            class="error"
            role="alert"
          >
            {{ paz.error.value }}
          </p>
          <HudBoton
            :cargando="paz.cargando.value"
            @click="pedirPaz"
          >
            Pedir paz y salvo
          </HudBoton>
        </template>
      </HudPanel>

      <HudPanel etiqueta="Pendiente por pagar">
        <p
          v-if="pendientes.length === 0"
          class="texto-2"
        >
          No tiene obligaciones pendientes.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Obligaciones pendientes"
        >
          <li
            v-for="o in pendientes"
            :key="o.id"
          >
            <span>{{ o.concepto_nombre }} · {{ fechaCalendario(o.periodo) }}</span>
            <strong>{{ moneda(o.saldo) }}</strong>
            <small>Vence el {{ fechaCalendario(o.vencimiento) }}</small>
          </li>
        </ul>
      </HudPanel>

      <HudPanel etiqueta="Cuentas de cobro">
        <p
          v-if="errorDescarga"
          class="error"
          role="alert"
        >
          {{ errorDescarga }}
        </p>
        <p
          v-if="cobros.length === 0"
          class="texto-2"
        >
          Aún no hay cuentas de cobro.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Cuentas de cobro"
        >
          <li
            v-for="c in cobros"
            :key="c.id"
          >
            <span>N.º {{ c.numero }} · {{ fechaCalendario(c.periodo) }}</span>
            <strong>{{ moneda(c.total) }}</strong>
            <small>Vence el {{ fechaCalendario(c.vencimiento) }}</small>
            <HudBoton
              variante="fantasma"
              @click="bajar(c)"
            >
              <IDescargar aria-hidden="true" /> PDF<span class="solo-lector"> de la cuenta de cobro {{ c.numero }}</span>
            </HudBoton>
          </li>
        </ul>
      </HudPanel>

      <HudPanel
        v-if="cuenta.pagos.length"
        etiqueta="Pagos recibidos"
      >
        <ul
          class="lista"
          aria-label="Pagos recibidos"
        >
          <li
            v-for="p in cuenta.pagos"
            :key="`${p.recibo_id}-${p.obligacion_id}`"
          >
            <span>{{ fechaCalendario(p.fecha) }}</span>
            <strong>{{ moneda(p.valor) }}</strong>
          </li>
        </ul>
      </HudPanel>
    </template>

    <template v-else>
      <HudEstado
        v-if="bienes.length === 0"
        estado="vacio"
        mensaje="No tiene bienes en la cartera de la copropiedad."
      />
      <ul
        v-else
        class="tarjetas"
        aria-label="Bienes en cartera"
      >
        <li
          v-for="b in bienes"
          :key="b.id"
        >
          <RouterLink
            :to="ruta(b.id)"
            class="tarjeta"
          >
            <strong>{{ b.codigo }}</strong>
            <small v-if="b.referencia_pago">Referencia {{ b.referencia_pago }}</small>
          </RouterLink>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped src="./portal.css"></style>
<style scoped>
.saldo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin-bottom: 12px;
}

.saldo strong {
  font-family: var(--fuente-display);
  font-size: clamp(28px, 7vw, 38px);
}

.aviso {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.aviso p {
  margin: 0;
}
</style>

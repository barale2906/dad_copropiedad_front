<script setup lang="ts">
/**
 * Liquidación mensual (`?vista=`): elegir el mes → **vista previa** (no guarda) → liquidar y
 * contabilizar → cuentas de cobro y envío por correo. Si el mes ya estaba liquidado (409) se
 * muestra la existente. Historial de liquidaciones (detalle en `:id`) y cuotas extraordinarias.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Liquidado, LiquidacionCartera, VistaLiquidacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { enviarCuentas, liquidaciones as pedirLiquidaciones, liquidar, vistaLiquidacion } from '../api'
import CuotasExtraordinarias from '../componentes/CuotasExtraordinarias.vue'
import DetalleLiquidacion from '../componentes/DetalleLiquidacion.vue'
import VistaLiquidacionResumen from '../componentes/VistaLiquidacion.vue'
import { moverPeriodo, periodoDe, textoPeriodo } from '../reglas'

const PESTANAS = [
  { id: 'liquidar', texto: 'Liquidar' },
  { id: 'historial', texto: 'Historial' },
  { id: 'extraordinarias', texto: 'Cuotas extraordinarias' },
] as const

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const liquidacionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (l = '') => ({ name: 'modulo', params: { ...route.params, accion: 'liquidacion', id: l }, query: l ? {} : { vista: 'historial' } })

const actual = periodoDe(hoyEn(entidad.zonaHoraria))
const opcionesMes = [-3, -2, -1, 0, 1].map((d) => moverPeriodo(actual, d)).map((p) => ({ valor: p, etiqueta: textoPeriodo(p) }))
const periodo = ref(actual)
const paso = ref<PasoFlujo>('editar')
const vista = ref<VistaLiquidacion | null>(null)
const hecho = ref<Liquidado | null>(null)
const existente = ref<LiquidacionCartera | null>(null)
const envio = ref<string | null>(null)
const lista = ref<LiquidacionCartera[]>([])
const estadoLista = ref<'cargando' | 'listo' | 'error'>('cargando')
const errorLista = ref<string | null>(null)

const previa = useAccion(() => vistaLiquidacion(id.value, periodo.value))
const confirmar = useAccion((clave) => liquidar(id.value, periodo.value, clave))
const enviar = useAccion((_c, liqId: string) => enviarCuentas(id.value, liqId))
const errorFlujo = computed(() => previa.error.value ?? (existente.value ? null : confirmar.error.value))

async function alPrevisualizar() {
  existente.value = null
  const r = await previa.ejecutar()
  if (!r.ok) return
  vista.value = r.valor
  paso.value = 'revisar'
}

async function alConfirmar() {
  const r = await confirmar.ejecutar()
  if (r.ok) {
    hecho.value = r.valor
    paso.value = 'hecho'
    return
  }
  // 409: el mes ya estaba liquidado; se muestra la existente.
  if (confirmar.codigo.value === 'conflicto' || confirmar.codigo.value === 'conflicto_estado') {
    existente.value = (await pedirLiquidaciones(id.value).catch(() => [])).find((l) => l.periodo === periodo.value && l.estado === 'contabilizada') ?? null
  }
}

async function alEnviar() {
  if (!hecho.value) return
  const r = await enviar.ejecutar(hecho.value.liquidacion.id)
  if (r.ok) envio.value = `Se enviaron ${r.valor.enviadas} cuentas de cobro por correo.${r.valor.sin_correo ? ` ${r.valor.sin_correo} pagador(es) sin correo.` : ''}`
}

function reiniciar() {
  paso.value = 'editar'
  vista.value = hecho.value = existente.value = null
  envio.value = null
  previa.reiniciar()
  confirmar.reiniciar()
}

async function cargarLista() {
  estadoLista.value = 'cargando'
  try {
    lista.value = await pedirLiquidaciones(id.value)
    estadoLista.value = 'listo'
  } catch (e) {
    errorLista.value = mensajeDeError(e)
    estadoLista.value = 'error'
  }
}

watch([pestana, liquidacionId], () => pestana.value === 'historial' && !liquidacionId.value && void cargarLista(), { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-liquidacion">
    <template v-if="liquidacionId">
      <RouterLink
        class="volver"
        :to="ruta()"
      >
        <IVolver aria-hidden="true" /> Volver al historial
      </RouterLink>
      <h1 id="titulo-liquidacion">
        Liquidación
      </h1>
      <DetalleLiquidacion :liquidacion-id="liquidacionId" />
    </template>

    <template v-else>
      <header>
        <h1 id="titulo-liquidacion">
          Liquidación mensual
        </h1>
        <p class="texto-2">
          Revise la vista previa antes de liquidar: al confirmar se crean las obligaciones, el comprobante y una cuenta de cobro por unidad.
        </p>
      </header>
      <HudPestanas
        :pestanas="PESTANAS"
        etiqueta="Vistas de la liquidación"
      />

      <FlujoDosPasos
        v-if="pestana === 'liquidar'"
        v-model:paso="paso"
        :cargando="previa.cargando.value || confirmar.cargando.value"
        :error="errorFlujo"
        :accion="`Liquidar ${textoPeriodo(periodo)}`"
        @previsualizar="alPrevisualizar"
        @confirmar="alConfirmar"
        @reiniciar="reiniciar"
      >
        <template #formulario>
          <HudSelector
            v-model="periodo"
            etiqueta="Mes a liquidar"
            :opciones="opcionesMes"
          />
        </template>
        <template #vista-previa>
          <VistaLiquidacionResumen
            v-if="vista"
            :vista="vista"
          />
          <p
            v-if="existente"
            class="aviso"
            role="alert"
          >
            {{ textoPeriodo(existente.periodo) }} ya estaba liquidado por {{ moneda(existente.total) }}.
            <RouterLink :to="ruta(existente.id)">
              Ver la liquidación existente
            </RouterLink>
          </p>
        </template>
        <template #hecho>
          <div
            v-if="hecho"
            class="campos"
          >
            <p class="ok">
              {{ textoPeriodo(hecho.liquidacion.periodo) }} liquidado por {{ moneda(hecho.liquidacion.total) }}: {{ hecho.cuentas_cobro.length }} cuentas de cobro, vencen el {{ fechaCalendario(hecho.liquidacion.vencimiento) }}.
              {{ hecho.anticipos_aplicados ? `Se aplicaron ${hecho.anticipos_aplicados} anticipo(s).` : '' }}
            </p>
            <p
              v-if="hecho.aviso_fondo"
              class="aviso"
            >
              El fondo de imprevistos llegó al 50 % del presupuesto: la asamblea puede suspender los aportes (art. 35).
            </p>
            <p
              v-if="envio"
              class="ok"
            >
              {{ envio }}
            </p>
            <p
              v-if="enviar.error.value"
              class="error"
              role="alert"
            >
              {{ enviar.error.value }}
            </p>
            <div class="botones">
              <HudBoton
                v-if="!envio"
                :cargando="enviar.cargando.value"
                @click="alEnviar"
              >
                Enviar cuentas de cobro por correo
              </HudBoton>
              <HudBoton
                variante="secundario"
                @click="router.push(ruta(hecho.liquidacion.id))"
              >
                Ver la liquidación
              </HudBoton>
            </div>
          </div>
        </template>
      </FlujoDosPasos>

      <template v-else-if="pestana === 'historial'">
        <HudEstado
          v-if="estadoLista === 'cargando'"
          estado="cargando"
        />
        <HudEstado
          v-else-if="estadoLista === 'error'"
          estado="error"
          :mensaje="errorLista ?? undefined"
          @reintentar="cargarLista"
        />
        <HudEstado
          v-else-if="lista.length === 0"
          estado="vacio"
          mensaje="Aún no hay liquidaciones."
        />
        <ul
          v-else
          class="lista"
          aria-label="Liquidaciones"
        >
          <li
            v-for="l in lista"
            :key="l.id"
          >
            <span class="crece">
              <RouterLink :to="ruta(l.id)">{{ textoPeriodo(l.periodo) }}</RouterLink>
              <small>Vence el {{ fechaCalendario(l.vencimiento) }}</small>
            </span>
            <span class="cifra">{{ moneda(l.total) }}</span>
            <HudInsignia :tono="l.estado === 'anulada' ? 'neutro' : 'exito'">
              {{ l.estado === 'anulada' ? 'Anulada' : 'Contabilizada' }}
            </HudInsignia>
          </li>
        </ul>
      </template>

      <CuotasExtraordinarias
        v-else
        :puede="entidad.tienePermiso('cartera.liquidar')"
      />
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

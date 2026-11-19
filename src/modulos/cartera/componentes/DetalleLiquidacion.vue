<script setup lang="ts">
/**
 * Una liquidación: total, vencimiento y estado; sus cuentas de cobro (PDF dentro de la app);
 * enviarlas por correo (resultado: enviadas y pagadores sin correo) y anularla con motivo
 * (solo sin pagos ni ajustes; con pagos se corrige con notas crédito).
 */
import { computed, ref, watch } from 'vue'
import { type ArchivoRecibido, guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { CuentaCobro, DetalleLiquidacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import VisorPdf from '@/hud/componentes/VisorPdf.vue'
import { useEntidad } from '@/stores/entidad'
import { anularLiquidacion, cuentasCobro, enviarCuentas, liquidacion as pedirLiquidacion, pdfCuentaCobro } from '../api'
import { useCartera } from '../store'
import { textoPeriodo } from '../reglas'

const props = defineProps<{ liquidacionId: string }>()

const entidad = useEntidad()
const cartera = useCartera()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleLiquidacion | null>(null)
const cuentas = ref<CuentaCobro[]>([])
const resultado = ref<string | null>(null)
const anulando = ref(false)
const pdf = ref<{ archivo: ArchivoRecibido; numero: string } | null>(null)
const liq = computed(() => detalle.value?.liquidacion ?? null)

const enviar = useAccion(() => enviarCuentas(id.value, props.liquidacionId))
const anular = useAccion((_c, motivo: string) => anularLiquidacion(id.value, props.liquidacionId, motivo), { alConflicto: () => cargar() })
const verPdf = useAccion((_c, c: CuentaCobro) => pdfCuentaCobro(id.value, c.id))

async function alEnviar() {
  const r = await enviar.ejecutar()
  if (r.ok) resultado.value = `Se enviaron ${r.valor.enviadas} cuentas de cobro por correo.${r.valor.sin_correo ? ` ${r.valor.sin_correo} pagador(es) no tienen correo: entrégueles la cuenta por otro medio.` : ''}`
}

async function alAnular(motivo: string) {
  if (!(await anular.ejecutar(motivo)).ok) return
  anulando.value = false
  resultado.value = 'Liquidación anulada: se revirtió su comprobante.'
  await cargar()
}

async function alVerPdf(c: CuentaCobro) {
  const r = await verPdf.ejecutar(c)
  if (r.ok) pdf.value = { archivo: r.valor, numero: c.numero }
}

async function cargar() {
  try {
    const [d, c] = await Promise.all([pedirLiquidacion(id.value, props.liquidacionId), cuentasCobro(id.value, { liquidacionId: props.liquidacionId }), cartera.asegurar(id.value)])
    detalle.value = d
    cuentas.value = c
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(() => props.liquidacionId, cargar, { immediate: true })
</script>

<template>
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
  <article
    v-else-if="liq"
    class="campos"
    :aria-label="`Liquidación de ${textoPeriodo(liq.periodo)}`"
  >
    <header class="encabezado">
      <h2>Liquidación de {{ textoPeriodo(liq.periodo) }}</h2>
      <HudInsignia :tono="liq.estado === 'anulada' ? 'neutro' : 'exito'">
        {{ liq.estado === 'anulada' ? 'Anulada' : 'Contabilizada' }}
      </HudInsignia>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <dl class="datos">
      <div><dt>Total</dt><dd class="cifra"><strong>{{ moneda(liq.total) }}</strong></dd></div>
      <div><dt>Vence</dt><dd>{{ fechaCalendario(liq.vencimiento) }}</dd></div>
      <div><dt>Obligaciones</dt><dd>{{ detalle?.obligaciones.length ?? 0 }}</dd></div>
      <div><dt>Liquidada</dt><dd>{{ fechaHora(liq.liquidada_en, entidad.zonaHoraria) }}</dd></div>
      <div v-if="liq.motivo_anulacion"><dt>Motivo de la anulación</dt><dd>{{ liq.motivo_anulacion }}</dd></div>
    </dl>
    <div
      v-if="liq.estado === 'contabilizada'"
      class="botones"
    >
      <HudBoton
        :cargando="enviar.cargando.value"
        @click="alEnviar"
      >
        Enviar cuentas de cobro por correo
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="anulando = true"
      >
        Anular liquidación
      </HudBoton>
    </div>
    <p
      v-for="e in [enviar.error.value, verPdf.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>
    <ul
      class="lista"
      aria-label="Cuentas de cobro de la liquidación"
    >
      <li
        v-for="c in cuentas"
        :key="c.id"
      >
        <span class="crece">
          <strong>{{ c.numero }} · {{ cartera.codigo(c.bien_privado_id) }}</strong>
          <small>{{ c.referencia_pago ? `Referencia ${c.referencia_pago}` : 'Sin referencia de pago' }}</small>
        </span>
        <span class="cifra">{{ moneda(c.total) }}</span>
        <HudBoton
          variante="fantasma"
          @click="alVerPdf(c)"
        >
          PDF<span class="solo-lector"> de {{ c.numero }}</span>
        </HudBoton>
      </li>
    </ul>
    <VisorPdf
      v-if="pdf"
      :archivo="pdf.archivo.blob"
      :titulo="`Cuenta de cobro ${pdf.numero}`"
      @descargar="pdf && guardarBlob(pdf.archivo.blob, pdf.archivo.nombre)"
    />
    <ConfirmarConMotivo
      v-model:abierto="anulando"
      titulo="Anular la liquidación"
      accion="Anular liquidación"
      descripcion="Solo si no tiene pagos ni ajustes: se revierte su comprobante y los cargos de reservas vuelven a pendientes."
      :cargando="anular.cargando.value"
      :error="anular.error.value"
      @confirmar="alAnular"
    />
  </article>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

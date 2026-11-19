<script setup lang="ts">
/**
 * Detalle de una factura de venta: estado, líneas y totales; su documento electrónico (número,
 * CUFE, estado ante la DIAN, PDF dentro de la app y paquete) con sus notas; y las acciones que
 * permiten el estado y los permisos: emitir, borrar, pago a mano (sin contabilidad), anular
 * (sin factura electrónica validada), enviar a la DIAN, transcribir una de contingencia, nota
 * crédito, nota débito y aceptación tácita.
 */
import { computed, ref, watch } from 'vue'
import { type ArchivoRecibido, guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { ConceptoNotaDebito, DocumentoElectronico, FacturaVenta, MedioPagoManual } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { numeroDocumento, numeroFacturaVenta } from '@/formato/facturacion'
import { fechaCalendario, fechaHora, hoyEn, sumarDias } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import VisorPdf from '@/hud/componentes/VisorPdf.vue'
import { useEntidad } from '@/stores/entidad'
import { useTercerosConocidos } from '@/stores/terceros'
import * as api from '../api'
import {
  accionesFactura,
  CLASIFICACION,
  CONCEPTO_NOTA_DEBITO,
  documentoDeFactura,
  ESTADO_DOCUMENTO,
  ESTADO_FACTURA,
  MEDIO_PAGO,
  notasDe,
  TIPO_DOCUMENTO_ELECTRONICO,
} from '../reglas'
import AvisoSimulado from './AvisoSimulado.vue'

const props = defineProps<{ facturaId: string }>()
const emit = defineEmits<{ borrada: [] }>()

const entidad = useEntidad()
const terceros = useTercerosConocidos()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const factura = ref<FacturaVenta | null>(null)
const documentos = ref<DocumentoElectronico[]>([])
const resultado = ref<string | null>(null)
const pdf = ref<ArchivoRecibido | null>(null)

const documento = computed(() => documentoDeFactura(documentos.value, props.facturaId))
const notas = computed(() => notasDe(documentos.value, documento.value?.id ?? null))
const acciones = computed(() =>
  factura.value
    ? accionesFactura(factura.value, documento.value, {
        gestionar: entidad.tienePermiso('facturacion.facturas.gestionar'),
        emitir: entidad.tienePermiso('facturacion.emitir'),
        electronica: entidad.tieneModulo('facturacion_electronica'),
        contabilidad: entidad.tieneModulo('contabilidad'),
        hoy: hoyEn(zona.value),
      })
    : [],
)
const puede = (a: (typeof acciones.value)[number]) => acciones.value.includes(a)
const conContabilidad = computed(() => entidad.tieneModulo('contabilidad'))

// Diálogos
const pago = ref({ abierto: false, fecha: '', medio: 'transferencia' as MedioPagoManual, referencia: '' })
const anulando = ref(false)
const acreditando = ref(false)
const contingencia = ref({ abierto: false, numero: '' })
const debito = ref({ abierto: false, concepto: 'intereses' as ConceptoNotaDebito, motivo: '', fecha: '', vencimiento: '', valor: '' })
const opcionesMedio = (Object.keys(MEDIO_PAGO) as MedioPagoManual[]).map((valor) => ({ valor, etiqueta: MEDIO_PAGO[valor] }))
const opcionesConcepto = (Object.keys(CONCEPTO_NOTA_DEBITO) as ConceptoNotaDebito[]).map((valor) => ({ valor, etiqueta: CONCEPTO_NOTA_DEBITO[valor] }))

const emitir = useAccion(() => api.emitirFactura(id.value, props.facturaId), { alConflicto: () => cargar() })
const borrar = useAccion(() => api.borrarFactura(id.value, props.facturaId))
const pagar = useAccion(() =>
  api.pagarFactura(id.value, props.facturaId, { fecha: pago.value.fecha, medio: pago.value.medio, referencia: pago.value.referencia.trim() || null }),
)
const anular = useAccion((_c, motivo: string) => api.anularFactura(id.value, props.facturaId, motivo), { alConflicto: () => cargar() })
const electronica = useAccion(() => api.facturaElectronica(id.value, props.facturaId))
const reintentar = useAccion(() => api.reintentarDocumento(id.value, documento.value?.id ?? ''))
const transcribir = useAccion(() => api.transcribirContingencia(id.value, props.facturaId, Number(contingencia.value.numero)))
const credito = useAccion((_c, motivo: string) => api.notaCredito(id.value, props.facturaId, motivo))
const notaDebito = useAccion(() =>
  api.notaDebito(id.value, props.facturaId, {
    concepto: debito.value.concepto,
    motivo: debito.value.motivo.trim(),
    fecha: debito.value.fecha,
    vencimiento: debito.value.vencimiento,
    lineas: [{ descripcion: debito.value.motivo.trim(), cantidad: '1', valor_unitario: debito.value.valor, tarifa_iva: '0', clasificacion: 'otra' }],
  }),
)
const tacita = useAccion(() => api.aceptacionTacita(id.value, documento.value?.id ?? ''))
const verPdf = useAccion((_c, d: DocumentoElectronico) => api.pdfDocumento(id.value, d.id))
const paquete = useAccion((_c, d: DocumentoElectronico) => api.paqueteDocumento(id.value, d.id))

const errores = computed(() =>
  [emitir, borrar, electronica, reintentar, tacita, verPdf, paquete].map((a) => a.error.value).filter((e): e is string => !!e),
)
const errorContingencia = computed(() => (contingencia.value.numero && !/^\d+$/.test(contingencia.value.numero) ? 'Escriba solo el número de la factura de papel.' : null))

async function hecho(texto: string, recargar = true) {
  resultado.value = texto
  if (recargar) await cargar(false)
}

async function alEmitir() {
  const r = await emitir.ejecutar()
  if (r.ok) await hecho(`Factura emitida con el número ${numeroFacturaVenta(r.valor)}.`)
}

async function alBorrar() {
  if ((await borrar.ejecutar()).ok) emit('borrada')
}

function abrirPago() {
  pago.value = { abierto: true, fecha: hoyEn(zona.value), medio: 'transferencia', referencia: '' }
}

async function alPagar() {
  if ((await pagar.ejecutar()).ok) {
    pago.value.abierto = false
    await hecho('Pago registrado: la factura quedó pagada.')
  }
}

async function alAnular(motivo: string) {
  if ((await anular.ejecutar(motivo)).ok) {
    anulando.value = false
    await hecho('Factura anulada.')
  }
}

async function alEnviar() {
  const r = await electronica.ejecutar()
  if (r.ok) await hecho(`Documento ${numeroDocumento(r.valor)}: ${ESTADO_DOCUMENTO[r.valor.estado].texto.toLowerCase()}.`)
}

async function alReintentar() {
  const r = await reintentar.ejecutar()
  if (r.ok) await hecho(`Reintento hecho: ${ESTADO_DOCUMENTO[r.valor.estado].texto.toLowerCase()}.`)
}

async function alTranscribir() {
  if (errorContingencia.value || !contingencia.value.numero) return
  const r = await transcribir.ejecutar()
  if (r.ok) {
    contingencia.value.abierto = false
    await hecho(`Factura de contingencia transcrita como ${numeroDocumento(r.valor)}.`)
  }
}

async function alAcreditar(motivo: string) {
  const r = await credito.ejecutar(motivo)
  if (r.ok) {
    acreditando.value = false
    await hecho(`Nota crédito ${numeroDocumento(r.valor)} emitida: la factura quedó anulada.`)
  }
}

function abrirDebito() {
  const hoy = hoyEn(zona.value)
  debito.value = { abierto: true, concepto: 'intereses', motivo: '', fecha: hoy, vencimiento: sumarDias(hoy, 30), valor: '' }
}

async function alDebitar() {
  const r = await notaDebito.ejecutar()
  if (r.ok) {
    debito.value.abierto = false
    await hecho(`Nota débito ${numeroDocumento(r.valor)} emitida: aparece debajo de la factura.`)
  }
}

async function alTacita() {
  const r = await tacita.ejecutar()
  if (r.ok) await hecho(r.valor.estado === 'rechazado' ? 'La DIAN rechazó la aceptación tácita.' : 'Aceptación tácita registrada ante la DIAN.', false)
}

async function alVerPdf(d: DocumentoElectronico) {
  const r = await verPdf.ejecutar(d)
  if (r.ok) pdf.value = r.valor
}

async function alPaquete(d: DocumentoElectronico) {
  const r = await paquete.ejecutar(d)
  if (r.ok) resultado.value = `Se descargó ${r.valor.nombre}.`
}

async function cargar(conEspera = true) {
  if (conEspera) estado.value = 'cargando'
  try {
    const [f, docs] = await Promise.all([
      api.factura(id.value, props.facturaId),
      entidad.tieneModulo('facturacion_electronica') ? api.documentos(id.value).catch(() => []) : Promise.resolve([]),
    ])
    factura.value = f
    documentos.value = docs
    void terceros.resolver(id.value, [f.persona_id])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(
  () => props.facturaId,
  () => {
    resultado.value = null
    pdf.value = null
    void cargar()
  },
  { immediate: true },
)
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
    @reintentar="cargar()"
  />
  <article
    v-else-if="factura"
    class="campos"
    :aria-label="`Factura ${numeroFacturaVenta(factura)}`"
  >
    <header class="encabezado">
      <div>
        <h2>{{ factura.nota_debito_de ? 'Nota débito' : 'Factura' }} {{ numeroFacturaVenta(factura) }}</h2>
        <p class="texto-2">
          {{ terceros.nombre(factura.persona_id, 'Cliente') }} · {{ factura.descripcion }}
        </p>
      </div>
      <HudInsignia :tono="ESTADO_FACTURA[factura.estado].tono">
        {{ ESTADO_FACTURA[factura.estado].texto }}
      </HudInsignia>
    </header>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-for="e in errores"
      :key="e"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>

    <dl class="datos">
      <div><dt>Fecha</dt><dd>{{ fechaCalendario(factura.fecha) }}</dd></div>
      <div><dt>Vence</dt><dd>{{ fechaCalendario(factura.vencimiento) }}</dd></div>
      <div><dt>Subtotal</dt><dd class="cifra">{{ moneda(factura.subtotal) }}</dd></div>
      <div><dt>IVA</dt><dd class="cifra">{{ moneda(factura.iva) }}</dd></div>
      <div><dt>Total</dt><dd class="cifra"><strong>{{ moneda(factura.total) }}</strong></dd></div>
      <div><dt>Pagado</dt><dd class="cifra">{{ moneda(factura.pagado) }}</dd></div>
      <div v-if="factura.emitida_en"><dt>Emitida</dt><dd>{{ fechaHora(factura.emitida_en, zona) }}</dd></div>
      <div v-if="factura.concepto_nota_debito"><dt>Concepto</dt><dd>{{ CONCEPTO_NOTA_DEBITO[factura.concepto_nota_debito] }}</dd></div>
      <div v-if="factura.motivo_anulacion"><dt>Motivo de la anulación</dt><dd>{{ factura.motivo_anulacion }}</dd></div>
    </dl>

    <ul
      v-if="factura.lineas.length"
      class="lista"
      aria-label="Líneas de la factura"
    >
      <li
        v-for="(l, i) in factura.lineas"
        :key="i"
      >
        <span class="crece">
          <strong>{{ l.descripcion }}</strong>
          <small>{{ l.cantidad }} × {{ moneda(l.valor_unitario) }} · {{ CLASIFICACION[l.clasificacion] }}{{ Number(l.tarifa_iva) ? ` · IVA ${l.tarifa_iva} %` : '' }}</small>
        </span>
        <span class="cifra">{{ moneda(l.subtotal) }}</span>
      </li>
    </ul>

    <div class="botones">
      <HudBoton
        v-if="puede('emitir')"
        :cargando="emitir.cargando.value"
        @click="alEmitir"
      >
        Emitir factura
      </HudBoton>
      <HudBoton
        v-if="puede('factura_electronica')"
        :cargando="electronica.cargando.value"
        @click="alEnviar"
      >
        Enviar a la DIAN
      </HudBoton>
      <HudBoton
        v-if="puede('reintentar')"
        :cargando="reintentar.cargando.value"
        @click="alReintentar"
      >
        Reintentar el envío
      </HudBoton>
      <HudBoton
        v-if="puede('pagar')"
        variante="secundario"
        @click="abrirPago"
      >
        Registrar pago
      </HudBoton>
      <HudBoton
        v-if="puede('contingencia')"
        variante="secundario"
        @click="contingencia = { abierto: true, numero: '' }"
      >
        Transcribir de contingencia
      </HudBoton>
      <HudBoton
        v-if="puede('nota_debito')"
        variante="secundario"
        @click="abrirDebito"
      >
        Nota débito
      </HudBoton>
      <HudBoton
        v-if="puede('aceptacion_tacita')"
        variante="fantasma"
        :cargando="tacita.cargando.value"
        @click="alTacita"
      >
        Registrar aceptación tácita
      </HudBoton>
      <HudBoton
        v-if="puede('nota_credito')"
        variante="fantasma"
        @click="acreditando = true"
      >
        Anular con nota crédito
      </HudBoton>
      <HudBoton
        v-if="puede('anular')"
        variante="fantasma"
        @click="anulando = true"
      >
        Anular factura
      </HudBoton>
      <HudBoton
        v-if="puede('borrar')"
        variante="fantasma"
        :cargando="borrar.cargando.value"
        @click="alBorrar"
      >
        Borrar borrador
      </HudBoton>
    </div>
    <p
      v-if="conContabilidad && (factura.estado === 'emitida' || factura.estado === 'pagada_parcial')"
      class="texto-2"
    >
      Con contabilidad, el pago se registra con un recibo de caja en la tesorería.
    </p>

    <HudPanel
      v-if="documento"
      etiqueta="Documento electrónico"
    >
      <div class="campos">
        <AvisoSimulado :documentos="[documento]" />
        <dl class="datos">
          <div><dt>Número</dt><dd>{{ numeroDocumento(documento) }}</dd></div>
          <div>
            <dt>Estado</dt>
            <dd>
              <HudInsignia :tono="ESTADO_DOCUMENTO[documento.estado].tono">
                {{ ESTADO_DOCUMENTO[documento.estado].texto }}
              </HudInsignia>
            </dd>
          </div>
          <div><dt>Intentos</dt><dd>{{ documento.intentos }}</dd></div>
          <div v-if="documento.validado_en"><dt>Validado</dt><dd>{{ fechaHora(documento.validado_en, zona) }}</dd></div>
          <div
            v-if="documento.cufe"
            class="completo"
          >
            <dt>CUFE</dt><dd class="huella">{{ documento.cufe }}</dd>
          </div>
          <div
            v-if="documento.respuesta"
            class="completo"
          >
            <dt>Respuesta de la DIAN</dt><dd>{{ documento.respuesta }}</dd>
          </div>
        </dl>
        <p
          v-if="documento.estado === 'contingencia'"
          class="aviso"
        >
          La DIAN no respondió: el documento se reintenta solo cada 30 minutos. Puede forzarlo con «Reintentar el envío».
        </p>
        <div
          v-if="documento.numero"
          class="botones"
        >
          <HudBoton
            variante="secundario"
            :cargando="verPdf.cargando.value"
            @click="alVerPdf(documento)"
          >
            Ver PDF
          </HudBoton>
          <HudBoton
            variante="fantasma"
            :cargando="paquete.cargando.value"
            @click="alPaquete(documento)"
          >
            Descargar paquete (ZIP)
          </HudBoton>
        </div>
        <VisorPdf
          v-if="pdf"
          :archivo="pdf.blob"
          :titulo="`PDF de ${numeroDocumento(documento)}`"
          @descargar="pdf && guardarBlob(pdf.blob, pdf.nombre)"
        />
        <ul
          v-if="notas.length"
          class="lista"
          aria-label="Notas del documento"
        >
          <li
            v-for="n in notas"
            :key="n.id"
          >
            <span class="crece">
              <strong>{{ TIPO_DOCUMENTO_ELECTRONICO[n.tipo] }} {{ numeroDocumento(n) }}</strong>
              <small>{{ moneda(n.total) }} · {{ fechaHora(n.creado_en, zona) }}</small>
            </span>
            <HudInsignia :tono="ESTADO_DOCUMENTO[n.estado].tono">
              {{ ESTADO_DOCUMENTO[n.estado].texto }}
            </HudInsignia>
          </li>
        </ul>
      </div>
    </HudPanel>

    <HudDialogo
      v-model:abierto="pago.abierto"
      titulo="Registrar el pago"
    >
      <form
        id="form-pago"
        class="campos"
        novalidate
        @submit.prevent="alPagar"
      >
        <p class="texto-2">
          Marca la factura como pagada por {{ moneda(factura.total) }}.
        </p>
        <HudFecha
          v-model="pago.fecha"
          etiqueta="Fecha del pago"
        />
        <HudSelector
          v-model="pago.medio"
          etiqueta="Medio de pago"
          :opciones="opcionesMedio"
        />
        <HudCampo
          v-model="pago.referencia"
          etiqueta="Referencia (opcional)"
          ayuda="Número de la transferencia o del comprobante."
          autocompletar="off"
        />
        <p
          v-if="pagar.error.value"
          class="error"
          role="alert"
        >
          {{ pagar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="secundario"
          @click="pago.abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="form-pago"
          :cargando="pagar.cargando.value"
        >
          Registrar pago
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="contingencia.abierto"
      titulo="Transcribir una factura de contingencia"
    >
      <form
        id="form-contingencia"
        class="campos"
        novalidate
        @submit.prevent="alTranscribir"
      >
        <p class="texto-2">
          Si expidió esta factura en papel con el talonario de contingencia, transcríbala dentro de las 48 horas siguientes a superar el inconveniente.
        </p>
        <HudCampo
          v-model="contingencia.numero"
          etiqueta="Número del talonario"
          modo-entrada="numeric"
          :error="errorContingencia ?? transcribir.error.value"
        />
      </form>
      <template #acciones>
        <HudBoton
          variante="secundario"
          @click="contingencia.abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="form-contingencia"
          :cargando="transcribir.cargando.value"
        >
          Transcribir
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="debito.abierto"
      titulo="Nota débito"
    >
      <form
        id="form-debito"
        class="campos"
        novalidate
        @submit.prevent="alDebitar"
      >
        <p class="texto-2">
          Cobra un valor adicional de esta factura (intereses, gastos, cambio del valor). Se envía a la DIAN referida a la factura original.
        </p>
        <HudSelector
          v-model="debito.concepto"
          etiqueta="Concepto"
          :opciones="opcionesConcepto"
        />
        <HudCampo
          v-model="debito.motivo"
          etiqueta="Motivo"
          multilinea
          :maximo="300"
        />
        <HudCampoMonto
          v-model="debito.valor"
          etiqueta="Valor"
        />
        <HudFecha
          v-model="debito.fecha"
          etiqueta="Fecha de la nota"
        />
        <HudFecha
          v-model="debito.vencimiento"
          etiqueta="Vence"
          :minimo="debito.fecha || undefined"
        />
        <p
          v-if="notaDebito.error.value"
          class="error"
          role="alert"
        >
          {{ notaDebito.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="secundario"
          @click="debito.abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="form-debito"
          :cargando="notaDebito.cargando.value"
        >
          Emitir nota débito
        </HudBoton>
      </template>
    </HudDialogo>

    <ConfirmarConMotivo
      v-model:abierto="anulando"
      titulo="Anular la factura"
      accion="Anular factura"
      descripcion="Se anula la factura y, si se contabilizó, se revierte su comprobante."
      :cargando="anular.cargando.value"
      :error="anular.error.value"
      @confirmar="alAnular"
    />
    <ConfirmarConMotivo
      v-model:abierto="acreditando"
      titulo="Anular con nota crédito"
      accion="Emitir nota crédito"
      descripcion="La factura electrónica ya fue validada: se anula con una nota crédito que se envía a la DIAN."
      :cargando="credito.cargando.value"
      :error="credito.error.value"
      @confirmar="alAcreditar"
    />
  </article>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.completo {
  grid-column: 1 / -1;
}

.huella {
  font-family: var(--fuente-mono);
  font-size: 13px;
}
</style>

<script setup lang="ts">
/**
 * Documentos electrónicos de la entidad (facturas, notas, documentos soporte) con su estado ante
 * la DIAN, filtrables por tipo y estado. Se refresca cada 30 s con la pestaña visible. Los que
 * están por enviar o en contingencia se reintentan solos cada 30 minutos; aquí se puede forzar.
 * El PDF se ve dentro de la app.
 */
import { computed, ref, watch } from 'vue'
import { type ArchivoRecibido, guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { DocumentoElectronico, EstadoDocumentoElectronico, TipoDocumentoElectronico } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useRefresco } from '@/composables/useRefresco'
import { moneda } from '@/formato/decimales'
import { numeroDocumento } from '@/formato/facturacion'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import VisorPdf from '@/hud/componentes/VisorPdf.vue'
import { useEntidad } from '@/stores/entidad'
import { documentos as pedirDocumentos, paqueteDocumento, pdfDocumento, reintentarDocumento } from '../api'
import AvisoSimulado from '../componentes/AvisoSimulado.vue'
import { ESTADO_DOCUMENTO, TIPO_DOCUMENTO_ELECTRONICO } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const emite = computed(() => entidad.tienePermiso('facturacion.emitir'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<DocumentoElectronico[]>([])
const filtros = ref<{ tipo: TipoDocumentoElectronico | ''; estado: EstadoDocumentoElectronico | '' }>({ tipo: '', estado: '' })
const resultado = ref<string | null>(null)
const pdf = ref<{ archivo: ArchivoRecibido; documento: DocumentoElectronico } | null>(null)
const abiertoPdf = computed({ get: () => pdf.value !== null, set: (v) => !v && (pdf.value = null) })

const opcionesTipo = (Object.keys(TIPO_DOCUMENTO_ELECTRONICO) as TipoDocumentoElectronico[]).map((valor) => ({ valor, etiqueta: TIPO_DOCUMENTO_ELECTRONICO[valor] }))
const opcionesEstado = (Object.keys(ESTADO_DOCUMENTO) as EstadoDocumentoElectronico[]).map((valor) => ({ valor, etiqueta: ESTADO_DOCUMENTO[valor].texto }))
const reintentable = (d: DocumentoElectronico) => d.estado === 'por_enviar' || d.estado === 'contingencia'

const reintentar = useAccion((_c, d: DocumentoElectronico) => reintentarDocumento(id.value, d.id), { alConflicto: () => cargar() })
const verPdf = useAccion((_c, d: DocumentoElectronico) => pdfDocumento(id.value, d.id))
const paquete = useAccion((_c, d: DocumentoElectronico) => paqueteDocumento(id.value, d.id))
const errorAccion = computed(() => reintentar.error.value ?? verPdf.error.value ?? paquete.error.value)

async function alReintentar(d: DocumentoElectronico) {
  const r = await reintentar.ejecutar(d)
  if (!r.ok) return
  resultado.value = `${numeroDocumento(r.valor)}: ${ESTADO_DOCUMENTO[r.valor.estado].texto.toLowerCase()}.`
  await cargar()
}

async function alVerPdf(d: DocumentoElectronico) {
  const r = await verPdf.ejecutar(d)
  if (r.ok) pdf.value = { archivo: r.valor, documento: d }
}

async function alPaquete(d: DocumentoElectronico) {
  const r = await paquete.ejecutar(d)
  if (r.ok) resultado.value = `Se descargó ${r.valor.nombre}.`
}

async function cargar() {
  try {
    const f = filtros.value
    lista.value = await pedirDocumentos(id.value, { tipo: f.tipo || undefined, estado: f.estado || undefined })
    error.value = null
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    if (estado.value !== 'listo') estado.value = 'error'
  }
}

watch(filtros, () => {
  estado.value = 'cargando'
  void cargar()
}, { deep: true, immediate: true })
useRefresco(cargar, { cada: 30_000 })
</script>

<template>
  <section aria-labelledby="titulo-documentos">
    <header>
      <h1 id="titulo-documentos">
        Documentos electrónicos
      </h1>
      <p class="texto-2">
        Estado de cada documento ante la DIAN. Se actualiza solo cada 30 segundos.
      </p>
    </header>
    <AvisoSimulado :documentos="lista" />
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="errorAccion"
      class="error"
      role="alert"
    >
      {{ errorAccion }}
    </p>
    <div class="filtros">
      <HudSelector
        v-model="filtros.tipo"
        etiqueta="Tipo de documento"
        vacio="Todos"
        :opciones="opcionesTipo"
      />
      <HudSelector
        v-model="filtros.estado"
        etiqueta="Estado ante la DIAN"
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
      v-else-if="lista.length === 0"
      estado="vacio"
      :mensaje="filtros.tipo || filtros.estado ? 'Ningún documento coincide con los filtros.' : 'Aún no hay documentos electrónicos.'"
    />
    <ul
      v-else
      class="lista"
      aria-label="Documentos electrónicos"
    >
      <li
        v-for="d in lista"
        :key="d.id"
      >
        <span class="crece">
          <strong>{{ TIPO_DOCUMENTO_ELECTRONICO[d.tipo] }} {{ numeroDocumento(d) }}</strong>
          <small>{{ moneda(d.total) }} · {{ fechaHora(d.creado_en, entidad.zonaHoraria) }} · {{ d.intentos }} intento{{ d.intentos === 1 ? '' : 's' }}</small>
          <small v-if="d.respuesta">{{ d.respuesta }}</small>
        </span>
        <HudInsignia :tono="ESTADO_DOCUMENTO[d.estado].tono">
          {{ ESTADO_DOCUMENTO[d.estado].texto }}
        </HudInsignia>
        <span class="botones">
          <HudBoton
            v-if="emite && reintentable(d)"
            variante="secundario"
            :cargando="reintentar.cargando.value"
            @click="alReintentar(d)"
          >
            Reintentar<span class="solo-lector"> {{ numeroDocumento(d) }}</span>
          </HudBoton>
          <HudBoton
            v-if="d.numero"
            variante="fantasma"
            @click="alVerPdf(d)"
          >
            Ver PDF<span class="solo-lector"> de {{ numeroDocumento(d) }}</span>
          </HudBoton>
          <HudBoton
            v-if="d.numero"
            variante="fantasma"
            @click="alPaquete(d)"
          >
            ZIP<span class="solo-lector"> de {{ numeroDocumento(d) }}</span>
          </HudBoton>
        </span>
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="abiertoPdf"
      :titulo="pdf ? `PDF de ${numeroDocumento(pdf.documento)}` : 'PDF'"
    >
      <VisorPdf
        v-if="pdf"
        :archivo="pdf.archivo.blob"
        :titulo="`PDF de ${numeroDocumento(pdf.documento)}`"
        @descargar="pdf && guardarBlob(pdf.archivo.blob, pdf.archivo.nombre)"
      />
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

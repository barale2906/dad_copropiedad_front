<script setup lang="ts">
/** Certificado de retenciones de un proveedor en un rango: ver, descargar el PDF y enviarlo a su correo. */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CertificadoRetencion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { useEntidad } from '@/stores/entidad'
import { certificado, certificadoPdf, enviarCertificado } from '../api'
import { IMPUESTO } from '../reglas'
import ElegirTercero from './ElegirTercero.vue'

const props = defineProps<{ entidadId: string }>()

const entidad = useEntidad()
const hoy = hoyEn(entidad.zonaHoraria)
const proveedor = ref<OpcionPersona | null>(null)
const desde = ref(`${Number(hoy.slice(0, 4)) - 1}-01-01`)
const hasta = ref(`${Number(hoy.slice(0, 4)) - 1}-12-31`)
const estado = ref<'inicio' | 'cargando' | 'listo' | 'error'>('inicio')
const error = ref<string | null>(null)
const cert = ref<CertificadoRetencion | null>(null)
const resultado = ref<string | null>(null)
const rango = computed(() => ({ desde: desde.value, hasta: hasta.value }))
const filas = computed(() => (cert.value?.filas ?? []).map((f, i) => ({ ...f, clave: String(i), impuestoTexto: IMPUESTO[f.impuesto] })))
const COLUMNAS = [
  { clave: 'impuestoTexto', titulo: 'Impuesto' },
  { clave: 'concepto', titulo: 'Concepto' },
  { clave: 'tarifa', titulo: 'Tarifa', alinear: 'fin' as const },
  { clave: 'base', titulo: 'Base', alinear: 'fin' as const },
  { clave: 'valor', titulo: 'Retenido', alinear: 'fin' as const },
]

const pdf = useAccion(() => certificadoPdf(props.entidadId, proveedor.value?.id ?? '', rango.value))
const enviar = useAccion(() => enviarCertificado(props.entidadId, proveedor.value?.id ?? '', rango.value))

async function alEnviar() {
  const r = await enviar.ejecutar()
  if (r.ok) resultado.value = `Certificado enviado a ${r.valor.para}.`
}

async function cargar() {
  resultado.value = null
  if (!proveedor.value) {
    estado.value = 'inicio'
    return
  }
  estado.value = 'cargando'
  try {
    cert.value = await certificado(props.entidadId, proveedor.value.id, rango.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([proveedor, desde, hasta], () => void cargar())
</script>

<template>
  <div class="campos">
    <ElegirTercero
      v-model="proveedor"
      :entidad-id="entidadId"
      etiqueta="Proveedor"
    />
    <div class="filtros">
      <HudFecha
        v-model="desde"
        etiqueta="Desde"
      />
      <HudFecha
        v-model="hasta"
        etiqueta="Hasta"
      />
    </div>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudEstado
      v-if="estado === 'inicio'"
      estado="vacio"
      mensaje="Elija el proveedor para ver su certificado."
    />
    <HudEstado
      v-else-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <template v-else-if="cert">
      <p class="texto-2">
        {{ cert.entidad }}{{ cert.entidad_nit ? ` (NIT ${cert.entidad_nit})` : '' }} certifica las retenciones practicadas a {{ cert.tercero }}{{ cert.tercero_documento ? ` (${cert.tercero_documento})` : '' }}
        del {{ fechaCalendario(cert.desde) }} al {{ fechaCalendario(cert.hasta) }}.
      </p>
      <HudEstado
        v-if="!filas.length"
        estado="vacio"
        mensaje="No hubo retenciones en el rango."
      />
      <HudTabla
        v-else
        :filas="filas"
        :columnas="COLUMNAS"
        clave="clave"
        titulo="Retenciones certificadas"
      >
        <template #celda-tarifa="{ fila }">
          <span class="cifra">{{ fila.tarifa }} %</span>
        </template>
        <template #celda-base="{ fila }">
          <span class="cifra">{{ moneda(fila.base) }}</span>
        </template>
        <template #celda-valor="{ fila }">
          <span class="cifra">{{ moneda(fila.valor) }}</span>
        </template>
      </HudTabla>
      <p class="texto-2 cifra">
        Base {{ moneda(cert.total_base) }} · retenido {{ moneda(cert.total_retenido) }}
      </p>
      <div class="botones">
        <HudBoton
          variante="secundario"
          :cargando="pdf.cargando.value"
          @click="pdf.ejecutar()"
        >
          Descargar el PDF
        </HudBoton>
        <HudBoton
          variante="fantasma"
          :cargando="enviar.cargando.value"
          @click="alEnviar"
        >
          Enviar al correo del proveedor
        </HudBoton>
      </div>
      <p
        v-for="e in [pdf.error.value, enviar.error.value].filter(Boolean)"
        :key="e ?? ''"
        class="error"
        role="alert"
      >
        {{ e }}
      </p>
    </template>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

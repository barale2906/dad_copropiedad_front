<script setup lang="ts">
/**
 * Compras a quien no está obligado a facturar: registrar la compra y emitir su documento
 * soporte (necesita una resolución `documento_soporte` y la dirección del vendedor). Lista los
 * documentos soporte y sus notas de ajuste; un documento validado se anula con nota de ajuste
 * (anula también la compra).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DocumentoElectronico, NuevaFacturaProveedor } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { numeroDocumento } from '@/formato/facturacion'
import { fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import { documentoSoporte, documentos as pedirDocumentos, notaAjuste, registrarCompra } from '../api'
import AvisoSimulado from '../componentes/AvisoSimulado.vue'
import FormularioCompra from '../componentes/FormularioCompra.vue'
import { ESTADO_DOCUMENTO, TIPO_DOCUMENTO_ELECTRONICO } from '../reglas'

const entidad = useEntidad()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const contabilidad = computed(() => entidad.tieneModulo('contabilidad'))
const emite = computed(() => entidad.tienePermiso('facturacion.emitir'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<DocumentoElectronico[]>([])
const registrando = ref(false)
const resultado = ref<string | null>(null)
const ajustando = ref<DocumentoElectronico | null>(null)
const abiertoAjuste = computed({ get: () => ajustando.value !== null, set: (v) => !v && (ajustando.value = null) })
const cuentas = computed(() => plan.imputables.filter((c) => /^[56]/.test(c.codigo)).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const ajustados = computed(() => new Set(lista.value.filter((d) => d.tipo === 'nota_ajuste_ds').map((d) => d.referencia_id)))

const registrar = useAccion(async (clave, datos: NuevaFacturaProveedor) => {
  const compra = await registrarCompra(id.value, datos, clave)
  return emite.value ? { compra, documento: await documentoSoporte(id.value, compra.id) } : { compra, documento: null }
})
const ajustar = useAccion((_c, d: DocumentoElectronico, motivo: string) => notaAjuste(id.value, d.origen_id, motivo))

async function alRegistrar(datos: NuevaFacturaProveedor) {
  const r = await registrar.ejecutar(datos)
  if (!r.ok) return
  registrando.value = false
  resultado.value = r.valor.documento
    ? `Compra registrada y documento soporte ${numeroDocumento(r.valor.documento)}: ${ESTADO_DOCUMENTO[r.valor.documento.estado].texto.toLowerCase()}.`
    : 'Compra registrada. Quien tenga permiso para emitir enviará su documento soporte.'
  await cargar()
}

async function alAjustar(motivo: string) {
  if (!ajustando.value) return
  const r = await ajustar.ejecutar(ajustando.value, motivo)
  if (!r.ok) return
  ajustando.value = null
  resultado.value = `Nota de ajuste ${numeroDocumento(r.valor)} emitida: la compra quedó anulada.`
  await cargar()
}

async function cargar() {
  try {
    const [soporte, ajustes] = await Promise.all([
      pedirDocumentos(id.value, { tipo: 'documento_soporte' }),
      pedirDocumentos(id.value, { tipo: 'nota_ajuste_ds' }),
      contabilidad.value ? plan.asegurar().catch(() => undefined) : Promise.resolve(),
    ])
    lista.value = [...soporte, ...ajustes].sort((a, b) => b.creado_en.localeCompare(a.creado_en))
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-compras">
    <header class="encabezado">
      <div>
        <h1 id="titulo-compras">
          Compras y documento soporte
        </h1>
        <p class="texto-2">
          Para comprar a quien no está obligado a facturar: registre la compra y se emite su documento soporte ante la DIAN.
        </p>
      </div>
      <HudBoton
        v-if="!registrando"
        @click="registrando = true"
      >
        <IMas aria-hidden="true" /> Registrar compra
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudPanel
      v-if="registrando"
      etiqueta="Compra nueva"
    >
      <FormularioCompra
        :entidad-id="id"
        :contabilidad="contabilidad"
        :cuentas="cuentas"
        :accion="emite ? 'Registrar y emitir documento soporte' : 'Registrar compra'"
        :cargando="registrar.cargando.value"
        :error="registrar.error.value"
        @guardar="alRegistrar"
        @cancelar="registrando = false"
      />
    </HudPanel>

    <AvisoSimulado :documentos="lista" />
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
      mensaje="Aún no hay documentos soporte."
    />
    <ul
      v-else
      class="lista"
      aria-label="Documentos soporte"
    >
      <li
        v-for="d in lista"
        :key="d.id"
      >
        <span class="crece">
          <strong>{{ TIPO_DOCUMENTO_ELECTRONICO[d.tipo] }} {{ numeroDocumento(d) }}</strong>
          <small>{{ moneda(d.total) }} · {{ fechaHora(d.creado_en, entidad.zonaHoraria) }}</small>
        </span>
        <HudInsignia :tono="ESTADO_DOCUMENTO[d.estado].tono">
          {{ ESTADO_DOCUMENTO[d.estado].texto }}
        </HudInsignia>
        <HudBoton
          v-if="emite && d.tipo === 'documento_soporte' && d.estado === 'validado' && !ajustados.has(d.id)"
          variante="fantasma"
          @click="ajustando = d"
        >
          Anular con nota de ajuste<span class="solo-lector"> {{ numeroDocumento(d) }}</span>
        </HudBoton>
      </li>
    </ul>

    <ConfirmarConMotivo
      v-model:abierto="abiertoAjuste"
      titulo="Anular el documento soporte"
      accion="Emitir nota de ajuste"
      descripcion="Se emite la nota de ajuste ante la DIAN y se anula la compra (con contabilidad, se revierte su comprobante)."
      :cargando="ajustar.cargando.value"
      :error="ajustar.error.value"
      @confirmar="alAjustar"
    />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

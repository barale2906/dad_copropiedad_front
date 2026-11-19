<script setup lang="ts">
/**
 * Factura electrónica recibida: datos que se leyeron del XML, registrarla como compra (queda
 * vinculada por su CUFE), rechazarla internamente y sus eventos RADIAN en orden.
 */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DetalleFacturaRecibida, NuevaFacturaProveedor, NuevoEventoRadian } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { eventoRadian, rechazarRecibida, recibida as pedirRecibida, registrarCompra, vincularRecibida } from '../api'
import { ESTADO_RECIBIDA, EVENTO_RADIAN } from '../reglas'
import FormularioCompra, { type CompraInicial } from './FormularioCompra.vue'
import LineaTiempoRadian from './LineaTiempoRadian.vue'

const props = defineProps<{ recibidaId: string }>()
const emit = defineEmits<{ cambio: [] }>()

const entidad = useEntidad()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const contabilidad = computed(() => entidad.tieneModulo('contabilidad'))
const gestiona = computed(() => entidad.tienePermiso('facturacion.facturas.gestionar'))
const recibe = computed(() => entidad.tienePermiso('facturacion.recibir'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleFacturaRecibida | null>(null)
const registrando = ref(false)
const rechazando = ref(false)
const resultado = ref<string | null>(null)

const factura = computed(() => detalle.value?.factura ?? null)
const cuentas = computed(() => plan.imputables.filter((c) => /^[56]/.test(c.codigo)).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const inicial = computed<CompraInicial | null>(() => {
  const f = factura.value
  if (!f) return null
  return {
    proveedor: f.persona_id ? { id: f.persona_id, nombre: f.emisor_nombre, detalle: `NIT ${f.emisor_nit}` } : null,
    prefijo: f.prefijo,
    numero: f.numero,
    fecha: f.fecha,
    vencimiento: f.vencimiento ?? f.fecha,
    descripcion: `Factura ${f.prefijo}${f.numero} de ${f.emisor_nombre}`,
    cufe: f.cufe,
    base: f.subtotal,
    iva: f.iva,
  }
})

const registrar = useAccion(async (clave, datos: NuevaFacturaProveedor) => {
  const compra = await registrarCompra(id.value, datos, clave)
  return vincularRecibida(id.value, props.recibidaId, compra.id)
})
const rechazar = useAccion((_c, motivo: string) => rechazarRecibida(id.value, props.recibidaId, motivo), { alConflicto: () => cargar() })
const evento = useAccion((_c, e: NuevoEventoRadian) => eventoRadian(id.value, props.recibidaId, e))

async function alRegistrar(datos: NuevaFacturaProveedor) {
  if (!(await registrar.ejecutar(datos)).ok) return
  registrando.value = false
  resultado.value = 'Factura registrada como compra y vinculada por su CUFE.'
  await cargar(false)
  emit('cambio')
}

async function alRechazar(motivo: string) {
  if (!(await rechazar.ejecutar(motivo)).ok) return
  rechazando.value = false
  resultado.value = 'Factura rechazada. Para reclamarla ante el emisor, registre el evento «Reclamo».'
  await cargar(false)
  emit('cambio')
}

async function alEvento(e: NuevoEventoRadian) {
  const r = await evento.ejecutar(e)
  if (!r.ok) return
  resultado.value = r.valor.estado === 'rechazado'
    ? `La DIAN rechazó el evento «${EVENTO_RADIAN[r.valor.tipo]}»: revise los datos y regístrelo de nuevo.`
    : `Evento «${EVENTO_RADIAN[r.valor.tipo]}» registrado ante la DIAN.`
  await cargar(false)
}

async function cargar(conEspera = true) {
  if (conEspera) estado.value = 'cargando'
  try {
    const [d] = await Promise.all([pedirRecibida(id.value, props.recibidaId), contabilidad.value ? plan.asegurar().catch(() => undefined) : Promise.resolve()])
    detalle.value = d
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(() => props.recibidaId, () => {
  resultado.value = null
  void cargar()
}, { immediate: true })
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
    v-else-if="factura && detalle"
    class="campos"
    :aria-label="`Factura recibida ${factura.prefijo}${factura.numero}`"
  >
    <header class="encabezado">
      <div>
        <h2>{{ factura.prefijo }}{{ factura.numero }} · {{ factura.emisor_nombre }}</h2>
        <p class="texto-2">
          NIT {{ factura.emisor_nit }}
        </p>
      </div>
      <HudInsignia :tono="ESTADO_RECIBIDA[factura.estado].tono">
        {{ ESTADO_RECIBIDA[factura.estado].texto }}
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
      <div><dt>Fecha</dt><dd>{{ fechaCalendario(factura.fecha) }}</dd></div>
      <div v-if="factura.vencimiento"><dt>Vence</dt><dd>{{ fechaCalendario(factura.vencimiento) }}</dd></div>
      <div><dt>Subtotal</dt><dd class="cifra">{{ moneda(factura.subtotal) }}</dd></div>
      <div><dt>IVA</dt><dd class="cifra">{{ moneda(factura.iva) }}</dd></div>
      <div><dt>Total</dt><dd class="cifra"><strong>{{ moneda(factura.total) }}</strong></dd></div>
      <div v-if="factura.motivo_rechazo"><dt>Motivo del rechazo</dt><dd>{{ factura.motivo_rechazo }}</dd></div>
    </dl>
    <p
      v-if="factura.estado === 'pendiente' && !factura.persona_id"
      class="aviso"
    >
      El NIT {{ factura.emisor_nit }} aún no es un tercero de la entidad: créelo al registrar la compra.
    </p>
    <div
      v-if="factura.estado === 'pendiente' && gestiona && !registrando"
      class="botones"
    >
      <HudBoton @click="registrando = true">
        Registrar como compra
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="rechazando = true"
      >
        Rechazar
      </HudBoton>
    </div>
    <HudPanel
      v-if="registrando && inicial"
      etiqueta="Registrar la compra"
    >
      <FormularioCompra
        :entidad-id="id"
        :inicial="inicial"
        :contabilidad="contabilidad"
        :cuentas="cuentas"
        accion="Registrar y vincular"
        :cargando="registrar.cargando.value"
        :error="registrar.error.value"
        @guardar="alRegistrar"
        @cancelar="registrando = false"
      />
    </HudPanel>

    <HudPanel etiqueta="Eventos RADIAN">
      <LineaTiempoRadian
        :eventos="detalle.eventos"
        :zona="entidad.zonaHoraria"
        :puede="recibe"
        :cargando="evento.cargando.value"
        :error="evento.error.value"
        @registrar="alEvento"
      />
    </HudPanel>

    <ConfirmarConMotivo
      v-model:abierto="rechazando"
      titulo="Rechazar la factura"
      accion="Rechazar"
      descripcion="No se registra como compra. Esto no avisa al emisor: para reclamarla ante él, registre el evento «Reclamo»."
      :cargando="rechazar.cargando.value"
      :error="rechazar.error.value"
      @confirmar="alRechazar"
    />
  </article>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

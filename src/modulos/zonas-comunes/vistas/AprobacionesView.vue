<script setup lang="ts">
/**
 * Bandeja de la administración: reservas por aprobar (aprobar / rechazar con motivo) y pagos
 * pendientes. El pago se registra a mano solo si el recurso se cobra `manual`; con `factura` se
 * ofrece «Facturar»; con `cartera` el cargo nace solo al aprobar.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DestinoCobro, Reserva } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import { aprobarReserva, facturarReserva, listarReservas, rechazarReserva, registrarPago } from '../api'
import ListaReservas from '../componentes/ListaReservas.vue'
import { admiteFactura, admitePagoManual, ordenarReservas } from '../reservas'
import { useZonasComunes } from '../store'

const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puedeFacturar = computed(() => entidad.tienePermiso('facturacion.facturas.gestionar'))

const PESTANAS = [
  { id: 'pendientes', texto: 'Por aprobar' },
  { id: 'pagos', texto: 'Pagos pendientes' },
] as const
const pestana = usePestana(PESTANAS)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const reservas = ref<Reserva[]>([])
const destinos = ref<Record<string, DestinoCobro>>({})
const elegida = ref<Reserva | null>(null)
const resultado = ref<string | null>(null)

const porAprobar = computed(() => ordenarReservas(reservas.value.filter((r) => r.estado === 'solicitada')))
const conPago = computed(() =>
  ordenarReservas(
    reservas.value.filter((r) => admitePagoManual(r, destinos.value[r.recurso_id]) || admiteFactura(r, destinos.value[r.recurso_id])),
  ),
)
const pestanasConConteo = computed(() => [
  { id: 'pendientes' as const, texto: `Por aprobar (${porAprobar.value.length})` },
  { id: 'pagos' as const, texto: `Pagos pendientes (${conPago.value.length})` },
])
const lista = computed(() => (pestana.value === 'pagos' ? conPago.value : porAprobar.value))

function reemplazar(r: Reserva) {
  reservas.value = reservas.value.map((x) => (x.id === r.id ? r : x))
}

const recargar = () => cargar()
const aprobar = useAccion((_c, r: Reserva) => aprobarReserva(id.value, r.id), { alConflicto: recargar })
const rechazar = useAccion((_c, motivo: string) => rechazarReserva(id.value, elegida.value?.id ?? '', motivo), { alConflicto: recargar })
const pagar = useAccion((_c, e: 'pagado' | 'exonerado') => registrarPago(id.value, elegida.value?.id ?? '', e))
const facturar = useAccion((_c, r: Reserva) => facturarReserva(id.value, r.id))
const errorAccion = computed(() => aprobar.error.value ?? facturar.error.value)

const rechazando = ref(false)
const pagando = ref(false)

async function ejecutarAprobar(r: Reserva) {
  elegida.value = r
  const x = await aprobar.ejecutar(r)
  if (!x.ok) return
  reemplazar(x.valor)
  resultado.value = `Reserva de ${r.recurso_nombre} aprobada; se avisó al solicitante.`
}

function abrirRechazo(r: Reserva) {
  elegida.value = r
  rechazar.reiniciar()
  rechazando.value = true
}

async function confirmarRechazo(motivo: string) {
  const x = await rechazar.ejecutar(motivo)
  if (!x.ok) return
  rechazando.value = false
  reemplazar(x.valor)
  resultado.value = 'Reserva rechazada; el solicitante verá el motivo.'
}

function abrirPago(r: Reserva) {
  elegida.value = r
  pagar.reiniciar()
  pagando.value = true
}

async function confirmarPago(e: 'pagado' | 'exonerado') {
  const x = await pagar.ejecutar(e)
  if (!x.ok) return
  pagando.value = false
  reemplazar(x.valor)
  resultado.value = e === 'pagado' ? 'Pago registrado.' : 'Reserva exonerada del pago.'
}

async function ejecutarFactura(r: Reserva) {
  elegida.value = r
  const x = await facturar.ejecutar(r)
  if (x.ok) resultado.value = 'Factura creada en borrador: emítala desde Facturación.'
}

/** Cómo se cobra cada recurso de las reservas cargadas (decide pago o factura). */
watch(reservas, async (lista) => {
  for (const recursoId of new Set(lista.map((r) => r.recurso_id))) {
    if (destinos.value[recursoId]) continue
    const c = await zonas.cobroDe(id.value, recursoId)
    if (c) destinos.value = { ...destinos.value, [recursoId]: c.destino }
  }
})

async function cargar() {
  estado.value = 'cargando'
  try {
    reservas.value = await listarReservas(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section
    class="aprobaciones"
    aria-labelledby="titulo-aprobaciones"
  >
    <header>
      <h1 id="titulo-aprobaciones">
        Aprobar reservas
      </h1>
    </header>

    <HudPestanas
      :pestanas="pestanasConConteo"
      etiqueta="Bandejas de reservas"
    />

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
      :mensaje="pestana === 'pagos' ? 'No hay pagos pendientes por registrar.' : 'No hay reservas por aprobar.'"
    />
    <ListaReservas
      v-else
      :reservas="lista"
      :titulo="pestana === 'pagos' ? 'Reservas con pago pendiente' : 'Reservas por aprobar'"
    >
      <template #acciones="{ fila }">
        <template v-if="pestana === 'pendientes'">
          <HudBoton
            variante="secundario"
            :cargando="aprobar.cargando.value && elegida?.id === fila.id"
            @click="ejecutarAprobar(fila)"
          >
            Aprobar<span class="solo-lector"> la reserva de {{ fila.bien_codigo }}</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="abrirRechazo(fila)"
          >
            Rechazar<span class="solo-lector"> la reserva de {{ fila.bien_codigo }}</span>
          </HudBoton>
        </template>
        <template v-else>
          <HudBoton
            v-if="admitePagoManual(fila, destinos[fila.recurso_id])"
            variante="secundario"
            @click="abrirPago(fila)"
          >
            Registrar pago<span class="solo-lector"> de {{ fila.bien_codigo }}</span>
          </HudBoton>
          <HudBoton
            v-if="puedeFacturar && admiteFactura(fila, destinos[fila.recurso_id])"
            variante="secundario"
            :cargando="facturar.cargando.value && elegida?.id === fila.id"
            @click="ejecutarFactura(fila)"
          >
            Facturar<span class="solo-lector"> la reserva de {{ fila.bien_codigo }}</span>
          </HudBoton>
        </template>
      </template>
    </ListaReservas>

    <ConfirmarConMotivo
      v-model:abierto="rechazando"
      titulo="Rechazar la reserva"
      accion="Rechazar"
      descripcion="El solicitante recibirá el motivo."
      :cargando="rechazar.cargando.value"
      :error="rechazar.error.value"
      @confirmar="confirmarRechazo"
    />

    <HudDialogo
      v-model:abierto="pagando"
      titulo="Registrar el pago"
    >
      <p>¿El solicitante pagó la reserva, o la administración decidió exonerarlo?</p>
      <p
        v-if="pagar.error.value"
        class="error"
        role="alert"
      >
        {{ pagar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="pagando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          variante="secundario"
          :cargando="pagar.cargando.value"
          @click="confirmarPago('exonerado')"
        >
          Exonerar
        </HudBoton>
        <HudBoton
          :cargando="pagar.cargando.value"
          @click="confirmarPago('pagado')"
        >
          Pagó
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.aprobaciones {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.ok,
.error {
  margin: 0;
}

.ok {
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  color: var(--magenta);
}
</style>

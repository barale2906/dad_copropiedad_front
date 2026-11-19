<script setup lang="ts">
/**
 * Mis reservas (móvil primero): las propias, de la más próxima a la más lejana, con cancelar.
 * Antes de cancelar avisa la penalidad si ya pasó el plazo sin costo (la aplica el backend).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Reserva } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, moneda } from '@/formato/decimales'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/calendar-plus'
import { cancelarReserva, listarReservas } from '../api'
import ListaReservas from '../componentes/ListaReservas.vue'
import { accionesDeReserva, ordenarReservas, penalidadAlCancelar } from '../reservas'
import { useZonasComunes } from '../store'

const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const reservas = ref<Reserva[]>([])
const elegida = ref<Reserva | null>(null)
const cancelando = ref(false)
const resultado = ref<string | null>(null)

const ordenadas = computed(() => ordenarReservas(reservas.value))
const penalidad = computed(() => {
  const r = elegida.value
  const p = r ? zonas.recurso(r.recurso_id)?.politica : null
  return r && p ? penalidadAlCancelar(r, p) : null
})
const aviso = computed(() =>
  penalidad.value
    ? `Ya pasó el plazo para cancelar sin costo: se cobrará una penalidad de ${moneda(penalidad.value)}.`
    : 'La franja quedará libre para otros residentes.',
)

const cancelar = useAccion((_c, motivo: string) => cancelarReserva(id.value, elegida.value?.id ?? '', motivo), {
  alConflicto: () => cargar(),
})

function abrirCancelar(r: Reserva) {
  elegida.value = r
  cancelar.reiniciar()
  cancelando.value = true
}

async function confirmarCancelacion(motivo: string) {
  const r = await cancelar.ejecutar(motivo)
  if (!r.ok) return
  cancelando.value = false
  reservas.value = reservas.value.map((x) => (x.id === r.valor.id ? r.valor : x))
  resultado.value = comparar(r.valor.penalidad, '0') > 0
    ? `Reserva cancelada con una penalidad de ${moneda(r.valor.penalidad)}.`
    : 'Reserva cancelada.'
}

async function cargar() {
  estado.value = 'cargando'
  try {
    const [lista] = await Promise.all([listarReservas(id.value, { mias: true }), zonas.asegurarRecursos(id.value)])
    reservas.value = lista
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
    class="mis-reservas"
    aria-labelledby="titulo-mis-reservas"
  >
    <header class="encabezado">
      <h1 id="titulo-mis-reservas">
        Mis reservas
      </h1>
      <HudBoton :a="{ name: 'modulo', params: { ...$route.params, accion: 'reservar' } }">
        <IMas aria-hidden="true" /> Reservar
      </HudBoton>
    </header>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
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
      v-else-if="reservas.length === 0"
      estado="vacio"
      mensaje="Aún no tiene reservas."
    />
    <ListaReservas
      v-else
      :reservas="ordenadas"
      titulo="Mis reservas"
      :mostrar-bien="false"
    >
      <template #acciones="{ fila }">
        <HudBoton
          v-if="accionesDeReserva(fila.estado).includes('cancelar')"
          variante="fantasma"
          @click="abrirCancelar(fila)"
        >
          Cancelar<span class="solo-lector"> la reserva de {{ fila.recurso_nombre }}</span>
        </HudBoton>
      </template>
    </ListaReservas>

    <ConfirmarConMotivo
      v-model:abierto="cancelando"
      titulo="Cancelar la reserva"
      accion="Cancelar reserva"
      :descripcion="aviso"
      :cargando="cancelar.cargando.value"
      :error="cancelar.error.value"
      @confirmar="confirmarCancelacion"
    />
  </section>
</template>

<style scoped>
.mis-reservas {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.ok {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}
</style>

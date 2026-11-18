<script setup lang="ts">
/**
 * Entregas y recibos del día (portería o administración): entregar la zona (→ en curso),
 * recibirla (→ finalizada, o con novedad si se reporta novedad o daños, con fotos) y marcar
 * que el solicitante no asistió.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Reserva } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { aUtc, hoyEn, sumarDias } from '@/formato/fechas'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { entregarReserva, listarReservas, noAsistio, recibirReserva } from '../api'
import ListaReservas from '../componentes/ListaReservas.vue'
import { accionesDeReserva, ordenarReservas } from '../reservas'
import { useZonasComunes } from '../store'

type Paso = 'entregar' | 'recibir' | 'no_asistio'

const entidad = useEntidad()
const zonas = useZonasComunes()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const dia = ref(hoyEn(zona.value))
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const reservas = ref<Reserva[]>([])
const resultado = ref<string | null>(null)

const elegida = ref<Reserva | null>(null)
const paso = ref<Paso | null>(null)
const abierto = computed({
  get: () => paso.value !== null,
  set: (si: boolean) => {
    if (!si) paso.value = null
  },
})
const novedad = ref('')
const danos = ref('')
const fotos = useAdjuntos(id, 'interno')

const visibles = computed(() => ordenarReservas(reservas.value.filter((r) => r.estado !== 'rechazada' && r.estado !== 'cancelada')))
const TITULOS: Record<Paso, string> = { entregar: 'Entregar la zona', recibir: 'Recibir la zona', no_asistio: 'No asistió' }

const accion = useAccion((_c, p: Paso) => {
  const r = elegida.value?.id ?? ''
  const datos = { fotos: fotos.ids(), novedad: novedad.value.trim() || null, valor_danos: danos.value || null }
  if (p === 'entregar') return entregarReserva(id.value, r, datos)
  if (p === 'recibir') return recibirReserva(id.value, r, datos)
  return noAsistio(id.value, r)
}, { alConflicto: () => cargar() })

function abrir(r: Reserva, p: Paso) {
  elegida.value = r
  novedad.value = danos.value = ''
  fotos.limpiar()
  accion.reiniciar()
  paso.value = p
}

async function confirmar() {
  const p = paso.value
  if (!p) return
  const r = await accion.ejecutar(p)
  if (!r.ok) return
  reservas.value = reservas.value.map((x) => (x.id === r.valor.id ? r.valor : x))
  paso.value = null
  const nombre = zonas.nombreRecurso(r.valor.recurso_id)
  resultado.value =
    p === 'entregar'
      ? `${nombre} entregada.`
      : p === 'no_asistio'
        ? 'Se registró que el solicitante no asistió.'
        : r.valor.estado === 'con_novedad'
          ? `${nombre} recibida con novedad: la administración la revisará.`
          : `${nombre} recibida sin novedad.`
}

async function cargar() {
  estado.value = 'cargando'
  try {
    const [lista] = await Promise.all([
      listarReservas(id.value, { desde: aUtc(`${dia.value}T00:00`, zona.value), hasta: aUtc(`${sumarDias(dia.value, 1)}T00:00`, zona.value) }),
      zonas.asegurarRecursos(id.value),
    ])
    reservas.value = lista
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(dia, cargar)
onMounted(cargar)
</script>

<template>
  <section
    class="entregas"
    aria-labelledby="titulo-entregas"
  >
    <header class="encabezado">
      <h1 id="titulo-entregas">
        Entregas y recibos
      </h1>
      <HudFecha
        v-model="dia"
        etiqueta="Día"
      />
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
      v-else-if="visibles.length === 0"
      estado="vacio"
      mensaje="No hay reservas para ese día."
    />
    <ListaReservas
      v-else
      :reservas="visibles"
      titulo="Reservas del día"
    >
      <template #acciones="{ fila }">
        <HudBoton
          v-if="accionesDeReserva(fila.estado).includes('entregar')"
          variante="secundario"
          @click="abrir(fila, 'entregar')"
        >
          Entregar<span class="solo-lector"> {{ zonas.nombreRecurso(fila.recurso_id) }}</span>
        </HudBoton>
        <HudBoton
          v-if="accionesDeReserva(fila.estado).includes('recibir')"
          variante="secundario"
          @click="abrir(fila, 'recibir')"
        >
          Recibir<span class="solo-lector"> {{ zonas.nombreRecurso(fila.recurso_id) }}</span>
        </HudBoton>
        <HudBoton
          v-if="accionesDeReserva(fila.estado).includes('no_asistio')"
          variante="fantasma"
          @click="abrir(fila, 'no_asistio')"
        >
          No asistió<span class="solo-lector"> a {{ zonas.nombreRecurso(fila.recurso_id) }}</span>
        </HudBoton>
      </template>
    </ListaReservas>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="paso ? TITULOS[paso] : ''"
    >
      <form
        id="formulario-entrega"
        class="campos"
        @submit.prevent="confirmar"
      >
        <p v-if="elegida">
          {{ zonas.nombreRecurso(elegida.recurso_id) }} · {{ bienes.codigo(elegida.bien_privado_id) }}
        </p>
        <template v-if="paso !== 'no_asistio'">
          <HudCampo
            v-model="novedad"
            :etiqueta="paso === 'recibir' ? 'Novedad (si la hubo)' : 'Observación (opcional)'"
            multilinea
            :ayuda="paso === 'recibir' ? 'Si reporta novedad o daños, la reserva queda «con novedad».' : undefined"
          />
          <HudCampoMonto
            v-if="paso === 'recibir'"
            v-model="danos"
            etiqueta="Valor de los daños (opcional)"
          />
          <div>
            <p class="rotulo-fotos">
              Fotos
            </p>
            <HudAdjuntos
              :adjuntos="fotos.adjuntos.value"
              acepta="image/*"
              :subiendo="fotos.subiendo.value"
              @subir="fotos.subir"
              @abrir="fotos.abrir"
              @quitar="fotos.quitar"
            />
            <p
              v-if="fotos.error.value"
              class="error"
              role="alert"
            >
              {{ fotos.error.value }}
            </p>
          </div>
        </template>
        <p v-else>
          Se registrará que nadie se presentó a usar la zona reservada.
        </p>
        <p
          v-if="accion.error.value"
          class="error"
          role="alert"
        >
          {{ accion.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-entrega"
          :cargando="accion.cargando.value"
          :deshabilitado="fotos.subiendo.value"
        >
          Confirmar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.entregas,
.campos {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.campos p,
.ok,
.error {
  margin: 0;
}

.rotulo-fotos {
  margin-bottom: 6px;
  color: var(--texto-2);
  font-size: 14px;
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

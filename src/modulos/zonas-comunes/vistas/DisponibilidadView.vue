<script setup lang="ts">
/** Disponibilidad: franjas libres de un recurso por semana, de solo lectura. */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { FranjaLibre } from '@/api/tipos'
import { hoyEn } from '@/formato/fechas'
import { dias } from '@/formato/franjas'
import CalendarioFranjas from '@/hud/componentes/CalendarioFranjas.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IAnterior from '~icons/tabler/chevron-left'
import ISiguiente from '~icons/tabler/chevron-right'
import { disponibilidad } from '../api'
import { ESTADO_RECURSO } from '../recursos'
import { useZonasComunes } from '../store'

const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const recursoId = ref('')
const semana = ref(0)
const franjas = ref<FranjaLibre[]>([])
const cargando = ref(false)

const opciones = computed(() =>
  zonas.recursos.filter((r) => r.tipo !== 'parqueadero' || r.parqueadero?.naturaleza === 'visitantes').map((r) => ({ valor: r.id, etiqueta: r.nombre })),
)
const recurso = computed(() => zonas.recurso(recursoId.value))
const diasSemana = computed(() => dias(hoyEn(zona.value), (semana.value + 1) * 7).slice(semana.value * 7))

async function cargarFranjas() {
  if (!recursoId.value) return
  cargando.value = true
  error.value = null
  try {
    const d = diasSemana.value
    franjas.value = await disponibilidad(id.value, recursoId.value, d[0] ?? '', d.at(-1) ?? '')
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

watch([recursoId, semana], cargarFranjas)

async function cargar() {
  estado.value = 'cargando'
  try {
    await zonas.asegurarRecursos(id.value)
    recursoId.value = opciones.value[0]?.valor ?? ''
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
    class="disponibilidad"
    aria-labelledby="titulo-disponibilidad"
  >
    <header>
      <h1 id="titulo-disponibilidad">
        Disponibilidad
      </h1>
      <p class="texto-2">
        Franjas libres de cada zona; ya descuentan reservas, excepciones y tiempos de alistamiento.
      </p>
    </header>

    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error' && !recursoId"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <HudEstado
      v-else-if="opciones.length === 0"
      estado="vacio"
      mensaje="Aún no hay zonas registradas."
    />
    <template v-else>
      <div class="barra">
        <HudSelector
          v-model="recursoId"
          etiqueta="Zona"
          :opciones="opciones"
        />
        <div class="semana">
          <HudBoton
            variante="fantasma"
            :deshabilitado="semana === 0"
            @click="semana--"
          >
            <IAnterior aria-hidden="true" /> Anterior
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="semana++"
          >
            Siguiente <ISiguiente aria-hidden="true" />
          </HudBoton>
        </div>
      </div>
      <p
        v-if="recurso && recurso.estado !== 'disponible'"
        class="aviso"
      >
        {{ recurso.nombre }} está {{ ESTADO_RECURSO[recurso.estado].texto.toLowerCase() }}: no recibe reservas.
      </p>
      <HudEstado
        v-if="cargando"
        estado="cargando"
      />
      <HudEstado
        v-else-if="error"
        estado="error"
        :mensaje="error"
        @reintentar="cargarFranjas"
      />
      <CalendarioFranjas
        v-else
        :dias="diasSemana"
        :franjas="franjas"
        :zona="zona"
        solo-lectura
        :titulo="`Franjas libres de ${recurso?.nombre ?? 'la zona'}`"
      />
    </template>
  </section>
</template>

<style scoped>
.disponibilidad {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.barra > :first-child {
  flex: 1 1 240px;
}

.semana {
  display: flex;
  gap: 8px;
}

.aviso {
  margin: 0;
  color: var(--ambar);
}
</style>

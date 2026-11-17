<script setup lang="ts">
/**
 * Restricciones de reserva: bienes que no pueden reservar (mora o sanción), restringir uno
 * (no aplica a los bienes comunes esenciales, art. 59) y levantar. La mora automática la marca
 * la cartera cuando la PH tiene `contabilidad_ph`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Restriccion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc, fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { crearRestriccion, levantarRestriccion, listarRestricciones } from '../api'
import ElegirBien from '../componentes/ElegirBien.vue'

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const conCartera = computed(() => entidad.tieneModulo('contabilidad_ph'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Restriccion[]>([])
const resultado = ref<string | null>(null)

const COLUMNAS = [
  { clave: 'bien', titulo: 'Bien' },
  { clave: 'motivo', titulo: 'Motivo' },
  { clave: 'vigencia', titulo: 'Vigencia' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

// Restringir
const creando = ref(false)
const bienId = ref('')
const motivo = ref('')
const hasta = ref('')
const intentado = ref(false)
const crear = useAccion((clave) =>
  crearRestriccion(
    id.value,
    { bien_privado_id: bienId.value, motivo: motivo.value.trim(), hasta: hasta.value ? aUtc(`${hasta.value}T23:59`, zona.value) : null },
    clave,
  ),
)

function abrirCrear() {
  bienId.value = motivo.value = hasta.value = ''
  intentado.value = false
  crear.reiniciar()
  creando.value = true
}

async function enviar() {
  intentado.value = true
  if (!bienId.value || !motivo.value.trim()) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  lista.value = [r.valor, ...lista.value]
  resultado.value = `${bienes.codigo(r.valor.bien_privado_id)} ya no puede reservar.`
}

// Levantar
const elegida = ref<Restriccion | null>(null)
const levantando = ref(false)
const levantar = useAccion(() => levantarRestriccion(id.value, elegida.value?.id ?? ''))

function abrirLevantar(r: Restriccion) {
  elegida.value = r
  levantar.reiniciar()
  levantando.value = true
}

async function confirmarLevantar() {
  const r = elegida.value
  if (!r || !(await levantar.ejecutar()).ok) return
  levantando.value = false
  lista.value = lista.value.filter((x) => x.id !== r.id)
  resultado.value = `Se levantó la restricción de ${bienes.codigo(r.bien_privado_id)}.`
}

watch(lista, (l) => bienes.resolver(l.map((r) => r.bien_privado_id)))

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await listarRestricciones(id.value)
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
    class="restricciones"
    aria-labelledby="titulo-restricciones"
  >
    <header class="encabezado">
      <div>
        <h1 id="titulo-restricciones">
          Restricciones
        </h1>
        <p class="texto-2">
          Bienes que no pueden reservar zonas comunes. Nunca limitan los bienes esenciales (art. 59).
        </p>
        <p
          v-if="conCartera"
          class="texto-2"
        >
          La mora se marca sola desde la
          <RouterLink :to="{ name: 'modulo', params: { entidadId: id, seccion: 'cartera' } }">
            cartera
          </RouterLink>.
        </p>
      </div>
      <HudBoton @click="abrirCrear">
        <IMas aria-hidden="true" /> Restringir un bien
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
      v-else-if="lista.length === 0"
      estado="vacio"
      mensaje="Ningún bien tiene restringidas las reservas."
    />
    <HudTabla
      v-else
      :filas="lista"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Bienes con reservas restringidas"
    >
      <template #celda-bien="{ fila }">
        <strong>{{ bienes.codigo(fila.bien_privado_id) }}</strong>
      </template>
      <template #celda-vigencia="{ fila }">
        Desde {{ fecha(fila.desde, zona) }}{{ fila.hasta ? ` hasta ${fecha(fila.hasta, zona)}` : ' (indefinida)' }}
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          variante="fantasma"
          @click="abrirLevantar(fila)"
        >
          Levantar<span class="solo-lector"> la restricción de {{ bienes.codigo(fila.bien_privado_id) }}</span>
        </HudBoton>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Restringir un bien"
    >
      <div class="campos">
        <ElegirBien
          v-model="bienId"
          etiqueta="Bien"
          solo-busqueda
          :error="intentado && !bienId ? 'Elija el bien.' : null"
        />
        <form
          id="formulario-restriccion"
          class="campos"
          novalidate
          @submit.prevent="enviar"
        >
          <HudCampo
            v-model="motivo"
            etiqueta="Motivo"
            :error="intentado && !motivo.trim() ? 'Escriba el motivo (mora, sanción…).' : null"
            requerido
          />
          <HudFecha
            v-model="hasta"
            etiqueta="Hasta (opcional)"
            ayuda="Vacío = hasta que la levanten."
          />
          <p
            v-if="crear.error.value"
            class="error"
            role="alert"
          >
            {{ crear.error.value }}
          </p>
        </form>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-restriccion"
          :cargando="crear.cargando.value"
        >
          Restringir
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="levantando"
      titulo="Levantar la restricción"
    >
      <p>
        {{ elegida ? bienes.codigo(elegida.bien_privado_id) : '' }} podrá volver a reservar desde ahora.
      </p>
      <p
        v-if="levantar.error.value"
        class="error"
        role="alert"
      >
        {{ levantar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="levantando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="levantar.cargando.value"
          @click="confirmarLevantar"
        >
          Levantar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.restricciones,
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

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
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

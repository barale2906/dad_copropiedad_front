<script setup lang="ts">
/**
 * Reservar una zona común (móvil primero): elegir el recurso (o abrirlo directo desde la zona de
 * la maqueta, `?zona=`), ver sus reglas, elegir bien, duración y franja libre, y confirmar. La
 * respuesta dice si quedó confirmada o pendiente de aprobación.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { FranjaLibre, Recurso, Reserva } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora, hoyEn, horaEn } from '@/formato/fechas'
import { dias, duraciones, sumarMinutos, textoDuracion } from '@/formato/franjas'
import CalendarioFranjas from '@/hud/componentes/CalendarioFranjas.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IAnterior from '~icons/tabler/chevron-left'
import ISiguiente from '~icons/tabler/chevron-right'
import { disponibilidad, reservar } from '../api'
import ElegirBien from '../componentes/ElegirBien.vue'
import { CATEGORIA, esReservable, filtroDeZona, resumenPolitica, TIPO_RECURSO } from '../recursos'
import { ESTADO_RESERVA } from '../reservas'
import { useZonasComunes } from '../store'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const zonas = useZonasComunes()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)

const filtro = computed(() => filtroDeZona(route.query.zona))
const candidatos = computed(() =>
  zonas.recursos.filter((r) => {
    if (!esReservable(r.politica)) return false
    const f = filtro.value
    if (!f) return r.tipo === 'bien_comun'
    if (f.tipo) return r.tipo === f.tipo
    return !!r.bien_comun && (f.categorias ?? []).includes(r.bien_comun.categoria)
  }),
)
const recurso = computed<Recurso | null>(() => {
  const elegido = typeof route.query.recurso === 'string' ? zonas.recurso(route.query.recurso) : null
  if (elegido) return elegido
  return candidatos.value.length === 1 ? (candidatos.value[0] ?? null) : null
})

// Formulario
const bienId = ref('')
const duracion = ref('')
const semana = ref(0)
const inicio = ref<string | null>(null)
const invitados = ref('0')
const franjas = ref<FranjaLibre[]>([])
const cargandoFranjas = ref(false)
const errorFranjas = ref<string | null>(null)
const intentado = ref(false)
/** Tras un 422 (mora, sanción, política) no se reintenta hasta que cambie algo. */
const bloqueado = ref(false)
const resultado = ref<Reserva | null>(null)

const opcionesDuracion = computed(() => {
  const p = recurso.value?.politica
  return p ? duraciones(p.duracion_minima_min, p.duracion_maxima_min, p.granularidad_min).map((d) => ({ valor: String(d), etiqueta: textoDuracion(d) })) : []
})
const maxSemana = computed(() => Math.max(0, Math.ceil((recurso.value?.politica.anticipacion_maxima_dias ?? 7) / 7) - 1))
/** Los 7 días de la semana mostrada, desde hoy (semana 0) en la zona de la PH. */
const diasSemana = computed(() => dias(hoyEn(zona.value), (semana.value + 1) * 7).slice(semana.value * 7))
const fin = computed(() => (inicio.value && duracion.value ? sumarMinutos(inicio.value, Number.parseInt(duracion.value, 10)) : null))
const errorBien = computed(() => (intentado.value && !bienId.value ? 'Elija el bien a cuyo nombre reserva.' : null))
const errorInvitados = computed(() => {
  const max = recurso.value?.politica.max_invitados ?? 0
  const n = Number.parseInt(invitados.value || '0', 10)
  return Number.isNaN(n) || n < 0 || n > max ? `Entre 0 y ${max} invitados.` : null
})

const confirmar = useAccion((clave) =>
  reservar(
    id.value,
    {
      recurso_id: recurso.value?.id ?? '',
      bien_privado_id: bienId.value,
      inicio: inicio.value ?? '',
      fin: fin.value ?? '',
      invitados: Number.parseInt(invitados.value || '0', 10),
      canal: 'web',
    },
    clave,
  ),
)

function elegirRecurso(r: Recurso) {
  router.push({ query: { ...route.query, recurso: r.id } })
}

/** Quita la zona (y el recurso) de la dirección para ver todas las zonas. */
function otraZona() {
  const query = { ...route.query }
  delete query.zona
  delete query.recurso
  router.push({ query })
}

async function cargarFranjas() {
  const r = recurso.value
  if (!r) return
  cargandoFranjas.value = true
  errorFranjas.value = null
  try {
    const d = diasSemana.value
    franjas.value = await disponibilidad(id.value, r.id, d[0] ?? '', d.at(-1) ?? '')
  } catch (e) {
    errorFranjas.value = mensajeDeError(e)
  } finally {
    cargandoFranjas.value = false
  }
}

async function enviar() {
  intentado.value = true
  if (!bienId.value || !inicio.value || errorInvitados.value || bloqueado.value) return
  const r = await confirmar.ejecutar()
  if (r.ok) {
    resultado.value = r.valor
    return
  }
  const codigo = confirmar.codigo.value
  if (codigo === 'conflicto') {
    inicio.value = null
    await cargarFranjas()
  } else if (codigo === 'validacion') {
    bloqueado.value = true
  }
}

function otraReserva() {
  resultado.value = null
  inicio.value = null
  confirmar.reiniciar()
  cargarFranjas()
}

watch(recurso, (r) => {
  semana.value = 0
  inicio.value = null
  duracion.value = r ? String(duraciones(r.politica.duracion_minima_min, r.politica.duracion_maxima_min, r.politica.granularidad_min)[0] ?? '') : ''
  resultado.value = null
  confirmar.reiniciar()
  cargarFranjas()
})
watch(semana, () => {
  inicio.value = null
  cargarFranjas()
})
watch([bienId, inicio, duracion, invitados], () => {
  bloqueado.value = false
})
watch(duracion, () => (inicio.value = null))

async function cargar() {
  estado.value = 'cargando'
  try {
    await zonas.asegurarRecursos(id.value)
    estado.value = 'listo'
    if (recurso.value) {
      const p = recurso.value.politica
      duracion.value = String(duraciones(p.duracion_minima_min, p.duracion_maxima_min, p.granularidad_min)[0] ?? '')
      await cargarFranjas()
    }
  } catch (e) {
    error.value = e instanceof ErrorApi ? mensajeDeError(e) : 'No se pudieron cargar las zonas.'
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section
    class="reservar"
    aria-labelledby="titulo-reservar"
  >
    <header>
      <h1 id="titulo-reservar">
        {{ recurso ? `Reservar: ${recurso.nombre}` : 'Reservar' }}
      </h1>
      <p
        v-if="!recurso"
        class="texto-2"
      >
        Elija la zona que quiere usar.
      </p>
    </header>

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

    <template v-else-if="!recurso">
      <HudEstado
        v-if="candidatos.length === 0"
        estado="vacio"
        :mensaje="filtro ? `Esta copropiedad no tiene ${filtro.nombre} para reservar.` : 'Aún no hay zonas comunes para reservar.'"
      >
        <HudBoton
          v-if="filtro"
          variante="secundario"
          @click="otraZona"
        >
          Ver todas las zonas
        </HudBoton>
      </HudEstado>
      <ul
        v-else
        class="recursos"
        aria-label="Zonas para reservar"
      >
        <li
          v-for="r in candidatos"
          :key="r.id"
        >
          <button
            type="button"
            class="tarjeta"
            @click="elegirRecurso(r)"
          >
            <strong>{{ r.nombre }}</strong>
            <small>{{ r.bien_comun ? CATEGORIA[r.bien_comun.categoria] : TIPO_RECURSO[r.tipo] }}{{ r.ubicacion ? ` · ${r.ubicacion}` : '' }}</small>
          </button>
        </li>
      </ul>
    </template>

    <HudPanel
      v-else-if="resultado"
      :etiqueta="ESTADO_RESERVA[resultado.estado].texto"
      resaltado
    >
      <div
        class="resultado"
        role="status"
      >
        <p v-if="resultado.estado === 'aprobada'">
          ¡Listo! Su reserva de <strong>{{ recurso.nombre }}</strong> quedó confirmada para el
          {{ fechaHora(resultado.inicio, zona) }} hasta las {{ horaEn(resultado.fin, zona) }}.
        </p>
        <p v-else>
          Su solicitud de <strong>{{ recurso.nombre }}</strong> para el {{ fechaHora(resultado.inicio, zona) }} quedó
          pendiente de aprobación. Le avisaremos cuando la administración la revise.
        </p>
      </div>
      <div class="botones">
        <HudBoton
          :a="{ name: 'modulo', params: { ...$route.params, accion: 'mis-reservas' } }"
          variante="secundario"
        >
          Ver mis reservas
        </HudBoton>
        <HudBoton
          variante="fantasma"
          @click="otraReserva"
        >
          Hacer otra reserva
        </HudBoton>
      </div>
    </HudPanel>

    <template v-else>
      <HudBoton
        v-if="candidatos.length > 1 || $route.query.recurso"
        variante="fantasma"
        @click="router.push({ query: { ...$route.query, recurso: undefined } })"
      >
        <IAnterior aria-hidden="true" /> Elegir otra zona
      </HudBoton>

      <HudPanel etiqueta="Reglas de uso">
        <ul class="reglas">
          <li
            v-for="l in resumenPolitica(recurso.politica)"
            :key="l"
          >
            {{ l }}
          </li>
        </ul>
        <details v-if="recurso.bien_comun?.reglas">
          <summary>Leer el reglamento</summary>
          <p class="reglamento">
            {{ recurso.bien_comun.reglas }}
          </p>
        </details>
      </HudPanel>

      <form
        class="formulario"
        novalidate
        @submit.prevent="enviar"
      >
        <ElegirBien
          v-model="bienId"
          etiqueta="Reserva a nombre de"
          :error="errorBien"
        />
        <HudSelector
          v-if="opcionesDuracion.length > 1"
          v-model="duracion"
          etiqueta="Duración"
          :opciones="opcionesDuracion"
        />
        <p
          v-else-if="duracion"
          class="texto-2"
        >
          Duración: {{ textoDuracion(Number.parseInt(duracion, 10)) }}
        </p>

        <div class="semana">
          <HudBoton
            variante="fantasma"
            :deshabilitado="semana === 0"
            @click="semana--"
          >
            <IAnterior aria-hidden="true" /> Semana anterior
          </HudBoton>
          <HudBoton
            variante="fantasma"
            :deshabilitado="semana >= maxSemana"
            @click="semana++"
          >
            Semana siguiente <ISiguiente aria-hidden="true" />
          </HudBoton>
        </div>
        <HudEstado
          v-if="cargandoFranjas"
          estado="cargando"
          mensaje="Buscando franjas libres…"
        />
        <HudEstado
          v-else-if="errorFranjas"
          estado="error"
          :mensaje="errorFranjas"
          @reintentar="cargarFranjas"
        />
        <CalendarioFranjas
          v-else
          v-model="inicio"
          :dias="diasSemana"
          :franjas="franjas"
          :zona="zona"
          :paso="recurso.politica.granularidad_min"
          :duracion="Number.parseInt(duracion || '0', 10)"
          titulo="Elija la hora de inicio"
        />
        <p
          v-if="intentado && !inicio"
          class="error"
          role="alert"
        >
          Elija la hora de inicio en el calendario.
        </p>

        <HudCampo
          v-if="recurso.politica.max_invitados > 0"
          v-model="invitados"
          etiqueta="Invitados"
          modo-entrada="numeric"
          :error="errorInvitados"
          :ayuda="`Hasta ${recurso.politica.max_invitados}.`"
        />

        <HudPanel
          v-if="inicio && fin"
          etiqueta="Resumen"
        >
          <p class="resumen">
            {{ recurso.nombre }}: {{ fechaHora(inicio, zona) }} – {{ horaEn(fin, zona) }}
            ({{ textoDuracion(Number.parseInt(duracion, 10)) }})
            <template v-if="bienId">
              · a nombre de {{ bienes.codigo(bienId) }}
            </template>
          </p>
          <p class="texto-2">
            {{ recurso.politica.modo === 'franja_con_aprobacion' ? 'La administración debe aprobarla.' : 'Queda confirmada al enviarla.' }}
          </p>
        </HudPanel>

        <p
          v-if="confirmar.error.value"
          class="error"
          role="alert"
        >
          {{ confirmar.error.value }}
          <template v-if="bloqueado">
            Cambie el bien o la franja para intentarlo de nuevo.
          </template>
        </p>
        <HudBoton
          tipo="submit"
          bloque
          :cargando="confirmar.cargando.value"
          :deshabilitado="bloqueado"
        >
          {{ recurso.politica.modo === 'franja_con_aprobacion' ? 'Solicitar reserva' : 'Confirmar reserva' }}
        </HudBoton>
      </form>
    </template>
  </section>
</template>

<style scoped>
.reservar,
.formulario {
  display: grid;
  gap: 16px;
}

.reservar {
  max-width: 980px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.recursos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tarjeta {
  display: grid;
  gap: 4px;
  width: 100%;
  min-height: 72px;
  padding: 14px;
  border: 1px solid var(--linea);
  background: var(--superficie);
  color: var(--texto);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tarjeta:hover,
.tarjeta:focus-visible {
  border-color: var(--cian);
  background: var(--cian-tenue);
}

small {
  color: var(--texto-3);
}

.reglas {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 18px;
}

.reglamento {
  white-space: pre-wrap;
}

summary {
  min-height: 40px;
  padding: 8px 0;
  color: var(--cian);
  cursor: pointer;
}

.semana {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.resumen,
.error,
.resultado p {
  margin: 0;
}

.error {
  color: var(--magenta);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
</style>

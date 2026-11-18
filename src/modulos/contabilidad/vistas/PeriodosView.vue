<script setup lang="ts">
/**
 * Periodos contables del año: abrir un mes, pasarlo a revisión, cerrarlo o devolverlo a abierto.
 * Un periodo cerrado se reabre con una **solicitud** que aprueba otra cuenta (cuatro ojos): quien
 * la pidió no ve los botones de aprobar.
 */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { PeriodoContable, Reapertura } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { puedeAprobar } from '@/composables/reglas'
import { fechaHora, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import IAnterior from '~icons/tabler/chevron-left'
import ISiguiente from '~icons/tabler/chevron-right'
import { abrirPeriodo, cambiarPeriodo, decidirReapertura, periodos as pedirPeriodos, reaperturas as pedirReaperturas, solicitarReapertura } from '../api'
import { type AccionPeriodo, accionesPeriodo, ESTADO_DESTINO, ESTADO_PERIODO, ESTADO_REAPERTURA, nombrePeriodo, TEXTO_ACCION_PERIODO } from '../reglas'

const entidad = useEntidad()
const cuenta = useCuenta()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const anio = ref(Number(hoyEn(zona.value).slice(0, 4)))
const q = computed(() => ({ cerrar: entidad.tienePermiso('contabilidad.periodos.cerrar'), reabrir: entidad.tienePermiso('contabilidad.periodos.reabrir') }))
const aprueba = computed(() => entidad.tienePermiso('contabilidad.periodos.aprobar_reapertura'))

const lista = ref<PeriodoContable[]>([])
const solicitudes = ref<Reapertura[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const resultado = ref<string | null>(null)

/** Los 12 meses más el de cierre anual: el periodo si existe o `null` (sin abrir). */
const meses = computed(() => Array.from({ length: 13 }, (_, k) => ({ mes: k + 1, periodo: lista.value.find((p) => p.mes === k + 1) ?? null })))
const pendientesDe = (p: PeriodoContable) => solicitudes.value.filter((s) => s.periodo_id === p.id)

const abrir = useAccion((_c, mes: number) => abrirPeriodo(id.value, anio.value, mes))
const cambiar = useAccion((_c, p: PeriodoContable, a: Exclude<AccionPeriodo, 'reabrir'>) => cambiarPeriodo(id.value, p.id, ESTADO_DESTINO[a]), { alConflicto: () => cargar() })
const decidir = useAccion((_c, s: Reapertura, aprobar: boolean) => decidirReapertura(id.value, s.id, aprobar))
const solicitar = useAccion((_c, p: PeriodoContable) => solicitarReapertura(id.value, p.id, motivo.value, alcance.value || null))
const errores = computed(() => [abrir.error.value, cambiar.error.value, decidir.error.value].filter(Boolean))

// Confirmar el cierre y pedir la reapertura
const cerrando = ref<PeriodoContable | null>(null)
const abiertoCierre = computed({ get: () => !!cerrando.value, set: (v) => !v && (cerrando.value = null) })
const reabriendo = ref<PeriodoContable | null>(null)
const abiertoReapertura = computed({ get: () => !!reabriendo.value, set: (v) => !v && (reabriendo.value = null) })
const motivo = ref('')
const alcance = ref('')

async function alAbrir(mes: number) {
  const r = await abrir.ejecutar(mes)
  if (!r.ok) return
  resultado.value = `${nombrePeriodo(r.valor)}: abierto.`
  await cargar()
}

async function hacer(p: PeriodoContable, a: AccionPeriodo) {
  if (a === 'reabrir') {
    motivo.value = alcance.value = ''
    reabriendo.value = p
    return
  }
  if (a === 'cerrar' && cerrando.value?.id !== p.id) {
    cerrando.value = p
    return
  }
  const r = await cambiar.ejecutar(p, a)
  cerrando.value = null
  if (!r.ok) return
  resultado.value = `${nombrePeriodo(r.valor)}: ${ESTADO_PERIODO[r.valor.estado].texto.toLowerCase()}.`
  await cargar()
}

async function alSolicitar() {
  if (!reabriendo.value) return
  const r = await solicitar.ejecutar(reabriendo.value)
  if (!r.ok) return
  resultado.value = `Reapertura de ${nombrePeriodo(reabriendo.value)} solicitada: la aprueba otra persona.`
  reabriendo.value = null
  await cargar()
}

async function alDecidir(s: Reapertura, aprobar: boolean) {
  const r = await decidir.ejecutar(s, aprobar)
  if (!r.ok) return
  resultado.value = aprobar ? 'Reapertura aprobada: el periodo quedó abierto.' : 'Reapertura rechazada.'
  await cargar()
}

async function cargar() {
  try {
    await cuenta.asegurar().catch(() => undefined)
    lista.value = await pedirPeriodos(id.value, anio.value)
    const cerrados = lista.value.filter((p) => p.estado === 'cerrado')
    solicitudes.value = (await Promise.all(cerrados.map((p) => pedirReaperturas(id.value, p.id)))).flat()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(anio, () => {
  estado.value = 'cargando'
  resultado.value = null
  void cargar()
}, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-periodos">
    <header class="encabezado">
      <h1 id="titulo-periodos">
        Periodos contables
      </h1>
      <div
        class="anio"
        role="group"
        aria-label="Año"
      >
        <HudBoton
          variante="fantasma"
          @click="anio--"
        >
          <IAnterior aria-hidden="true" /><span class="solo-lector">Año anterior</span>
        </HudBoton>
        <strong aria-live="polite">{{ anio }}</strong>
        <HudBoton
          variante="fantasma"
          @click="anio++"
        >
          <ISiguiente aria-hidden="true" /><span class="solo-lector">Año siguiente</span>
        </HudBoton>
      </div>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-for="e in errores"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
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
    <ul
      v-else
      class="meses"
      :aria-label="`Periodos de ${anio}`"
    >
      <li
        v-for="m in meses"
        :key="m.mes"
        :class="m.periodo?.estado ?? 'sin-abrir'"
      >
        <div class="cabeza">
          <strong>{{ nombrePeriodo({ anio, mes: m.mes }) }}</strong>
          <HudInsignia
            v-if="m.periodo"
            :tono="ESTADO_PERIODO[m.periodo.estado].tono"
          >
            {{ ESTADO_PERIODO[m.periodo.estado].texto }}
          </HudInsignia>
          <HudInsignia
            v-else
            tono="neutro"
          >
            Sin abrir
          </HudInsignia>
        </div>
        <small v-if="m.periodo?.cerrado_en">Cerrado el {{ fechaHora(m.periodo.cerrado_en, zona) }}</small>
        <div class="botones">
          <HudBoton
            v-if="!m.periodo && q.cerrar"
            variante="secundario"
            :cargando="abrir.cargando.value"
            @click="alAbrir(m.mes)"
          >
            Abrir<span class="solo-lector"> {{ nombrePeriodo({ anio, mes: m.mes }) }}</span>
          </HudBoton>
          <template v-if="m.periodo">
            <HudBoton
              v-for="a in accionesPeriodo(m.periodo.estado, q)"
              :key="a"
              :variante="a === 'cerrar' ? 'primario' : 'fantasma'"
              :cargando="cambiar.cargando.value"
              @click="m.periodo && hacer(m.periodo, a)"
            >
              {{ TEXTO_ACCION_PERIODO[a] }}<span class="solo-lector"> de {{ nombrePeriodo(m.periodo) }}</span>
            </HudBoton>
          </template>
        </div>
        <ul
          v-if="m.periodo && pendientesDe(m.periodo).length"
          class="solicitudes"
          :aria-label="`Reaperturas de ${nombrePeriodo(m.periodo)}`"
        >
          <li
            v-for="s in pendientesDe(m.periodo)"
            :key="s.id"
          >
            <HudInsignia :tono="ESTADO_REAPERTURA[s.estado].tono">
              {{ ESTADO_REAPERTURA[s.estado].texto }}
            </HudInsignia>
            <span>{{ s.motivo }}<template v-if="s.alcance"> · alcance: {{ s.alcance }}</template></span>
            <small>Solicitada el {{ fechaHora(s.solicitada_en, zona) }}{{ s.solicitada_por === cuenta.id ? ' por usted' : '' }}</small>
            <div
              v-if="s.estado === 'pendiente'"
              class="botones"
            >
              <template v-if="aprueba && puedeAprobar([s.solicitada_por], cuenta.id)">
                <HudBoton
                  :cargando="decidir.cargando.value"
                  @click="alDecidir(s, true)"
                >
                  Aprobar la reapertura
                </HudBoton>
                <HudBoton
                  variante="fantasma"
                  :cargando="decidir.cargando.value"
                  @click="alDecidir(s, false)"
                >
                  Rechazar
                </HudBoton>
              </template>
              <small v-else>La aprueba otra persona con permiso para hacerlo.</small>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="abiertoCierre"
      :titulo="`Cerrar ${cerrando ? nombrePeriodo(cerrando) : ''}`"
    >
      <p>Con el periodo cerrado no se contabiliza con fechas de ese mes. Para reabrirlo hará falta una solicitud que apruebe otra persona.</p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="cerrando = null"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="cambiar.cargando.value"
          @click="cerrando && hacer(cerrando, 'cerrar')"
        >
          Cerrar el periodo
        </HudBoton>
      </template>
    </HudDialogo>
    <HudDialogo
      v-model:abierto="abiertoReapertura"
      :titulo="`Reabrir ${reabriendo ? nombrePeriodo(reabriendo) : ''}`"
    >
      <div class="campos">
        <HudCampo
          v-model="motivo"
          etiqueta="Motivo"
          multilinea
          requerido
          ayuda="Explique por qué hay que reabrirlo (queda en la auditoría)."
        />
        <HudCampo
          v-model="alcance"
          etiqueta="Alcance (opcional)"
          ayuda="Qué se va a corregir, p. ej. «solo la causación de servicios»."
        />
        <p
          v-if="solicitar.error.value"
          class="error"
          role="alert"
        >
          {{ solicitar.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="reabriendo = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="solicitar.cargando.value"
          :deshabilitado="motivo.trim().length < 5"
          @click="alSolicitar"
        >
          Solicitar la reapertura
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./contabilidad.css"></style>
<style scoped>
.anio {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--fuente-display);
  font-size: 22px;
}

.meses {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.meses > li {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--linea);
  border-left-width: 4px;
  background: var(--superficie);
}

.meses > li.abierto {
  border-left-color: var(--verde);
}

.meses > li.en_revision {
  border-left-color: var(--ambar);
}

.cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cabeza strong::first-letter {
  text-transform: uppercase;
}

.solicitudes {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--linea);
  list-style: none;
}

.solicitudes li {
  display: grid;
  gap: 4px;
}
</style>

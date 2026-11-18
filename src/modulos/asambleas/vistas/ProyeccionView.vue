<script setup lang="ts">
/**
 * Proyección en sala: quórum, punto en curso y la votación abierta (o la última cerrada) en
 * grande, sin controles y en alto contraste, alimentada por el tablero en vivo. Un botón pone la
 * pantalla completa (desaparece en ella).
 */
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { leerEscrutinio } from '@/formato/escrutinio'
import EscrutinioPregunta from '@/hud/componentes/EscrutinioPregunta.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import MedidorQuorum from '@/hud/componentes/MedidorQuorum.vue'
import { useEntidad } from '@/stores/entidad'
import IPantalla from '~icons/tabler/maximize'
import ElegirReunion from '../componentes/ElegirReunion.vue'
import { ESTADO_REUNION, umbralQuorum } from '../reglas'
import { TEXTO_CONEXION, useTableroEnVivo } from '../useTableroEnVivo'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))

const vivo = useTableroEnVivo(() => id.value, () => reunionId.value)
const t = computed(() => vivo.tablero.value)
const enVotacion = computed(() =>
  (t.value?.preguntas_abiertas ?? []).map((x) => ({ pregunta: x.pregunta, escrutinio: leerEscrutinio(x.escrutinio), abierta: true })),
)
const ultima = computed(() => {
  const u = t.value?.ultima_cerrada
  return u ? { pregunta: u.pregunta, escrutinio: leerEscrutinio(u.escrutinio), abierta: false } : null
})
const mostradas = computed(() => (enVotacion.value.length ? enVotacion.value : ultima.value ? [ultima.value] : []))

const marco = useTemplateRef<HTMLElement>('marco')
const completa = ref(false)
const puedeCompleta = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen

function pantallaCompleta() {
  void marco.value?.requestFullscreen?.().catch(() => undefined)
}

function alCambiar() {
  completa.value = document.fullscreenElement !== null
}

onMounted(() => document.addEventListener('fullscreenchange', alCambiar))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', alCambiar))
</script>

<template>
  <section
    aria-labelledby="titulo-proyeccion"
    :class="{ proyectando: !!reunionId }"
  >
    <template v-if="reunionId">
      <div
        ref="marco"
        class="sala"
      >
        <HudEstado
          v-if="vivo.estado.value === 'cargando'"
          estado="cargando"
        />
        <HudEstado
          v-else-if="vivo.estado.value === 'error' || !t"
          estado="error"
          :mensaje="vivo.error.value ?? undefined"
          @reintentar="vivo.recargar()"
        />
        <template v-else>
          <header class="cabeza">
            <h1 id="titulo-proyeccion">
              {{ t.reunion.titulo }}
            </h1>
            <p>
              {{ ESTADO_REUNION[t.reunion.estado].texto }} · <span :class="{ en: vivo.enVivo.value }">{{ TEXTO_CONEXION[vivo.conexion.value] }}</span>
            </p>
            <HudBoton
              v-if="puedeCompleta && !completa"
              variante="fantasma"
              @click="pantallaCompleta"
            >
              <IPantalla aria-hidden="true" /> Pantalla completa
            </HudBoton>
          </header>
          <MedidorQuorum
            :porcentaje-coeficiente="t.quorum.porcentaje_coeficiente"
            :unidades-presentes="t.quorum.unidades_presentes"
            :unidades-total="t.quorum.unidades_total"
            :asistentes="t.quorum.asistentes"
            :hay-quorum="t.hay_quorum"
            :umbral="umbralQuorum(t.reunion.convocatoria)"
            grande
          />
          <p
            v-if="t.punto_en_curso"
            class="punto"
          >
            En curso: <strong>{{ t.punto_en_curso }}</strong>
          </p>
          <article
            v-for="x in mostradas"
            :key="x.pregunta.id"
            class="votacion"
            :aria-labelledby="`p-${x.pregunta.id}`"
          >
            <h2 :id="`p-${x.pregunta.id}`">
              <small>{{ x.abierta ? 'Votación abierta' : 'Última votación' }}</small>
              {{ x.pregunta.enunciado }}
            </h2>
            <EscrutinioPregunta
              v-if="x.escrutinio"
              :escrutinio="x.escrutinio"
              :reservada="x.pregunta.tipo_voto === 'reservado'"
              :abierta="x.abierta"
              :etiqueta="`Resultados de «${x.pregunta.enunciado}»`"
              grande
            />
          </article>
        </template>
      </div>
    </template>

    <template v-else>
      <h1 id="titulo-proyeccion">
        Proyección en sala
      </h1>
      <ElegirReunion
        accion="proyeccion"
        :estados="['en_registro', 'instalada', 'suspendida', 'cerrada']"
        etiqueta="Asambleas para proyectar"
        vacio="No hay asambleas en curso."
      />
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>
<style scoped>
.sala {
  display: grid;
  gap: clamp(16px, 3vw, 32px);
  padding: clamp(16px, 3vw, 40px);
  border: 1px solid var(--linea-fuerte);
  background: var(--fondo);
  color: var(--texto);
}

.sala:fullscreen {
  align-content: start;
  overflow-y: auto;
  border: 0;
}

.cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cabeza h1 {
  flex: 1 1 100%;
  font-size: clamp(28px, 5vw, 56px);
}

.cabeza p {
  margin: 0;
  color: var(--texto-2);
  font-size: clamp(16px, 2vw, 22px);
}

.en {
  color: var(--verde);
}

.punto {
  margin: 0;
  font-size: clamp(20px, 3vw, 32px);
}

.votacion {
  display: grid;
  gap: 14px;
  padding-top: 16px;
  border-top: 1px solid var(--linea-fuerte);
}

.votacion h2 {
  display: grid;
  gap: 4px;
  font-size: clamp(24px, 4vw, 44px);
}

.votacion h2 small {
  color: var(--cian);
  font-size: clamp(14px, 1.6vw, 20px);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>

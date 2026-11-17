<script setup lang="ts">
/**
 * Bandeja de propuestas de cambio del censo (las envían residentes y propietarios): ver qué
 * proponen, aprobar (crea el registro) o rechazar con motivo.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CambioCenso } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { aprobarCambio, cambiosCenso, rechazarCambio } from '../api'
import { camposDePropuesta, ESTADO_CAMBIO, TIPO_CAMBIO } from '../censo'

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<CambioCenso[]>([])
const elegido = ref<CambioCenso | null>(null)
const rechazando = ref(false)
const resultado = ref<string | null>(null)

const pendientes = computed(() => lista.value.filter((c) => c.estado === 'pendiente'))
const campos = (c: CambioCenso) => camposDePropuesta(c.datos as Record<string, unknown>)

const aprobar = useAccion((_c, c: CambioCenso) => aprobarCambio(id.value, c.id), { alConflicto: () => cargar() })
const rechazar = useAccion((_c, motivo: string) => rechazarCambio(id.value, elegido.value?.id ?? '', motivo), { alConflicto: () => cargar() })

function reemplazar(c: CambioCenso) {
  lista.value = lista.value.map((x) => (x.id === c.id ? c : x))
}

async function ejecutarAprobar(c: CambioCenso) {
  elegido.value = c
  const r = await aprobar.ejecutar(c)
  if (!r.ok) return
  reemplazar(r.valor)
  resultado.value = `${TIPO_CAMBIO[c.tipo]} de ${bienes.codigo(c.bien_privado_id)} aprobado: ya quedó en el censo.`
}

function abrirRechazo(c: CambioCenso) {
  elegido.value = c
  rechazar.reiniciar()
  rechazando.value = true
}

async function confirmarRechazo(motivo: string) {
  const r = await rechazar.ejecutar(motivo)
  if (!r.ok) return
  rechazando.value = false
  reemplazar(r.valor)
  resultado.value = 'Propuesta rechazada; quien la envió verá el motivo.'
}

watch(lista, (l) => bienes.resolver(l.map((c) => c.bien_privado_id)))

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await cambiosCenso(id.value, 'pendiente')
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
    class="cambios"
    aria-labelledby="titulo-cambios"
  >
    <header>
      <h1 id="titulo-cambios">
        Aprobar cambios del censo
      </h1>
      <p class="texto-2">
        Lo que proponen residentes y propietarios solo entra al censo cuando se aprueba.
      </p>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="aprobar.error.value"
      class="error"
      role="alert"
    >
      {{ aprobar.error.value }}
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
      v-else-if="pendientes.length === 0"
      estado="vacio"
      mensaje="No hay propuestas pendientes."
    />
    <ul
      v-else
      class="propuestas"
      aria-label="Propuestas pendientes"
    >
      <li
        v-for="c in pendientes"
        :key="c.id"
      >
        <article :aria-label="`${TIPO_CAMBIO[c.tipo]} para ${bienes.codigo(c.bien_privado_id)}`">
          <div class="cabecera">
            <strong>{{ TIPO_CAMBIO[c.tipo] }} · {{ bienes.codigo(c.bien_privado_id) }}</strong>
            <HudInsignia :tono="ESTADO_CAMBIO[c.estado].tono">
              {{ ESTADO_CAMBIO[c.estado].texto }}
            </HudInsignia>
            <small>Propuesto {{ fechaHora(c.propuesto_en, zona) }}</small>
          </div>
          <dl>
            <div
              v-for="f in campos(c)"
              :key="f.campo"
            >
              <dt>{{ f.campo }}</dt>
              <dd>{{ f.valor }}</dd>
            </div>
          </dl>
          <div class="botones">
            <HudBoton
              variante="secundario"
              :cargando="aprobar.cargando.value && elegido?.id === c.id"
              @click="ejecutarAprobar(c)"
            >
              Aprobar<span class="solo-lector"> el cambio de {{ bienes.codigo(c.bien_privado_id) }}</span>
            </HudBoton>
            <HudBoton
              variante="fantasma"
              @click="abrirRechazo(c)"
            >
              Rechazar<span class="solo-lector"> el cambio de {{ bienes.codigo(c.bien_privado_id) }}</span>
            </HudBoton>
          </div>
        </article>
      </li>
    </ul>
    <ConfirmarConMotivo
      v-model:abierto="rechazando"
      titulo="Rechazar la propuesta"
      accion="Rechazar"
      descripcion="Quien la envió verá el motivo."
      :cargando="rechazar.cargando.value"
      :error="rechazar.error.value"
      @confirmar="confirmarRechazo"
    />
  </section>
</template>

<style scoped>
.cambios {
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

.propuestas {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

article {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

small {
  color: var(--texto-3);
}

dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
  gap: 8px 16px;
  margin: 0;
}

dt {
  color: var(--texto-3);
  font-size: 13px;
}

dd {
  margin: 2px 0 0;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

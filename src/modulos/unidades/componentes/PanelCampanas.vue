<script setup lang="ts">
/**
 * Campañas de actualización del censo por WhatsApp: lanzar una (llega al responsable de cada
 * bien con teléfono), ver sus respuestas y marcar atendidas las que traen cambios.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CampanaCenso, RespuestaCampana } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { atenderRespuesta, campanas, lanzarCampana, respuestasCampana } from '../api'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const editable = computed(() => entidad.tienePermiso('censo.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<CampanaCenso[]>([])
const elegida = ref<CampanaCenso | null>(null)
const respuestas = ref<RespuestaCampana[]>([])
const resultado = ref<string | null>(null)

const COLUMNAS = [
  { clave: 'codigo', titulo: 'Bien' },
  { clave: 'respuesta', titulo: 'Respuesta' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]
const filas = computed(() => respuestas.value.map((r) => ({ ...r, id: `${r.persona_id}-${r.bien_privado_id}` })))

const lanzar = useAccion((clave) => lanzarCampana(id.value, clave))
const atender = useAccion((_c, r: RespuestaCampana) => atenderRespuesta(id.value, elegida.value?.campana.id ?? '', r.persona_id, r.bien_privado_id))

async function enviarCampana() {
  const r = await lanzar.ejecutar()
  if (!r.ok) return
  resultado.value = `Campaña enviada a ${r.valor} responsables por WhatsApp.`
  await cargar()
}

async function ver(c: CampanaCenso) {
  elegida.value = c
  respuestas.value = await respuestasCampana(id.value, c.campana.id).catch(() => [])
}

async function marcar(r: RespuestaCampana) {
  if (!(await atender.ejecutar(r)).ok) return
  respuestas.value = respuestas.value.map((x) => (x === r ? { ...x, atendida_en: new Date().toISOString() } : x))
  resultado.value = `Respuesta de ${r.codigo} atendida.`
}

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await campanas(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="campanas">
    <div
      v-if="editable"
      class="barra"
    >
      <p class="texto-2">
        Le llega la plantilla «actualizar datos» al responsable de cada bien con residentes (o al representante si nadie reside).
      </p>
      <HudBoton
        :cargando="lanzar.cargando.value"
        @click="enviarCampana"
      >
        Lanzar campaña
      </HudBoton>
    </div>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="lanzar.error.value || atender.error.value"
      class="error"
      role="alert"
    >
      {{ lanzar.error.value ?? atender.error.value }}
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
      mensaje="Aún no se han lanzado campañas."
    />
    <ul
      v-else
      class="lista"
      aria-label="Campañas"
    >
      <li
        v-for="c in lista"
        :key="c.campana.id"
      >
        <span>
          <strong>{{ fechaHora(c.campana.creada_en, zona) }}</strong> · {{ c.campana.enviados }} enviados ·
          {{ c.confirmados }} confirmaron · {{ c.con_cambios }} con cambios
        </span>
        <HudInsignia
          v-if="c.por_atender"
          tono="aviso"
        >
          {{ c.por_atender }} por atender
        </HudInsignia>
        <HudBoton
          variante="fantasma"
          @click="ver(c)"
        >
          Ver respuestas<span class="solo-lector"> de la campaña del {{ fechaHora(c.campana.creada_en, zona) }}</span>
        </HudBoton>
      </li>
    </ul>
    <HudTabla
      v-if="elegida && filas.length"
      :filas="filas"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Respuestas de la campaña"
    >
      <template #celda-codigo="{ fila }">
        <span class="celda">
          <strong>{{ fila.codigo }}</strong>
          <small>{{ fila.nombre }}</small>
        </span>
      </template>
      <template #celda-respuesta="{ fila }">
        <span class="celda">
          <HudInsignia :tono="fila.respuesta === 'confirmado' ? 'exito' : 'aviso'">
            {{ fila.respuesta === 'confirmado' ? 'Confirmó sus datos' : 'Reportó cambios' }}
          </HudInsignia>
          <small v-if="fila.detalle">{{ fila.detalle }}</small>
        </span>
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          v-if="editable && fila.respuesta === 'cambios' && !fila.atendida_en"
          variante="secundario"
          @click="marcar(fila)"
        >
          Marcar atendida<span class="solo-lector"> la respuesta de {{ fila.codigo }}</span>
        </HudBoton>
        <span
          v-else-if="fila.atendida_en"
          class="texto-2"
        >Atendida</span>
      </template>
    </HudTabla>
  </div>
</template>

<style scoped src="./panel-censo.css"></style>
<style scoped>
.campanas {
  display: grid;
  gap: 14px;
}

.barra {
  align-items: center;
  justify-content: space-between;
}

.texto-2 {
  margin: 0;
  color: var(--texto-2);
}

.lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 12px;
  border: 1px solid var(--linea);
}
</style>

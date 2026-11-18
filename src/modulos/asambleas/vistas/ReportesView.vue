<script setup lang="ts">
/**
 * Reportes de una reunión: asistencia por bien (y en CSV), participación por canal en cada
 * pregunta (con los votos en CSV) y costo estimado de WhatsApp (solo `asambleas.convocar`).
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { CanalesPregunta, CanalVoto, CostoWhatsapp, FilaAsistencia } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { coeficiente, moneda } from '@/formato/decimales'
import { fechaHora, horaEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { costoWhatsapp, descargarAsistencia, descargarVotos, participacionPorCanal, reporteAsistencia } from '../api'
import ElegirReunion from '../componentes/ElegirReunion.vue'
import { CANAL_VOTO } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })

const PESTANAS_BASE = [
  { id: 'asistencia', texto: 'Asistencia' },
  { id: 'canales', texto: 'Votos por canal' },
  { id: 'costo', texto: 'Costo de WhatsApp' },
] as const
const pestanas = computed(() => PESTANAS_BASE.filter((p) => p.id !== 'costo' || entidad.tienePermiso('asambleas.convocar')))
const pestana = usePestana(PESTANAS_BASE)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const asistencia = ref<FilaAsistencia[]>([])
const canales = ref<CanalesPregunta[]>([])
const costo = ref<CostoWhatsapp | null>(null)

const csvAsistencia = useAccion(() => descargarAsistencia(id.value, reunionId.value))
const csvVotos = useAccion((_c, pregunta: string) => descargarVotos(id.value, reunionId.value, pregunta))

const filas = computed(() =>
  asistencia.value.map((f, i) => ({
    ...f,
    clave: String(i),
    entradaTexto: f.entrada ? horaEn(f.entrada, zona.value) : '—',
    salidaTexto: f.salida ? `${horaEn(f.salida, zona.value)}${f.motivo_salida ? ` (${f.motivo_salida.replace(/_/g, ' ')})` : ''}` : '—',
    notas: [f.calidad === 'apoderado' ? 'apoderado' : '', f.moroso ? 'en mora' : '', f.whatsapp_confirmado ? 'WhatsApp confirmado' : ''].filter(Boolean).join(', ') || '—',
  })),
)
const COLUMNAS = [
  { clave: 'bien', titulo: 'Bien' },
  { clave: 'asistente', titulo: 'Asistente' },
  { clave: 'coeficiente', titulo: 'Coeficiente', alinear: 'fin' as const },
  { clave: 'entradaTexto', titulo: 'Entrada' },
  { clave: 'salidaTexto', titulo: 'Salida' },
  { clave: 'notas', titulo: 'Notas' },
]

const porCanal = (c: CanalesPregunta) =>
  Object.entries(c.por_canal)
    .map(([canal, n]) => `${CANAL_VOTO[canal as CanalVoto] ?? canal}: ${n}`)
    .join(' · ') || 'Sin votos'

async function cargar() {
  if (!reunionId.value) return
  try {
    const [a, c] = await Promise.all([reporteAsistencia(id.value, reunionId.value), participacionPorCanal(id.value, reunionId.value)])
    asistencia.value = a
    canales.value = c
    costo.value = entidad.tienePermiso('asambleas.convocar') ? await costoWhatsapp(id.value, reunionId.value) : null
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(reunionId, () => {
  estado.value = 'cargando'
  void cargar()
}, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-reportes">
    <template v-if="reunionId">
      <RouterLink
        :to="ruta('reuniones', reunionId)"
        class="volver"
      >
        <IVolver aria-hidden="true" /> La reunión
      </RouterLink>
      <h1 id="titulo-reportes">
        Reportes de la asamblea
      </h1>
      <HudPestanas
        :pestanas="pestanas"
        etiqueta="Reportes"
      />
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
      <template v-else>
        <p
          v-for="e in [csvAsistencia.error.value, csvVotos.error.value].filter(Boolean)"
          :key="e ?? ''"
          class="error"
          role="alert"
        >
          {{ e }}
        </p>
        <HudPanel
          v-if="pestana === 'asistencia'"
          etiqueta="Asistencia por bien"
        >
          <HudBoton
            variante="secundario"
            :cargando="csvAsistencia.cargando.value"
            @click="csvAsistencia.ejecutar()"
          >
            Descargar la asistencia (CSV)
          </HudBoton>
          <HudEstado
            v-if="!filas.length"
            estado="vacio"
            mensaje="No se registraron asistentes."
          />
          <HudTabla
            v-else
            :filas="filas"
            :columnas="COLUMNAS"
            clave="clave"
            titulo="Asistencia"
          >
            <template #celda-coeficiente="{ fila }">
              {{ coeficiente(fila.coeficiente) }}
            </template>
          </HudTabla>
        </HudPanel>

        <HudPanel
          v-else-if="pestana === 'canales'"
          etiqueta="Participación por canal"
        >
          <HudEstado
            v-if="!canales.length"
            estado="vacio"
            mensaje="Todavía no se ha votado ninguna pregunta."
          />
          <ul
            v-else
            class="lista"
            aria-label="Participación por pregunta"
          >
            <li
              v-for="c in canales"
              :key="c.pregunta_id"
            >
              <span class="crece">
                <strong>{{ c.orden }}. {{ c.enunciado }}</strong>
                <small>{{ porCanal(c) }}</small>
                <small v-if="c.primero">Primer voto {{ fechaHora(c.primero, zona) }}<template v-if="c.ultimo">; último {{ fechaHora(c.ultimo, zona) }}</template></small>
              </span>
              <HudBoton
                variante="fantasma"
                :cargando="csvVotos.cargando.value"
                @click="csvVotos.ejecutar(c.pregunta_id)"
              >
                Votos (CSV)<span class="solo-lector"> de «{{ c.enunciado }}»</span>
              </HudBoton>
            </li>
          </ul>
        </HudPanel>

        <HudPanel
          v-else-if="costo"
          etiqueta="Costo estimado de WhatsApp"
        >
          <dl class="datos">
            <div>
              <dt>Valor estimado</dt>
              <dd><strong>{{ moneda(costo.valor_estimado) }} {{ costo.moneda }}</strong></dd>
            </div>
            <div>
              <dt>Plantillas enviadas</dt>
              <dd>{{ costo.plantillas }} ({{ moneda(costo.tarifa_utilidad) }} c/u)</dd>
            </div>
            <div>
              <dt>Mensajes de servicio</dt>
              <dd>{{ costo.servicio }} ({{ moneda(costo.tarifa_servicio) }} c/u)</dd>
            </div>
            <div>
              <dt>Fallidos</dt>
              <dd>{{ costo.fallidos }}</dd>
            </div>
          </dl>
          <p class="texto-2">
            Sin descontar la franquicia gratuita de cada línea: el valor exacto sale de la factura de Meta.
          </p>
          <ul
            class="lista"
            aria-label="Mensajes por línea"
          >
            <li
              v-for="(l, i) in costo.por_linea"
              :key="i"
            >
              <span class="crece">
                <strong>{{ l.linea ?? 'Línea predeterminada' }}</strong>
                <small>{{ l.es_plantilla ? 'Plantillas' : 'Servicio' }}: {{ l.enviados }} enviados, {{ l.fallidos }} fallidos</small>
              </span>
            </li>
          </ul>
        </HudPanel>
      </template>
    </template>

    <template v-else>
      <h1 id="titulo-reportes">
        Reportes
      </h1>
      <ElegirReunion
        accion="reportes"
        :estados="['en_registro', 'instalada', 'suspendida', 'cerrada']"
        etiqueta="Asambleas con reportes"
        vacio="No hay asambleas en curso ni cerradas."
      />
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>

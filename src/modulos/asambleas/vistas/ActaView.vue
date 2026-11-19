<script setup lang="ts">
/**
 * Acta de una reunión cerrada (Ley 675, art. 47): revisar los datos ya calculados →
 * generar el PDF (se puede regenerar mientras no se apruebe) → subir el escaneo firmado por
 * presidente y secretario → aprobar (comisión verificadora) → publicar en el libro de actas.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { abrirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { DatosActa, Reunion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { coeficiente, porcentaje } from '@/formato/decimales'
import EscrutinioPregunta from '@/hud/componentes/EscrutinioPregunta.vue'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { avanzarActa, detalleReunion, generarActa, vistaActa } from '../api'
import ElegirReunion from '../componentes/ElegirReunion.vue'
import { ESTADO_ACTA, pasosActa } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })
const conduce = computed(() => entidad.tienePermiso('asambleas.conducir'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const reunion = ref<Reunion | null>(null)
const datos = ref<DatosActa | null>(null)
const resultado = ref<string | null>(null)
const pasos = computed(() => (reunion.value && conduce.value ? pasosActa(reunion.value) : []))

const escaneo = useAdjuntos(() => id.value, 'personal')
const generar = useAccion(() => generarActa(id.value, reunionId.value), { alConflicto: () => cargar() })
const avanzar = useAccion((_c, paso: 'firmada' | 'aprobar' | 'publicar') => avanzarActa(id.value, reunionId.value, paso, paso === 'firmada' ? (escaneo.ids()[0] ?? null) : null), {
  alConflicto: () => cargar(),
})
const abrir = useAccion((_c, archivo: string) => abrirArchivo(id.value, archivo))
const errores = computed(() => [generar.error.value, avanzar.error.value, abrir.error.value, escaneo.error.value].filter(Boolean))

const preguntasActa = computed(() => (datos.value?.preguntas ?? []).map((p) => ({ ...p, e: p.escrutinio ?? null })))
const filasAsistentes = computed(() =>
  (datos.value?.asistentes ?? []).map((a, i) => ({ ...a, clave: String(i), bienesTexto: a.bienes.join(', '), salidasTexto: a.salidas.join('; ') || '—' })),
)
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Asistente' },
  { clave: 'bienesTexto', titulo: 'Bienes' },
  { clave: 'coeficiente', titulo: 'Coeficiente', alinear: 'fin' as const },
  { clave: 'entrada', titulo: 'Entrada' },
  { clave: 'salidasTexto', titulo: 'Salidas' },
]

const HECHO = {
  firmada: 'Acta firmada ligada. Ya se puede aprobar.',
  aprobar: 'Acta aprobada.',
  publicar: 'Acta publicada en el libro de actas.',
}

async function generarPdf() {
  const r = await generar.ejecutar()
  if (!r.ok) return
  reunion.value = r.valor
  resultado.value = 'Acta generada en PDF. Imprímala, recoja las firmas y suba el escaneo.'
}

async function dar(paso: 'firmada' | 'aprobar' | 'publicar') {
  const r = await avanzar.ejecutar(paso)
  if (!r.ok) return
  reunion.value = r.valor
  resultado.value = HECHO[paso]
  if (paso === 'firmada') escaneo.limpiar()
}

async function cargar() {
  if (!reunionId.value) return
  try {
    const d = await detalleReunion(id.value, reunionId.value)
    reunion.value = d.reunion
    datos.value = d.reunion.estado === 'cerrada' ? await vistaActa(id.value, reunionId.value) : null
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(reunionId, () => {
  estado.value = 'cargando'
  resultado.value = null
  void cargar()
}, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-acta">
    <template v-if="reunionId">
      <RouterLink
        :to="ruta('reuniones', reunionId)"
        class="volver"
      >
        <IVolver aria-hidden="true" /> La reunión
      </RouterLink>
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error' || !reunion"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargar"
      />
      <template v-else>
        <header class="encabezado">
          <h1 id="titulo-acta">
            Acta: {{ reunion.titulo }}
          </h1>
          <HudInsignia :tono="ESTADO_ACTA[reunion.acta_estado].tono">
            {{ ESTADO_ACTA[reunion.acta_estado].texto }}
          </HudInsignia>
        </header>
        <HudEstado
          v-if="reunion.estado !== 'cerrada' || !datos"
          estado="vacio"
          mensaje="El acta se genera cuando la asamblea se cierra."
        />
        <template v-else>
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
          <HudPanel etiqueta="Pasos del acta">
            <div class="botones">
              <HudBoton
                v-if="pasos.includes('generar')"
                :variante="reunion.acta_estado === 'pendiente' ? 'primario' : 'fantasma'"
                :cargando="generar.cargando.value"
                @click="generarPdf"
              >
                {{ reunion.acta_estado === 'pendiente' ? 'Generar el acta (PDF)' : 'Regenerar el PDF' }}
              </HudBoton>
              <HudBoton
                v-if="reunion.acta_archivo_id"
                variante="secundario"
                :cargando="abrir.cargando.value"
                @click="abrir.ejecutar(reunion.acta_archivo_id)"
              >
                Abrir el acta
              </HudBoton>
              <HudBoton
                v-if="reunion.acta_firmada_archivo_id"
                variante="secundario"
                :cargando="abrir.cargando.value"
                @click="abrir.ejecutar(reunion.acta_firmada_archivo_id)"
              >
                Abrir el acta firmada
              </HudBoton>
              <HudBoton
                v-if="pasos.includes('aprobar')"
                :cargando="avanzar.cargando.value"
                @click="dar('aprobar')"
              >
                Aprobar el acta
              </HudBoton>
              <HudBoton
                v-if="pasos.includes('publicar')"
                :cargando="avanzar.cargando.value"
                @click="dar('publicar')"
              >
                Publicar en el libro de actas
              </HudBoton>
            </div>
            <div
              v-if="pasos.includes('firmada')"
              class="campos"
            >
              <p class="texto-2">
                {{ reunion.acta_firmada_archivo_id ? 'Puede reemplazar el escaneo firmado:' : 'Suba el acta escaneada con las firmas del presidente y del secretario:' }}
              </p>
              <HudAdjuntos
                :adjuntos="escaneo.adjuntos.value"
                acepta="application/pdf,image/*"
                :subiendo="escaneo.subiendo.value"
                @subir="escaneo.subir"
                @abrir="escaneo.abrir"
                @quitar="escaneo.quitar"
              />
              <HudBoton
                variante="secundario"
                :deshabilitado="!escaneo.ids().length"
                :cargando="avanzar.cargando.value"
                @click="dar('firmada')"
              >
                Ligar el acta firmada
              </HudBoton>
            </div>
            <p
              v-if="!conduce"
              class="texto-2"
            >
              Generar, aprobar y publicar el acta es de quien conduce la asamblea.
            </p>
          </HudPanel>

          <p
            v-for="a in datos.advertencias"
            :key="a"
            class="aviso"
          >
            {{ a }}
          </p>
          <HudPanel etiqueta="Datos de la reunión">
            <dl class="datos">
              <div>
                <dt>Copropiedad</dt>
                <dd>{{ datos.copropiedad }}{{ datos.nit ? ` · NIT ${datos.nit}` : '' }}</dd>
              </div>
              <div>
                <dt>Reunión</dt>
                <dd>{{ datos.tipo }}, {{ datos.convocatoria }} ({{ datos.modalidad }})</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{{ datos.fecha }}</dd>
              </div>
              <div>
                <dt>Lugar</dt>
                <dd>{{ datos.lugar ?? '—' }}</dd>
              </div>
              <div>
                <dt>Instalada / cerrada</dt>
                <dd>{{ datos.instalada ?? '—' }} / {{ datos.cerrada ?? '—' }}</dd>
              </div>
              <div>
                <dt>Efecto de la mora</dt>
                <dd>{{ datos.efecto_mora }}{{ datos.morosos.length ? ` (${datos.morosos.join(', ')})` : '' }}</dd>
              </div>
            </dl>
          </HudPanel>
          <HudPanel etiqueta="Orden del día y quórum">
            <ol
              class="lista"
              aria-label="Orden del día del acta"
            >
              <li
                v-for="p in datos.orden_del_dia"
                :key="p"
              >
                {{ p }}
              </li>
            </ol>
            <ul
              class="lista"
              aria-label="Quórum registrado"
            >
              <li
                v-for="q in datos.quorum"
                :key="`${q.momento}-${q.hora}`"
              >
                <span class="crece">
                  <strong>{{ q.hora }} · {{ porcentaje(q.porcentaje_coeficiente) }} del coeficiente</strong>
                  <small>{{ q.unidades }} de {{ q.unidades_total }} unidades · {{ q.asistentes }} asistentes ({{ q.momento.replace('_', ' ') }})</small>
                </span>
              </li>
            </ul>
          </HudPanel>
          <HudPanel etiqueta="Asistencia">
            <HudTabla
              :filas="filasAsistentes"
              :columnas="COLUMNAS"
              clave="clave"
              titulo="Asistentes del acta"
            >
              <template #celda-coeficiente="{ fila }">
                {{ coeficiente(fila.coeficiente) }}
              </template>
            </HudTabla>
          </HudPanel>
          <HudPanel etiqueta="Votaciones">
            <HudEstado
              v-if="!preguntasActa.length"
              estado="vacio"
              mensaje="En esta reunión no se votó."
            />
            <article
              v-for="p in preguntasActa"
              :key="p.orden"
              class="pregunta-acta"
            >
              <h2>{{ p.orden }}. {{ p.enunciado }}</h2>
              <p class="texto-2">
                {{ p.tipo }} · voto {{ p.tipo_voto }} · {{ p.abierta ?? '—' }} a {{ p.cerrada ?? '—' }} · decisión: {{ p.decision }}
              </p>
              <EscrutinioPregunta
                v-if="p.e"
                :escrutinio="p.e"
                :reservada="p.tipo_voto === 'reservado'"
                :etiqueta="`Escrutinio de «${p.enunciado}» en el acta`"
              />
              <p
                v-if="p.detalle.length"
                class="texto-2"
              >
                El acta lista el voto de {{ p.detalle.length }} bien(es).
              </p>
              <p
                v-if="p.elegidos.length"
                class="texto-2"
              >
                Elegidos: {{ p.elegidos.join(', ') }}
              </p>
            </article>
          </HudPanel>
          <p class="texto-2">
            Datos calculados el {{ datos.generada }}.
          </p>
        </template>
      </template>
    </template>

    <template v-else>
      <h1 id="titulo-acta">
        Actas
      </h1>
      <ElegirReunion
        accion="acta"
        :estados="['cerrada']"
        etiqueta="Asambleas cerradas"
        vacio="No hay asambleas cerradas."
      />
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>
<style scoped>
.pregunta-acta {
  display: grid;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--linea);
}

.pregunta-acta:first-of-type {
  padding-top: 0;
  border-top: 0;
}
</style>

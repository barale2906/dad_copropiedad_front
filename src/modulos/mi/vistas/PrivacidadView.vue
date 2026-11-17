<script setup lang="ts">
/**
 * Mis datos y privacidad: la política de tratamiento vigente (antes de cualquier autorización),
 * mis autorizaciones por finalidad, mis solicitudes y radicar una nueva (consulta, rectificación,
 * revocatoria…), y la autorización de publicidad de la plataforma (solo el titular).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { AutorizacionPublicidad, DatosTitular, Politica, TipoSolicitudTitular } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { autorizacionPublicidad, autorizarPublicidad, misDatos, politicaVigente, radicarMiSolicitud, retirarPublicidad } from '../api'

const FINALIDAD: Record<string, string> = {
  administracion: 'Administración de la copropiedad',
  comunicaciones: 'Comunicaciones',
  control_acceso: 'Control de acceso',
  publicidad: 'Publicidad',
}
const TIPOS: { valor: TipoSolicitudTitular; etiqueta: string }[] = [
  { valor: 'consulta', etiqueta: 'Consultar qué datos míos tienen' },
  { valor: 'actualizacion', etiqueta: 'Actualizar mis datos' },
  { valor: 'rectificacion', etiqueta: 'Corregir un dato' },
  { valor: 'supresion', etiqueta: 'Borrar mis datos' },
  { valor: 'revocatoria', etiqueta: 'Revocar una autorización' },
]
const ESTADO: Record<string, { texto: string; tono: 'info' | 'aviso' | 'exito' }> = {
  radicada: { texto: 'Radicada', tono: 'info' },
  en_tramite: { texto: 'En trámite', tono: 'aviso' },
  respondida: { texto: 'Respondida', tono: 'exito' },
}

const textoTipo = (t: TipoSolicitudTitular) => TIPOS.find((x) => x.valor === t)?.etiqueta ?? t

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const politica = ref<Politica | null>(null)
const datos = ref<DatosTitular | null>(null)
const publicidad = ref<AutorizacionPublicidad | null>(null)
const errorPublicidad = ref<string | null>(null)
const resultado = ref<string | null>(null)

const vigentes = computed(() => (datos.value?.autorizaciones ?? []).filter((a) => !a.revocada_en))

// Radicar solicitud
const radicando = ref(false)
const tipo = ref<TipoSolicitudTitular>('consulta')
const detalle = ref('')
const radicar = useAccion((clave) => radicarMiSolicitud(id.value, datos.value?.persona.id ?? '', tipo.value, detalle.value.trim() || null, clave))

function abrirRadicar() {
  tipo.value = 'consulta'
  detalle.value = ''
  radicar.reiniciar()
  radicando.value = true
}

async function enviar() {
  const r = await radicar.ejecutar()
  if (!r.ok || !datos.value) return
  radicando.value = false
  datos.value = { ...datos.value, solicitudes: [r.valor, ...datos.value.solicitudes] }
  resultado.value = `Solicitud radicada. La administración debe responder antes del ${fechaCalendario(r.valor.vence_el)}.`
}

// Publicidad
const cambiarPublicidad = useAccion((_c, autorizar: boolean) =>
  autorizar ? autorizarPublicidad(id.value, publicidad.value?.politica?.version ?? 0) : retirarPublicidad(id.value),
)

async function alternarPublicidad() {
  const autorizar = !publicidad.value?.autorizada
  if (!(await cambiarPublicidad.ejecutar(autorizar)).ok || !publicidad.value) return
  publicidad.value = { ...publicidad.value, autorizada: autorizar }
  resultado.value = autorizar ? 'Autorizó recibir ofertas de los comercios del directorio.' : 'Ya no recibirá publicidad.'
}

async function cargar() {
  estado.value = 'cargando'
  try {
    ;[politica.value, datos.value] = await Promise.all([politicaVigente(id.value), misDatos(id.value)])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
  try {
    publicidad.value = await autorizacionPublicidad(id.value)
  } catch (e) {
    errorPublicidad.value = mensajeDeError(e)
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-privacidad">
    <header>
      <h1 id="titulo-privacidad">
        Mis datos y privacidad
      </h1>
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
    <template v-else-if="datos">
      <HudPanel etiqueta="Política de tratamiento de datos">
        <template v-if="politica">
          <p class="texto-2">
            Versión {{ politica.version }}, vigente desde {{ fechaHora(politica.vigente_desde, zona) }}.
          </p>
          <details>
            <summary>Leer la política</summary>
            <p class="politica">
              {{ politica.texto ?? 'La política está en el documento publicado por la administración.' }}
            </p>
          </details>
        </template>
        <p
          v-else
          class="texto-2"
        >
          La copropiedad aún no ha publicado su política.
        </p>
      </HudPanel>

      <HudPanel etiqueta="Mis autorizaciones">
        <p
          v-if="vigentes.length === 0"
          class="texto-2"
        >
          No tiene autorizaciones vigentes.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Autorizaciones vigentes"
        >
          <li
            v-for="a in vigentes"
            :key="a.id"
          >
            <span>{{ FINALIDAD[a.finalidad] ?? a.finalidad }}</span>
            <small>Desde {{ fechaHora(a.otorgada_en, zona) }} · política v{{ a.politica_version }}</small>
          </li>
        </ul>
        <p class="texto-2">
          Para revocar una autorización o consultar, corregir o borrar sus datos, radique una solicitud.
        </p>
      </HudPanel>

      <HudPanel etiqueta="Mis solicitudes sobre mis datos">
        <ul
          v-if="datos.solicitudes.length"
          class="lista"
          aria-label="Solicitudes sobre mis datos"
        >
          <li
            v-for="s in datos.solicitudes"
            :key="s.id"
          >
            <span>{{ textoTipo(s.tipo) }}</span>
            <HudInsignia :tono="ESTADO[s.estado]?.tono ?? 'info'">
              {{ ESTADO[s.estado]?.texto ?? s.estado }}
            </HudInsignia>
            <small v-if="s.estado !== 'respondida'">Respuesta a más tardar el {{ fechaCalendario(s.prorrogada_hasta ?? s.vence_el) }}</small>
            <small v-else-if="s.respuesta">{{ s.respuesta }}</small>
          </li>
        </ul>
        <HudBoton
          variante="secundario"
          @click="abrirRadicar"
        >
          Radicar una solicitud
        </HudBoton>
      </HudPanel>

      <HudPanel etiqueta="Publicidad">
        <p
          v-if="errorPublicidad"
          class="texto-2"
        >
          {{ errorPublicidad }}
        </p>
        <template v-else-if="publicidad">
          <p class="texto-2">
            {{ publicidad.autorizada
              ? 'Usted autorizó recibir ofertas de los comercios del directorio.'
              : 'Sin su autorización no recibe publicidad de los comercios del directorio.' }}
          </p>
          <details v-if="publicidad.politica && !publicidad.autorizada">
            <summary>Leer la política de publicidad (versión {{ publicidad.politica.version }})</summary>
            <p class="politica">
              {{ publicidad.politica.texto }}
            </p>
          </details>
          <p
            v-if="cambiarPublicidad.error.value"
            class="error"
            role="alert"
          >
            {{ cambiarPublicidad.error.value }}
          </p>
          <HudBoton
            :variante="publicidad.autorizada ? 'fantasma' : 'secundario'"
            :cargando="cambiarPublicidad.cargando.value"
            :deshabilitado="!publicidad.autorizada && !publicidad.politica"
            @click="alternarPublicidad"
          >
            {{ publicidad.autorizada ? 'Retirar la autorización' : 'Acepto recibir publicidad' }}
          </HudBoton>
        </template>
      </HudPanel>
    </template>

    <HudDialogo
      v-model:abierto="radicando"
      titulo="Solicitud sobre mis datos"
    >
      <form
        id="formulario-titular"
        class="campos"
        @submit.prevent="enviar"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Quiero"
          :opciones="TIPOS"
        />
        <HudCampo
          v-model="detalle"
          etiqueta="Detalle (opcional)"
          multilinea
          ayuda="Por ejemplo, qué dato corregir o qué autorización revocar."
        />
        <p class="texto-2">
          La administración tiene plazos legales (Ley 1581): 10 días hábiles para consultas y 15 para reclamos.
        </p>
        <p
          v-if="radicar.error.value"
          class="error"
          role="alert"
        >
          {{ radicar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="radicando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-titular"
          :cargando="radicar.cargando.value"
        >
          Radicar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./portal.css"></style>
<style scoped>
summary {
  min-height: 40px;
  padding: 8px 0;
  color: var(--cian);
  cursor: pointer;
}

.politica {
  white-space: pre-wrap;
}
</style>

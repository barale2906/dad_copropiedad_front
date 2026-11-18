<script setup lang="ts">
/**
 * Escrutinio de cada pregunta (`?pregunta=`): por coeficiente **y** por unidades, en vivo
 * mientras está abierta. Detalle bien → opción (en reservadas, con permiso y aviso de
 * auditoría), votos en CSV y, en elecciones cerradas de consejo, revisor o comité, aplicar la
 * elección para crear los roles de los elegidos.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { DetalleVoto, Elegido, Pregunta, ResultadosPregunta } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useRefresco } from '@/composables/useRefresco'
import { coeficiente } from '@/formato/decimales'
import { leerEscrutinio } from '@/formato/escrutinio'
import { aUtc, fechaHora } from '@/formato/fechas'
import AvisoAuditado from '@/hud/componentes/AvisoAuditado.vue'
import EscrutinioPregunta from '@/hud/componentes/EscrutinioPregunta.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { aplicarEleccion, descargarVotos, detalleVotos, preguntas as pedirPreguntas, resultados as pedirResultados } from '../api'
import ElegirReunion from '../componentes/ElegirReunion.vue'
import { CANAL_VOTO, CARGO_ELECCION, CARGOS_CON_ROL, ESTADO_PREGUNTA, TIPO_PREGUNTA, textoRegla } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })
const enlace = (p: Pregunta) => ({ ...ruta('resultados', reunionId.value), query: { pregunta: p.id } })

const lista = ref<Pregunta[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const votadas = computed(() => lista.value.filter((p) => p.estado !== 'borrador'))
const pregunta = computed(() => votadas.value.find((p) => p.id === route.query.pregunta) ?? votadas.value[0] ?? null)

const res = ref<ResultadosPregunta | null>(null)
const errorRes = ref<string | null>(null)
const escrutinio = computed(() => (res.value ? leerEscrutinio(res.value.escrutinio) : null))
const actual = computed(() => res.value?.pregunta ?? pregunta.value)

// Detalle
const reservada = computed(() => actual.value?.tipo_voto === 'reservado')
const puedeDetalle = computed(() => !reservada.value || entidad.tienePermiso('asambleas.votos.ver_detalle'))
const avisoAbierto = ref(false)
const detalle = ref<DetalleVoto[] | null>(null)
const verDetalle = useAccion(() => detalleVotos(id.value, reunionId.value, actual.value?.id ?? ''))
const opcionTexto = (o: string) => actual.value?.opciones.find((x) => x.id === o)?.texto ?? ''
const filasDetalle = computed(() =>
  (detalle.value ?? []).map((d) => ({ ...d, opcion: opcionTexto(d.opcion_id), canalTexto: CANAL_VOTO[d.canal], hora: fechaHora(d.registrado_en, zona.value) })),
)
const COLUMNAS = [
  { clave: 'codigo', titulo: 'Bien' },
  { clave: 'coeficiente', titulo: 'Coeficiente', alinear: 'fin' as const },
  { clave: 'opcion', titulo: 'Opción' },
  { clave: 'asistente', titulo: 'Asistente' },
  { clave: 'canalTexto', titulo: 'Canal' },
  { clave: 'hora', titulo: 'Hora' },
]

// CSV
const csv = useAccion(() => descargarVotos(id.value, reunionId.value, actual.value?.id ?? ''))

// Elección
const vigencia = ref('')
const elegidos = ref<Elegido[] | null>(null)
const aplicable = computed(() => {
  const p = actual.value
  return !!p && p.tipo === 'eleccion' && p.estado === 'cerrada' && !!p.cargo && CARGOS_CON_ROL.includes(p.cargo) && !p.roles_aplicados_en && entidad.tienePermiso('asambleas.conducir')
})
const aplicar = useAccion(() => aplicarEleccion(id.value, reunionId.value, actual.value?.id ?? '', vigencia.value ? aUtc(vigencia.value, zona.value) : null))

async function pedirDetalle() {
  if (reservada.value && !avisoAbierto.value) {
    avisoAbierto.value = true
    return
  }
  const r = await verDetalle.ejecutar()
  avisoAbierto.value = false
  if (r.ok) detalle.value = r.valor
}

async function aplicarLaEleccion() {
  const r = await aplicar.ejecutar()
  if (!r.ok) return
  elegidos.value = r.valor
  await cargarResultados()
}

async function cargarResultados() {
  const p = pregunta.value
  if (!p) return
  try {
    res.value = await pedirResultados(id.value, reunionId.value, p.id)
    errorRes.value = null
  } catch (e) {
    errorRes.value = mensajeDeError(e)
  }
}

async function cargar() {
  if (!reunionId.value) return
  try {
    lista.value = await pedirPreguntas(id.value, reunionId.value)
    estado.value = 'listo'
    await cargarResultados()
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

useRefresco(async () => {
  if (actual.value?.estado === 'abierta') await cargarResultados()
}, { cada: 5_000 })
watch(() => pregunta.value?.id, () => {
  res.value = null
  detalle.value = null
  elegidos.value = null
  void cargarResultados()
})
watch(reunionId, () => {
  estado.value = 'cargando'
  void cargar()
}, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-resultados">
    <template v-if="reunionId">
      <RouterLink
        :to="ruta('en-vivo', reunionId)"
        class="volver"
      >
        <IVolver aria-hidden="true" /> La asamblea
      </RouterLink>
      <h1 id="titulo-resultados">
        Resultados
      </h1>
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
        v-else-if="!votadas.length || !actual"
        estado="vacio"
        mensaje="Todavía no se ha votado ninguna pregunta."
      />
      <template v-else>
        <nav aria-label="Preguntas votadas">
          <ul class="lista">
            <li
              v-for="p in votadas"
              :key="p.id"
            >
              <span class="crece">
                <RouterLink
                  :to="enlace(p)"
                  class="fila"
                  :aria-current="p.id === actual.id ? 'page' : undefined"
                ><strong>{{ p.orden }}. {{ p.enunciado }}</strong></RouterLink>
              </span>
              <HudInsignia :tono="ESTADO_PREGUNTA[p.estado].tono">
                {{ ESTADO_PREGUNTA[p.estado].texto }}
              </HudInsignia>
            </li>
          </ul>
        </nav>

        <HudPanel :etiqueta="`${actual.orden}. ${actual.enunciado}`">
          <p class="texto-2">
            {{ TIPO_PREGUNTA[actual.tipo] }} · {{ actual.tipo_voto === 'reservado' ? 'voto reservado' : 'voto nominal' }}
            <template v-if="actual.tipo !== 'eleccion'">
              · {{ textoRegla(actual.regla_mayoria) }}
            </template>
            <template v-if="actual.cargo">
              · {{ CARGO_ELECCION[actual.cargo] }} ({{ actual.cupos }} cupos)
            </template>
          </p>
          <HudEstado
            v-if="actual.estado === 'anulada'"
            estado="vacio"
            mensaje="La pregunta se anuló: sus votos no cuentan."
          />
          <p
            v-else-if="errorRes"
            class="error"
            role="alert"
          >
            {{ errorRes }}
          </p>
          <EscrutinioPregunta
            v-else-if="escrutinio"
            :escrutinio="escrutinio"
            :reservada="reservada"
            :abierta="actual.estado === 'abierta'"
          />
          <HudEstado
            v-else
            estado="cargando"
          />
          <div
            v-if="actual.estado !== 'anulada'"
            class="botones"
          >
            <HudBoton
              v-if="puedeDetalle"
              variante="secundario"
              :cargando="verDetalle.cargando.value"
              @click="pedirDetalle"
            >
              Ver el detalle por bien
            </HudBoton>
            <HudBoton
              variante="fantasma"
              :cargando="csv.cargando.value"
              @click="csv.ejecutar()"
            >
              Descargar los votos (CSV)
            </HudBoton>
          </div>
          <p
            v-for="e in [verDetalle.error.value, csv.error.value].filter(Boolean)"
            :key="e ?? ''"
            class="error"
            role="alert"
          >
            {{ e }}
          </p>
        </HudPanel>

        <HudPanel
          v-if="aplicable || elegidos"
          etiqueta="Elección"
        >
          <template v-if="!elegidos">
            <p class="texto-2">
              Al aplicarla se crean los roles de los elegidos y terminan los del periodo anterior.
            </p>
            <HudFecha
              v-model="vigencia"
              etiqueta="Vigentes hasta (opcional)"
              con-hora
              ayuda="Por ejemplo, la próxima asamblea ordinaria. Vacío: sin fecha."
            />
            <p
              v-if="aplicar.error.value"
              class="error"
              role="alert"
            >
              {{ aplicar.error.value }}
            </p>
            <HudBoton
              :cargando="aplicar.cargando.value"
              @click="aplicarLaEleccion"
            >
              Aplicar la elección
            </HudBoton>
          </template>
          <template v-else>
            <p
              class="ok"
              role="status"
            >
              Elección aplicada: {{ elegidos.length }} elegido(s).
            </p>
            <ul
              class="lista"
              aria-label="Elegidos"
            >
              <li
                v-for="x in elegidos"
                :key="x.persona_id"
              >
                <span class="crece">{{ x.nombre }}</span>
                <HudInsignia :tono="x.rol_asignado ? 'exito' : 'aviso'">
                  {{ x.rol_asignado ? 'Rol asignado' : 'Se asigna cuando cree su cuenta' }}
                </HudInsignia>
              </li>
            </ul>
          </template>
        </HudPanel>

        <HudPanel
          v-if="detalle"
          etiqueta="Detalle por bien"
        >
          <HudEstado
            v-if="!detalle.length"
            estado="vacio"
            mensaje="Nadie ha votado esta pregunta."
          />
          <HudTabla
            v-else
            :filas="filasDetalle"
            :columnas="COLUMNAS"
            clave="bien_privado_id"
            titulo="Votos por bien"
          >
            <template #celda-coeficiente="{ fila }">
              {{ coeficiente(fila.coeficiente) }}
            </template>
            <template #celda-asistente="{ fila }">
              {{ fila.asistente }}{{ fila.apoderado ? ' (apoderado)' : '' }}
            </template>
          </HudTabla>
        </HudPanel>
        <AvisoAuditado
          v-model:abierto="avisoAbierto"
          que="qué votó cada bien en una votación reservada"
          :cargando="verDetalle.cargando.value"
          @confirmar="pedirDetalle"
        />
      </template>
    </template>

    <template v-else>
      <h1 id="titulo-resultados">
        Resultados
      </h1>
      <ElegirReunion
        accion="resultados"
        :estados="['instalada', 'suspendida', 'cerrada']"
        etiqueta="Asambleas con votaciones"
        vacio="No hay asambleas instaladas ni cerradas."
      />
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>

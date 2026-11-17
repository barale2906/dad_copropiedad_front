<script setup lang="ts">
/**
 * Autorizaciones de tratamiento de una persona: las vigentes y revocadas, registrar una nueva
 * (bajo la política vigente) por finalidad, revocar y consultar los datos que la PH trata de ella
 * (consulta auditada, tras `AvisoAuditado`).
 */
import { computed, ref, useTemplateRef } from 'vue'
import { subirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { AutorizacionTratamiento, DatosTitular, FinalidadTratamiento, MedioAutorizacion, Persona } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import AvisoAuditado from '@/hud/componentes/AvisoAuditado.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { autorizacionesDe, datosTratados, otorgarAutorizacion, revocarAutorizacion } from '../api-proteccion'
import { ESTADO_SOLICITUD, FINALIDAD, finalidadesVigentes, MEDIO, TIPO_SOLICITUD } from '../proteccion'
import BuscarPersona from './BuscarPersona.vue'

const props = defineProps<{ copropiedadId: string }>()

const entidad = useEntidad()
const selector = useTemplateRef<HTMLInputElement>('selector')

const persona = ref<Persona | null>(null)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const autorizaciones = ref<AutorizacionTratamiento[]>([])
const resultado = ref<string | null>(null)

const vigentes = computed(() => finalidadesVigentes(autorizaciones.value))
const todas = Object.keys(FINALIDAD) as FinalidadTratamiento[]
const otorgables = computed(() => todas.filter((f) => !vigentes.value.includes(f)))

const COLUMNAS = [
  { clave: 'finalidad', titulo: 'Finalidad' },
  { clave: 'medio', titulo: 'Medio' },
  { clave: 'otorgada_en', titulo: 'Otorgada' },
  { clave: 'estado', titulo: 'Estado' },
]

async function elegir(p: Persona) {
  persona.value = p
  resultado.value = null
  datos.value = null
  await cargar()
}

async function cargar() {
  if (!persona.value) return
  estado.value = 'cargando'
  try {
    autorizaciones.value = await autorizacionesDe(props.copropiedadId, persona.value.id)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

// Otorgar
const otorgando = ref(false)
const elegidas = ref<FinalidadTratamiento[]>([])
const medio = ref<MedioAutorizacion>('escrito')
const evidencia = ref<File | null>(null)
const intentado = ref(false)
const opcionesMedio = (Object.keys(MEDIO) as MedioAutorizacion[]).map((valor) => ({ valor, etiqueta: MEDIO[valor] }))

const otorgar = useAccion(async (clave) => {
  const p = persona.value
  if (!p) return
  const evidenciaId = evidencia.value ? (await subirArchivo(props.copropiedadId, evidencia.value, 'personal')).id : null
  await otorgarAutorizacion(
    props.copropiedadId,
    p.id,
    { finalidades: elegidas.value, medio: medio.value, evidencia_archivo_id: evidenciaId },
    clave,
  )
})

function abrirOtorgar() {
  elegidas.value = []
  medio.value = 'escrito'
  evidencia.value = null
  intentado.value = false
  otorgar.reiniciar()
  otorgando.value = true
}

async function enviarOtorgar() {
  intentado.value = true
  if (elegidas.value.length === 0) return
  if (!(await otorgar.ejecutar()).ok) return
  otorgando.value = false
  resultado.value = 'Autorización registrada.'
  await cargar()
}

// Revocar
const revocando = ref(false)
const aRevocar = ref<FinalidadTratamiento[]>([])
const revocar = useAccion(() => revocarAutorizacion(props.copropiedadId, persona.value?.id ?? '', aRevocar.value))

function abrirRevocar() {
  aRevocar.value = []
  revocar.reiniciar()
  revocando.value = true
}

async function enviarRevocar() {
  if (aRevocar.value.length === 0) return
  const r = await revocar.ejecutar()
  if (!r.ok) return
  revocando.value = false
  resultado.value = r.valor === 1 ? 'Se revocó 1 autorización.' : `Se revocaron ${r.valor} autorizaciones.`
  await cargar()
}

// Datos tratados (auditado)
const avisando = ref(false)
const consultando = ref(false)
const datos = ref<DatosTitular | null>(null)
const errorDatos = ref<string | null>(null)

async function verDatos() {
  if (!persona.value) return
  consultando.value = true
  errorDatos.value = null
  try {
    datos.value = await datosTratados(props.copropiedadId, persona.value.id)
    avisando.value = false
  } catch (e) {
    errorDatos.value = mensajeDeError(e)
    avisando.value = false
  } finally {
    consultando.value = false
  }
}
</script>

<template>
  <div class="autorizaciones">
    <BuscarPersona
      :copropiedad-id="copropiedadId"
      etiqueta="Titular"
      @elegir="elegir"
    />

    <HudPanel
      v-if="persona"
      :etiqueta="persona.nombre"
    >
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
      <template v-else>
        <p
          v-if="autorizaciones.length === 0"
          class="texto-2"
        >
          Esta persona aún no ha otorgado autorizaciones.
        </p>
        <HudTabla
          v-else
          :filas="autorizaciones"
          :columnas="COLUMNAS"
          clave="id"
          :titulo="`Autorizaciones de ${persona.nombre}`"
        >
          <template #celda-finalidad="{ fila }">
            {{ FINALIDAD[fila.finalidad].texto }}
          </template>
          <template #celda-medio="{ fila }">
            {{ MEDIO[fila.medio] }} · política v{{ fila.politica_version }}
          </template>
          <template #celda-otorgada_en="{ fila }">
            {{ fechaHora(fila.otorgada_en, entidad.zonaHoraria) }}
          </template>
          <template #celda-estado="{ fila }">
            <HudInsignia :tono="fila.revocada_en ? 'neutro' : 'exito'">
              {{ fila.revocada_en ? `Revocada ${fechaHora(fila.revocada_en, entidad.zonaHoraria)}` : 'Vigente' }}
            </HudInsignia>
          </template>
        </HudTabla>
        <div class="botones">
          <HudBoton
            v-if="otorgables.length"
            @click="abrirOtorgar"
          >
            Registrar autorización
          </HudBoton>
          <HudBoton
            v-if="vigentes.length"
            variante="secundario"
            @click="abrirRevocar"
          >
            Revocar
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="avisando = true"
          >
            Ver datos tratados
          </HudBoton>
        </div>
      </template>

      <p
        v-if="errorDatos"
        class="error"
        role="alert"
      >
        {{ errorDatos }}
      </p>
      <section
        v-if="datos"
        class="datos"
        aria-labelledby="titulo-datos-tratados"
      >
        <h3 id="titulo-datos-tratados">
          Datos que la copropiedad trata
        </h3>
        <dl>
          <div>
            <dt>Documento</dt>
            <dd>{{ [datos.persona.tipo_documento, datos.persona.documento].filter(Boolean).join(' ') || '—' }}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{{ datos.persona.telefono ?? '—' }}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{{ datos.persona.correo ?? '—' }}</dd>
          </div>
          <div v-if="!datos.persona.datos_sensibles_ocultos">
            <dt>Fecha de nacimiento</dt>
            <dd>{{ datos.persona.fecha_nacimiento ? fechaCalendario(datos.persona.fecha_nacimiento) : '—' }}</dd>
          </div>
          <div>
            <dt>Autorizaciones</dt>
            <dd>{{ datos.autorizaciones.length }}</dd>
          </div>
        </dl>
        <p
          v-if="datos.persona.datos_sensibles_ocultos"
          class="texto-2"
        >
          Los datos sensibles se ocultan: requieren el permiso para verlos.
        </p>
        <ul
          v-if="datos.solicitudes.length"
          :aria-label="`Solicitudes de ${persona.nombre}`"
        >
          <li
            v-for="s in datos.solicitudes"
            :key="s.id"
          >
            {{ TIPO_SOLICITUD[s.tipo] }} — {{ ESTADO_SOLICITUD[s.estado].texto }} ({{ fechaHora(s.radicada_en, entidad.zonaHoraria) }})
          </li>
        </ul>
      </section>
    </HudPanel>

    <HudDialogo
      v-model:abierto="otorgando"
      titulo="Registrar autorización"
    >
      <form
        id="formulario-otorgar"
        class="campos"
        @submit.prevent="enviarOtorgar"
      >
        <fieldset>
          <legend>Finalidades que autoriza</legend>
          <label
            v-for="f in otorgables"
            :key="f"
            class="casilla"
          >
            <input
              v-model="elegidas"
              type="checkbox"
              :value="f"
            >
            <span>
              {{ FINALIDAD[f].texto }}
              <small>{{ FINALIDAD[f].ayuda }}</small>
            </span>
          </label>
        </fieldset>
        <p
          v-if="intentado && elegidas.length === 0"
          class="error"
          role="alert"
        >
          Elija al menos una finalidad.
        </p>
        <HudSelector
          v-model="medio"
          etiqueta="Medio por el que la otorgó"
          :opciones="opcionesMedio"
        />
        <div class="archivo">
          <input
            ref="selector"
            type="file"
            accept="application/pdf,image/*"
            class="solo-lector"
            tabindex="-1"
            aria-hidden="true"
            @change="evidencia = ($event.target as HTMLInputElement).files?.[0] ?? null"
          >
          <HudBoton
            variante="secundario"
            @click="selector?.click()"
          >
            {{ evidencia ? 'Cambiar evidencia' : 'Adjuntar evidencia (opcional)' }}
          </HudBoton>
          <span v-if="evidencia">{{ evidencia.name }}</span>
        </div>
        <p
          v-if="otorgar.error.value"
          class="error"
          role="alert"
        >
          {{ otorgar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="otorgando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-otorgar"
          :cargando="otorgar.cargando.value"
        >
          Registrar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="revocando"
      titulo="Revocar autorización"
    >
      <form
        id="formulario-revocar"
        class="campos"
        @submit.prevent="enviarRevocar"
      >
        <fieldset>
          <legend>Finalidades que revoca</legend>
          <label
            v-for="f in vigentes"
            :key="f"
            class="casilla"
          >
            <input
              v-model="aRevocar"
              type="checkbox"
              :value="f"
            >
            {{ FINALIDAD[f].texto }}
          </label>
        </fieldset>
        <p
          v-if="revocar.error.value"
          class="error"
          role="alert"
        >
          {{ revocar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="revocando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-revocar"
          :cargando="revocar.cargando.value"
          :deshabilitado="aRevocar.length === 0"
        >
          Revocar
        </HudBoton>
      </template>
    </HudDialogo>

    <AvisoAuditado
      v-model:abierto="avisando"
      :que="`los datos que la copropiedad trata de ${persona?.nombre ?? 'esta persona'}`"
      :cargando="consultando"
      @confirmar="verDatos"
    />
  </div>
</template>

<style scoped>
.autorizaciones {
  display: grid;
  gap: 14px;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.texto-2 {
  color: var(--texto-2);
}

.ok,
.error,
.texto-2 {
  margin: 0 0 8px;
}

.ok {
  color: var(--verde);
}

.error {
  color: var(--magenta);
}

.campos {
  display: grid;
  gap: 14px;
}

fieldset {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 6px;
  font-weight: 600;
}

.casilla {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 40px;
  padding: 6px 0;
}

.casilla input {
  flex: none;
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.casilla span {
  display: grid;
}

small {
  color: var(--texto-3);
}

.archivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.datos {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--linea);
}

h3 {
  margin: 0 0 8px;
  font-size: 17px;
}

dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 10px 16px;
  margin: 0;
}

dt {
  color: var(--texto-3);
  font-size: 13px;
}

dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}
</style>

<script setup lang="ts">
/**
 * Personas de la PH: búsqueda por nombre o documento y, con `:id`, su ficha con sus residencias.
 * Los datos sensibles (nacimiento, movilidad reducida) se muestran «ocultos» a quien no puede
 * verlos y no se piden en el formulario.
 */
import { computed, ref, watch } from 'vue'
import { type RouteLocationRaw, useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Persona, Residencia, TipoDocumento } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fecha, fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { editarPersona, listarPersonas, persona as obtenerPersona, residencias } from '../api'
import { CALIDAD } from '../censo'

const route = useRoute()
const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const editable = computed(() => entidad.tienePermiso('personas.editar'))

const personaId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (p = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: p }, query: {} })

const filtros = ref({ q: '' })
const listado = useListado((despues, f: { q: string }) => listarPersonas(id.value, despues, f.q), { filtros, inmediato: false })
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Persona' },
  { clave: 'contacto', titulo: 'Contacto' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

// Ficha
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const datos = ref<Persona | null>(null)
const vinculos = ref<Residencia[]>([])
const resultado = ref<string | null>(null)
const editando = ref(false)
const OPCIONES_TIPO = (['CC', 'CE', 'TI', 'RC', 'PA', 'PPT', 'NIT'] as TipoDocumento[]).map((t) => ({ valor: t, etiqueta: t }))
const v = ref({ nombre: '', tipo_documento: 'CC' as TipoDocumento, documento: '', telefono: '', correo: '', contacto: '', contacto_tel: '', nacimiento: '', movilidad: false })

const guardar = useAccion(() => {
  const p = datos.value
  const sensibles = p && !p.datos_sensibles_ocultos ? { fecha_nacimiento: v.value.nacimiento || null, movilidad_reducida: v.value.movilidad } : {}
  return editarPersona(id.value, personaId.value, {
    nombre: v.value.nombre.trim(),
    tipo_documento: v.value.tipo_documento,
    documento: v.value.documento.trim() || null,
    telefono: v.value.telefono.trim() || null,
    correo: v.value.correo.trim() || null,
    contacto_emergencia_nombre: v.value.contacto.trim() || null,
    contacto_emergencia_telefono: v.value.contacto_tel.trim() || null,
    ...sensibles,
  })
})

function abrirEdicion() {
  const p = datos.value
  if (!p) return
  v.value = {
    nombre: p.nombre,
    tipo_documento: (p.tipo_documento as TipoDocumento | null | undefined) ?? 'CC',
    documento: p.documento ?? '',
    telefono: p.telefono ?? '',
    correo: p.correo ?? '',
    contacto: p.contacto_emergencia_nombre ?? '',
    contacto_tel: p.contacto_emergencia_telefono ?? '',
    nacimiento: p.fecha_nacimiento ?? '',
    movilidad: p.movilidad_reducida,
  }
  guardar.reiniciar()
  editando.value = true
}

async function enviar() {
  if (!v.value.nombre.trim()) return
  const r = await guardar.ejecutar()
  if (!r.ok) return
  datos.value = r.valor
  editando.value = false
  resultado.value = 'Datos actualizados.'
}

async function cargarFicha() {
  if (!personaId.value) return
  estado.value = 'cargando'
  resultado.value = null
  editando.value = false
  try {
    const [p, todas] = await Promise.all([
      obtenerPersona(id.value, personaId.value),
      entidad.tienePermiso('censo.ver') ? residencias(id.value) : Promise.resolve([]),
    ])
    datos.value = p
    vinculos.value = todas.filter((r) => r.persona.id === p.id)
    await bienes.resolver(vinculos.value.map((r) => r.bien_privado_id))
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(personaId, (p) => (p ? cargarFicha() : listado.recargar()), { immediate: true })
</script>

<template>
  <section
    class="personas"
    aria-labelledby="titulo-personas"
  >
    <header>
      <RouterLink
        v-if="personaId"
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Todas las personas
      </RouterLink>
      <h1 id="titulo-personas">
        Personas
      </h1>
    </header>

    <template v-if="personaId">
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error'"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargarFicha"
      />
      <template v-else-if="datos">
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <HudPanel :etiqueta="datos.nombre">
          <form
            v-if="editando"
            class="rejilla"
            novalidate
            @submit.prevent="enviar"
          >
            <HudCampo
              v-model="v.nombre"
              etiqueta="Nombre"
              requerido
            />
            <HudSelector
              v-model="v.tipo_documento"
              etiqueta="Tipo de documento"
              :opciones="OPCIONES_TIPO"
            />
            <HudCampo
              v-model="v.documento"
              etiqueta="Documento"
            />
            <HudCampo
              v-model="v.telefono"
              etiqueta="Teléfono"
              tipo="tel"
            />
            <HudCampo
              v-model="v.correo"
              etiqueta="Correo"
              tipo="email"
            />
            <HudCampo
              v-model="v.contacto"
              etiqueta="Contacto de emergencia"
            />
            <HudCampo
              v-model="v.contacto_tel"
              etiqueta="Teléfono de emergencia"
              tipo="tel"
            />
            <template v-if="!datos.datos_sensibles_ocultos">
              <HudFecha
                v-model="v.nacimiento"
                etiqueta="Fecha de nacimiento"
              />
              <label class="casilla">
                <input
                  v-model="v.movilidad"
                  type="checkbox"
                >
                Movilidad reducida
              </label>
            </template>
            <p
              v-if="guardar.error.value"
              class="error"
              role="alert"
            >
              {{ guardar.error.value }}
            </p>
            <div class="botones">
              <HudBoton
                variante="fantasma"
                @click="editando = false"
              >
                Cancelar
              </HudBoton>
              <HudBoton
                tipo="submit"
                :cargando="guardar.cargando.value"
              >
                Guardar
              </HudBoton>
            </div>
          </form>
          <template v-else>
            <dl class="rejilla">
              <div><dt>Documento</dt><dd>{{ [datos.tipo_documento, datos.documento].filter(Boolean).join(' ') || '—' }}</dd></div>
              <div><dt>Teléfono</dt><dd>{{ datos.telefono ?? '—' }}</dd></div>
              <div><dt>Correo</dt><dd>{{ datos.correo ?? '—' }}</dd></div>
              <div><dt>Contacto de emergencia</dt><dd>{{ [datos.contacto_emergencia_nombre, datos.contacto_emergencia_telefono].filter(Boolean).join(' · ') || '—' }}</dd></div>
              <div>
                <dt>Fecha de nacimiento</dt>
                <dd>{{ datos.datos_sensibles_ocultos ? 'Oculto' : datos.fecha_nacimiento ? fechaCalendario(datos.fecha_nacimiento) : '—' }}</dd>
              </div>
              <div>
                <dt>Movilidad reducida</dt>
                <dd>{{ datos.datos_sensibles_ocultos ? 'Oculto' : datos.movilidad_reducida ? 'Sí' : 'No' }}</dd>
              </div>
            </dl>
            <p
              v-if="datos.datos_sensibles_ocultos"
              class="texto-2"
            >
              Los datos sensibles están ocultos: requieren el permiso «Ver datos sensibles».
            </p>
            <HudBoton
              v-if="editable"
              variante="secundario"
              @click="abrirEdicion"
            >
              Editar datos
            </HudBoton>
          </template>
        </HudPanel>
        <HudPanel etiqueta="Residencias">
          <p
            v-if="vinculos.length === 0"
            class="texto-2"
          >
            No figura como residente de ningún bien.
          </p>
          <ul
            v-else
            class="lista"
            aria-label="Residencias de la persona"
          >
            <li
              v-for="r in vinculos"
              :key="r.id"
            >
              <RouterLink :to="{ name: 'modulo', params: { ...$route.params, accion: 'bienes', id: r.bien_privado_id }, query: { vista: 'residentes' } }">
                {{ bienes.codigo(r.bien_privado_id) }}
              </RouterLink>
              · {{ CALIDAD[r.calidad] }} · desde {{ fecha(r.vigente_desde, zona) }}
            </li>
          </ul>
        </HudPanel>
      </template>
    </template>

    <template v-else>
      <HudCampo
        v-model="filtros.q"
        etiqueta="Buscar por nombre o documento"
        tipo="search"
        autocompletar="off"
      />
      <HudEstado
        v-if="listado.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'error'"
        estado="error"
        :mensaje="listado.error.value ?? undefined"
        @reintentar="listado.recargar()"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        :mensaje="filtros.q ? 'Ninguna persona coincide.' : 'Aún no hay personas registradas.'"
      />
      <template v-else>
        <HudTabla
          :filas="listado.filas.value"
          :columnas="COLUMNAS"
          clave="id"
          titulo="Personas de la copropiedad"
        >
          <template #celda-nombre="{ fila }">
            <span class="celda">
              <strong>{{ fila.nombre }}</strong>
              <small>{{ [fila.tipo_documento, fila.documento].filter(Boolean).join(' ') }}</small>
            </span>
          </template>
          <template #celda-contacto="{ fila }">
            {{ [fila.telefono, fila.correo].filter(Boolean).join(' · ') || '—' }}
          </template>
          <template #celda-acciones="{ fila }">
            <HudBoton
              :a="ruta(fila.id)"
              variante="fantasma"
            >
              Ver<span class="solo-lector"> a {{ fila.nombre }}</span>
            </HudBoton>
          </template>
        </HudTabla>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </template>
    </template>
  </section>
</template>

<style scoped>
.personas {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.volver {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
  align-items: end;
  gap: 12px 16px;
  margin: 0 0 12px;
}

dt {
  color: var(--texto-3);
  font-size: 13px;
}

dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.celda {
  display: grid;
  text-align: left;
}

small,
.texto-2 {
  color: var(--texto-2);
}

.texto-2 {
  margin: 0 0 12px;
}

.lista {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista a {
  color: var(--cian);
}

.casilla {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.botones {
  display: flex;
  gap: 8px;
  grid-column: 1 / -1;
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
  grid-column: 1 / -1;
}
</style>

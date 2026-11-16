<script setup lang="ts">
/**
 * Usuarios y roles de la entidad: el equipo (roles, contraseña pendiente, último acceso),
 * crear un usuario con su rol, gestionar sus roles y la carga masiva.
 */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { NuevoUsuario, Rol, Usuario, UsuarioCreado } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IBuscar from '~icons/tabler/search'
import IMas from '~icons/tabler/user-plus'
import ISubir from '~icons/tabler/table-import'
import { crearUsuario, listarRoles, listarUsuarios } from '../api'
import DetalleUsuario from '../componentes/DetalleUsuario.vue'
import FormularioUsuario from '../componentes/FormularioUsuario.vue'
import ImportarUsuarios from '../componentes/ImportarUsuarios.vue'
import { estadoDeUsuario, nombresDeRoles } from '../usuarios'

const entidad = useEntidad()
const entidadId = computed(() => entidad.activa?.entidad_id ?? '')
const puedeAsignar = computed(() => entidad.tienePermiso('roles.asignar'))
const puedeImportar = computed(() => puedeAsignar.value && entidad.tienePermiso('importaciones.ejecutar'))

const filtros = ref({ q: '' })
const usuarios = useListado((despues, f: { q: string }) => listarUsuarios(entidadId.value, despues, f.q), { filtros })

const roles = ref<Rol[]>([])
const errorRoles = ref<string | null>(null)
const creando = ref(false)
const importando = ref(false)
const resultado = ref<string | null>(null)
const elegido = ref<Usuario | null>(null)
const verDetalle = ref(false)

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Usuario' },
  { clave: 'roles', titulo: 'Roles' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'ultimo_acceso_en', titulo: 'Último acceso' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

/** Mensaje tras crear: cuenta nueva (código), cuenta existente (aviso) o ya tenía el rol. */
function mensajeCreado(r: UsuarioCreado, correo: string): string {
  if (r.cuenta_nueva) return `Usuario creado. Le enviamos a ${correo} un código para definir su contraseña.`
  if (!r.asignacion_id) return `${correo} ya tenía ese rol en la entidad: no hubo cambios.`
  return `${correo} ya tenía cuenta en DAD: se le asignó el rol y se le avisó por correo.`
}

const crear = useAccion((clave, datos: NuevoUsuario) => crearUsuario(entidadId.value, datos, clave))

async function enviarUsuario(datos: NuevoUsuario) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  creando.value = false
  resultado.value = mensajeCreado(r.valor, datos.correo)
  await usuarios.recargar()
}

function abrirCrear() {
  crear.reiniciar()
  resultado.value = null
  creando.value = true
}

function gestionar(u: Usuario) {
  elegido.value = u
  verDetalle.value = true
}

async function cargarRoles() {
  errorRoles.value = null
  try {
    roles.value = await listarRoles(entidadId.value)
  } catch (e) {
    errorRoles.value = e instanceof ErrorApi ? mensajeDeError(e) : 'No se pudieron cargar los roles.'
  }
}

onMounted(cargarRoles)
</script>

<template>
  <section
    class="usuarios"
    aria-labelledby="titulo-usuarios"
  >
    <header class="encabezado">
      <div>
        <h1 id="titulo-usuarios">
          Usuarios y roles
        </h1>
        <p class="texto-2">
          Quién trabaja en la entidad y con qué rol.
        </p>
      </div>
      <div class="botones">
        <HudBoton
          v-if="puedeImportar"
          variante="secundario"
          :aria-expanded="importando"
          @click="importando = !importando"
        >
          <ISubir aria-hidden="true" /> Carga masiva
        </HudBoton>
        <HudBoton
          v-if="puedeAsignar"
          :deshabilitado="roles.length === 0"
          @click="abrirCrear"
        >
          <IMas aria-hidden="true" /> Crear usuario
        </HudBoton>
      </div>
    </header>

    <p
      v-if="errorRoles"
      class="error"
      role="alert"
    >
      {{ errorRoles }}
      <button
        type="button"
        class="enlace"
        @click="cargarRoles"
      >
        Reintentar
      </button>
    </p>
    <p
      v-if="resultado"
      class="resultado"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudPanel
      v-if="importando"
      etiqueta="Carga masiva de usuarios"
    >
      <ImportarUsuarios
        :entidad-id="entidadId"
        @aplicada="usuarios.recargar()"
      />
    </HudPanel>

    <HudCampo
      v-model="filtros.q"
      etiqueta="Buscar"
      tipo="search"
      autocompletar="off"
      ayuda="Por nombre, usuario o correo."
    >
      <template #antes>
        <IBuscar
          class="icono-campo"
          aria-hidden="true"
        />
      </template>
    </HudCampo>

    <HudEstado
      v-if="usuarios.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="usuarios.estado.value === 'error'"
      estado="error"
      :mensaje="usuarios.error.value ?? undefined"
      :referencia="usuarios.referencia.value"
      @reintentar="usuarios.recargar()"
    />
    <HudEstado
      v-else-if="usuarios.estado.value === 'vacio'"
      estado="vacio"
      :mensaje="filtros.q ? 'Ningún usuario coincide con la búsqueda.' : 'Aún no hay usuarios en la entidad.'"
    />
    <template v-else>
      <HudTabla
        :filas="usuarios.filas.value"
        :columnas="COLUMNAS"
        clave="cuenta_id"
        titulo="Usuarios de la entidad"
      >
        <template #celda-nombre="{ fila }">
          <span class="persona">
            <strong>{{ fila.nombre }}</strong>
            <small>{{ fila.correo ?? fila.usuario ?? '' }}</small>
          </span>
        </template>
        <template #celda-roles="{ fila }">
          {{ nombresDeRoles(fila.roles, roles).join(', ') || '—' }}
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="estadoDeUsuario(fila).tono">
            {{ estadoDeUsuario(fila).texto }}
          </HudInsignia>
        </template>
        <template #celda-ultimo_acceso_en="{ fila }">
          {{ fila.ultimo_acceso_en ? fechaHora(fila.ultimo_acceso_en, entidad.zonaHoraria) : 'Nunca' }}
        </template>
        <template #celda-acciones="{ fila }">
          <HudBoton
            variante="fantasma"
            @click="gestionar(fila)"
          >
            Gestionar<span class="solo-lector"> a {{ fila.nombre }}</span>
          </HudBoton>
        </template>
      </HudTabla>
      <HudCargarMas
        :hay-mas="usuarios.hayMas.value"
        :cargando="usuarios.cargando.value"
        @cargar="usuarios.cargarMas()"
      />
    </template>

    <FormularioUsuario
      v-model:abierto="creando"
      :roles="roles"
      :cargando="crear.cargando.value"
      :error="crear.error.value"
      @enviar="enviarUsuario"
    />
    <DetalleUsuario
      v-model:abierto="verDetalle"
      :usuario="elegido"
      :roles="roles"
      :entidad-id="entidadId"
      :puede-asignar="puedeAsignar"
      @cambio="usuarios.recargar()"
    />
  </section>
</template>

<style scoped>
.usuarios {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  font-size: clamp(26px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.persona {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
  overflow-wrap: anywhere;
}

.icono-campo {
  color: var(--texto-3);
}

.resultado {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  margin: 0;
  color: var(--magenta);
}

.enlace {
  min-height: 40px;
  border: 0;
  background: none;
  color: var(--cian);
  text-decoration: underline;
  cursor: pointer;
}
</style>

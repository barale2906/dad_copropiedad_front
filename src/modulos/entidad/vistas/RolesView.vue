<script setup lang="ts">
/**
 * Roles y permisos de la entidad: el listado (plantillas del sistema y roles propios), crear un
 * rol y, con `:id` en la ruta, el detalle con su matriz de permisos.
 */
import { computed, onMounted, ref } from 'vue'
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { NuevoRol, PermisoDelCatalogo, Rol } from '@/api/tipos'
import { catalogoPermisos, crearRol, listarRoles } from '@/api/usuarios'
import { agruparPermisos } from '@/formato/permisos'
import { useAccion } from '@/composables/useAccion'
import FormularioRol from '@/hud/componentes/FormularioRol.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import DetalleRol from '../componentes/DetalleRol.vue'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const entidadId = computed(() => entidad.activa?.entidad_id ?? '')
const puedeGestionar = computed(() => entidad.tienePermiso('roles.gestionar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const roles = ref<Rol[]>([])
const catalogo = ref<PermisoDelCatalogo[]>([])
const creando = ref(false)
const base = ref('')

const rolId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const rol = computed(() => roles.value.find((r) => r.id === rolId.value) ?? null)
const grupos = computed(() => agruparPermisos(catalogo.value, 'copropiedad'))
const ordenados = computed(() =>
  [...roles.value].sort((a, b) => Number(a.es_plantilla) - Number(b.es_plantilla) || a.nombre.localeCompare(b.nombre)),
)

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Rol' },
  { clave: 'tipo', titulo: 'Tipo' },
  { clave: 'permisos', titulo: 'Permisos', alinear: 'fin' as const },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

function rutaRol(id = ''): RouteLocationRaw {
  return { name: 'modulo', params: { ...route.params, id }, query: route.query }
}

const crear = useAccion((clave, datos: NuevoRol) => crearRol(entidadId.value, datos, clave))

async function enviarRol(datos: NuevoRol) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  creando.value = false
  roles.value = [...roles.value, r.valor]
  await router.push(rutaRol(r.valor.id))
}

function abrirCrear(desde = '') {
  crear.reiniciar()
  base.value = desde
  creando.value = true
}

function actualizado(r: Rol) {
  roles.value = roles.value.map((x) => (x.id === r.id ? r : x))
}

async function cargar() {
  estado.value = 'cargando'
  try {
    ;[roles.value, catalogo.value] = await Promise.all([listarRoles(entidadId.value), catalogoPermisos()])
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
    class="roles"
    aria-labelledby="titulo-roles"
  >
    <header class="encabezado">
      <div>
        <RouterLink
          v-if="rolId"
          :to="rutaRol()"
          class="volver"
        >
          <IVolver aria-hidden="true" /> Todos los roles
        </RouterLink>
        <h1 id="titulo-roles">
          {{ rolId ? 'Permisos del rol' : 'Roles y permisos' }}
        </h1>
        <p
          v-if="!rolId"
          class="texto-2"
        >
          Qué puede hacer cada rol. Los del sistema vienen listos; los propios los define la entidad.
        </p>
      </div>
      <HudBoton
        v-if="puedeGestionar && !rolId"
        :deshabilitado="estado !== 'listo'"
        @click="abrirCrear()"
      >
        <IMas aria-hidden="true" /> Crear rol
      </HudBoton>
    </header>

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
    <template v-else-if="rolId">
      <DetalleRol
        v-if="rol"
        :rol="rol"
        :grupos="grupos"
        :entidad-id="entidadId"
        :puede-gestionar="puedeGestionar"
        @guardado="actualizado"
        @crear-desde="abrirCrear"
      />
      <HudEstado
        v-else
        estado="vacio"
        mensaje="Ese rol no existe en la entidad."
      />
    </template>
    <HudEstado
      v-else-if="roles.length === 0"
      estado="vacio"
      mensaje="La entidad aún no tiene roles."
    />
    <HudTabla
      v-else
      :filas="ordenados"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Roles de la entidad"
    >
      <template #celda-nombre="{ fila }">
        <span class="rol">
          <strong>{{ fila.nombre }}</strong>
          <small>{{ fila.descripcion ?? fila.codigo }}</small>
        </span>
      </template>
      <template #celda-tipo="{ fila }">
        <HudInsignia :tono="fila.es_plantilla ? 'info' : 'neutro'">
          {{ fila.es_plantilla ? 'Del sistema' : 'Propio' }}
        </HudInsignia>
      </template>
      <template #celda-permisos="{ fila }">
        {{ fila.permisos.length }}
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          :a="rutaRol(fila.id)"
          variante="fantasma"
        >
          {{ puedeGestionar && !fila.es_plantilla ? 'Editar permisos' : 'Ver permisos' }}<span class="solo-lector">
            de {{ fila.nombre }}</span>
        </HudBoton>
      </template>
    </HudTabla>

    <FormularioRol
      v-model:abierto="creando"
      :roles="roles"
      :base="base"
      :puede-otorgar="entidad.tienePermiso"
      :cargando="crear.cargando.value"
      :error="crear.error.value"
      @enviar="enviarRol"
    />
  </section>
</template>

<style scoped>
.roles {
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

.volver {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}

.rol {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
  overflow-wrap: anywhere;
}
</style>

<script setup lang="ts">
/**
 * Usuarios de un cliente desde la plataforma (`plataforma.entidades.usuarios`): los mismos
 * esquemas y piezas que «Datos y usuarios» (plan 04) por la ruta `/plataforma/entidades/{id}`.
 * Crear un usuario, asignar un rol a una cuenta existente, ver sus roles y quitarlos.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CuentaPlataforma, NuevoUsuario, Rol, Usuario } from '@/api/tipos'
import { asignarRol, crearUsuario, listarRoles, listarUsuarios } from '@/api/usuarios'
import { useAccion } from '@/composables/useAccion'
import { useDetalleUsuario } from '@/composables/useDetalleUsuario'
import { useListado } from '@/composables/useListado'
import { estadoDeUsuario, nombresDeRoles } from '@/formato/usuarios'
import DetalleUsuario from '@/hud/componentes/DetalleUsuario.vue'
import FormularioUsuario from '@/hud/componentes/FormularioUsuario.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import BuscarCuentaPlataforma from './BuscarCuentaPlataforma.vue'

const props = defineProps<{ entidadId: string }>()

const destino = computed(() => ({ plataforma: props.entidadId }))
const usuarios = useListado((despues) => listarUsuarios(destino.value, despues))
const roles = ref<Rol[]>([])
const errorRoles = ref<string | null>(null)
const creando = ref(false)
const asignando = ref(false)
const cuenta = ref<CuentaPlataforma | null>(null)
const rolId = ref('')
const elegido = ref<Usuario | null>(null)
const verDetalle = ref(false)
const resultado = ref<string | null>(null)

const opcionesRol = computed(() => roles.value.map((r) => ({ valor: r.id, etiqueta: r.nombre })))

const crear = useAccion((clave, datos: NuevoUsuario) => crearUsuario(destino.value, datos, clave))
const asignar = useAccion((clave) => asignarRol(props.entidadId, cuenta.value?.id ?? '', rolId.value, clave))

async function enviarUsuario(datos: NuevoUsuario) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  creando.value = false
  resultado.value = r.valor.cuenta_nueva
    ? `Usuario creado: le enviamos a ${datos.correo} un código para definir su contraseña.`
    : `${datos.correo} ya tenía cuenta: se le asignó el rol.`
  await usuarios.recargar()
}

function abrirCrear() {
  crear.reiniciar()
  creando.value = true
}

function abrirAsignar() {
  asignar.reiniciar()
  cuenta.value = null
  rolId.value = ''
  asignando.value = true
}

async function enviarAsignacion() {
  if (!cuenta.value || !rolId.value) return
  const r = await asignar.ejecutar()
  if (!r.ok) return
  asignando.value = false
  resultado.value = `Se asignó el rol a ${cuenta.value.nombre}.`
  await usuarios.recargar()
}

const detalle = useDetalleUsuario(
  () => destino.value,
  () => roles.value,
  () => void usuarios.recargar(),
)

function gestionar(u: Usuario) {
  elegido.value = u
  detalle.abrir(u)
  verDetalle.value = true
}

onMounted(async () => {
  try {
    roles.value = await listarRoles(destino.value)
  } catch (e) {
    errorRoles.value = mensajeDeError(e)
  }
})
</script>

<template>
  <div class="campos">
    <div class="botones">
      <HudBoton
        :deshabilitado="roles.length === 0"
        @click="abrirCrear"
      >
        Crear usuario
      </HudBoton>
      <HudBoton
        variante="secundario"
        :deshabilitado="roles.length === 0"
        @click="abrirAsignar"
      >
        Asignar rol a una cuenta
      </HudBoton>
    </div>
    <p
      v-if="errorRoles"
      class="error"
      role="alert"
    >
      {{ errorRoles }}
    </p>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudEstado
      v-if="usuarios.estado.value === 'cargando'"
      estado="cargando"
      :filas="3"
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
      mensaje="La entidad aún no tiene usuarios."
    />
    <template v-else>
      <ul class="lista">
        <li
          v-for="u in usuarios.filas.value"
          :key="u.cuenta_id"
        >
          <span class="crece">
            <strong>{{ u.nombre }}</strong>
            <small>{{ u.correo ?? u.usuario }} · {{ nombresDeRoles(u.roles, roles).join(', ') || 'Sin roles' }}</small>
          </span>
          <HudInsignia :tono="estadoDeUsuario(u).tono">
            {{ estadoDeUsuario(u).texto }}
          </HudInsignia>
          <HudBoton
            variante="fantasma"
            @click="gestionar(u)"
          >
            Roles<span class="solo-lector"> de {{ u.nombre }}</span>
          </HudBoton>
        </li>
      </ul>
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
      :detalle="detalle"
      puede-asignar
    />
    <HudDialogo
      v-model:abierto="asignando"
      titulo="Asignar rol a una cuenta"
    >
      <div class="campos">
        <BuscarCuentaPlataforma @encontrada="cuenta = $event" />
        <p
          v-if="cuenta"
          class="ok"
          role="status"
        >
          Cuenta: <strong>{{ cuenta.nombre }}</strong>
        </p>
        <HudSelector
          v-model="rolId"
          etiqueta="Rol en la entidad"
          :opciones="opcionesRol"
          vacio="Elija un rol"
        />
        <p
          v-if="asignar.error.value"
          class="error"
          role="alert"
        >
          {{ asignar.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="asignando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :deshabilitado="!cuenta || !rolId"
          :cargando="asignar.cargando.value"
          @click="enviarAsignacion"
        >
          Asignar rol
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

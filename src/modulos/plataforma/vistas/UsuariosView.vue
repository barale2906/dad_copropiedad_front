<script setup lang="ts">
/**
 * Usuarios de la plataforma: buscar una cuenta (usuario o correo exactos), crear un usuario de
 * la plataforma con su rol, bloquear o desbloquear cuentas y los roles con su matriz de permisos.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CuentaPlataforma, Rol } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IMas from '~icons/tabler/user-plus'
import { crearUsuarioPlataforma, rolesPlataforma } from '../api-clientes'
import BuscarCuentaPlataforma from '../componentes/BuscarCuentaPlataforma.vue'
import FichaCuenta from '../componentes/FichaCuenta.vue'
import RolesPlataforma from '../componentes/RolesPlataforma.vue'
import { usePermisosPlataforma } from '../store'

const { puede } = usePermisosPlataforma()
const TODAS = [
  { id: 'cuentas', texto: 'Cuentas' },
  { id: 'roles', texto: 'Roles y permisos' },
] as const
const PESTANAS = computed(() =>
  TODAS.filter((p) => (p.id === 'cuentas' ? puede('plataforma.cuentas.ver') : puede('plataforma.roles.gestionar') || puede('plataforma.roles.asignar'))),
)
const pestana = usePestana(TODAS)

const roles = ref<Rol[]>([])
const estadoRoles = ref<'cargando' | 'listo' | 'error'>('cargando')
const errorRoles = ref<string | null>(null)
const cuenta = ref<CuentaPlataforma | null>(null)
const creando = ref(false)
const nuevo = ref({ nombre: '', correo: '', usuario: '', rol: '' })
const intentado = ref(false)
const resultado = ref<string | null>(null)

const opcionesRol = computed(() => [{ valor: '', etiqueta: 'Sin rol por ahora' }, ...roles.value.map((r) => ({ valor: r.id, etiqueta: r.nombre }))])
const errorNombre = computed(() => (intentado.value && nuevo.value.nombre.trim().length < 3 ? 'Escriba el nombre.' : null))
const errorCorreo = computed(() =>
  intentado.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo.value.correo.trim()) ? 'Escriba un correo válido.' : null,
)

const crear = useAccion((clave) =>
  crearUsuarioPlataforma(
    {
      nombre: nuevo.value.nombre.trim(),
      correo: nuevo.value.correo.trim(),
      usuario: nuevo.value.usuario.trim() || null,
      rol_plataforma_id: nuevo.value.rol || null,
    },
    clave,
  ),
)

function abrirCrear() {
  nuevo.value = { nombre: '', correo: '', usuario: '', rol: '' }
  intentado.value = false
  crear.reiniciar()
  creando.value = true
}

async function enviar() {
  intentado.value = true
  if (errorNombre.value || errorCorreo.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  resultado.value = r.valor.cuenta_nueva
    ? `Usuario creado: a ${nuevo.value.correo} le llega un código para definir su contraseña.`
    : `${nuevo.value.correo} ya tenía cuenta en DAD${nuevo.value.rol ? ': se le asignó el rol' : ''}.`
}

onMounted(async () => {
  try {
    roles.value = await rolesPlataforma()
    estadoRoles.value = 'listo'
  } catch (e) {
    errorRoles.value = mensajeDeError(e)
    estadoRoles.value = 'error'
  }
})
</script>

<template>
  <section aria-labelledby="titulo-usuarios-plataforma">
    <header class="encabezado">
      <div>
        <h1 id="titulo-usuarios-plataforma">
          Usuarios de la plataforma
        </h1>
        <p class="texto-2">
          Cuentas del equipo DAD y de cualquier entidad: bloqueos, roles de plataforma y sus permisos.
        </p>
      </div>
      <HudBoton
        v-if="puede('plataforma.cuentas.crear')"
        @click="abrirCrear"
      >
        <IMas aria-hidden="true" /> Crear usuario
      </HudBoton>
    </header>
    <HudPestanas
      v-if="PESTANAS.length > 1"
      :pestanas="PESTANAS"
      etiqueta="Usuarios de la plataforma"
    />
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <template v-if="pestana === 'cuentas' && puede('plataforma.cuentas.ver')">
      <HudPanel etiqueta="Buscar una cuenta">
        <BuscarCuentaPlataforma @encontrada="cuenta = $event" />
      </HudPanel>
      <HudPanel
        v-if="cuenta"
        etiqueta="Cuenta"
      >
        <FichaCuenta
          :key="cuenta.id"
          :cuenta="cuenta"
          :roles="roles"
          @cambio="cuenta = $event"
        />
      </HudPanel>
    </template>
    <template v-else-if="puede('plataforma.roles.gestionar') || puede('plataforma.roles.asignar')">
      <HudEstado
        v-if="estadoRoles === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estadoRoles === 'error'"
        estado="error"
        :mensaje="errorRoles ?? undefined"
      />
      <RolesPlataforma
        v-else
        v-model:roles="roles"
      />
    </template>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Crear usuario de la plataforma"
    >
      <form
        id="formulario-usuario-plataforma"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudCampo
          v-model="nuevo.nombre"
          etiqueta="Nombre"
          :error="errorNombre"
        />
        <HudCampo
          v-model="nuevo.correo"
          etiqueta="Correo"
          tipo="email"
          modo-entrada="email"
          :error="errorCorreo"
          ayuda="Allí le llega el código para definir la contraseña."
        />
        <HudCampo
          v-model="nuevo.usuario"
          etiqueta="Usuario (opcional)"
          autocompletar="off"
        />
        <HudSelector
          v-model="nuevo.rol"
          etiqueta="Rol de plataforma"
          :opciones="opcionesRol"
        />
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-usuario-plataforma"
          :cargando="crear.cargando.value"
        >
          Crear usuario
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<script setup lang="ts">
/**
 * Roles de plataforma (soporte, comercial, superusuario…): el listado, crear uno propio y editar
 * su matriz de permisos. Las plantillas solo se consultan; un permiso que la cuenta no tiene no
 * se puede otorgar.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { NuevoRol, Permiso, PermisoDelCatalogo, Rol } from '@/api/tipos'
import { catalogoPermisos } from '@/api/usuarios'
import { useAccion } from '@/composables/useAccion'
import { agruparPermisos, diferencia, noOtorgables } from '@/formato/permisos'
import FormularioRol from '@/hud/componentes/FormularioRol.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import MatrizPermisos from '@/hud/componentes/MatrizPermisos.vue'
import { useCuenta } from '@/stores/cuenta'
import IMas from '~icons/tabler/plus'
import { crearRolPlataforma, permisosRolPlataforma } from '../api-clientes'
import { usePermisosPlataforma } from '../store'

const roles = defineModel<Rol[]>('roles', { required: true })

const cuenta = useCuenta()
const { puede } = usePermisosPlataforma()
const catalogo = ref<PermisoDelCatalogo[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const elegidoId = ref('')
const elegidos = ref<Permiso[]>([])
const creando = ref(false)
const guardadoOk = ref(false)

const puedeGestionar = computed(() => puede('plataforma.roles.gestionar'))
const otorga = (p: Permiso) => cuenta.permisosPlataforma.has(p)
const grupos = computed(() => agruparPermisos(catalogo.value, 'plataforma'))
const rol = computed(() => roles.value.find((r) => r.id === elegidoId.value) ?? null)
const editable = computed(() => !!rol.value && puedeGestionar.value && !rol.value.es_plantilla)
const cambios = computed(() => (rol.value ? diferencia(rol.value.permisos, elegidos.value) : { agregados: [], quitados: [] }))
const hayCambios = computed(() => cambios.value.agregados.length + cambios.value.quitados.length > 0)
const ajenos = computed(() => noOtorgables(elegidos.value, otorga))

const crear = useAccion((clave, datos: NuevoRol) => crearRolPlataforma(datos, clave))
const guardar = useAccion((_clave, permisos: Permiso[]) => permisosRolPlataforma(elegidoId.value, permisos), {
  alExito: (r) => {
    roles.value = roles.value.map((x) => (x.id === r.id ? r : x))
    guardadoOk.value = true
  },
})

watch(rol, (r) => {
  elegidos.value = r ? [...r.permisos] : []
  guardadoOk.value = false
  guardar.reiniciar()
})

async function enviarRol(datos: NuevoRol) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  creando.value = false
  roles.value = [...roles.value, r.valor]
  elegidoId.value = r.valor.id
}

function abrirCrear() {
  crear.reiniciar()
  creando.value = true
}

onMounted(async () => {
  try {
    catalogo.value = await catalogoPermisos()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
})
</script>

<template>
  <div class="campos">
    <div
      v-if="puedeGestionar"
      class="botones"
    >
      <HudBoton @click="abrirCrear">
        <IMas aria-hidden="true" /> Crear rol de plataforma
      </HudBoton>
    </div>
    <ul class="lista">
      <li
        v-for="r in roles"
        :key="r.id"
      >
        <span class="crece">
          <strong>{{ r.nombre }}</strong>
          <small>{{ r.codigo }} · {{ r.permisos.length }} permisos</small>
        </span>
        <HudInsignia :tono="r.es_plantilla ? 'info' : 'neutro'">
          {{ r.es_plantilla ? 'Plantilla' : 'Propio' }}
        </HudInsignia>
        <HudBoton
          variante="fantasma"
          :aria-pressed="elegidoId === r.id"
          @click="elegidoId = elegidoId === r.id ? '' : r.id"
        >
          {{ elegidoId === r.id ? 'Ocultar permisos' : 'Ver permisos' }}<span class="solo-lector"> de {{ r.nombre }}</span>
        </HudBoton>
      </li>
    </ul>

    <HudEstado
      v-if="rol && estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="rol && estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
    />
    <HudPanel
      v-else-if="rol"
      :etiqueta="`Permisos de ${rol.nombre}`"
    >
      <p
        v-if="rol.es_plantilla"
        class="texto-2"
      >
        Los roles del sistema no se editan; cree uno propio a partir de ellos.
      </p>
      <MatrizPermisos
        v-model="elegidos"
        :grupos="grupos"
        :solo-lectura="!editable"
        :puede-otorgar="otorga"
      />
      <template v-if="editable">
        <p
          v-if="ajenos.length"
          class="aviso"
        >
          Tiene {{ ajenos.length }} permisos que usted no puede otorgar: el backend rechazará el cambio.
        </p>
        <div class="botones">
          <HudBoton
            :deshabilitado="!hayCambios"
            :cargando="guardar.cargando.value"
            @click="guardar.ejecutar(elegidos)"
          >
            Guardar permisos
          </HudBoton>
        </div>
        <p
          v-if="guardadoOk"
          class="ok"
          role="status"
        >
          Permisos guardados.
        </p>
        <p
          v-if="guardar.error.value"
          class="error"
          role="alert"
        >
          {{ guardar.error.value }}
        </p>
      </template>
    </HudPanel>

    <FormularioRol
      v-model:abierto="creando"
      :roles="roles"
      :puede-otorgar="otorga"
      :cargando="crear.cargando.value"
      :error="crear.error.value"
      @enviar="enviarRol"
    />
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

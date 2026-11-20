<script setup lang="ts">
/**
 * Una cuenta de DAD vista desde la plataforma: estado, contraseña pendiente, segundo factor y
 * bloqueo temporal; bloquearla (cierra sus sesiones) o desbloquearla con motivo, y sus roles de
 * plataforma: los vigentes (quitarlos), el historial y asignar uno nuevo.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { AsignacionPlataforma, CuentaPlataforma, Rol } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fecha, fechaHora } from '@/formato/fechas'
import { vigente } from '@/formato/usuarios'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { asignacionesPlataforma, asignarRolPlataforma, bloquearCuenta, desbloquearCuenta, quitarRolPlataforma } from '../api-clientes'
import { usePermisosPlataforma } from '../store'

const props = defineProps<{ cuenta: CuentaPlataforma; roles: Rol[] }>()
const emit = defineEmits<{ cambio: [cuenta: CuentaPlataforma] }>()

const entidad = useEntidad()
const { puede } = usePermisosPlataforma()
const confirmandoBloqueo = ref(false)
const pidiendoMotivo = ref(false)
const rolId = ref('')
const asignaciones = ref<AsignacionPlataforma[]>([])
const estadoRoles = ref<'cargando' | 'listo' | 'error'>('cargando')
const errorRoles = ref<string | null>(null)
const resultado = ref<string | null>(null)

const bloqueada = computed(() => props.cuenta.estado === 'bloqueada')
const puedeVerRoles = computed(() => puede('plataforma.roles.asignar') || puede('plataforma.roles.gestionar'))
const nombreRol = (rolId: string) => props.roles.find((r) => r.id === rolId)?.nombre ?? 'Rol'
const vigentes = computed(() => asignaciones.value.filter((a) => vigente(a)))
const anteriores = computed(() => asignaciones.value.filter((a) => !vigente(a)))
/** No se ofrece un rol que la cuenta ya tiene vigente. */
const opcionesRol = computed(() =>
  props.roles.filter((r) => !vigentes.value.some((a) => a.rol_id === r.id)).map((r) => ({ valor: r.id, etiqueta: r.nombre })),
)
const estado = computed(() => {
  if (bloqueada.value) return { texto: 'Bloqueada', tono: 'peligro' as const }
  if (props.cuenta.estado === 'eliminada') return { texto: 'Eliminada', tono: 'neutro' as const }
  if (props.cuenta.contrasena_pendiente) return { texto: 'Contraseña pendiente', tono: 'aviso' as const }
  return { texto: 'Activa', tono: 'exito' as const }
})

const bloquear = useAccion(() => bloquearCuenta(props.cuenta.id), {
  alExito: () => {
    confirmandoBloqueo.value = false
    resultado.value = 'Cuenta bloqueada: se cerraron sus sesiones.'
    emit('cambio', { ...props.cuenta, estado: 'bloqueada' })
  },
})
const desbloquear = useAccion((_clave, motivo: string) => desbloquearCuenta(props.cuenta.id, motivo), {
  alExito: () => {
    pidiendoMotivo.value = false
    resultado.value = 'Cuenta desbloqueada: ya puede iniciar sesión.'
    emit('cambio', { ...props.cuenta, estado: 'activa', bloqueo_temporal_hasta: null })
  },
})
const asignar = useAccion((clave) => asignarRolPlataforma(props.cuenta.id, rolId.value, clave), {
  alExito: () => {
    resultado.value = 'Rol de plataforma asignado.'
    rolId.value = ''
    void cargarRoles()
  },
})
const quitar = useAccion((_clave, id: string) => quitarRolPlataforma(id), {
  alExito: () => {
    resultado.value = 'Rol de plataforma quitado.'
    void cargarRoles()
  },
})

const errores = computed(() => [asignar.error.value, quitar.error.value].filter((e): e is string => !!e))

async function cargarRoles() {
  if (!puedeVerRoles.value) return
  try {
    asignaciones.value = await asignacionesPlataforma(props.cuenta.id)
    estadoRoles.value = 'listo'
  } catch (e) {
    errorRoles.value = mensajeDeError(e)
    estadoRoles.value = 'error'
  }
}

function reintentarRoles() {
  estadoRoles.value = 'cargando'
  void cargarRoles()
}

function abrirBloqueo() {
  bloquear.reiniciar()
  confirmandoBloqueo.value = true
}

function abrirDesbloqueo() {
  desbloquear.reiniciar()
  pidiendoMotivo.value = true
}

onMounted(cargarRoles)
</script>

<template>
  <article class="campos">
    <header class="encabezado">
      <div>
        <h2>{{ cuenta.nombre }}</h2>
        <p class="texto-2">
          {{ cuenta.correo ?? 'Sin correo' }}<template v-if="cuenta.usuario">
            · usuario {{ cuenta.usuario }}
          </template>
        </p>
      </div>
      <HudInsignia :tono="estado.tono">
        {{ estado.texto }}
      </HudInsignia>
    </header>
    <dl class="datos">
      <div>
        <dt>Correo verificado</dt>
        <dd>{{ cuenta.correo_verificado ? 'Sí' : 'No' }}</dd>
      </div>
      <div>
        <dt>Segundo factor</dt>
        <dd>{{ cuenta.segundo_factor_activo ? 'Activo' : 'Sin activar' }}</dd>
      </div>
      <div v-if="cuenta.bloqueo_temporal_hasta">
        <dt>Bloqueo por intentos</dt>
        <dd>Hasta {{ fechaHora(cuenta.bloqueo_temporal_hasta, entidad.zonaHoraria) }}</dd>
      </div>
    </dl>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <div
      v-if="puede('plataforma.cuentas.bloquear')"
      class="botones"
    >
      <HudBoton
        v-if="bloqueada || cuenta.bloqueo_temporal_hasta"
        variante="secundario"
        @click="abrirDesbloqueo"
      >
        Desbloquear
      </HudBoton>
      <HudBoton
        v-if="!bloqueada && cuenta.estado !== 'eliminada'"
        variante="fantasma"
        @click="abrirBloqueo"
      >
        Bloquear
      </HudBoton>
    </div>

    <section
      v-if="puedeVerRoles"
      class="campos"
      aria-labelledby="titulo-roles-cuenta"
    >
      <h3 id="titulo-roles-cuenta">
        Roles de plataforma
      </h3>
      <HudEstado
        v-if="estadoRoles === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estadoRoles === 'error'"
        estado="error"
        :mensaje="errorRoles ?? undefined"
        @reintentar="reintentarRoles"
      />
      <template v-else>
        <ul
          v-if="vigentes.length"
          class="lista"
          aria-label="Roles de plataforma vigentes"
        >
          <li
            v-for="a in vigentes"
            :key="a.id"
          >
            <span class="crece">
              <strong>{{ nombreRol(a.rol_id) }}</strong>
              <small>Desde el {{ fecha(a.vigente_desde, entidad.zonaHoraria) }}<template v-if="a.vigente_hasta"> · hasta el {{ fecha(a.vigente_hasta, entidad.zonaHoraria) }}</template></small>
            </span>
            <HudBoton
              v-if="puede('plataforma.roles.asignar')"
              variante="fantasma"
              :cargando="quitar.cargando.value"
              @click="quitar.ejecutar(a.id)"
            >
              Quitar<span class="solo-lector"> {{ nombreRol(a.rol_id) }}</span>
            </HudBoton>
          </li>
        </ul>
        <p
          v-else
          class="texto-2"
        >
          No tiene roles de plataforma vigentes.
        </p>
        <details v-if="anteriores.length">
          <summary>Historial ({{ anteriores.length }})</summary>
          <ul class="lista">
            <li
              v-for="a in anteriores"
              :key="a.id"
            >
              <span class="crece">
                <strong>{{ nombreRol(a.rol_id) }}</strong>
                <small>Del {{ fecha(a.vigente_desde, entidad.zonaHoraria) }} al {{ a.vigente_hasta ? fecha(a.vigente_hasta, entidad.zonaHoraria) : '—' }}</small>
              </span>
            </li>
          </ul>
        </details>
        <div
          v-if="puede('plataforma.roles.asignar')"
          class="filtros"
        >
          <HudSelector
            v-model="rolId"
            etiqueta="Rol de plataforma"
            :opciones="opcionesRol"
            vacio="Elija un rol"
          />
          <div>
            <HudBoton
              :deshabilitado="!rolId"
              :cargando="asignar.cargando.value"
              @click="asignar.ejecutar()"
            >
              Asignar
            </HudBoton>
          </div>
        </div>
      </template>
      <p
        v-for="e in errores"
        :key="e"
        class="error"
        role="alert"
      >
        {{ e }}
      </p>
    </section>

    <HudDialogo
      v-model:abierto="confirmandoBloqueo"
      titulo="¿Bloquear la cuenta?"
    >
      <p class="aviso">
        {{ cuenta.nombre }} no podrá iniciar sesión en ninguna entidad y se cerrarán sus sesiones abiertas.
      </p>
      <p
        v-if="bloquear.error.value"
        class="error"
        role="alert"
      >
        {{ bloquear.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmandoBloqueo = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="bloquear.cargando.value"
          @click="bloquear.ejecutar()"
        >
          Bloquear cuenta
        </HudBoton>
      </template>
    </HudDialogo>
    <ConfirmarConMotivo
      v-model:abierto="pidiendoMotivo"
      titulo="Desbloquear la cuenta"
      accion="Desbloquear"
      descripcion="Diga por qué se desbloquea (queda en la auditoría)."
      :cargando="desbloquear.cargando.value"
      :error="desbloquear.error.value"
      @confirmar="desbloquear.ejecutar"
    />
  </article>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
h3 {
  margin: 0;
  font-size: 17px;
}

summary {
  min-height: 40px;
  color: var(--texto-2);
  cursor: pointer;
}
</style>

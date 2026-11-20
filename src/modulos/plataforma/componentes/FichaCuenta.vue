<script setup lang="ts">
/**
 * Una cuenta de DAD vista desde la plataforma: estado, contraseña pendiente, segundo factor y
 * bloqueo temporal; bloquearla (cierra sus sesiones) o desbloquearla con motivo, y asignarle o
 * quitarle roles de plataforma (solo las asignaciones hechas en esta sesión: el backend no las
 * lista, S20).
 */
import { computed, ref } from 'vue'
import type { CuentaPlataforma, Rol } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { asignarRolPlataforma, bloquearCuenta, desbloquearCuenta, quitarRolPlataforma } from '../api-clientes'
import { usePermisosPlataforma } from '../store'

const props = defineProps<{ cuenta: CuentaPlataforma; roles: Rol[] }>()
const emit = defineEmits<{ cambio: [cuenta: CuentaPlataforma] }>()

const entidad = useEntidad()
const { puede } = usePermisosPlataforma()
const confirmandoBloqueo = ref(false)
const pidiendoMotivo = ref(false)
const rolId = ref('')
const asignadas = ref<{ id: string; rol: string }[]>([])
const resultado = ref<string | null>(null)

const bloqueada = computed(() => props.cuenta.estado === 'bloqueada')
const opcionesRol = computed(() => props.roles.map((r) => ({ valor: r.id, etiqueta: r.nombre })))
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
  alExito: (id) => {
    asignadas.value = [...asignadas.value, { id, rol: props.roles.find((r) => r.id === rolId.value)?.nombre ?? 'Rol' }]
    resultado.value = 'Rol de plataforma asignado.'
    rolId.value = ''
  },
})
const quitar = useAccion((_clave, id: string) => quitarRolPlataforma(id), {
  alExito: () => (resultado.value = 'Rol de plataforma quitado.'),
})

const errores = computed(() => [asignar.error.value, quitar.error.value].filter((e): e is string => !!e))

async function quitarRol(id: string) {
  if ((await quitar.ejecutar(id)).ok) asignadas.value = asignadas.value.filter((a) => a.id !== id)
}

function abrirBloqueo() {
  bloquear.reiniciar()
  confirmandoBloqueo.value = true
}

function abrirDesbloqueo() {
  desbloquear.reiniciar()
  pidiendoMotivo.value = true
}
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
      v-if="puede('plataforma.roles.asignar')"
      class="campos"
      aria-labelledby="titulo-roles-cuenta"
    >
      <h3 id="titulo-roles-cuenta">
        Roles de plataforma
      </h3>
      <div class="filtros">
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
      <ul
        v-if="asignadas.length"
        class="lista"
      >
        <li
          v-for="a in asignadas"
          :key="a.id"
        >
          <span class="crece">{{ a.rol }}</span>
          <HudBoton
            variante="fantasma"
            :cargando="quitar.cargando.value"
            @click="quitarRol(a.id)"
          >
            Quitar<span class="solo-lector"> {{ a.rol }}</span>
          </HudBoton>
        </li>
      </ul>
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
</style>

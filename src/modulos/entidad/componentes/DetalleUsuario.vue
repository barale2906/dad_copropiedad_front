<script setup lang="ts">
/**
 * Detalle de un usuario: sus roles vigentes (quitar los asignados a mano; así se inactiva a
 * alguien en la entidad) y reenviar el código si aún no define su contraseña.
 */
import { ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Rol, Usuario } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { asignacionesDe, quitarAsignacion, reenviarCodigo } from '../api'
import { type AsignacionVisible, asignacionesVigentes, estadoDeUsuario, textoOrigen } from '../usuarios'

const props = defineProps<{ usuario: Usuario | null; roles: Rol[]; entidadId: string; puedeAsignar: boolean }>()
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ cambio: [] }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const errorCarga = ref<string | null>(null)
const asignaciones = ref<AsignacionVisible[]>([])
const porQuitar = ref<AsignacionVisible | null>(null)
const codigoEnviado = ref(false)

async function cargar() {
  if (!props.usuario) return
  estado.value = 'cargando'
  try {
    asignaciones.value = asignacionesVigentes(await asignacionesDe(props.entidadId, props.usuario.cuenta_id), props.roles)
    estado.value = 'listo'
  } catch (e) {
    errorCarga.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

const quitar = useAccion((_clave, id: string) => quitarAsignacion(props.entidadId, id), {
  alExito: () => {
    porQuitar.value = null
    emit('cambio')
    void cargar()
  },
})
const reenviar = useAccion(() => reenviarCodigo(props.entidadId, props.usuario?.cuenta_id ?? ''), {
  alExito: () => (codigoEnviado.value = true),
})

watch(abierto, (si) => {
  if (!si) return
  porQuitar.value = null
  codigoEnviado.value = false
  quitar.reiniciar()
  reenviar.reiniciar()
  void cargar()
})
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    :titulo="usuario?.nombre ?? 'Usuario'"
  >
    <template v-if="usuario">
      <p class="datos">
        <span>{{ usuario.correo ?? 'Sin correo' }}</span>
        <span v-if="usuario.usuario">Usuario: {{ usuario.usuario }}</span>
        <HudInsignia :tono="estadoDeUsuario(usuario).tono">
          {{ estadoDeUsuario(usuario).texto }}
        </HudInsignia>
      </p>

      <section
        v-if="usuario.contrasena_pendiente && puedeAsignar"
        class="pendiente"
      >
        <p>Aún no define su contraseña. Si el código venció o no le llegó, envíele otro.</p>
        <HudBoton
          variante="secundario"
          :cargando="reenviar.cargando.value"
          @click="reenviar.ejecutar()"
        >
          Reenviar código
        </HudBoton>
        <p
          v-if="codigoEnviado"
          role="status"
          class="exito"
        >
          Le enviamos un código nuevo a {{ usuario.correo }}.
        </p>
        <p
          v-if="reenviar.error.value"
          role="alert"
          class="error"
        >
          {{ reenviar.error.value }}
        </p>
      </section>

      <h3>Roles en la entidad</h3>
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
        :filas="2"
      />
      <HudEstado
        v-else-if="estado === 'error'"
        estado="error"
        :mensaje="errorCarga ?? undefined"
        @reintentar="cargar"
      />
      <HudEstado
        v-else-if="asignaciones.length === 0"
        estado="vacio"
        mensaje="No tiene roles vigentes en esta entidad."
      />
      <ul
        v-else
        class="roles"
      >
        <li
          v-for="a in asignaciones"
          :key="a.id"
        >
          <span>
            <strong>{{ a.rol }}</strong>
            <small v-if="!a.quitable">{{ textoOrigen(a.origen) }}: se retira solo cuando cambie esa condición</small>
          </span>
          <HudBoton
            v-if="a.quitable && puedeAsignar"
            variante="fantasma"
            @click="porQuitar = a"
          >
            Quitar
          </HudBoton>
        </li>
      </ul>

      <div
        v-if="porQuitar"
        class="confirmar"
        role="group"
        :aria-label="`Quitar el rol ${porQuitar.rol}`"
      >
        <p>
          ¿Quitar el rol <strong>{{ porQuitar.rol }}</strong> a {{ usuario.nombre }}? Dejará de tener
          sus permisos desde ahora.
        </p>
        <p
          v-if="quitar.error.value"
          role="alert"
          class="error"
        >
          {{ quitar.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            variante="fantasma"
            @click="porQuitar = null"
          >
            Cancelar
          </HudBoton>
          <HudBoton
            :cargando="quitar.cargando.value"
            @click="quitar.ejecutar(porQuitar.id)"
          >
            Quitar rol
          </HudBoton>
        </div>
      </div>
    </template>
  </HudDialogo>
</template>

<style scoped>
.datos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin: 0;
  color: var(--texto-2);
  overflow-wrap: anywhere;
}

h3 {
  font-size: 17px;
}

.pendiente,
.confirmar {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--ambar);
}

.pendiente p,
.confirmar p {
  margin: 0;
}

.roles {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.roles li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 6px 6px 12px;
  border: 1px solid var(--linea);
}

.roles span {
  display: grid;
}

small {
  color: var(--texto-3);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.exito {
  color: var(--verde);
}

.error {
  color: var(--magenta);
}
</style>

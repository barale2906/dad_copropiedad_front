<script setup lang="ts">
/**
 * Detalle de un usuario: sus roles vigentes (quitar los asignados a mano; así se inactiva a
 * alguien en la entidad) y reenviar el código si aún no define su contraseña. Solo presenta: la
 * lógica llega en `detalle` (`useDetalleUsuario`, por la ruta de la entidad o de la plataforma).
 */
import { ref, watch } from 'vue'
import type { Usuario } from '@/api/tipos'
import { type AsignacionVisible, type EstadoDetalleUsuario, estadoDeUsuario, textoOrigen } from '@/formato/usuarios'
import HudBoton from './HudBoton.vue'
import HudDialogo from './HudDialogo.vue'
import HudEstado from './HudEstado.vue'
import HudInsignia from './HudInsignia.vue'

const props = defineProps<{ usuario: Usuario | null; detalle: EstadoDetalleUsuario; puedeAsignar: boolean }>()
const abierto = defineModel<boolean>('abierto', { required: true })

const porQuitar = ref<AsignacionVisible | null>(null)

watch(abierto, () => (porQuitar.value = null))

async function confirmarQuitar(id: string) {
  if (await props.detalle.quitar(id)) porQuitar.value = null
}
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
          :cargando="detalle.reenviando"
          @click="detalle.reenviar()"
        >
          Reenviar código
        </HudBoton>
        <p
          v-if="detalle.codigoEnviado"
          role="status"
          class="exito"
        >
          Le enviamos un código nuevo a {{ usuario.correo }}.
        </p>
        <p
          v-if="detalle.errorReenviar"
          role="alert"
          class="error"
        >
          {{ detalle.errorReenviar }}
        </p>
      </section>

      <h3>Roles en la entidad</h3>
      <HudEstado
        v-if="detalle.estado === 'cargando'"
        estado="cargando"
        :filas="2"
      />
      <HudEstado
        v-else-if="detalle.estado === 'error'"
        estado="error"
        :mensaje="detalle.error ?? undefined"
        @reintentar="detalle.cargar()"
      />
      <HudEstado
        v-else-if="detalle.asignaciones.length === 0"
        estado="vacio"
        mensaje="No tiene roles vigentes en esta entidad."
      />
      <ul
        v-else
        class="roles"
      >
        <li
          v-for="a in detalle.asignaciones"
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
          v-if="detalle.errorQuitar"
          role="alert"
          class="error"
        >
          {{ detalle.errorQuitar }}
        </p>
        <div class="botones">
          <HudBoton
            variante="fantasma"
            @click="porQuitar = null"
          >
            Cancelar
          </HudBoton>
          <HudBoton
            :cargando="detalle.quitando"
            @click="confirmarQuitar(porQuitar.id)"
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

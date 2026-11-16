<script setup lang="ts">
/** Cerrar todas las sesiones y quitar los dispositivos que reciben notificaciones. */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import IBorrar from '~icons/tabler/trash'

const cuenta = useCuenta()
const entidad = useEntidad()
const router = useRouter()
const confirmando = ref(false)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')

const cerrarTodas = useAccion(() => cuenta.cerrarTodasLasSesiones(), {
  alExito: () => {
    entidad.salir()
    void router.replace({ name: 'ingresar' })
  },
})
const quitar = useAccion((_clave, id: string) => cuenta.quitarDispositivo(id))

async function cargar() {
  estado.value = 'cargando'
  try {
    await cuenta.cargarDispositivos()
    estado.value = 'listo'
  } catch {
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudPanel
    etiqueta="Sesiones y dispositivos"
    as="section"
    aria-labelledby="titulo-sesiones"
  >
    <h2 id="titulo-sesiones">
      Sesiones
    </h2>
    <p class="ayuda">
      Si perdió un equipo o cree que alguien entró con su cuenta, cierre todas las sesiones.
      Tendrá que volver a iniciar sesión.
    </p>
    <HudBoton
      variante="secundario"
      @click="confirmando = true"
    >
      Cerrar todas las sesiones
    </HudBoton>

    <h3>Dispositivos con notificaciones</h3>
    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
      :filas="1"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      @reintentar="cargar"
    />
    <HudEstado
      v-else-if="cuenta.dispositivos.length === 0"
      estado="vacio"
      mensaje="Ningún dispositivo recibe notificaciones de su cuenta."
    />
    <ul
      v-else
      class="dispositivos"
    >
      <li
        v-for="d in cuenta.dispositivos"
        :key="d.id"
      >
        <span>
          <strong>{{ d.nombre ?? (d.plataforma === 'ios' ? 'iPhone' : 'Android') }}</strong>
          <small>Desde {{ fechaHora(d.registrado_en, entidad.zonaHoraria) }}</small>
        </span>
        <button
          type="button"
          class="quitar"
          :disabled="quitar.cargando.value"
          @click="quitar.ejecutar(d.id)"
        >
          <IBorrar aria-hidden="true" /><span class="solo-lector">Quitar {{ d.nombre ?? d.plataforma }}</span>
        </button>
      </li>
    </ul>
    <p
      v-if="quitar.error.value"
      class="error"
      role="alert"
    >
      {{ quitar.error.value }}
    </p>

    <HudDialogo
      v-model:abierto="confirmando"
      titulo="¿Cerrar todas las sesiones?"
    >
      <p>Se cerrarán en todos sus equipos, también en este.</p>
      <p
        v-if="cerrarTodas.error.value"
        class="error"
        role="alert"
      >
        {{ cerrarTodas.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="cerrarTodas.cargando.value"
          @click="cerrarTodas.ejecutar()"
        >
          Cerrar todas
        </HudBoton>
      </template>
    </HudDialogo>
  </HudPanel>
</template>

<style scoped>
h2 {
  font-size: 22px;
}

h3 {
  margin-top: 24px;
  font-size: 17px;
}

.ayuda {
  margin: 12px 0 16px;
  color: var(--texto-2);
}

.dispositivos {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.dispositivos li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 8px 8px 12px;
  border: 1px solid var(--linea);
}

.dispositivos span {
  display: grid;
}

small {
  color: var(--texto-3);
}

.quitar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--linea);
  background: none;
  color: var(--texto-2);
  font-size: 18px;
  cursor: pointer;
}

.quitar:hover {
  color: var(--magenta);
  border-color: var(--magenta);
}

.error {
  color: var(--magenta);
}
</style>

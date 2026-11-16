<script setup lang="ts">
/**
 * Mi cuenta (fuera de cualquier entidad): perfil y correo, contraseña, segundo factor,
 * sesiones y dispositivos. «Mis PQRS» llega con el plan 07.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import MarcaDad from '../componentes/MarcaDad.vue'
import SeccionContrasena from './SeccionContrasena.vue'
import SeccionPerfil from './SeccionPerfil.vue'
import SeccionSegundoFactor from './SeccionSegundoFactor.vue'
import SeccionSesiones from './SeccionSesiones.vue'

const cuenta = useCuenta()
const entidad = useEntidad()
const route = useRoute()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<{ mensaje: string; referencia: string | null } | null>(null)

const regreso = computed(() =>
  entidad.activa
    ? { texto: 'Volver a la maqueta', a: { name: 'maqueta', params: { entidadId: entidad.activa.entidad_id } } }
    : { texto: 'Volver', a: { name: 'inicio' } },
)

async function cargar() {
  estado.value = 'cargando'
  try {
    await cuenta.cargar()
    estado.value = 'listo'
    // Llegó desde «exige segundo factor»: lleva la vista a esa sección.
    if (route.hash) {
      await nextTick()
      document.querySelector(route.hash)?.scrollIntoView()
    }
  } catch (e) {
    error.value = { mensaje: mensajeDeError(e), referencia: e instanceof ErrorApi ? e.requestId : null }
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="cuenta">
    <div
      class="fondo-hud"
      aria-hidden="true"
    />
    <header class="barra">
      <MarcaDad />
      <HudBoton
        :a="regreso.a"
        variante="fantasma"
      >
        <IVolver aria-hidden="true" /> {{ regreso.texto }}
      </HudBoton>
    </header>

    <main class="contenido">
      <p class="rotulo acento">
        Configuración personal
      </p>
      <h1>Mi cuenta</h1>

      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error' || !cuenta.perfil"
        estado="error"
        :mensaje="error?.mensaje"
        :referencia="error?.referencia"
        @reintentar="cargar"
      />
      <div
        v-else
        class="rejilla"
      >
        <SeccionPerfil :perfil="cuenta.perfil" />
        <SeccionSegundoFactor :activo="cuenta.segundoFactorActivo" />
        <SeccionContrasena />
        <SeccionSesiones />
      </div>
    </main>
  </div>
</template>

<style scoped>
.cuenta {
  min-height: 100dvh;
  padding: 0 var(--gutter) 48px;
}

.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 72px;
  max-width: 1200px;
  margin: 0 auto;
}

.contenido {
  max-width: 1200px;
  margin: clamp(8px, 4vh, 40px) auto 0;
}

.acento {
  margin: 0 0 8px;
  color: var(--cian);
}

h1 {
  margin-bottom: 24px;
  font-size: clamp(30px, 4.5vw, 44px);
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
  gap: 20px;
  align-items: start;
}
</style>

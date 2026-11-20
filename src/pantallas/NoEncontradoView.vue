<script setup lang="ts">
/**
 * Página «no encontrado» (404). Muestra la maqueta del tipo de entidad en que se trabaja
 * (conjunto o oficina) y ofrece volver a un lugar conocido. No insinúa si lo pedido existe:
 * el backend también responde 404 a lo que la cuenta no puede ver.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { plantillaDe } from '@/escena/plantillas/zonas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import IlustracionPerdido from '@/hud/ilustraciones/IlustracionPerdido.vue'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import IVolver from '~icons/tabler/arrow-left'

const route = useRoute()
const entidad = useEntidad()
const sesion = useSesion()

/** La entidad activa o, si no hay, la última usada (de la sesión). */
const tipo = computed(() => {
  if (entidad.activa) return entidad.activa.tipo
  const ultima = entidad.ultima()
  return sesion.entidades.find((e) => e.entidad_id === ultima)?.tipo
})
const escenario = computed(() => (tipo.value && plantillaDe(tipo.value) === 'conjunto' ? 'conjunto' : 'oficina'))

const regreso = computed(() => {
  if (entidad.activa) {
    return {
      texto: 'Volver a la maqueta',
      a: { name: 'maqueta', params: { entidadId: entidad.activa.entidad_id } },
    }
  }
  if (sesion.estado === 'autenticado') return { texto: 'Ir al inicio', a: { name: 'inicio' } }
  return { texto: 'Ir al acceso', a: { name: 'ingresar' } }
})
</script>

<template>
  <main class="no-encontrado">
    <div
      class="fondo-hud"
      aria-hidden="true"
    />
    <div class="escena">
      <IlustracionPerdido :escenario="escenario" />
    </div>
    <section class="texto">
      <p class="rotulo acento">
        Error 404 · Ruta no encontrada
      </p>
      <h1>Esta página no existe</h1>
      <p class="ayuda">
        Puede que el enlace esté mal escrito o que la página ya no esté disponible. Revise la
        dirección o vuelva a un lugar conocido.
      </p>
      <p class="ruta">
        <span class="solo-lector">Dirección solicitada: </span>{{ route.fullPath }}
      </p>
      <HudBoton :a="regreso.a">
        <IVolver aria-hidden="true" /> {{ regreso.texto }}
      </HudBoton>
    </section>
  </main>
</template>

<style scoped>
.no-encontrado {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: clamp(16px, 4vh, 40px);
  min-height: 100dvh;
  padding: 32px var(--gutter);
}

.escena {
  width: min(100%, 520px);
}

.texto {
  display: grid;
  justify-items: center;
  gap: 12px;
  max-width: 60ch;
  text-align: center;
}

.acento {
  margin: 0;
  color: var(--magenta);
}

h1 {
  font-size: clamp(28px, 4.5vw, 44px);
}

.ayuda {
  margin: 0;
  color: var(--texto-2);
}

.ruta {
  max-width: 100%;
  margin: 0 0 8px;
  padding: 4px 10px;
  border: 1px solid var(--linea);
  color: var(--texto-3);
  font-family: var(--fuente-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}

@media (min-width: 900px) {
  .no-encontrado {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .texto {
    justify-items: start;
    text-align: left;
  }
}
</style>

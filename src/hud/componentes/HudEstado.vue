<script setup lang="ts">
/**
 * Estado de una pantalla o listado que aún no tiene datos que mostrar: cargando (esqueleto),
 * vacío (mensaje y, en el slot, la acción para crear el primero) o error (mensaje, referencia
 * copiable para soporte y «Reintentar»).
 */
import { ref } from 'vue'
import IAlerta from '~icons/tabler/alert-triangle'
import ICaja from '~icons/tabler/box-off'
import IReintentar from '~icons/tabler/refresh'
import HudBoton from './HudBoton.vue'

const props = withDefaults(
  defineProps<{
    estado: 'cargando' | 'vacio' | 'error'
    mensaje?: string
    /** `X-Request-Id` del error, para que soporte lo rastree. */
    referencia?: string | null
    filas?: number
  }>(),
  { mensaje: undefined, referencia: null, filas: 3 },
)

const emit = defineEmits<{ reintentar: [] }>()

const copiada = ref(false)

async function copiar() {
  if (!props.referencia) return
  try {
    await navigator.clipboard.writeText(props.referencia)
    copiada.value = true
  } catch {
    copiada.value = false
  }
}
</script>

<template>
  <div
    v-if="estado === 'cargando'"
    class="hud-estado cargando"
    role="status"
    aria-live="polite"
  >
    <span class="solo-lector">{{ mensaje ?? 'Cargando…' }}</span>
    <span
      v-for="i in filas"
      :key="i"
      class="esqueleto"
      aria-hidden="true"
    />
  </div>

  <div
    v-else-if="estado === 'vacio'"
    class="hud-estado vacio"
  >
    <ICaja
      class="icono"
      aria-hidden="true"
    />
    <p>{{ mensaje ?? 'Aún no hay nada aquí.' }}</p>
    <slot />
  </div>

  <div
    v-else
    class="hud-estado error"
    role="alert"
  >
    <IAlerta
      class="icono"
      aria-hidden="true"
    />
    <p>{{ mensaje ?? 'No se pudo cargar la información.' }}</p>
    <p
      v-if="referencia"
      class="referencia"
    >
      Referencia: <code>{{ referencia }}</code>
      <button
        type="button"
        class="copiar"
        @click="copiar"
      >
        {{ copiada ? 'Copiada' : 'Copiar' }}
      </button>
    </p>
    <HudBoton
      variante="secundario"
      @click="emit('reintentar')"
    >
      <IReintentar aria-hidden="true" /> Reintentar
    </HudBoton>
  </div>
</template>

<style scoped>
.hud-estado {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 16px;
  text-align: center;
  color: var(--texto-2);
}

.hud-estado p {
  margin: 0;
  max-width: 60ch;
}

.icono {
  font-size: 32px;
  color: var(--texto-3);
}

.error .icono {
  color: var(--magenta);
}

.cargando {
  justify-items: stretch;
  padding: 8px 0;
}

.esqueleto {
  height: 44px;
  background: linear-gradient(90deg, var(--superficie) 0%, var(--superficie-alta) 50%, var(--superficie) 100%);
  border: 1px solid var(--linea);
  animation: latido 1.2s ease-in-out infinite;
}

.referencia {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--texto-3);
}

code {
  font-family: var(--fuente-mono);
  overflow-wrap: anywhere;
}

.copiar {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--linea-fuerte);
  background: none;
  color: var(--cian);
  cursor: pointer;
}

@keyframes latido {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .esqueleto {
    animation: none;
  }
}
</style>

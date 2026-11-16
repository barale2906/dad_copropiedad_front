<script setup lang="ts">
/**
 * Operaciones en dos pasos (importaciones, liquidaciones, intereses, extractos): primero se
 * edita y se pide la vista previa; luego se revisa y se confirma. El padre llama a la API en
 * `previsualizar` y `confirmar` y avanza `paso` cuando cada una termina bien.
 *
 * Slots: `formulario` (paso «editar»), `vista-previa` (paso «revisar») y `hecho`.
 */
import { computed } from 'vue'
import HudBoton from './HudBoton.vue'

export type PasoFlujo = 'editar' | 'revisar' | 'hecho'

const props = withDefaults(
  defineProps<{
    cargando?: boolean
    error?: string | null
    /** Texto del botón que confirma (p. ej. «Causar intereses»). */
    accion?: string
    /** La vista previa trae errores: no se puede confirmar. */
    bloqueado?: boolean
  }>(),
  { cargando: false, error: null, accion: 'Confirmar', bloqueado: false },
)
const paso = defineModel<PasoFlujo>('paso', { required: true })
const emit = defineEmits<{ previsualizar: []; confirmar: []; reiniciar: [] }>()

const PASOS: { id: PasoFlujo; nombre: string }[] = [
  { id: 'editar', nombre: 'Datos' },
  { id: 'revisar', nombre: 'Vista previa' },
  { id: 'hecho', nombre: 'Listo' },
]
const indice = computed(() => PASOS.findIndex((p) => p.id === paso.value))
const confirmable = computed(() => !props.bloqueado && !props.cargando)
</script>

<template>
  <div class="flujo">
    <ol
      class="pasos"
      aria-label="Pasos"
    >
      <li
        v-for="(p, i) in PASOS"
        :key="p.id"
        :class="{ actual: i === indice, hecho: i < indice }"
        :aria-current="i === indice ? 'step' : undefined"
      >
        <span aria-hidden="true">{{ i + 1 }}</span> {{ p.nombre }}
      </li>
    </ol>

    <form
      v-if="paso === 'editar'"
      class="cuerpo"
      @submit.prevent="emit('previsualizar')"
    >
      <slot name="formulario" />
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="botones">
        <HudBoton
          tipo="submit"
          :cargando="cargando"
        >
          Ver vista previa
        </HudBoton>
      </div>
    </form>

    <div
      v-else-if="paso === 'revisar'"
      class="cuerpo"
    >
      <slot name="vista-previa" />
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="botones">
        <HudBoton
          variante="fantasma"
          :deshabilitado="cargando"
          @click="paso = 'editar'"
        >
          Volver a editar
        </HudBoton>
        <HudBoton
          :cargando="cargando"
          :deshabilitado="!confirmable"
          @click="emit('confirmar')"
        >
          {{ accion }}
        </HudBoton>
      </div>
    </div>

    <div
      v-else
      class="cuerpo"
      role="status"
    >
      <slot name="hecho" />
      <div class="botones">
        <HudBoton
          variante="secundario"
          @click="emit('reiniciar')"
        >
          Hacer otra
        </HudBoton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flujo {
  display: grid;
  gap: 20px;
}

.pasos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pasos li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--linea);
  color: var(--texto-3);
  font-family: var(--fuente-display);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pasos span {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid currentcolor;
  font-size: 12px;
}

.pasos .actual {
  border-color: var(--cian);
  color: var(--cian);
}

.pasos .hecho {
  color: var(--verde);
}

.cuerpo {
  display: grid;
  gap: 16px;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>

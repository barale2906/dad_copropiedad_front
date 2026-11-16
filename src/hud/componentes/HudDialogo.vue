<script setup lang="ts">
/**
 * Diálogo modal accesible sobre el `<dialog>` nativo: atrapa el foco, `Escape` lo cierra, el
 * fondo queda inerte y el foco vuelve al control que lo abrió. Contenido en el slot y botones
 * en el slot `acciones`.
 */
import { onBeforeUnmount, useId, useTemplateRef, watch } from 'vue'
import IX from '~icons/tabler/x'

defineProps<{ titulo: string }>()
const abierto = defineModel<boolean>('abierto', { required: true })

const id = useId()
const dialogo = useTemplateRef<HTMLDialogElement>('dialogo')
let anterior: HTMLElement | null = null

watch(
  abierto,
  (si) => {
    const d = dialogo.value
    if (!d) return
    if (si && !d.open) {
      anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
      d.showModal()
    } else if (!si && d.open) {
      d.close()
    }
  },
  { flush: 'post' },
)

/** `Escape` o `close()`: sincroniza el modelo y devuelve el foco. */
function alCerrar() {
  abierto.value = false
  anterior?.focus()
  anterior = null
}

onBeforeUnmount(() => {
  if (dialogo.value?.open) dialogo.value.close()
})
</script>

<template>
  <dialog
    ref="dialogo"
    class="hud-dialogo"
    :aria-labelledby="`${id}-titulo`"
    @close="alCerrar"
  >
    <header class="cabecera">
      <h2 :id="`${id}-titulo`">
        {{ titulo }}
      </h2>
      <button
        type="button"
        class="cerrar"
        @click="abierto = false"
      >
        <IX aria-hidden="true" /><span class="solo-lector">Cerrar</span>
      </button>
    </header>
    <div class="cuerpo">
      <slot />
    </div>
    <footer
      v-if="$slots.acciones"
      class="acciones"
    >
      <slot name="acciones" />
    </footer>
  </dialog>
</template>

<style scoped>
.hud-dialogo {
  width: min(100% - 2 * var(--gutter), 520px);
  max-height: min(90dvh, 720px);
  padding: 0;
  border: 1px solid var(--linea-fuerte);
  background: var(--superficie-solida);
  color: var(--texto);
  box-shadow: var(--sombra);
  clip-path: polygon(0 0, calc(100% - var(--corte)) 0, 100% var(--corte), 100% 100%, 0 100%);
}

.hud-dialogo[open] {
  animation: entrar var(--medio) var(--curva);
}

.hud-dialogo::backdrop {
  background: rgb(2 5 12 / 72%);
  backdrop-filter: blur(3px);
}

.cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 14px 20px;
  border-bottom: 1px solid var(--linea);
}

h2 {
  font-size: 20px;
}

.cerrar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid transparent;
  background: none;
  color: var(--texto-2);
  font-size: 20px;
  cursor: pointer;
}

.cerrar:hover {
  border-color: var(--linea);
  color: var(--cian);
}

.cuerpo {
  display: grid;
  gap: 14px;
  padding: 20px;
  overflow-y: auto;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 20px 20px;
}

@keyframes entrar {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
</style>

<script setup lang="ts">
/**
 * Secreto que el backend entrega una sola vez (secreto del segundo factor, token de un puente,
 * código de un certificado…): se muestra con «Copiar» y la advertencia de guardarlo ahora.
 */
import { ref } from 'vue'
import ICopiar from '~icons/tabler/copy'
import IAlerta from '~icons/tabler/alert-triangle'

withDefaults(defineProps<{ valor: string; etiqueta?: string; aviso?: string }>(), {
  etiqueta: 'Secreto',
  aviso: 'Cópielo y guárdelo ahora: no se volverá a mostrar.',
})

const estado = ref<'listo' | 'copiado' | 'fallo'>('listo')

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    estado.value = 'copiado'
  } catch {
    estado.value = 'fallo'
  }
}
</script>

<template>
  <div class="secreto">
    <p class="rotulo">
      {{ etiqueta }}
    </p>
    <div class="valor">
      <code>{{ valor }}</code>
      <button
        type="button"
        class="copiar"
        @click="copiar(valor)"
      >
        <ICopiar aria-hidden="true" />
        {{ estado === 'copiado' ? 'Copiado' : 'Copiar' }}
      </button>
    </div>
    <p
      class="aviso"
      role="note"
    >
      <IAlerta aria-hidden="true" /> {{ aviso }}
    </p>
    <p
      v-if="estado === 'fallo'"
      class="fallo"
      role="alert"
    >
      No se pudo copiar. Selecciónelo y cópielo a mano.
    </p>
  </div>
</template>

<style scoped>
.secreto {
  display: grid;
  gap: 8px;
}

.rotulo {
  margin: 0;
}

.valor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border: 1px dashed var(--linea-fuerte);
  background: rgb(5 10 20 / 70%);
}

code {
  flex: 1;
  min-width: 0;
  font-family: var(--fuente-mono);
  font-size: 15px;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
  user-select: all;
}

.copiar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--linea-fuerte);
  background: var(--cian-tenue);
  color: var(--cian);
  cursor: pointer;
}

.aviso,
.fallo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: var(--ambar);
}

.fallo {
  color: var(--magenta);
}
</style>

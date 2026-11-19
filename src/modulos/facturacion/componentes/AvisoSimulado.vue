<script setup lang="ts">
/** Aviso fijo cuando algún documento lo transmitió el proveedor simulado (sin validez ante la DIAN). */
import { computed } from 'vue'
import type { DocumentoElectronico } from '@/api/tipos'
import { esSimulado } from '../reglas'

const props = defineProps<{ documentos: Pick<DocumentoElectronico, 'proveedor'>[] }>()
const visible = computed(() => esSimulado(props.documentos))
</script>

<template>
  <p
    v-if="visible"
    class="simulado"
    role="note"
  >
    <strong>Sin validez ante la DIAN:</strong> estos documentos los transmite el proveedor simulado mientras la entidad no
    termine su habilitación.
  </p>
</template>

<style scoped>
.simulado {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--ambar);
  background: color-mix(in srgb, var(--ambar) 10%, transparent);
}
</style>

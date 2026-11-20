<script setup lang="ts">
/** El enlace público no sirve (vencido, revocado o incompleto): qué hacer y a quién pedir otro. */
import HudPanel from '@/hud/componentes/HudPanel.vue'
import ICandado from '~icons/tabler/link-off'

defineProps<{ quien: string }>()
</script>

<template>
  <HudPanel
    etiqueta="Enlace no válido"
    class="enlace-no-valido"
  >
    <ICandado
      class="icono"
      aria-hidden="true"
    />
    <p
      class="titulo"
      role="alert"
    >
      Este enlace ya no es válido.
    </p>
    <p>Puede que haya vencido, que lo hayan cambiado o que no se haya copiado completo.</p>
    <p>Pida uno nuevo {{ quien }}.</p>
  </HudPanel>
</template>

<style scoped>
.enlace-no-valido p {
  margin: 8px 0 0;
  color: var(--texto-2);
}

.enlace-no-valido .titulo {
  color: var(--texto);
  font-size: 19px;
  font-weight: 600;
}

.icono {
  font-size: 32px;
  color: var(--ambar);
}
</style>

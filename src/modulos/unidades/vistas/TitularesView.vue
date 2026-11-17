<script setup lang="ts">
/** Propietarios: buscar un bien y gestionar sus titulares (registrar, transferir, representante). */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import PanelTitulares from '../componentes/PanelTitulares.vue'

const route = useRoute()
const router = useRouter()
const bienes = useBienes()

/** El bien elegido va en `?bien=` (se puede compartir y volver con «Atrás»). */
const bienId = computed({
  get: () => (typeof route.query.bien === 'string' ? route.query.bien : ''),
  set: (b: string) => router.replace({ query: { ...route.query, bien: b || undefined } }),
})
const buscarBien = async (q: string) => (await bienes.buscar(q)).datos

watch(bienId, (b) => b && bienes.resolver([b]), { immediate: true })
</script>

<template>
  <section
    class="titulares-vista"
    aria-labelledby="titulo-titulares"
  >
    <header>
      <h1 id="titulo-titulares">
        Propietarios
      </h1>
      <p class="texto-2">
        Titulares de cada bien. El dueño no se edita: un cambio de propietario se registra como transferencia.
      </p>
    </header>
    <SelectorBien
      v-model="bienId"
      etiqueta="Bien"
      :buscar="buscarBien"
      :codigo-elegido="bienId ? bienes.codigo(bienId) : null"
    />
    <HudPanel
      v-if="bienId"
      :etiqueta="`Titulares de ${bienes.codigo(bienId)}`"
    >
      <PanelTitulares
        :key="bienId"
        :bien-id="bienId"
        :codigo="bienes.codigo(bienId)"
      />
    </HudPanel>
  </section>
</template>

<style scoped>
.titulares-vista {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}
</style>

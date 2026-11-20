<script setup lang="ts">
/**
 * Normativa de la plataforma: PUC, retenciones y UVT, IVA e ICA, exógena, tasas de referencia y
 * plantillas contables. Cada catálogo es versionado: una versión nueva rige desde su fecha.
 */
import { computed } from 'vue'
import { usePestana } from '@/composables/usePestana'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import NormativaExogena from '../componentes/NormativaExogena.vue'
import NormativaPlantillas from '../componentes/NormativaPlantillas.vue'
import NormativaPuc from '../componentes/NormativaPuc.vue'
import NormativaRetenciones from '../componentes/NormativaRetenciones.vue'
import NormativaTasas from '../componentes/NormativaTasas.vue'
import NormativaTributaria from '../componentes/NormativaTributaria.vue'
import { usePermisosPlataforma } from '../store'

const { puede } = usePermisosPlataforma()
const TODAS = [
  { id: 'retenciones', texto: 'Retenciones y UVT' },
  { id: 'tributario', texto: 'IVA e ICA' },
  { id: 'exogena', texto: 'Exógena' },
  { id: 'tasas', texto: 'Tasas de referencia' },
  { id: 'puc', texto: 'PUC' },
  { id: 'plantillas', texto: 'Plantillas contables' },
] as const
const PESTANAS = computed(() =>
  TODAS.filter((p) => (p.id === 'plantillas' ? puede('plataforma.plantillas_contables.publicar') : puede('plataforma.normativa.gestionar'))),
)
const actual = usePestana(TODAS)
/** Si la pestaña pedida no es del rol, la primera que sí tiene. */
const pestana = computed(() => (PESTANAS.value.some((p) => p.id === actual.value) ? actual.value : PESTANAS.value[0]?.id))
</script>

<template>
  <section aria-labelledby="titulo-normativa">
    <header>
      <h1 id="titulo-normativa">
        Normativa
      </h1>
      <p class="texto-2">
        Catálogos que usan todas las entidades. Una versión nueva no edita la anterior: la cierra el día antes.
      </p>
    </header>
    <HudPestanas
      v-if="PESTANAS.length > 1"
      :pestanas="PESTANAS"
      etiqueta="Catálogos normativos"
    />
    <NormativaRetenciones v-if="pestana === 'retenciones'" />
    <NormativaTributaria v-else-if="pestana === 'tributario'" />
    <NormativaExogena v-else-if="pestana === 'exogena'" />
    <NormativaTasas v-else-if="pestana === 'tasas'" />
    <NormativaPuc v-else-if="pestana === 'puc'" />
    <NormativaPlantillas v-else-if="pestana === 'plantillas'" />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

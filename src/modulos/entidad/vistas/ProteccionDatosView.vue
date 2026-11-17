<script setup lang="ts">
/**
 * Protección de datos personales de la PH (Ley 1581 de 2012): política de tratamiento,
 * solicitudes de los titulares y autorizaciones por persona. La pestaña va en `?vista=`.
 */
import { computed } from 'vue'
import { usePestana } from '@/composables/usePestana'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import AutorizacionesTitular from '../componentes/AutorizacionesTitular.vue'
import PoliticaTratamiento from '../componentes/PoliticaTratamiento.vue'
import SolicitudesTitular from '../componentes/SolicitudesTitular.vue'

const PESTANAS = [
  { id: 'solicitudes', texto: 'Solicitudes' },
  { id: 'politica', texto: 'Política' },
  { id: 'titulares', texto: 'Autorizaciones' },
] as const

const entidad = useEntidad()
const copropiedadId = computed(() => entidad.activa?.entidad_id ?? '')
const puedeVerPersonas = computed(() => entidad.tienePermiso('personas.ver'))

const actual = usePestana(PESTANAS)
</script>

<template>
  <section
    class="proteccion"
    aria-labelledby="titulo-proteccion"
  >
    <header>
      <h1 id="titulo-proteccion">
        Protección de datos
      </h1>
      <p class="texto-2">
        Política de tratamiento, solicitudes de los titulares y sus autorizaciones (Ley 1581 de 2012).
      </p>
    </header>

    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Secciones de protección de datos"
    />

    <SolicitudesTitular
      v-if="actual === 'solicitudes'"
      :copropiedad-id="copropiedadId"
    />
    <PoliticaTratamiento
      v-else-if="actual === 'politica'"
      :copropiedad-id="copropiedadId"
    />
    <template v-else>
      <AutorizacionesTitular
        v-if="puedeVerPersonas"
        :copropiedad-id="copropiedadId"
      />
      <p
        v-else
        class="texto-2"
      >
        Para buscar a un titular necesita el permiso «Ver personas». Pídaselo a la administración.
      </p>
    </template>
  </section>
</template>

<style scoped>
.proteccion {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(26px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}
</style>

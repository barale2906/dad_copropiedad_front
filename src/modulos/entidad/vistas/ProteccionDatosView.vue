<script setup lang="ts">
/**
 * Protección de datos personales de la PH (Ley 1581 de 2012): política de tratamiento,
 * solicitudes de los titulares y autorizaciones por persona. La pestaña va en `?vista=`.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useEntidad } from '@/stores/entidad'
import AutorizacionesTitular from '../componentes/AutorizacionesTitular.vue'
import PoliticaTratamiento from '../componentes/PoliticaTratamiento.vue'
import SolicitudesTitular from '../componentes/SolicitudesTitular.vue'

const PESTANAS = [
  { id: 'solicitudes', texto: 'Solicitudes' },
  { id: 'politica', texto: 'Política' },
  { id: 'titulares', texto: 'Autorizaciones' },
] as const

type Pestana = (typeof PESTANAS)[number]['id']

const route = useRoute()
const entidad = useEntidad()
const copropiedadId = computed(() => entidad.activa?.entidad_id ?? '')
const puedeVerPersonas = computed(() => entidad.tienePermiso('personas.ver'))

const actual = computed<Pestana>(() => PESTANAS.find((p) => p.id === route.query.vista)?.id ?? 'solicitudes')
const destino = (id: Pestana) => ({ query: { ...route.query, vista: id } })
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

    <nav aria-label="Secciones de protección de datos">
      <ul class="pestanas">
        <li
          v-for="p in PESTANAS"
          :key="p.id"
        >
          <RouterLink
            :to="destino(p.id)"
            :aria-current="actual === p.id ? 'page' : undefined"
            replace
          >
            {{ p.texto }}
          </RouterLink>
        </li>
      </ul>
    </nav>

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

.pestanas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--linea);
  list-style: none;
}

.pestanas a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  border-bottom: 2px solid transparent;
  color: var(--texto-2);
  font-family: var(--fuente-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-decoration: none;
}

.pestanas a:hover,
.pestanas a:focus-visible {
  color: var(--cian);
}

.pestanas a[aria-current='page'] {
  border-bottom-color: var(--cian);
  color: var(--cian);
}
</style>

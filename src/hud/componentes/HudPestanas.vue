<script setup lang="ts" generic="I extends string">
/**
 * Pestañas como enlaces que cambian `?vista=` (se pueden compartir y el botón «Atrás» funciona).
 * La primera es la predeterminada. El contenido lo pinta el padre según `actual`.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  pestanas: readonly { id: I; texto: string }[]
  /** Nombre accesible del grupo de pestañas. */
  etiqueta: string
}>()

const route = useRoute()

/** Pestaña actual según la dirección (la primera si no hay o no se conoce). */
const actual = computed<I | undefined>(() => props.pestanas.find((p) => p.id === route.query.vista)?.id ?? props.pestanas[0]?.id)
</script>

<template>
  <nav :aria-label="etiqueta">
    <ul class="hud-pestanas">
      <li
        v-for="p in pestanas"
        :key="p.id"
      >
        <RouterLink
          :to="{ query: { ...route.query, vista: p.id } }"
          :aria-current="actual === p.id ? 'page' : undefined"
          replace
        >
          {{ p.texto }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.hud-pestanas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--linea);
  list-style: none;
}

.hud-pestanas a {
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

.hud-pestanas a:hover,
.hud-pestanas a:focus-visible {
  color: var(--cian);
}

.hud-pestanas a[aria-current='page'] {
  border-bottom-color: var(--cian);
  color: var(--cian);
}
</style>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'

/** La maqueta se conserva (KeepAlive) por entidad; los módulos comparten el marco. */
const clave = (r: RouteLocationNormalizedLoaded) =>
  r.params.entidadId ? `${String(r.name)}-${String(r.params.entidadId)}` : String(r.name)
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition
      name="vista"
      mode="out-in"
    >
      <KeepAlive
        include="MaquetaView"
        :max="1"
      >
        <component
          :is="Component"
          :key="clave(route)"
        />
      </KeepAlive>
    </Transition>
  </RouterView>
</template>

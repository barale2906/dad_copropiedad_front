<script setup lang="ts">
import { type RouteLocationNormalizedLoaded, useRouter } from 'vue-router'
import { vigilarNavegacion } from '@/app/carga'
import HudCarga from '@/hud/componentes/HudCarga.vue'

/** La maqueta se conserva (KeepAlive) por entidad; los módulos comparten el marco. */
const clave = (r: RouteLocationNormalizedLoaded) =>
  r.params.entidadId ? `${String(r.name)}-${String(r.params.entidadId)}` : String(r.name)

const cargando = vigilarNavegacion(useRouter())
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
  <HudCarga v-if="cargando" />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import ICambiar from '~icons/tabler/switch-horizontal'
import ISalir from '~icons/tabler/logout'
import MarcaDad from './MarcaDad.vue'

const entidad = useEntidad()
const sesion = useSesion()
const router = useRouter()

async function salir() {
  await sesion.cerrar()
  entidad.salir()
  router.replace({ name: 'ingresar' })
}
</script>

<template>
  <header class="barra">
    <RouterLink
      :to="{ name: 'maqueta', params: { entidadId: entidad.activa?.entidad_id } }"
      class="inicio"
      aria-label="Ir a la maqueta"
    >
      <MarcaDad compacta />
    </RouterLink>

    <div class="entidad">
      <span class="rotulo">{{ entidad.esPH ? 'Propiedad horizontal' : 'Empresa' }}</span>
      <strong>{{ entidad.activa?.nombre }}</strong>
    </div>

    <div class="acciones">
      <slot />
      <RouterLink
        v-if="sesion.entidades.length > 1"
        :to="{ name: 'entidades' }"
        class="boton-icono"
        title="Cambiar de entidad"
      >
        <ICambiar /><span class="texto">Cambiar</span>
      </RouterLink>
      <button
        class="boton-icono"
        title="Cerrar sesión"
        @click="salir"
      >
        <ISalir /><span class="texto">Salir</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.barra {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--barra-alto);
  padding: 0 var(--gutter);
  background: linear-gradient(180deg, rgb(5 9 18 / 92%), rgb(5 9 18 / 60%));
  border-bottom: 1px solid var(--linea);
  backdrop-filter: blur(10px);
}

.inicio {
  text-decoration: none;
  flex: none;
}

.entidad {
  display: grid;
  min-width: 0;
  padding-left: 16px;
  border-left: 1px solid var(--linea);
  line-height: 1.2;
}

.entidad .rotulo {
  font-size: 10.5px;
  color: var(--cian);
}

.entidad strong {
  font-family: var(--fuente-display);
  font-size: 17px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.acciones {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.acciones :deep(.boton-icono) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 10px;
  border: 1px solid transparent;
  background: none;
  color: var(--texto-2);
  font-family: var(--fuente-display);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
}

.acciones :deep(.boton-icono svg) {
  font-size: 19px;
}

.acciones :deep(.boton-icono:hover),
.acciones :deep(.boton-icono[aria-pressed='true']) {
  color: var(--cian);
  border-color: var(--linea);
  background: var(--cian-tenue);
}

@media (max-width: 720px) {
  .acciones :deep(.texto) {
    display: none;
  }

  .entidad {
    padding-left: 10px;
  }

  .entidad .rotulo {
    display: none;
  }
}
</style>

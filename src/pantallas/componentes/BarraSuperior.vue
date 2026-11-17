<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import ICambiar from '~icons/tabler/switch-horizontal'
import IUsuario from '~icons/tabler/user-circle'
import ISalir from '~icons/tabler/logout'
import IAlerta from '~icons/tabler/alert-triangle'
import { avisoDeEstado, ESTADO_ENTIDAD, TIPO_ENTIDAD } from '../textos-entidad'
import AvisoComunicados from './AvisoComunicados.vue'
import MarcaDad from './MarcaDad.vue'

const entidad = useEntidad()
const sesion = useSesion()
const router = useRouter()

const tipo = computed(() => entidad.capacidades?.tipo ?? entidad.activa?.tipo ?? 'empresa')
// Las capacidades avisan la suspensión aunque el listado de entidades aún no la refleje.
const estado = computed(() => (entidad.suspendida ? 'suspendida' : (entidad.activa?.estado ?? 'activa')))
const aviso = computed(() => avisoDeEstado(estado.value))

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
      title="Ir a la maqueta"
    >
      <MarcaDad compacta />
    </RouterLink>

    <div class="entidad">
      <span class="rotulo">{{ TIPO_ENTIDAD[tipo] }}</span>
      <strong>{{ entidad.activa?.nombre }}</strong>
    </div>

    <p
      v-if="aviso"
      class="aviso-estado"
      :data-estado="estado"
      :title="aviso"
    >
      <IAlerta aria-hidden="true" />
      <span class="etiqueta-estado">{{ ESTADO_ENTIDAD[estado] }}</span>
      <span class="solo-lector">. {{ aviso }}</span>
    </p>

    <div class="acciones">
      <slot />
      <AvisoComunicados />
      <RouterLink
        :to="{ name: 'cuenta' }"
        class="boton-icono"
        title="Mi cuenta"
      >
        <IUsuario /><span class="texto">Mi cuenta</span>
      </RouterLink>
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

.aviso-estado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  margin: 0;
  padding: 4px 10px;
  border: 1px solid currentcolor;
  color: var(--ambar);
  font-family: var(--fuente-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.aviso-estado[data-estado='suspendida'],
.aviso-estado[data-estado='retirada'] {
  color: var(--magenta);
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
  /* Solo el icono, pero el texto sigue siendo el nombre accesible del botón. */
  .acciones :deep(.texto) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .entidad {
    padding-left: 10px;
  }

  .entidad .rotulo {
    display: none;
  }

  /* Solo el icono; el estado sigue en el texto accesible y en el título. */
  .etiqueta-estado {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}
</style>

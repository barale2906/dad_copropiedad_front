<script setup lang="ts">
/**
 * Aviso de comunicados sin leer en la barra superior (propietarios y residentes). Consulta al
 * entrar y cada 60 s, solo con la pestaña visible.
 */
import { computed, onMounted } from 'vue'
import { useRefresco } from '@/composables/useRefresco'
import { useComunicadosPendientes } from '@/stores/comunicados'
import { useEntidad } from '@/stores/entidad'
import ICarta from '~icons/tabler/mail'

const entidad = useEntidad()
const pendientes = useComunicadosPendientes()
const destino = computed(() => ({ name: 'modulo', params: { entidadId: entidad.activa?.entidad_id ?? '', seccion: 'mi', accion: 'comunicados' } }))
const texto = computed(() => (pendientes.cantidad === 1 ? '1 comunicado sin leer' : `${pendientes.cantidad} comunicados sin leer`))

useRefresco(() => pendientes.actualizar(), { cada: 60_000 })
onMounted(() => pendientes.actualizar())
</script>

<template>
  <RouterLink
    v-if="pendientes.aplica()"
    :to="destino"
    class="boton-icono aviso-comunicados"
    :title="pendientes.cantidad ? texto : 'Mis comunicados'"
  >
    <ICarta aria-hidden="true" />
    <span
      v-if="pendientes.cantidad"
      class="globo"
      aria-hidden="true"
    >{{ pendientes.cantidad > 9 ? '9+' : pendientes.cantidad }}</span>
    <!-- Un solo nombre accesible («Comunicados: 2 comunicados sin leer») que contiene el texto visible. -->
    <span
      class="texto"
      aria-hidden="true"
    >Comunicados</span>
    <span class="solo-lector">{{ pendientes.cantidad ? `Comunicados: ${texto}` : 'Comunicados' }}</span>
  </RouterLink>
</template>

<style scoped>
.aviso-comunicados {
  position: relative;
}

.globo {
  position: absolute;
  top: 2px;
  left: 20px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--magenta);
  color: var(--fondo);
  font-family: var(--fuente);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}
</style>

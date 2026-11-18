<script setup lang="ts">
/** Comunicados: lista con su estado y lectura, redactar uno nuevo (`:id = nuevo`) y el detalle. */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Comunicado } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { listarComunicados } from '../api'
import DetalleComunicado from '../componentes/DetalleComunicado.vue'
import EditorComunicado from '../componentes/EditorComunicado.vue'
import { ESTADO_COMUNICADO, resumenLectura, TIPO_AUDIENCIA } from '../reglas'

const NUEVO = 'nuevo'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const comunicadoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (c = '') => ({ name: 'modulo', params: { ...route.params, id: c } })
const listado = useListado((despues) => listarComunicados(id.value, despues))

const cuando = (c: Comunicado) =>
  c.enviado_en ? `Enviado ${fechaHora(c.enviado_en, zona.value)}` : c.programado_para ? `Programado para ${fechaHora(c.programado_para, zona.value)}` : `Creado ${fechaHora(c.creado_en, zona.value)}`

async function creado(c: Comunicado) {
  await router.replace(ruta(c.id))
  await listado.recargar()
}
</script>

<template>
  <section aria-labelledby="titulo-comunicados">
    <template v-if="comunicadoId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Comunicados
      </RouterLink>
      <template v-if="comunicadoId === NUEVO">
        <h1 id="titulo-comunicados">
          Nuevo comunicado
        </h1>
        <HudPanel etiqueta="Redactar">
          <EditorComunicado
            :entidad-id="id"
            @guardado="creado"
            @cancelar="router.push(ruta())"
          />
        </HudPanel>
      </template>
      <DetalleComunicado
        v-else
        :key="comunicadoId"
        :entidad-id="id"
        :comunicado-id="comunicadoId"
      />
    </template>
    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-comunicados">
          Comunicados
        </h1>
        <HudBoton :a="ruta(NUEVO)">
          <IMas aria-hidden="true" /> Nuevo comunicado
        </HudBoton>
      </header>
      <HudEstado
        v-if="listado.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'error'"
        estado="error"
        :mensaje="listado.error.value ?? undefined"
        @reintentar="listado.recargar()"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        mensaje="Aún no hay comunicados."
      />
      <template v-else>
        <ul
          class="lista"
          aria-label="Comunicados"
        >
          <li
            v-for="f in listado.filas.value"
            :key="f.comunicado.id"
          >
            <HudInsignia :tono="ESTADO_COMUNICADO[f.comunicado.estado].tono">
              {{ ESTADO_COMUNICADO[f.comunicado.estado].texto }}
            </HudInsignia>
            <span class="crece">
              <RouterLink
                :to="ruta(f.comunicado.id)"
                class="fila"
              ><strong>{{ f.comunicado.titulo }}</strong></RouterLink>
              <small>{{ TIPO_AUDIENCIA[f.comunicado.audiencia.tipo] }} · {{ cuando(f.comunicado) }}</small>
              <small v-if="f.comunicado.estado === 'enviado'">{{ resumenLectura(f.resumen) }}</small>
            </span>
            <HudInsignia
              v-if="f.comunicado.importante"
              tono="aviso"
            >
              Importante
            </HudInsignia>
          </li>
        </ul>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </template>
    </template>
  </section>
</template>

<style scoped src="./administracion.css"></style>

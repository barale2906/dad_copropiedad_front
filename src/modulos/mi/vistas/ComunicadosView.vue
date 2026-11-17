<script setup lang="ts">
/**
 * Mis comunicados: cartelera con los no leídos primero; abrir uno **registra la lectura** y trae
 * los adjuntos con enlaces de 5 minutos; «Enterado» cuando el comunicado lo pide. El cuerpo se
 * muestra como texto (nunca HTML).
 */
import { computed, ref, watch } from 'vue'
import { type RouteLocationRaw, useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { ComunicadoAbierto } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useComunicadosPendientes } from '@/stores/comunicados'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IArchivo from '~icons/tabler/paperclip'
import { abrirComunicado, marcarEnterado, misComunicados } from '../api'

const route = useRoute()
const entidad = useEntidad()
const pendientes = useComunicadosPendientes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const comunicadoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (c = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: c } })

const listado = useListado((despues) => misComunicados(id.value, despues), { inmediato: false })
const ordenados = computed(() =>
  [...listado.filas.value].sort((a, b) => Number(!!a.leido_en) - Number(!!b.leido_en) || (b.comunicado.enviado_en ?? '').localeCompare(a.comunicado.enviado_en ?? '')),
)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const abierto = ref<ComunicadoAbierto | null>(null)
const enterado = useAccion(() => marcarEnterado(id.value, comunicadoId.value))

async function abrir() {
  estado.value = 'cargando'
  try {
    abierto.value = await abrirComunicado(id.value, comunicadoId.value)
    estado.value = 'listo'
    void pendientes.actualizar()
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

async function confirmar() {
  const r = await enterado.ejecutar()
  if (r.ok && abierto.value) abierto.value = { ...abierto.value, enterado_en: r.valor.enterado_en }
}

watch(comunicadoId, (c) => (c ? abrir() : listado.recargar()), { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-comunicados">
    <header>
      <RouterLink
        v-if="comunicadoId"
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Todos los comunicados
      </RouterLink>
      <h1 id="titulo-comunicados">
        Mis comunicados
      </h1>
    </header>

    <template v-if="comunicadoId">
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error'"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="abrir"
      />
      <HudPanel
        v-else-if="abierto"
        :etiqueta="abierto.comunicado.importante ? 'Importante' : 'Comunicado'"
        :resaltado="abierto.comunicado.importante"
      >
        <article class="comunicado">
          <h2>{{ abierto.comunicado.titulo }}</h2>
          <small v-if="abierto.comunicado.enviado_en">{{ fechaHora(abierto.comunicado.enviado_en, zona) }}</small>
          <p class="cuerpo">
            {{ abierto.comunicado.cuerpo }}
          </p>
          <ul
            v-if="abierto.enlaces_adjuntos.length"
            class="adjuntos"
            aria-label="Adjuntos"
          >
            <li
              v-for="a in abierto.enlaces_adjuntos"
              :key="a.archivo_id"
            >
              <a
                :href="a.url"
                target="_blank"
                rel="noopener"
              ><IArchivo aria-hidden="true" /> {{ a.nombre }}</a>
            </li>
          </ul>
          <small v-if="abierto.enlaces_adjuntos.length">Los enlaces de los adjuntos vencen en 5 minutos; si vencen, vuelva a abrir el comunicado.</small>
          <div
            v-if="abierto.comunicado.requiere_confirmacion"
            class="botones"
          >
            <p
              v-if="abierto.enterado_en"
              class="ok"
              role="status"
            >
              Usted confirmó que se enteró el {{ fechaHora(abierto.enterado_en, zona) }}.
            </p>
            <template v-else>
              <HudBoton
                :cargando="enterado.cargando.value"
                @click="confirmar"
              >
                Enterado
              </HudBoton>
              <p
                v-if="enterado.error.value"
                class="error"
                role="alert"
              >
                {{ enterado.error.value }}
              </p>
            </template>
          </div>
        </article>
      </HudPanel>
    </template>

    <template v-else>
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
        mensaje="Aún no ha recibido comunicados."
      />
      <template v-else>
        <ul
          class="lista"
          aria-label="Comunicados recibidos"
        >
          <li
            v-for="c in ordenados"
            :key="c.comunicado.id"
            :class="{ nuevo: !c.leido_en }"
          >
            <RouterLink :to="ruta(c.comunicado.id)">
              <strong>{{ c.comunicado.titulo }}</strong>
            </RouterLink>
            <HudInsignia
              v-if="!c.leido_en"
              tono="aviso"
            >
              Sin leer
            </HudInsignia>
            <HudInsignia
              v-if="c.comunicado.importante"
              tono="peligro"
            >
              Importante
            </HudInsignia>
            <small v-if="c.comunicado.enviado_en">{{ fechaHora(c.comunicado.enviado_en, zona) }}</small>
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

<style scoped src="./portal.css"></style>
<style scoped>
.comunicado {
  display: grid;
  gap: 10px;
}

h2 {
  margin: 0;
  font-size: clamp(20px, 5vw, 26px);
}

.cuerpo {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}

.adjuntos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adjuntos a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}

.lista > li.nuevo {
  border-left: 3px solid var(--ambar);
}

.lista a {
  color: var(--texto);
}
</style>

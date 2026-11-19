<script setup lang="ts">
/**
 * Directorio de comercios y servicios que alcanzan a la entidad: búsqueda por texto y
 * categoría, destacadas primero, y la ficha del anunciante (`:id`) con sus reseñas en la PH.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { FichaDirectorio } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFiltros from '@/hud/componentes/HudFiltros.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import TarjetaAnunciante from '@/hud/componentes/TarjetaAnunciante.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { destacadas as pedirDestacadas, type FiltrosDirectorio, listarDirectorio } from '../api'
import FichaAnunciante from '../componentes/FichaAnunciante.vue'
import { useCategoriasDirectorio } from '../store'

const route = useRoute()
const entidad = useEntidad()
const categorias = useCategoriasDirectorio()

const id = computed(() => entidad.activa?.entidad_id ?? '')
const anuncianteId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))

const VACIOS: FiltrosDirectorio = { categoria: '', q: '' }
const filtros = ref<FiltrosDirectorio>({ ...VACIOS })
const listado = useListado((despues, f: FiltrosDirectorio) => listarDirectorio(id.value, despues, f), { filtros })
const destacadas = ref<FichaDirectorio[]>([])

const activos = computed(() =>
  [
    filtros.value.q.trim() && { clave: 'q', etiqueta: `Texto: ${filtros.value.q.trim()}` },
    filtros.value.categoria && { clave: 'categoria', etiqueta: `Categoría: ${categorias.nombre([filtros.value.categoria])}` },
  ].filter((x): x is { clave: keyof FiltrosDirectorio; etiqueta: string } => !!x),
)
/** Las destacadas van arriba solo sin texto de búsqueda (con texto manda la coincidencia). */
const mostrarDestacadas = computed(() => !filtros.value.q.trim() && destacadas.value.length > 0)
const resto = computed(() => {
  if (!mostrarDestacadas.value) return listado.filas.value
  const arriba = new Set(destacadas.value.map((d) => d.anunciante_id))
  return listado.filas.value.filter((f) => !arriba.has(f.anunciante_id))
})
const ruta = (anunciante = '') => ({ name: 'modulo', params: { ...route.params, id: anunciante }, query: {} })

function quitar(clave: string) {
  const k = clave as keyof FiltrosDirectorio
  filtros.value = { ...filtros.value, [k]: VACIOS[k] }
}

async function cargarDestacadas(categoria: string) {
  try {
    destacadas.value = await pedirDestacadas(id.value, categoria)
  } catch {
    // Las destacadas son un extra: si fallan, el directorio sigue completo.
    destacadas.value = []
  }
}

watch(() => filtros.value.categoria, (c) => void cargarDestacadas(c))
onMounted(() => {
  void cargarDestacadas('')
  // Sin categorías el filtro solo ofrece «Todas»; las tarjetas muestran el código.
  void categorias.asegurar(id.value).catch(() => undefined)
})
</script>

<template>
  <section aria-labelledby="titulo-directorio">
    <template v-if="anuncianteId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Directorio
      </RouterLink>
      <FichaAnunciante
        :entidad-id="id"
        :anunciante-id="anuncianteId"
      />
    </template>
    <template v-else>
      <header>
        <h1 id="titulo-directorio">
          Directorio
        </h1>
        <p class="texto-2">
          Comercios y servicios que atienden su sector. Escríbales directamente o vea las reseñas.
        </p>
      </header>

      <!-- La búsqueda es lo principal: siempre visible; la categoría va en los filtros (plegables en móvil). -->
      <div class="buscar">
        <HudCampo
          v-model="filtros.q"
          etiqueta="¿Qué necesita?"
          tipo="search"
          autocompletar="off"
          ayuda="Por ejemplo: modista, plomero, lavadoras."
        />
      </div>
      <HudFiltros
        :activos="activos"
        @quitar="quitar"
        @limpiar="filtros = { ...VACIOS }"
      >
        <HudSelector
          v-model="filtros.categoria"
          etiqueta="Categoría"
          :opciones="categorias.opciones"
        />
      </HudFiltros>

      <section
        v-if="mostrarDestacadas"
        aria-labelledby="titulo-destacadas"
      >
        <h2 id="titulo-destacadas">
          Destacadas
        </h2>
        <ul class="tarjetas">
          <li
            v-for="f in destacadas"
            :key="f.anunciante_id"
          >
            <TarjetaAnunciante
              :ficha="f"
              :categoria="categorias.nombre(f.categorias)"
              :a="ruta(f.anunciante_id)"
            />
          </li>
        </ul>
      </section>

      <HudEstado
        v-if="listado.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'error'"
        estado="error"
        :mensaje="listado.error.value ?? undefined"
        :referencia="listado.referencia.value"
        @reintentar="listado.recargar()"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        :mensaje="activos.length ? 'Ningún comercio coincide con la búsqueda. Pruebe con otra palabra.' : 'Aún no hay comercios en el directorio de su sector.'"
      />
      <section
        v-else-if="resto.length || listado.hayMas.value"
        aria-labelledby="titulo-todos"
      >
        <h2 id="titulo-todos">
          {{ mostrarDestacadas ? 'Más comercios y servicios' : 'Comercios y servicios' }}
        </h2>
        <ul class="tarjetas">
          <li
            v-for="f in resto"
            :key="f.anunciante_id"
          >
            <TarjetaAnunciante
              :ficha="f"
              :categoria="categorias.nombre(f.categorias)"
              :a="ruta(f.anunciante_id)"
            />
          </li>
        </ul>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </section>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.buscar {
  max-width: 560px;
}

.tarjetas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tarjetas > li {
  display: grid;
}
</style>

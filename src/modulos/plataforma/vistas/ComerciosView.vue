<script setup lang="ts">
/**
 * Comercios y campañas (la publicidad la opera la plataforma, ADR 0023): el listado con su
 * verificación, el alta, la ficha de cada comercio (`:id`) y el catálogo de categorías.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CategoriaDirectorio, EstadoVerificacion, NuevoAnunciante } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { usePestana } from '@/composables/usePestana'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { categoriasPlataforma, crearAnunciante, listarAnunciantes } from '../api-publicidad'
import CategoriasPlataforma from '../componentes/CategoriasPlataforma.vue'
import FichaComercio from '../componentes/FichaComercio.vue'
import FormularioComercio from '../componentes/FormularioComercio.vue'
import { ESTADO_ANUNCIANTE } from '../reglas'
import { usePermisosPlataforma } from '../store'

const route = useRoute()
const router = useRouter()
const { puede } = usePermisosPlataforma()
const comercioId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const TODAS = [
  { id: 'comercios', texto: 'Comercios' },
  { id: 'categorias', texto: 'Categorías' },
] as const
const PESTANAS = computed(() => TODAS.filter((p) => p.id === 'comercios' || puede('plataforma.directorio.gestionar')))
const pestana = usePestana(TODAS)

const filtros = ref<{ q: string; estado: EstadoVerificacion | '' }>({ q: '', estado: '' })
const lista = useListado((d, f: { q: string; estado: EstadoVerificacion | '' }) => listarAnunciantes(d, f), { filtros })
const categorias = ref<CategoriaDirectorio[]>([])
const creando = ref(false)

const ESTADOS = [{ valor: '', etiqueta: 'Todos' }, ...(Object.keys(ESTADO_ANUNCIANTE) as EstadoVerificacion[]).map((e) => ({ valor: e, etiqueta: ESTADO_ANUNCIANTE[e].texto }))]
const ruta = (id = '') => ({ name: 'modulo', params: { ...route.params, id }, query: {} })

const crear = useAccion((clave, datos: NuevoAnunciante) => crearAnunciante(datos, clave))

async function enviar(datos: NuevoAnunciante) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  creando.value = false
  await router.push(ruta(r.valor.id))
}

function abrirAlta() {
  crear.reiniciar()
  creando.value = true
}

onMounted(async () => {
  if (!puede('plataforma.directorio.gestionar')) return
  categorias.value = await categoriasPlataforma().catch(() => [])
})
</script>

<template>
  <section aria-labelledby="titulo-comercios">
    <template v-if="comercioId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Comercios
      </RouterLink>
      <FichaComercio
        :comercio-id="comercioId"
        :categorias="categorias"
      />
    </template>
    <template v-else>
      <header class="encabezado">
        <div>
          <h1 id="titulo-comercios">
            Comercios y campañas
          </h1>
          <p class="texto-2">
            Los comercios del directorio, su verificación, sus campañas y piezas.
          </p>
        </div>
        <HudBoton
          v-if="puede('plataforma.directorio.gestionar') && pestana === 'comercios'"
          @click="abrirAlta"
        >
          <IMas aria-hidden="true" /> Nuevo comercio
        </HudBoton>
      </header>
      <HudPestanas
        v-if="PESTANAS.length > 1"
        :pestanas="PESTANAS"
        etiqueta="Directorio de la plataforma"
      />
      <CategoriasPlataforma
        v-if="pestana === 'categorias' && puede('plataforma.directorio.gestionar')"
        v-model="categorias"
      />
      <template v-else>
        <div class="filtros">
          <HudCampo
            v-model="filtros.q"
            etiqueta="Buscar comercio"
            tipo="search"
            autocompletar="off"
          />
          <HudSelector
            v-model="filtros.estado"
            etiqueta="Verificación"
            :opciones="ESTADOS"
          />
        </div>
        <HudEstado
          v-if="lista.estado.value === 'cargando'"
          estado="cargando"
        />
        <HudEstado
          v-else-if="lista.estado.value === 'error'"
          estado="error"
          :mensaje="lista.error.value ?? undefined"
          :referencia="lista.referencia.value"
          @reintentar="lista.recargar()"
        />
        <HudEstado
          v-else-if="lista.estado.value === 'vacio'"
          estado="vacio"
          :mensaje="filtros.q || filtros.estado ? 'Ningún comercio coincide.' : 'Aún no hay comercios.'"
        />
        <template v-else>
          <ul class="lista">
            <li
              v-for="c in lista.filas.value"
              :key="c.id"
            >
              <span class="crece">
                <RouterLink :to="ruta(c.id)"><strong>{{ c.nombre_comercial }}</strong></RouterLink>
                <small>{{ c.ficha ? (c.ficha.publicada ? 'Publicado en el directorio' : 'Ficha sin publicar') : 'Sin ficha del directorio' }}</small>
              </span>
              <HudInsignia :tono="ESTADO_ANUNCIANTE[c.estado].tono">
                {{ ESTADO_ANUNCIANTE[c.estado].texto }}
              </HudInsignia>
            </li>
          </ul>
          <HudCargarMas
            :hay-mas="lista.hayMas.value"
            :cargando="lista.cargando.value"
            @cargar="lista.cargarMas()"
          />
        </template>
      </template>
      <FormularioComercio
        v-model:abierto="creando"
        :cargando="crear.cargando.value"
        :error="crear.error.value"
        @crear="enviar"
      />
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.crece a {
  color: var(--texto);
}
</style>

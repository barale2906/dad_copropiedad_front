<script setup lang="ts">
/**
 * Marco plano de los módulos de trabajo diario: menú lateral, migas de pan y «Volver a la
 * maqueta». Aquí no hay 3D. Cada módulo real (fase 3 en adelante) se monta en `modulos/` y
 * reemplaza el contenido provisional de la acción.
 */
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue'
import { type RouteLocationNamedRaw, useRoute } from 'vue-router'
import { TEXTO_ESTADO } from '@/escena/mapa-modulos'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import IVolver from '~icons/tabler/arrow-left'
import ICandado from '~icons/tabler/lock'
import IMenu from '~icons/tabler/list'
import BarraSuperior from './componentes/BarraSuperior.vue'
import ModuloNoDisponible from './componentes/ModuloNoDisponible.vue'
import { ICONOS } from './iconos'
import { useNavegacion } from './navegacion'
import { CLAVE_VISTAS_MODULO, claveVista } from './vistas-modulo'

const route = useRoute()
const nav = useNavegacion()
const menuAbierto = ref(false)

const slug = computed(() => String(route.params.seccion ?? ''))
const vista = computed(() => nav.vistaSeccion(slug.value))
/** Estado de la sección y, si hay acción en la ruta, de esa acción para el rol. */
const estado = computed(() => nav.estadoDeAccion(slug.value, String(route.params.accion ?? '')))
const accion = computed(() => {
  const id = String(route.params.accion ?? '')
  return vista.value?.acciones.find((a) => a.id === id) ?? null
})
const origen = computed(() => (typeof route.query.origen === 'string' ? route.query.origen : undefined))
const zonaPre = computed(() => {
  const z = route.query.zona
  if (typeof z !== 'string') return null
  return nav.zonas.value.find((x) => x.zona === z)?.nombre ?? z
})
const lateral = computed(() => nav.secciones.value)

/** Vista real de la acción, si el módulo ya la tiene (si no, «en construcción»). */
const vistas = inject(CLAVE_VISTAS_MODULO, {})
const vistaAccion = computed(() => {
  const cargar = accion.value ? vistas[claveVista(slug.value, accion.value.id)] : undefined
  return cargar ? defineAsyncComponent(cargar) : null
})

/** Conserva `zona` y `origen` al pasar entre acciones de la misma sección. */
function conConsulta(accionId: string): RouteLocationNamedRaw {
  return { ...(nav.rutaAccion(slug.value, accionId) as RouteLocationNamedRaw), query: route.query }
}

watch(() => route.fullPath, () => (menuAbierto.value = false))
</script>

<template>
  <div class="modulo">
    <BarraSuperior>
      <button
        class="boton-icono solo-movil"
        :aria-expanded="menuAbierto"
        aria-controls="menu-lateral"
        @click="menuAbierto = !menuAbierto"
      >
        <IMenu /><span class="texto">Menú</span>
      </button>
    </BarraSuperior>

    <div class="cuerpo">
      <nav
        id="menu-lateral"
        class="lateral"
        :class="{ abierto: menuAbierto }"
        aria-label="Módulos"
      >
        <RouterLink
          :to="nav.rutaMaqueta(origen)"
          class="volver"
        >
          <IVolver aria-hidden="true" /> Volver a la maqueta
        </RouterLink>
        <ul>
          <li
            v-for="s in lateral"
            :key="s.seccion.slug"
          >
            <RouterLink
              v-if="s.estado === 'activa'"
              :to="nav.rutaAccion(s.seccion.slug)"
              :class="{ actual: s.seccion.slug === slug }"
            >
              <component
                :is="ICONOS[s.seccion.slug]"
                aria-hidden="true"
              />
              {{ s.seccion.nombre }}
            </RouterLink>
            <span
              v-else
              class="apagada"
              :title="TEXTO_ESTADO[s.estado]"
            >
              <component
                :is="ICONOS[s.seccion.slug]"
                aria-hidden="true"
              />
              {{ s.seccion.nombre }}
              <ICandado
                class="candado"
                aria-hidden="true"
              />
            </span>
          </li>
        </ul>
      </nav>

      <main class="contenido">
        <RouterLink
          :to="nav.rutaMaqueta(origen)"
          class="volver solo-movil"
        >
          <IVolver aria-hidden="true" /> Volver a la maqueta
        </RouterLink>
        <nav
          class="migas"
          aria-label="Ruta"
        >
          <RouterLink :to="nav.rutaMaqueta(origen)">
            Maqueta
          </RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink
            v-if="vista && accion"
            :to="nav.rutaAccion(slug)"
          >
            {{ vista.seccion.nombre }}
          </RouterLink>
          <span
            v-else
            aria-current="page"
          >{{ vista?.seccion.nombre ?? 'Módulo' }}</span>
          <template v-if="accion">
            <span aria-hidden="true">/</span>
            <span aria-current="page">{{ accion.etiqueta }}</span>
          </template>
        </nav>

        <HudPanel
          v-if="!vista"
          etiqueta="Error"
        >
          <h1>Módulo no encontrado</h1>
        </HudPanel>

        <ModuloNoDisponible
          v-else-if="estado && estado !== 'activa'"
          :estado="estado"
          :seccion="vista.seccion"
        />

        <template v-else-if="!accion">
          <header class="encabezado">
            <component
              :is="ICONOS[vista.seccion.slug]"
              class="icono-grande"
              aria-hidden="true"
            />
            <div>
              <h1>{{ vista.seccion.nombre }}</h1>
              <p class="texto-2">
                {{ vista.seccion.resumen }}
              </p>
            </div>
          </header>
          <ul class="acciones">
            <li
              v-for="a in vista.acciones"
              :key="a.id"
            >
              <RouterLink :to="conConsulta(a.id)">
                <strong>{{ a.etiqueta }}</strong>
                <span>{{ a.descripcion }}</span>
              </RouterLink>
            </li>
          </ul>
        </template>

        <component
          :is="vistaAccion"
          v-else-if="vistaAccion"
          :key="accion.id"
        />

        <HudPanel
          v-else
          :etiqueta="vista.seccion.nombre"
        >
          <h1>{{ accion.etiqueta }}</h1>
          <p class="texto-2">
            {{ accion.descripcion }}
          </p>
          <p
            v-if="zonaPre"
            class="chip"
          >
            Zona preseleccionada: <strong>{{ zonaPre }}</strong>
          </p>
          <p class="construccion">
            Pantalla en construcción. Este marco (menú lateral, migas y regreso a la maqueta) es
            el que usarán todos los módulos.
          </p>
        </HudPanel>
      </main>
    </div>
  </div>
</template>

<style scoped>
.modulo {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: linear-gradient(180deg, var(--fondo-2), var(--fondo) 40%);
}

.cuerpo {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.lateral {
  position: sticky;
  top: 0;
  align-self: start;
  max-height: calc(100dvh - var(--barra-alto));
  overflow-y: auto;
  padding: 20px 12px;
  border-right: 1px solid var(--linea);
}

.volver {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  margin-bottom: 16px;
  border: 1px solid var(--linea-fuerte);
  background: var(--cian-tenue);
  color: var(--cian);
  font-family: var(--fuente-display);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
}

.volver:hover {
  background: rgb(56 232 255 / 22%);
}

.lateral ul {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lateral a,
.lateral .apagada {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
  border-left: 2px solid transparent;
  color: var(--texto-2);
  font-size: 14px;
  text-decoration: none;
}

.lateral a:hover {
  color: var(--texto);
  background: rgb(255 255 255 / 3%);
}

.lateral a.actual {
  color: var(--cian);
  border-left-color: var(--cian);
  background: var(--cian-tenue);
}

.lateral .apagada {
  color: var(--texto-3);
  opacity: 0.6;
  cursor: not-allowed;
}

.candado {
  margin-left: auto;
  font-size: 13px;
}

.contenido {
  padding: 20px var(--gutter) 48px;
  max-width: 1100px;
  width: 100%;
}

.migas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--texto-3);
}

.migas a {
  color: var(--texto-2);
  text-decoration: none;
}

.migas a:hover {
  color: var(--cian);
}

.migas [aria-current] {
  color: var(--texto);
}

.encabezado {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
}

.icono-grande {
  font-size: 44px;
  color: var(--cian);
  filter: drop-shadow(0 0 12px rgb(56 232 255 / 40%));
}

h1 {
  font-size: clamp(26px, 3.5vw, 36px);
}

.texto-2 {
  color: var(--texto-2);
  margin: 6px 0 0;
}

.acciones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.acciones a {
  display: grid;
  gap: 4px;
  height: 100%;
  padding: 16px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--cian);
  background: var(--superficie);
  color: var(--texto);
  text-decoration: none;
  transition:
    transform var(--rapido) var(--curva),
    background var(--rapido);
}

.acciones a:hover,
.acciones a:focus-visible {
  transform: translateY(-2px);
  background: var(--superficie-alta);
}

.acciones strong {
  font-family: var(--fuente-display);
  font-size: 18px;
}

.acciones span {
  font-size: 13px;
  color: var(--texto-2);
}

.chip {
  display: inline-block;
  margin: 16px 0 0;
  padding: 6px 12px;
  border: 1px solid var(--linea-fuerte);
  background: var(--cian-tenue);
  font-size: 13px;
}

.construccion {
  margin: 20px 0 0;
  padding-top: 14px;
  border-top: 1px dashed var(--linea);
  font-size: 13px;
  color: var(--texto-3);
}

.solo-movil {
  display: none !important;
}

@media (max-width: 900px) {
  .cuerpo {
    grid-template-columns: 1fr;
  }

  .solo-movil {
    display: inline-flex !important;
  }

  .lateral {
    position: fixed;
    z-index: 30;
    top: var(--barra-alto);
    left: 0;
    bottom: 0;
    width: min(300px, 86vw);
    max-height: none;
    background: var(--superficie-solida);
    transform: translateX(-100%);
    transition: transform var(--medio) var(--curva);
    box-shadow: var(--sombra);
  }

  /* Cerrado: fuera de la pantalla y fuera del orden de tabulación. */
  .lateral:not(.abierto) {
    visibility: hidden;
    transition:
      transform var(--medio) var(--curva),
      visibility 0s var(--medio);
  }

  .lateral.abierto {
    transform: none;
  }

  .lateral .volver {
    display: none;
  }
}
</style>

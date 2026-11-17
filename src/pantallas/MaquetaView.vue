<script setup lang="ts">
/**
 * Pantalla de inicio de la entidad: maqueta 3D genérica (conjunto u oficina) con etiquetas
 * HTML y el panel de la zona elegida; o el menú alterno (lista) si no hay WebGL, si la escena
 * falla o si el usuario lo prefiere. Se conserva con KeepAlive para volver al mismo encuadre.
 */
import {
  computed,
  defineAsyncComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { perfil } from '@/escena/calidad'
import type { EtiquetaPos, Holgura } from '@/escena/motor'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { usePreferencias } from '@/stores/preferencias'
import ICubo from '~icons/tabler/cube-3d-sphere'
import ICandado from '~icons/tabler/lock'
import ILista from '~icons/tabler/list'
import BarraSuperior from './componentes/BarraSuperior.vue'
import MenuAlterno from './componentes/MenuAlterno.vue'
import PanelZona from './componentes/PanelZona.vue'
import { useNavegacion } from './navegacion'

defineOptions({ name: 'MaquetaView' })

const fallo = ref(false)

const EscenaCanvas = defineAsyncComponent({
  loader: () => import('@/escena/EscenaCanvas.vue'),
  onError: (_e, _reintentar, fallar) => {
    fallo.value = true
    fallar()
  },
})

const route = useRoute()
const router = useRouter()
const prefs = usePreferencias()
const nav = useNavegacion()
const entidad = useEntidad()
const bienes = useBienes()

const calidad = perfil(prefs.calidad)
const lista3D = ref(false)
const activa = ref(true)
const elegida = ref<string | null>(typeof route.query.zona === 'string' ? route.query.zona : null)
const sobre = ref<string | null>(null)
const etiquetas = shallowRef<EtiquetaPos[]>([])
const medidaPanel = ref({ ancho: 0, alto: 0 })
const anchoVentana = ref(window.innerWidth)
const alRedimensionar = () => (anchoVentana.value = window.innerWidth)
onMounted(() => window.addEventListener('resize', alRedimensionar, { passive: true }))

/**
 * Quien solo tiene vínculo con bienes entra en móvil a «Mi hogar», y en un equipo marcado como
 * de portería se entra al turno (la maqueta queda a un toque, con `?ver=maqueta`). Para todos,
 * se cargan sus bienes para marcarlos en la maqueta.
 */
onMounted(() => {
  const directo = route.query.ver !== 'maqueta' && !route.query.zona
  const entrada =
    entidad.soloVinculo && window.innerWidth <= 760 ? { seccion: 'mi', accion: 'inicio' }
      : prefs.turnoAlEntrar && nav.estadoDeAccion('porteria', 'turno') === 'activa' ? { seccion: 'porteria', accion: 'turno' }
        : null
  if (directo && entrada) {
    void router.replace({ name: 'modulo', params: { entidadId: route.params.entidadId, ...entrada } })
    return
  }
  if (entidad.esPH && (entidad.tieneRol('propietario') || entidad.tieneRol('residente'))) bienes.asegurarPropios().catch(() => undefined)
})
onBeforeUnmount(() => window.removeEventListener('resize', alRedimensionar))

const usar3D = computed(() => prefs.vista === 'maqueta' && calidad.nivel !== 'lista' && !fallo.value)
const aviso = computed(() =>
  prefs.vista === 'maqueta' && (calidad.nivel === 'lista' || fallo.value)
    ? 'Este equipo no puede mostrar la maqueta 3D; se muestra la vista de lista con las mismas opciones.'
    : null,
)
const zonaElegida = computed(() => nav.zonas.value.find((z) => z.id === elegida.value) ?? null)
const esMovil = computed(() => anchoVentana.value <= 760)
const holgura = computed<Holgura>(() => {
  if (!zonaElegida.value) return { derecha: 0, abajo: 0 }
  return esMovil.value
    ? { derecha: 0, abajo: medidaPanel.value.alto }
    : { derecha: medidaPanel.value.ancho + 16, abajo: 0 }
})
const tactil = matchMedia('(pointer: coarse)').matches

/** Etiquetas visibles; en pantallas angostas se ocultan las que se pisan (gana la más cercana). */
const etiquetasVisibles = computed(() => {
  const vis = etiquetas.value.filter((e) => e.visible)
  if (!esMovil.value) return vis
  const puestas: EtiquetaPos[] = []
  for (const e of [...vis].sort((a, b) => a.profundidad - b.profundidad)) {
    if (e.id === elegida.value || !puestas.some((p) => Math.abs(p.x - e.x) < 80 && Math.abs(p.y - e.y) < 24)) {
      puestas.push(e)
    }
  }
  return puestas
})

/** Que ninguna etiqueta quede cortada por el borde de la pantalla. */
const limitarX = (x: number) => Math.min(Math.max(x, 70), anchoVentana.value - 70)

const nombre = (id: string) => nav.zonas.value.find((z) => z.id === id)?.nombre ?? id

/**
 * Marcas de los bienes del propietario sobre las zonas: su apartamento en Torres y el número de
 * su parqueadero en Parqueaderos (plan 05).
 */
const marcas = computed<Record<string, string>>(() => {
  const propios = bienes.propios ?? []
  const parqueaderos = propios.filter((b) => b.tipo === 'parqueadero').map((b) => b.numero ?? b.codigo)
  const otros = propios.filter((b) => b.tipo !== 'parqueadero' && b.tipo !== 'deposito' && b.tipo !== 'bodega').map((b) => b.codigo)
  return {
    ...(otros.length ? { torres: otros.join(', ') } : {}),
    ...(parqueaderos.length ? { parqueadero: parqueaderos.join(', ') } : {}),
  }
})

function elegir(id: string | null) {
  elegida.value = id
  sobre.value = null
  router.replace({ query: id ? { zona: id } : {} })
}

function alternarVista() {
  prefs.vista = prefs.vista === 'maqueta' ? 'lista' : 'maqueta'
}

watch(zonaElegida, (z) => {
  if (!z) medidaPanel.value = { ancho: 0, alto: 0 }
})

onActivated(() => {
  activa.value = true
  const z = route.query.zona
  if (typeof z === 'string' && z !== elegida.value) elegida.value = z
})
onDeactivated(() => (activa.value = false))
</script>

<template>
  <div class="maqueta">
    <BarraSuperior>
      <button
        class="boton-icono"
        :aria-pressed="prefs.vista === 'lista'"
        :title="prefs.vista === 'maqueta' ? 'Ver como lista' : 'Ver maqueta 3D'"
        @click="alternarVista"
      >
        <ILista v-if="prefs.vista === 'maqueta'" />
        <ICubo v-else />
        <span class="texto">{{ prefs.vista === 'maqueta' ? 'Lista' : 'Maqueta' }}</span>
      </button>
    </BarraSuperior>

    <div
      v-if="usar3D"
      class="escenario"
      :class="{ elegida: !!zonaElegida }"
    >
      <EscenaCanvas
        :plantilla="nav.plantilla.value"
        :perfil="calidad"
        :estados="nav.estadosZonas.value"
        :enfocada="elegida"
        :holgura="holgura"
        :pausada="!activa"
        @elegir="elegir"
        @pasar="sobre = $event"
        @etiquetas="etiquetas = $event"
        @lista="lista3D = true"
        @fallo="fallo = true"
      />

      <ul
        class="etiquetas"
        aria-label="Zonas de la maqueta"
      >
        <li
          v-for="e in etiquetasVisibles"
          :key="e.id"
          class="punto"
          :style="{ transform: `translate3d(${limitarX(e.x)}px, ${Math.max(e.y, 36)}px, 0) translate(-50%, -100%)` }"
        >
          <button
            class="etiqueta"
            :class="[nav.estadosZonas.value[e.id], { sobre: sobre === e.id, elegida: elegida === e.id }]"
            :aria-pressed="elegida === e.id"
            @click="elegir(elegida === e.id ? null : e.id)"
          >
            <ICandado
              v-if="nav.estadosZonas.value[e.id] !== 'activa'"
              class="candado"
              aria-hidden="true"
            />
            <i
              v-else
              aria-hidden="true"
            />
            {{ nombre(e.id) }}
            <small
              v-if="marcas[e.id]"
              class="marca"
            ><span class="solo-lector">: su bien </span>{{ marcas[e.id] }}</small>
          </button>
        </li>
      </ul>

      <p
        v-if="lista3D && !zonaElegida"
        class="pista rotulo"
      >
        {{ tactil ? 'Toque una zona · arrastre para girar · pellizque para acercar' : 'Clic en una zona · arrastre para girar · rueda para acercar' }}
      </p>

      <div
        v-if="!lista3D"
        class="cargando rotulo"
        role="status"
      >
        <span /> Cargando maqueta…
      </div>

      <PanelZona
        v-if="zonaElegida"
        :key="zonaElegida.id"
        :zona="zonaElegida"
        @cerrar="elegir(null)"
        @medida="(an, al) => (medidaPanel = { ancho: an, alto: al })"
      />
    </div>

    <main
      v-else
      class="lista"
    >
      <MenuAlterno :aviso="aviso" />
    </main>
  </div>
</template>

<style scoped>
.maqueta {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background:
    radial-gradient(1000px 520px at 50% 40%, rgb(0 184 212 / 12%), transparent 70%),
    linear-gradient(180deg, var(--fondo-2), var(--fondo));
}

.escenario {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.lista {
  flex: 1;
  overflow-y: auto;
}

.etiquetas {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  pointer-events: none;
}

.punto {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.etiqueta {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--linea-fuerte);
  background: rgb(5 12 24 / 78%);
  color: var(--texto);
  font-family: var(--fuente-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
}

.etiqueta::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  width: 1px;
  height: 10px;
  background: var(--linea-fuerte);
}

.marca {
  margin-left: 6px;
  padding: 0 6px;
  border: 1px solid currentcolor;
  color: var(--ambar);
  font-size: 12px;
}

.etiqueta i {
  width: 6px;
  height: 6px;
  background: var(--cian);
  box-shadow: 0 0 8px var(--cian);
  transform: rotate(45deg);
}

.etiqueta.sobre,
.etiqueta.elegida,
.etiqueta:hover,
.etiqueta:focus-visible {
  border-color: var(--cian);
  background: rgb(0 60 80 / 85%);
  color: #fff;
}

.etiqueta.no_contratada,
.etiqueta.sin_acceso,
.etiqueta.proximamente {
  color: var(--texto-3);
  border-color: rgb(120 130 150 / 35%);
  background: rgb(12 16 24 / 78%);
}

.etiqueta.no_contratada:hover,
.etiqueta.sin_acceso:hover,
.etiqueta.proximamente:hover {
  color: var(--texto-2);
}

.candado {
  font-size: 13px;
}

.pista {
  position: absolute;
  left: 50%;
  bottom: max(16px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 14px;
  background: rgb(5 9 18 / 70%);
  border: 1px solid var(--linea);
  white-space: nowrap;
  pointer-events: none;
  max-width: calc(100% - 32px);
  overflow: hidden;
  text-overflow: ellipsis;
}

.cargando {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--cian);
}

.cargando span {
  width: 18px;
  height: 18px;
  border: 2px solid var(--cian);
  border-right-color: transparent;
  border-radius: 50%;
  animation: girar 0.8s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .etiqueta {
    font-size: 11.5px;
    padding: 3px 8px;
  }

  .pista {
    font-size: 10.5px;
    letter-spacing: 0.1em;
  }
}
</style>

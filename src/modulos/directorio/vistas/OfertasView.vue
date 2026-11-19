<script setup lang="ts">
/**
 * Ofertas de los comercios: solo para quien autorizó recibir publicidad (por persona y entidad;
 * la entidad no autoriza por el titular). Sin autorización, la invitación con la política vigente.
 * Impresiones y clics se registran en lote sin bloquear la interfaz.
 */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import { autorizacionPublicidad, autorizarPublicidad, retirarPublicidad } from '@/api/publicidad'
import type { AutorizacionPublicidad, CuponPublicidad, PiezaPublicidad } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { obtenerCupon, piezas as pedirPiezas, reportarAnuncio } from '../api'
import PiezaOferta from '../componentes/PiezaOferta.vue'
import { useEventosPiezas } from '../useEventosPiezas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const eventos = useEventosPiezas(() => id.value)

const autorizacion = ref<AutorizacionPublicidad | null>(null)
const lista = ref<PiezaPublicidad[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const cupones = ref<Record<string, CuponPublicidad>>({})
const pidiendo = ref<string | null>(null)
const reportando = ref<PiezaPublicidad | null>(null)
const dialogoReporte = ref(false)
const resultado = ref<string | null>(null)

const autorizar = useAccion(() => autorizarPublicidad(id.value, autorizacion.value?.politica?.version ?? 0), {
  alExito: () => void cargar(),
})
const retirar = useAccion(() => retirarPublicidad(id.value), {
  alExito: () => {
    resultado.value = 'Ya no recibirá ofertas. Puede volver a autorizarlas cuando quiera.'
    lista.value = []
    if (autorizacion.value) autorizacion.value = { ...autorizacion.value, autorizada: false }
  },
})
const cupon = useAccion((_clave, creativoId: string) => obtenerCupon(id.value, creativoId))
const reportar = useAccion((_clave, creativoId: string, motivo: string) => reportarAnuncio(id.value, creativoId, motivo), {
  alExito: (nuevo) => {
    dialogoReporte.value = false
    resultado.value = nuevo ? 'Gracias: la moderación revisará el anuncio.' : 'Ya había reportado este anuncio.'
  },
})

async function cargar() {
  estado.value = 'cargando'
  error.value = referencia.value = null
  try {
    autorizacion.value = await autorizacionPublicidad(id.value)
    lista.value = autorizacion.value.autorizada ? await pedirPiezas(id.value) : []
    for (const p of lista.value) eventos.impresion(p.creativo_id)
    estado.value = 'listo'
  } catch (e) {
    // `validacion`: la cuenta no es una persona de la entidad (las ofertas son personales).
    error.value =
      e instanceof ErrorApi && e.codigo === 'validacion'
        ? 'Las ofertas son personales: solo las reciben las personas registradas en la entidad.'
        : mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

async function pedirCupon(p: PiezaPublicidad) {
  pidiendo.value = p.creativo_id
  const r = await cupon.ejecutar(p.creativo_id)
  pidiendo.value = null
  if (!r.ok) return
  cupones.value = { ...cupones.value, [p.creativo_id]: r.valor }
  eventos.clic(p.creativo_id)
}

function confirmarReporte(motivo: string) {
  if (reportando.value) void reportar.ejecutar(reportando.value.creativo_id, motivo.slice(0, 500))
}

function abrirReporte(p: PiezaPublicidad) {
  reportando.value = p
  reportar.reiniciar()
  dialogoReporte.value = true
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-ofertas">
    <header>
      <h1 id="titulo-ofertas">
        Ofertas
      </h1>
      <p class="texto-2">
        Promociones y cupones de los comercios del directorio.
      </p>
    </header>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      :referencia="referencia"
      @reintentar="cargar()"
    />
    <HudPanel
      v-else-if="!autorizacion?.autorizada"
      etiqueta="Reciba ofertas de su sector"
    >
      <div class="campos">
        <p>
          Para ver promociones y cupones de los comercios necesitamos su autorización. Solo usted puede darla y
          retirarla cuando quiera; el directorio sigue disponible aunque no autorice.
        </p>
        <template v-if="autorizacion?.politica">
          <h2>Política de publicidad (versión {{ autorizacion.politica.version }})</h2>
          <p
            class="politica"
            tabindex="0"
          >
            {{ autorizacion.politica.texto }}
          </p>
          <div>
            <HudBoton
              :cargando="autorizar.cargando.value"
              @click="autorizar.ejecutar()"
            >
              Acepto recibir ofertas
            </HudBoton>
          </div>
        </template>
        <p
          v-else
          class="aviso"
        >
          Aún no hay una política de publicidad vigente. Vuelva más tarde.
        </p>
        <p
          v-if="autorizar.error.value"
          class="error"
          role="alert"
        >
          {{ autorizar.error.value }}
        </p>
      </div>
    </HudPanel>
    <template v-else>
      <HudEstado
        v-if="lista.length === 0"
        estado="vacio"
        mensaje="Por ahora no hay ofertas para su sector."
      />
      <ul
        v-else
        class="piezas"
      >
        <li
          v-for="p in lista"
          :key="p.creativo_id"
        >
          <PiezaOferta
            :pieza="p"
            :zona="entidad.zonaHoraria"
            :cupon="cupones[p.creativo_id] ?? null"
            :pidiendo-cupon="pidiendo === p.creativo_id"
            @cupon="pedirCupon(p)"
            @clic="eventos.clic(p.creativo_id)"
            @reportar="abrirReporte(p)"
          />
        </li>
      </ul>
      <p
        v-if="cupon.error.value"
        class="error"
        role="alert"
      >
        {{ cupon.error.value }}
      </p>
      <div>
        <HudBoton
          variante="secundario"
          :cargando="retirar.cargando.value"
          @click="retirar.ejecutar()"
        >
          Dejar de recibir ofertas
        </HudBoton>
      </div>
      <p
        v-if="retirar.error.value"
        class="error"
        role="alert"
      >
        {{ retirar.error.value }}
      </p>
    </template>

    <ConfirmarConMotivo
      v-model:abierto="dialogoReporte"
      titulo="Reportar anuncio"
      accion="Reportar"
      descripcion="La moderación de la plataforma lo revisará. Diga qué tiene de engañoso u ofensivo."
      :cargando="reportar.cargando.value"
      :error="reportar.error.value"
      @confirmar="confirmarReporte"
    />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.politica {
  max-height: 220px;
  margin: 0;
  padding: 10px 14px;
  overflow: auto;
  border: 1px solid var(--linea);
  white-space: pre-wrap;
}

.piezas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.piezas > li {
  display: grid;
}
</style>

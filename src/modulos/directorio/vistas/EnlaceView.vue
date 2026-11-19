<script setup lang="ts">
/**
 * Enlace público del directorio para los grupos de WhatsApp de la PH. El backend entrega el
 * token (el mismo mientras no se regenere ni se revoque) y aquí se arma el enlace (acuerdo A1).
 * Generar otro o revocar deja sin servicio el enlace ya publicado: se confirma antes.
 */
import { computed, onMounted, ref } from 'vue'
import { enlacePublico } from '@/api/enlaces'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { EstadoEnlaceDirectorio } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { enlaceSeguro } from '@/formato/directorio'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import { useEntidad } from '@/stores/entidad'
import IWhatsapp from '~icons/tabler/brand-whatsapp'
import { estadoEnlace, generarEnlace, revocarEnlace } from '../api'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')

const enlace = ref<EstadoEnlaceDirectorio | null>(null)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const confirmando = ref<'generar' | 'revocar' | null>(null)
const resultado = ref<string | null>(null)

const url = computed(() => (enlace.value?.activo && enlace.value.token ? enlacePublico('directorio', id.value, enlace.value.token) : null))
const chatPh = computed(() => enlaceSeguro(enlace.value?.whatsapp_url))
const compartir = computed(() =>
  url.value ? `https://wa.me/?text=${encodeURIComponent(`Directorio de comercios y servicios del conjunto: ${url.value}`)}` : null,
)
const dialogo = computed({
  get: () => confirmando.value !== null,
  set: (v) => {
    if (!v) confirmando.value = null
  },
})

const generar = useAccion((clave) => generarEnlace(id.value, clave), {
  alExito: (r) => {
    enlace.value = { activo: true, token: r.token, creado_en: r.creado_en, whatsapp_url: r.whatsapp_url }
    confirmando.value = null
    resultado.value = 'Enlace generado. Cópielo y publíquelo en los grupos.'
  },
})
const revocar = useAccion(() => revocarEnlace(id.value), {
  alExito: () => {
    enlace.value = { activo: false, token: null, creado_en: null, whatsapp_url: null }
    confirmando.value = null
    resultado.value = 'Enlace revocado: el publicado en los grupos ya no funciona.'
  },
})
const accion = computed(() => (confirmando.value === 'revocar' ? revocar : generar))

async function cargar() {
  estado.value = 'cargando'
  try {
    enlace.value = await estadoEnlace(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

function pedir(que: 'generar' | 'revocar') {
  resultado.value = null
  generar.reiniciar()
  revocar.reiniciar()
  // Sin enlace vigente no hay nada que dejar de funcionar: se genera de una vez.
  if (que === 'generar' && !enlace.value?.activo) void generar.ejecutar()
  else confirmando.value = que
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-enlace">
    <header>
      <h1 id="titulo-enlace">
        Enlace para los grupos
      </h1>
      <p class="texto-2">
        Fíjelo en los grupos de WhatsApp del conjunto: abre el directorio sin iniciar sesión (sin reseñas, solo el
        promedio).
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
      v-else
      etiqueta="Enlace vigente"
    >
      <div class="campos">
        <template v-if="url">
          <SecretoUnaVez
            :valor="url"
            etiqueta="Enlace del directorio"
            aviso="Quien tenga este enlace verá el directorio. Si se publicó donde no debía, genere otro."
          />
          <p
            v-if="enlace?.creado_en"
            class="texto-2"
          >
            Generado el {{ fechaHora(enlace.creado_en, entidad.zonaHoraria) }}.
          </p>
          <div class="botones">
            <a
              v-if="compartir"
              class="whatsapp"
              :href="compartir"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IWhatsapp aria-hidden="true" /> Compartir por WhatsApp<span class="solo-lector"> (se abre en otra pestaña)</span>
            </a>
          </div>
          <p
            v-if="chatPh"
            class="texto-2"
          >
            En la página, «Busco …» abre el chat de la administración:
            <a
              :href="chatPh"
              target="_blank"
              rel="noopener noreferrer"
            >probar el chat<span class="solo-lector"> (se abre en otra pestaña)</span></a>.
          </p>
        </template>
        <p
          v-else-if="enlace?.activo"
          class="aviso"
        >
          El enlace vigente es anterior a esta versión y no se puede mostrar. Genere otro para copiarlo; el anterior
          dejará de funcionar.
        </p>
        <p
          v-else
          class="texto-2"
        >
          Aún no hay enlace. Genérelo para compartir el directorio en los grupos.
        </p>
        <div class="botones">
          <HudBoton
            :variante="enlace?.activo ? 'secundario' : 'primario'"
            :cargando="generar.cargando.value && !confirmando"
            @click="pedir('generar')"
          >
            {{ enlace?.activo ? 'Generar otro' : 'Generar enlace' }}
          </HudBoton>
          <HudBoton
            v-if="enlace?.activo"
            variante="fantasma"
            @click="pedir('revocar')"
          >
            Revocar
          </HudBoton>
        </div>
        <p
          v-if="!confirmando && generar.error.value"
          class="error"
          role="alert"
        >
          {{ generar.error.value }}
        </p>
      </div>
    </HudPanel>

    <HudDialogo
      v-model:abierto="dialogo"
      :titulo="confirmando === 'revocar' ? '¿Revocar el enlace?' : '¿Generar otro enlace?'"
    >
      <p class="aviso">
        El enlace publicado en los grupos de WhatsApp <strong>dejará de funcionar</strong>.
        {{ confirmando === 'revocar' ? 'Nadie podrá abrir el directorio con él.' : 'Tendrá que publicar el nuevo.' }}
      </p>
      <p
        v-if="accion.error.value"
        class="error"
        role="alert"
      >
        {{ accion.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmando = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="accion.cargando.value"
          @click="accion.ejecutar()"
        >
          {{ confirmando === 'revocar' ? 'Revocar enlace' : 'Generar otro' }}
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.whatsapp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--linea-fuerte);
  color: var(--cian);
  text-decoration: none;
}

.whatsapp:hover,
.whatsapp:focus-visible {
  background: var(--cian-tenue);
}

a:not(.whatsapp) {
  color: var(--cian);
}
</style>

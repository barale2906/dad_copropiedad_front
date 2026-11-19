<script setup lang="ts">
/**
 * «Busco …» (solo PH): la persona escribe su necesidad, ve hasta 3 proveedores sugeridos y, solo
 * si marca un consentimiento **visible y específico**, se comparten su nombre y su celular del
 * censo con esos proveedores y para esta solicitud (Ley 1581).
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { BusquedaDirectorio, ContactoAutorizado } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import TarjetaAnunciante from '@/hud/componentes/TarjetaAnunciante.vue'
import { useEntidad } from '@/stores/entidad'
import { autorizarContacto, buscarProveedores } from '../api'
import { useCategoriasDirectorio } from '../store'

const route = useRoute()
const entidad = useEntidad()
const categorias = useCategoriasDirectorio()
const id = computed(() => entidad.activa?.entidad_id ?? '')

const texto = ref('')
const intentado = ref(false)
const busqueda = ref<BusquedaDirectorio | null>(null)
const acepto = ref(false)
const contacto = ref<ContactoAutorizado | null>(null)

const errorTexto = computed(() => {
  if (!intentado.value) return null
  const t = texto.value.trim()
  if (t.length < 3) return 'Escriba qué necesita (por ejemplo, «costurera»).'
  return t.length > 100 ? 'Use máximo 100 caracteres.' : null
})
const nombres = computed(() => busqueda.value?.sugerencias.map((s) => s.nombre_comercial).join(', ') ?? '')
const rutaFicha = (anunciante: string) => ({ name: 'modulo', params: { ...route.params, accion: 'inicio', id: anunciante }, query: {} })

const buscar = useAccion((clave) => buscarProveedores(id.value, texto.value, clave), {
  alExito: (r) => {
    busqueda.value = r
    acepto.value = false
    contacto.value = null
  },
})
const autorizar = useAccion((clave, solicitudId: string) => autorizarContacto(id.value, solicitudId, clave), {
  alExito: (r) => (contacto.value = r),
})

function enviar() {
  intentado.value = true
  if (errorTexto.value) return
  buscar.reiniciar()
  void buscar.ejecutar()
}

onMounted(() => void categorias.asegurar(id.value).catch(() => undefined))
</script>

<template>
  <section aria-labelledby="titulo-busco">
    <header>
      <h1 id="titulo-busco">
        Busco…
      </h1>
      <p class="texto-2">
        Cuéntenos qué necesita y le sugerimos proveedores del directorio. Buscar no comparte ningún dato suyo.
      </p>
    </header>

    <form
      class="busqueda"
      novalidate
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="texto"
        etiqueta="¿Qué busca?"
        autocompletar="off"
        :maximo="100"
        :error="errorTexto"
        ayuda="Por ejemplo: costurera, técnico de lavadoras, cerrajero."
      />
      <div>
        <HudBoton
          tipo="submit"
          :cargando="buscar.cargando.value"
        >
          Buscar proveedores
        </HudBoton>
      </div>
    </form>
    <p
      v-if="buscar.error.value"
      class="error"
      role="alert"
    >
      {{ buscar.error.value }}
    </p>

    <section
      v-if="busqueda"
      aria-labelledby="titulo-sugerencias"
    >
      <h2 id="titulo-sugerencias">
        {{ busqueda.categoria ? `Sugerencias en ${busqueda.categoria.nombre}` : 'Sugerencias' }}
      </h2>
      <p
        v-if="busqueda.sugerencias.length === 0"
        class="aviso"
        role="status"
      >
        No encontramos proveedores para esa necesidad en su sector. Pruebe con otras palabras o revise el directorio.
      </p>
      <template v-else>
        <ul class="tarjetas">
          <li
            v-for="f in busqueda.sugerencias"
            :key="f.anunciante_id"
          >
            <TarjetaAnunciante
              :ficha="f"
              :categoria="categorias.nombre(f.categorias)"
              :a="rutaFicha(f.anunciante_id)"
            />
          </li>
        </ul>

        <HudPanel
          v-if="contacto"
          etiqueta="Contacto autorizado"
          resaltado
        >
          <p
            class="ok"
            role="status"
          >
            Listo: {{ contacto.proveedores.join(', ') }} recibirán su nombre y su celular por WhatsApp para atender esta
            solicitud.
            <template v-if="contacto.seguimiento">
              En 7 días le preguntaremos por WhatsApp si le sirvió.
            </template>
          </p>
        </HudPanel>
        <HudPanel
          v-else-if="busqueda.contactables"
          etiqueta="¿Quiere que lo contacten?"
        >
          <div class="campos">
            <p>
              Si prefiere, los proveedores sugeridos le escriben a usted. Para eso compartiremos
              <strong>solo su nombre y su celular registrado en el censo</strong>, <strong>solo con {{ nombres }}</strong> y
              <strong>solo para esta solicitud</strong>.
            </p>
            <label class="casilla">
              <input
                v-model="acepto"
                type="checkbox"
              >
              Sí, autorizo que {{ nombres }} me contacten por WhatsApp para esta solicitud.
            </label>
            <div>
              <HudBoton
                :deshabilitado="!acepto"
                :cargando="autorizar.cargando.value"
                @click="autorizar.ejecutar(busqueda.solicitud_id)"
              >
                Autorizar el contacto
              </HudBoton>
            </div>
            <p
              v-if="autorizar.error.value"
              class="error"
              role="alert"
            >
              {{ autorizar.error.value }}
            </p>
          </div>
        </HudPanel>
        <p
          v-else
          class="texto-2"
        >
          Estos proveedores no reciben solicitudes por WhatsApp: escríbales o llámelos directamente.
        </p>
      </template>
    </section>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.busqueda {
  display: grid;
  gap: 12px;
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

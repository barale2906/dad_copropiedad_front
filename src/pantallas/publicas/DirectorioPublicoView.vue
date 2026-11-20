<script setup lang="ts">
/**
 * Directorio público de la PH para los grupos de WhatsApp (`X-Enlace-Directorio`): buscar y
 * contactar comercios, sin reseñar ni «Busco …» (solo el promedio de las reseñas). El chat de la
 * administración recibe las necesidades que no estén en la lista.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { tomarCredencial } from '@/api/credencial-externa'
import { directorioPublico, enlaceNoValido } from '@/api/publico'
import { useListado } from '@/composables/useListado'
import { enlaceSeguro } from '@/formato/directorio'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import TarjetaAnunciante from '@/hud/componentes/TarjetaAnunciante.vue'
import IWhatsapp from '~icons/tabler/brand-whatsapp'
import EnlaceNoValido from './EnlaceNoValido.vue'
import MarcoPublico from './MarcoPublico.vue'

const route = useRoute()
const id = String(route.params.copropiedadId ?? '')
const conjunto = ref<string | null>(null)
const chat = ref<string | null>(null)
const sinEnlace = ref(false)
const invalido = ref(false)
const filtros = ref({ q: '' })

const lista = useListado(
  async (despues, f: { q: string }) => {
    try {
      const r = await directorioPublico(id, despues, f.q)
      conjunto.value = r.copropiedad
      chat.value = enlaceSeguro(r.whatsapp_url)
      return r.fichas
    } catch (e) {
      invalido.value = enlaceNoValido(e)
      throw e
    }
  },
  { filtros, inmediato: false },
)
const noValido = computed(() => sinEnlace.value || invalido.value)

onMounted(() => {
  if (!tomarCredencial('directorio')) sinEnlace.value = true
  else void lista.recargar()
})
</script>

<template>
  <MarcoPublico
    :titulo="conjunto ? `Directorio de ${conjunto}` : 'Directorio del conjunto'"
    subtitulo="Comercios y servicios que atienden el sector."
    ancho="amplio"
  >
    <EnlaceNoValido
      v-if="noValido"
      quien="en el grupo de WhatsApp del conjunto o a la administración"
    />
    <template v-else>
      <div class="buscar">
        <HudCampo
          v-model="filtros.q"
          etiqueta="¿Qué necesita?"
          tipo="search"
          autocompletar="off"
          ayuda="Por ejemplo: modista, plomero, lavadoras."
        />
      </div>
      <a
        v-if="chat"
        :href="chat"
        target="_blank"
        rel="noopener noreferrer"
        class="chat"
      >
        <IWhatsapp aria-hidden="true" /> ¿No lo encuentra? Escriba «Busco …» a la administración<span class="solo-lector"> (se abre WhatsApp)</span>
      </a>
      <HudEstado
        v-if="lista.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="lista.estado.value === 'error'"
        estado="error"
        :mensaje="lista.error.value ?? undefined"
        @reintentar="lista.recargar()"
      />
      <HudEstado
        v-else-if="lista.estado.value === 'vacio'"
        estado="vacio"
        :mensaje="filtros.q ? 'Ningún comercio coincide. Pruebe con otra palabra.' : 'Aún no hay comercios en el directorio.'"
      />
      <template v-else>
        <ul class="tarjetas">
          <li
            v-for="f in lista.filas.value"
            :key="f.anunciante_id"
          >
            <TarjetaAnunciante
              :ficha="f"
              :nivel="2"
            />
          </li>
        </ul>
        <HudCargarMas
          :hay-mas="lista.hayMas.value"
          :cargando="lista.cargando.value"
          @cargar="lista.cargarMas()"
        />
      </template>
    </template>
  </MarcoPublico>
</template>

<style scoped>
.buscar {
  max-width: 560px;
}

.chat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--cian);
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

<script setup lang="ts">
/** Minuta del turno: novedades que solo se agregan (nunca se editan), con foto opcional. */
import { computed, ref } from 'vue'
import type { TipoNovedadMinuta } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fechaHora } from '@/formato/fechas'
import CapturaFoto from '@/hud/componentes/CapturaFoto.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { minuta, registrarNovedad } from '../api'
import { TIPO_NOVEDAD } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const puedeRegistrar = computed(() => entidad.tienePermiso('acceso.minuta.registrar'))

const tipo = ref<TipoNovedadMinuta>('novedad')
const texto = ref('')
const foto = ref('')
const intentado = ref(false)
const resultado = ref<string | null>(null)
const faltaTexto = computed(() => (intentado.value && !texto.value.trim() ? 'Escriba la novedad.' : null))

const filtroTipo = ref<TipoNovedadMinuta | ''>('')
const filtros = computed(() => ({ tipo: filtroTipo.value || undefined }))
const listado = useListado((despues, f: { tipo?: TipoNovedadMinuta }) => minuta(id.value, despues, f), { filtros, retardo: 0 })

const registrar = useAccion((clave) => registrarNovedad(id.value, tipo.value, texto.value.trim(), foto.value ? [foto.value] : [], clave))

async function enviar() {
  intentado.value = true
  resultado.value = null
  if (!texto.value.trim()) return
  const r = await registrar.ejecutar()
  if (!r.ok) return
  texto.value = foto.value = ''
  intentado.value = false
  resultado.value = `${TIPO_NOVEDAD[r.valor.tipo]} registrada en la minuta.`
  await listado.recargar()
}
</script>

<template>
  <section aria-labelledby="titulo-minuta">
    <h1 id="titulo-minuta">
      Minuta
    </h1>

    <HudPanel
      v-if="puedeRegistrar"
      etiqueta="Nueva novedad"
    >
      <form
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesDe(TIPO_NOVEDAD)"
        />
        <HudCampo
          v-model="texto"
          etiqueta="Qué pasó"
          multilinea
          :error="faltaTexto"
          ayuda="La minuta no se puede editar: revise antes de guardar."
        />
        <CapturaFoto
          v-model="foto"
          etiqueta="Foto (opcional)"
        />
        <p
          v-if="registrar.error.value"
          class="error"
          role="alert"
        >
          {{ registrar.error.value }}
        </p>
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="registrar.cargando.value"
          >
            Agregar a la minuta
          </HudBoton>
        </div>
      </form>
    </HudPanel>

    <header class="encabezado">
      <h2>Novedades</h2>
      <HudSelector
        v-model="filtroTipo"
        etiqueta="Filtrar por tipo"
        vacio="Todas"
        :opciones="opcionesDe(TIPO_NOVEDAD)"
      />
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
      mensaje="Aún no hay novedades."
    />
    <template v-else>
      <ul
        class="lista"
        aria-label="Novedades de la minuta"
      >
        <li
          v-for="n in listado.filas.value"
          :key="n.id"
          :class="{ urgente: n.tipo === 'incidente' }"
        >
          <HudInsignia :tono="n.tipo === 'incidente' ? 'peligro' : 'neutro'">
            {{ TIPO_NOVEDAD[n.tipo] }}
          </HudInsignia>
          <span class="crece">
            <span class="texto">{{ n.texto }}</span>
            <small>{{ fechaHora(n.ocurrida_en, zona) }}{{ n.adjuntos.length ? ` · ${n.adjuntos.length} foto(s)` : '' }}</small>
          </span>
        </li>
      </ul>
      <HudCargarMas
        :hay-mas="listado.hayMas.value"
        :cargando="listado.cargando.value"
        @cargar="listado.cargarMas()"
      />
    </template>
  </section>
</template>

<style scoped src="./porteria.css"></style>
<style scoped>
h2 {
  margin: 0;
  font-size: 20px;
}

.texto {
  white-space: pre-line;
}
</style>

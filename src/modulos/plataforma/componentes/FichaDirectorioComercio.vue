<script setup lang="ts">
/**
 * La ficha del comercio en el directorio: descripción, de 1 a 5 categorías (la primera es la
 * principal; nunca una restringida), cobertura, contacto, horario, destacada y publicada.
 */
import { computed, ref, watch } from 'vue'
import type { CategoriaDirectorio, FichaAnunciante, NuevaFichaAnunciante, TipoCobertura } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aLocal, aUtc } from '@/formato/fechas'
import { enlaceSeguro } from '@/formato/directorio'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { guardarFicha } from '../api-publicidad'
import { COBERTURA } from '../reglas'

const props = defineProps<{ comercioId: string; ficha: FichaAnunciante | null; categorias: CategoriaDirectorio[] }>()
const emit = defineEmits<{ guardada: [ficha: FichaAnunciante] }>()

const entidad = useEntidad()
const vacia = () => ({
  descripcion: '', categorias: [] as string[], cobertura: 'municipio' as TipoCobertura, radio: '', telefono: '', whatsapp: '', correo: '',
  sitio: '', horario: '', destacada: '', publicada: true,
})
const f = ref(vacia())
const intentado = ref(false)
const ok = ref(false)

const elegibles = computed(() => props.categorias.filter((c) => c.activa && !c.restringida && c.padre))
const COBERTURAS = (Object.keys(COBERTURA) as TipoCobertura[]).map((c) => ({ valor: c, etiqueta: COBERTURA[c] }))
const errores = computed(() => {
  if (!intentado.value) return {}
  const e: Record<string, string> = {}
  if (f.value.categorias.length < 1 || f.value.categorias.length > 5) e.categorias = 'Elija de 1 a 5 categorías.'
  if (f.value.cobertura === 'radio' && !/^(\d|[1-9]\d|100)$/.test(f.value.radio)) e.radio = 'Escriba un radio de 1 a 100 km.'
  if (f.value.sitio && !(enlaceSeguro(f.value.sitio)?.startsWith('https://'))) e.sitio = 'El sitio debe empezar por https://.'
  if (f.value.descripcion.length > 1000) e.descripcion = 'Use máximo 1000 caracteres.'
  return e
})

const guardar = useAccion(() => {
  const v = f.value
  const datos: NuevaFichaAnunciante = {
    descripcion: v.descripcion.trim() || null,
    categorias: v.categorias,
    cobertura: v.cobertura,
    radio_km: v.cobertura === 'radio' ? Number.parseInt(v.radio, 10) : null,
    telefono: v.telefono.trim() || null,
    whatsapp: v.whatsapp.trim() || null,
    correo: v.correo.trim() || null,
    sitio_web: v.sitio.trim() || null,
    horario: v.horario.trim() || null,
    destacada_hasta: v.destacada ? aUtc(v.destacada, entidad.zonaHoraria) : null,
    publicada: v.publicada,
  }
  return guardarFicha(props.comercioId, datos)
})

watch(
  () => props.ficha,
  (x) => {
    f.value = x
      ? {
          descripcion: x.descripcion ?? '', categorias: [...x.categorias], cobertura: x.cobertura as TipoCobertura, radio: x.radio_km ? String(x.radio_km) : '',
          telefono: x.contacto.telefono ?? '', whatsapp: x.contacto.whatsapp ?? '', correo: x.contacto.correo ?? '', sitio: x.contacto.sitio_web ?? '',
          horario: x.horario ?? '', destacada: x.destacada_hasta ? aLocal(x.destacada_hasta, entidad.zonaHoraria) : '', publicada: x.publicada,
        }
      : vacia()
  },
  { immediate: true },
)

/** Marca o desmarca; la primera marcada queda como principal. */
function alternar(codigo: string) {
  const c = f.value.categorias
  f.value.categorias = c.includes(codigo) ? c.filter((x) => x !== codigo) : [...c, codigo]
}

async function enviar() {
  intentado.value = true
  ok.value = false
  if (Object.keys(errores.value).length) return
  const r = await guardar.ejecutar()
  if (!r.ok) return
  ok.value = true
  emit('guardada', r.valor)
}
</script>

<template>
  <form
    class="campos"
    novalidate
    @submit.prevent="enviar"
  >
    <HudCampo
      v-model="f.descripcion"
      etiqueta="Descripción"
      multilinea
      :maximo="1000"
      :error="errores.descripcion"
    />
    <fieldset class="categorias">
      <legend>Categorías (la primera es la principal)</legend>
      <label
        v-for="c in elegibles"
        :key="c.codigo"
        class="casilla"
      >
        <input
          type="checkbox"
          :checked="f.categorias.includes(c.codigo)"
          :disabled="!f.categorias.includes(c.codigo) && f.categorias.length >= 5"
          @change="alternar(c.codigo)"
        >
        {{ c.nombre }}<small v-if="f.categorias[0] === c.codigo"> · principal</small>
      </label>
      <p
        v-if="errores.categorias"
        class="error"
      >
        {{ errores.categorias }}
      </p>
    </fieldset>
    <div class="filtros">
      <HudSelector
        v-model="f.cobertura"
        etiqueta="Cobertura"
        :opciones="COBERTURAS"
      />
      <HudCampo
        v-if="f.cobertura === 'radio'"
        v-model="f.radio"
        etiqueta="Radio (km)"
        modo-entrada="numeric"
        :error="errores.radio"
      />
      <HudCampo
        v-model="f.telefono"
        etiqueta="Teléfono"
        tipo="tel"
      />
      <HudCampo
        v-model="f.whatsapp"
        etiqueta="WhatsApp"
        tipo="tel"
      />
      <HudCampo
        v-model="f.correo"
        etiqueta="Correo"
        tipo="email"
      />
      <HudCampo
        v-model="f.sitio"
        etiqueta="Sitio web"
        tipo="url"
        :error="errores.sitio"
      />
      <HudCampo
        v-model="f.horario"
        etiqueta="Horario"
      />
      <HudFecha
        v-model="f.destacada"
        etiqueta="Destacada hasta (opcional)"
        con-hora
      />
    </div>
    <label class="casilla">
      <input
        v-model="f.publicada"
        type="checkbox"
      >
      Publicada en el directorio
    </label>
    <div>
      <HudBoton
        tipo="submit"
        :cargando="guardar.cargando.value"
      >
        Guardar ficha
      </HudBoton>
    </div>
    <p
      v-if="ok"
      class="ok"
      role="status"
    >
      Ficha guardada.
    </p>
    <p
      v-if="guardar.error.value"
      class="error"
      role="alert"
    >
      {{ guardar.error.value }}
    </p>
  </form>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.categorias {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 0 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 4px;
  color: var(--texto-2);
}
</style>

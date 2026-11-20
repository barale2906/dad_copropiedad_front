<script setup lang="ts">
/**
 * Alta o edición de un comercio (datos y ubicación). En el alta se crea también su organización
 * (NIT, razón social, naturaleza): no hay portal del anunciante, lo carga el personal. Solo
 * presenta y emite; el padre llama a la API.
 */
import { computed, ref, watch } from 'vue'
import type { Anunciante, DatosAnunciante, NaturalezaOrganizacion, NuevoAnunciante } from '@/api/tipos'
import { NATURALEZA } from '@/formato/organizaciones'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'

const props = withDefaults(defineProps<{ comercio?: Anunciante | null; cargando?: boolean; error?: string | null }>(), {
  comercio: null,
  cargando: false,
  error: null,
})
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ crear: [datos: NuevoAnunciante]; editar: [datos: DatosAnunciante] }>()

const f = ref({ nombre: '', direccion: '', municipio: '', latitud: '', longitud: '', nit: '', razon: '', naturaleza: 'juridica' as NaturalezaOrganizacion })
const intentado = ref(false)
const NATURALEZAS = (Object.keys(NATURALEZA) as NaturalezaOrganizacion[]).map((n) => ({ valor: n, etiqueta: NATURALEZA[n] }))

const errores = computed(() => {
  if (!intentado.value) return {}
  const e: Record<string, string> = {}
  if (f.value.nombre.trim().length < 2) e.nombre = 'Escriba el nombre comercial.'
  if (f.value.municipio && !/^\d{5}$/.test(f.value.municipio)) e.municipio = 'El código DANE tiene 5 dígitos.'
  for (const k of ['latitud', 'longitud'] as const) if (f.value[k] && !/^-?\d{1,3}(\.\d+)?$/.test(f.value[k])) e[k] = 'Use grados decimales, por ejemplo 4.6097.'
  if (!props.comercio) {
    if (!/^\d{6,10}(-?\d)?$/.test(f.value.nit.replace(/\./g, ''))) e.nit = 'Escriba el NIT solo con números.'
    if (f.value.razon.trim().length < 3) e.razon = 'Escriba la razón social.'
  }
  return e
})

watch(abierto, (si) => {
  if (!si) return
  const c = props.comercio
  f.value = {
    nombre: c?.nombre_comercial ?? '',
    direccion: c?.direccion ?? '',
    municipio: c?.municipio_dane ?? '',
    latitud: c?.latitud ?? '',
    longitud: c?.longitud ?? '',
    nit: '',
    razon: '',
    naturaleza: 'juridica',
  }
  intentado.value = false
})

function enviar() {
  intentado.value = true
  if (Object.keys(errores.value).length) return
  const datos: DatosAnunciante = {
    nombre_comercial: f.value.nombre.trim(),
    direccion: f.value.direccion.trim() || null,
    municipio_dane: f.value.municipio || null,
    latitud: f.value.latitud || null,
    longitud: f.value.longitud || null,
  }
  if (props.comercio) emit('editar', datos)
  else
    emit('crear', {
      ...datos,
      organizacion: { nit: f.value.nit.replace(/\./g, ''), razon_social: f.value.razon.trim(), naturaleza: f.value.naturaleza, tipos: ['anunciante'] },
    })
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    :titulo="comercio ? `Editar ${comercio.nombre_comercial}` : 'Nuevo comercio'"
  >
    <form
      id="formulario-comercio"
      class="campos"
      novalidate
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="f.nombre"
        etiqueta="Nombre comercial"
        :error="errores.nombre"
      />
      <HudCampo
        v-model="f.direccion"
        etiqueta="Dirección (opcional)"
      />
      <HudCampo
        v-model="f.municipio"
        etiqueta="Municipio (código DANE)"
        modo-entrada="numeric"
        :maximo="5"
        :error="errores.municipio"
        ayuda="Sin municipio solo tiene cobertura nacional."
      />
      <div class="filtros">
        <HudCampo
          v-model="f.latitud"
          etiqueta="Latitud (opcional)"
          modo-entrada="decimal"
          :error="errores.latitud"
        />
        <HudCampo
          v-model="f.longitud"
          etiqueta="Longitud (opcional)"
          modo-entrada="decimal"
          :error="errores.longitud"
        />
      </div>
      <template v-if="!comercio">
        <h3>Organización del comercio</h3>
        <HudCampo
          v-model="f.nit"
          etiqueta="NIT"
          modo-entrada="numeric"
          :error="errores.nit"
        />
        <HudCampo
          v-model="f.razon"
          etiqueta="Razón social"
          :error="errores.razon"
        />
        <HudSelector
          v-model="f.naturaleza"
          etiqueta="Naturaleza"
          :opciones="NATURALEZAS"
        />
      </template>
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
    </form>
    <template #acciones>
      <HudBoton
        variante="fantasma"
        @click="abierto = false"
      >
        Cancelar
      </HudBoton>
      <HudBoton
        tipo="submit"
        form="formulario-comercio"
        :cargando="cargando"
      >
        {{ comercio ? 'Guardar' : 'Crear comercio' }}
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
h3 {
  margin: 6px 0 0;
  font-size: 17px;
}
</style>

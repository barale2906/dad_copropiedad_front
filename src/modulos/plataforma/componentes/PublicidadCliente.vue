<script setup lang="ts">
/**
 * La publicidad de un cliente: excluirlo (no recibe piezas ni destacadas; su directorio sigue)
 * o volverlo a incluir y, en una PH, el token de la pantalla del lobby (estable: se vuelve a
 * consultar; generar otro deja sin servicio la pantalla instalada).
 */
import { computed, onMounted, ref } from 'vue'
import { enlacePublico } from '@/api/enlaces'
import { mensajeDeError } from '@/api/errores'
import type { EntidadPlataforma, ExclusionPublicidad } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fecha } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import { useEntidad } from '@/stores/entidad'
import { excluir, exclusiones, generarPantalla, incluir, tokenPantalla } from '../api-publicidad'

const props = defineProps<{ cliente: EntidadPlataforma; puedeExcluir: boolean; puedePantalla: boolean }>()

const entidad = useEntidad()
const exclusion = ref<ExclusionPublicidad | null>(null)
const token = ref<string | null>(null)
const error = ref<string | null>(null)
const pidiendoExclusion = ref(false)
const confirmandoPantalla = ref(false)
const resultado = ref<string | null>(null)

const esPH = computed(() => props.cliente.tipo === 'propiedad_horizontal')
const enlacePantalla = computed(() => (token.value ? enlacePublico('pantalla', props.cliente.id, token.value) : null))

const accionExcluir = useAccion((_clave, motivo: string) => excluir(props.cliente.id, motivo), {
  alExito: (x) => {
    exclusion.value = x
    pidiendoExclusion.value = false
    resultado.value = 'Excluida de la publicidad: su directorio sigue funcionando.'
  },
})
const accionIncluir = useAccion(() => incluir(props.cliente.id), {
  alExito: () => {
    exclusion.value = null
    resultado.value = 'Volvió a recibir publicidad.'
  },
})
const pantalla = useAccion((clave) => generarPantalla(props.cliente.id, clave), {
  alExito: (t) => {
    token.value = t
    confirmandoPantalla.value = false
    resultado.value = 'Token de la pantalla generado.'
  },
})

function pedirExclusion() {
  accionExcluir.reiniciar()
  pidiendoExclusion.value = true
}

function pedirPantalla() {
  pantalla.reiniciar()
  if (token.value) confirmandoPantalla.value = true
  else void pantalla.ejecutar()
}

onMounted(async () => {
  try {
    const [lista, t] = await Promise.all([
      props.puedeExcluir ? exclusiones() : Promise.resolve([]),
      props.puedePantalla && esPH.value ? tokenPantalla(props.cliente.id) : Promise.resolve(null),
    ])
    exclusion.value = lista.find((x) => x.entidad_id === props.cliente.id) ?? null
    token.value = t
  } catch (e) {
    error.value = mensajeDeError(e)
  }
})
</script>

<template>
  <div class="campos">
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="puedeExcluir">
      <p
        v-if="exclusion"
        class="aviso"
      >
        Excluida de la publicidad desde el {{ fecha(exclusion.creada_en, entidad.zonaHoraria) }}: {{ exclusion.motivo }}
      </p>
      <p
        v-else
        class="texto-2"
      >
        Recibe piezas y destacadas según las campañas. Excluirla no apaga su directorio.
      </p>
      <div>
        <HudBoton
          v-if="exclusion"
          variante="secundario"
          :cargando="accionIncluir.cargando.value"
          @click="accionIncluir.ejecutar()"
        >
          Volver a incluir en la publicidad
        </HudBoton>
        <HudBoton
          v-else
          variante="secundario"
          @click="pedirExclusion"
        >
          Excluir de la publicidad
        </HudBoton>
      </div>
      <p
        v-if="accionIncluir.error.value"
        class="error"
        role="alert"
      >
        {{ accionIncluir.error.value }}
      </p>
    </template>

    <template v-if="puedePantalla && esPH">
      <h3>Pantalla del lobby</h3>
      <SecretoUnaVez
        v-if="enlacePantalla"
        :valor="enlacePantalla"
        etiqueta="Enlace de la pantalla"
        aviso="Ábralo en el televisor del lobby. Quien lo tenga ve la pantalla: no lo comparta."
      />
      <p
        v-else
        class="texto-2"
      >
        La pantalla aún no tiene token.
      </p>
      <div>
        <HudBoton
          variante="secundario"
          :cargando="pantalla.cargando.value && !confirmandoPantalla"
          @click="pedirPantalla"
        >
          {{ token ? 'Generar otro token' : 'Generar token de la pantalla' }}
        </HudBoton>
      </div>
      <p
        v-if="pantalla.error.value && !confirmandoPantalla"
        class="error"
        role="alert"
      >
        {{ pantalla.error.value }}
      </p>
    </template>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <ConfirmarConMotivo
      v-model:abierto="pidiendoExclusion"
      titulo="Excluir de la publicidad"
      accion="Excluir"
      :descripcion="`${cliente.nombre} dejará de recibir piezas y destacadas. Escriba el motivo.`"
      :cargando="accionExcluir.cargando.value"
      :error="accionExcluir.error.value"
      @confirmar="accionExcluir.ejecutar"
    />
    <HudDialogo
      v-model:abierto="confirmandoPantalla"
      titulo="¿Generar otro token?"
    >
      <p class="aviso">
        La pantalla instalada <strong>dejará de funcionar</strong> hasta que abra el enlace nuevo en ella.
      </p>
      <p
        v-if="pantalla.error.value"
        class="error"
        role="alert"
      >
        {{ pantalla.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmandoPantalla = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="pantalla.cargando.value"
          @click="pantalla.ejecutar()"
        >
          Generar otro
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
h3 {
  margin: 8px 0 0;
  font-size: 17px;
}
</style>

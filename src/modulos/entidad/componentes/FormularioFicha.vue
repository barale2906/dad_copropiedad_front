<script setup lang="ts">
/**
 * Formulario de la ficha (solo presenta y emite los valores editados; el padre calcula los
 * cambios con `cambiosDeFicha` y llama a la API). En la PH agrega los datos legales.
 */
import { computed, ref, watch } from 'vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { type CampoFicha, FORMA_COPROPIEDAD, TIPO_COPROPIEDAD, validarFicha, type ValoresFicha } from '../ficha'

const props = withDefaults(
  defineProps<{ valores: ValoresFicha; propiedadHorizontal: boolean; cargando?: boolean; error?: string | null }>(),
  { cargando: false, error: null },
)
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ enviar: [valores: ValoresFicha] }>()

const v = ref<ValoresFicha>({ ...props.valores })
const intentado = ref(false)

const errores = computed(() => (intentado.value ? validarFicha(v.value, props.propiedadHorizontal) : {}))
const err = (c: CampoFicha) => errores.value[c] ?? null

const opcionesTipo = Object.entries(TIPO_COPROPIEDAD).map(([valor, etiqueta]) => ({ valor, etiqueta }))
const opcionesForma = Object.entries(FORMA_COPROPIEDAD).map(([valor, etiqueta]) => ({ valor, etiqueta }))

const GENERALES: { campo: CampoFicha; etiqueta: string; tipo?: string; ayuda?: string }[] = [
  { campo: 'razon_social', etiqueta: 'Razón social' },
  { campo: 'nit', etiqueta: 'NIT', ayuda: 'Con o sin dígito de verificación.' },
  { campo: 'direccion', etiqueta: 'Dirección' },
  { campo: 'barrio', etiqueta: 'Barrio' },
  { campo: 'departamento', etiqueta: 'Departamento' },
  { campo: 'municipio_dane', etiqueta: 'Código DANE del municipio', ayuda: 'Por ejemplo 11001 (Bogotá).' },
  { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
  { campo: 'correo', etiqueta: 'Correo', tipo: 'email' },
  { campo: 'sitio_web', etiqueta: 'Sitio web', tipo: 'url' },
]

watch(abierto, (si) => {
  if (!si) return
  v.value = { ...props.valores }
  intentado.value = false
})

function enviar() {
  intentado.value = true
  if (Object.keys(validarFicha(v.value, props.propiedadHorizontal)).length) return
  emit('enviar', { ...v.value })
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Editar la ficha"
  >
    <form
      id="formulario-ficha"
      class="campos"
      novalidate
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="v.nombre"
        etiqueta="Nombre"
        :error="err('nombre')"
        requerido
      />
      <HudCampo
        v-for="c in GENERALES"
        :key="c.campo"
        v-model="v[c.campo]"
        :etiqueta="c.etiqueta"
        :tipo="c.tipo"
        :ayuda="c.ayuda"
        :error="err(c.campo)"
        autocompletar="off"
      />
      <HudCampo
        v-model="v.zona_horaria"
        etiqueta="Zona horaria"
        :error="err('zona_horaria')"
        ayuda="En ella se muestran las fechas y se evalúan los horarios. Ej.: America/Bogota."
        requerido
      />

      <fieldset
        v-if="propiedadHorizontal"
        class="campos"
      >
        <legend>Datos de la propiedad horizontal</legend>
        <HudSelector
          v-model="v.tipo"
          etiqueta="Tipo"
          :opciones="opcionesTipo"
        />
        <HudSelector
          v-model="v.forma"
          etiqueta="Forma"
          :opciones="opcionesForma"
        />
        <HudCampo
          v-model="v.estrato"
          etiqueta="Estrato"
          modo-entrada="numeric"
          :error="err('estrato')"
        />
        <HudCampo
          v-model="v.escritura_numero"
          etiqueta="Número de la escritura"
        />
        <HudCampo
          v-model="v.notaria"
          etiqueta="Notaría"
        />
        <HudFecha
          v-model="v.escritura_fecha"
          etiqueta="Fecha de la escritura"
        />
        <HudCampo
          v-model="v.matricula_matriz"
          etiqueta="Matrícula inmobiliaria matriz"
        />
        <HudCampo
          v-model="v.plantilla_codigo"
          etiqueta="Plantilla del código de las unidades"
          :error="err('plantilla_codigo')"
          ayuda="Debe contener {numero}; admite {agrupacion} y {ruta}. Cambiarla no recalcula los códigos ya asignados."
        />
      </fieldset>

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
        form="formulario-ficha"
        :cargando="cargando"
      >
        Guardar
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped>
.campos {
  display: grid;
  gap: 14px;
}

fieldset {
  margin: 8px 0 0;
  padding: 14px 0 0;
  border: 0;
  border-top: 1px solid var(--linea);
}

legend {
  font-family: var(--fuente-display);
  font-size: 17px;
  font-weight: 600;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>

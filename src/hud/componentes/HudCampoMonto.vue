<script setup lang="ts">
/**
 * Campo para escribir un monto. Acepta «1.234,56», «1234.56» o «$ 1.000» y entrega en el
 * modelo el **texto decimal** que espera el backend (`"1234.56"`), o `''` si está vacío o no
 * es válido (en ese caso muestra el error). Al salir del campo lo muestra con formato.
 */
import { computed, ref, watch } from 'vue'
import { leerDecimal, moneda } from '@/formato/decimales'
import HudCampo from './HudCampo.vue'

const props = withDefaults(
  defineProps<{ etiqueta: string; ayuda?: string; requerido?: boolean; decimales?: number; error?: string | null; etiquetaOculta?: boolean }>(),
  { ayuda: undefined, requerido: false, decimales: 2, error: null, etiquetaOculta: false },
)
const valor = defineModel<string>({ required: true })

const texto = ref(valor.value ? moneda(valor.value, props.decimales) : '')
const invalido = computed(() => texto.value.trim() !== '' && leerDecimal(texto.value, props.decimales) === null)
const errorMostrado = computed(() =>
  invalido.value ? `Escriba un monto válido, con hasta ${props.decimales} decimales.` : props.error,
)

watch(texto, (t) => {
  valor.value = leerDecimal(t, props.decimales) ?? ''
})

watch(valor, (v) => {
  if (v !== (leerDecimal(texto.value, props.decimales) ?? '')) texto.value = v ? moneda(v, props.decimales) : ''
})

function darFormato() {
  if (valor.value) texto.value = moneda(valor.value, props.decimales)
}
</script>

<template>
  <HudCampo
    v-model="texto"
    :etiqueta="etiqueta"
    :etiqueta-oculta="etiquetaOculta"
    :ayuda="ayuda"
    :requerido="requerido"
    :error="errorMostrado"
    modo-entrada="decimal"
    autocompletar="off"
    :al-salir="darFormato"
  />
</template>

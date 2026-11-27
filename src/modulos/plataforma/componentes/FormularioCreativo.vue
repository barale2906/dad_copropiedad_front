<script setup lang="ts">
/**
 * Crear o editar una pieza: formato, título, texto, botón y enlace (`https`), condiciones
 * (obligatorias en promociones y cupones, Ley 1480), cupón (código y límite) o plantilla de
 * WhatsApp aprobada en Meta, e imagen (JPEG, PNG o WebP). Si cambia, vuelve a moderación.
 */
import { computed, ref, watch } from 'vue'
import type { Creativo, FormatoCreativo, NuevoCreativo } from '@/api/tipos'
import { FORMATO_PIEZA } from '@/composables/textos-publicidad'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorImagenPublicidad from './SelectorImagenPublicidad.vue'

const props = withDefaults(defineProps<{ creativo?: Creativo | null; cargando?: boolean; error?: string | null }>(), {
  creativo: null,
  cargando: false,
  error: null,
})
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ enviar: [datos: NuevoCreativo] }>()

const vacio = () => ({ formato: 'banner' as FormatoCreativo, titulo: '', texto: '', boton: '', enlace: '', condiciones: '', promocion: false, cupon: '', limite: '', plantilla: '', imagen: null as string | null })
const f = ref(vacio())
const intentado = ref(false)
const FORMATOS = (Object.keys(FORMATO_PIEZA) as FormatoCreativo[]).map((x) => ({ valor: x, etiqueta: FORMATO_PIEZA[x] }))
const esCupon = computed(() => f.value.formato === 'oferta_cupon')
const esWhatsapp = computed(() => f.value.formato === 'mensaje_whatsapp')

const errores = computed(() => {
  if (!intentado.value) return {}
  const e: Record<string, string> = {}
  if (!f.value.titulo.trim()) e.titulo = 'Escriba el título.'
  if (!f.value.texto.trim()) e.texto = 'Escriba el texto de la pieza.'
  if (f.value.enlace && !f.value.enlace.startsWith('https://')) e.enlace = 'El enlace debe empezar por https://.'
  if ((f.value.promocion || esCupon.value) && !f.value.condiciones.trim()) e.condiciones = 'Las promociones y los cupones exigen condiciones (Ley 1480).'
  if (esCupon.value && !/^[A-Za-z0-9]{4,20}$/.test(f.value.cupon)) e.cupon = 'El código tiene de 4 a 20 letras o dígitos.'
  if (esWhatsapp.value && !f.value.plantilla.trim()) e.plantilla = 'Escriba el nombre de la plantilla aprobada en Meta.'
  return e
})

watch(abierto, (si) => {
  if (!si) return
  intentado.value = false
  const c = props.creativo
  f.value = c
    ? {
        formato: c.formato, titulo: c.titulo, texto: c.texto, boton: c.boton ?? '', enlace: c.enlace ?? '', condiciones: c.condiciones ?? '',
        promocion: c.es_promocion, cupon: c.cupon_codigo ?? '', limite: c.cupon_limite ? String(c.cupon_limite) : '', plantilla: c.plantilla_whatsapp ?? '',
        imagen: c.imagen_archivo_id ?? null,
      }
    : vacio()
})

function enviar() {
  intentado.value = true
  if (Object.keys(errores.value).length) return
  const v = f.value
  emit('enviar', {
    formato: v.formato, titulo: v.titulo.trim(), texto: v.texto.trim(), boton: v.boton.trim() || null, enlace: v.enlace.trim() || null,
    condiciones: v.condiciones.trim() || null, es_promocion: v.promocion || esCupon.value,
    cupon_codigo: esCupon.value ? v.cupon.toUpperCase() : null, cupon_limite: esCupon.value && /^\d+$/.test(v.limite) ? Number(v.limite) : null,
    plantilla_whatsapp: esWhatsapp.value ? v.plantilla.trim() : null,
    imagen_archivo_id: v.imagen,
  })
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    :titulo="creativo ? 'Editar pieza' : 'Nueva pieza'"
  >
    <form
      id="formulario-creativo"
      class="campos"
      novalidate
      @submit.prevent="enviar"
    >
      <HudSelector
        v-model="f.formato"
        etiqueta="Formato"
        :opciones="FORMATOS"
      />
      <HudCampo
        v-model="f.titulo"
        etiqueta="Título"
        :error="errores.titulo"
      />
      <HudCampo
        v-model="f.texto"
        etiqueta="Texto"
        multilinea
        :error="errores.texto"
      />
      <div class="filtros">
        <HudCampo
          v-model="f.boton"
          etiqueta="Texto del botón (opcional)"
        />
        <HudCampo
          v-model="f.enlace"
          etiqueta="Enlace (opcional)"
          tipo="url"
          :error="errores.enlace"
        />
      </div>
      <label
        v-if="!esCupon"
        class="casilla"
      >
        <input
          v-model="f.promocion"
          type="checkbox"
        >
        Es una promoción
      </label>
      <HudCampo
        v-model="f.condiciones"
        etiqueta="Condiciones"
        multilinea
        :error="errores.condiciones"
      />
      <div
        v-if="esCupon"
        class="filtros"
      >
        <HudCampo
          v-model="f.cupon"
          etiqueta="Código del cupón"
          :error="errores.cupon"
        />
        <HudCampo
          v-model="f.limite"
          etiqueta="Límite de usos (opcional)"
          modo-entrada="numeric"
        />
      </div>
      <HudCampo
        v-if="esWhatsapp"
        v-model="f.plantilla"
        etiqueta="Plantilla de marketing en Meta"
        :error="errores.plantilla"
      />
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
      <SelectorImagenPublicidad
        v-model="f.imagen"
        etiqueta="Imagen de la pieza"
      />
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
        form="formulario-creativo"
        :cargando="cargando"
      >
        {{ creativo ? 'Guardar pieza' : 'Agregar pieza' }}
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

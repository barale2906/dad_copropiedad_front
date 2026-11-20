<script setup lang="ts">
/**
 * Crear o editar una campaña: objetivo, una de las categorías de la ficha, fechas, modelo de cobro,
 * presupuesto y segmentación (entidades por tipo y municipio; para PH también tipo, tamaño y
 * estrato). Solo presenta y emite.
 */
import { computed, ref, watch } from 'vue'
import type { Campana, ModeloCobro, NuevaCampana, ObjetivoCampana, TipoCopropiedad } from '@/api/tipos'
import { leerDecimal } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { MODELO_COBRO, OBJETIVO_CAMPANA } from '../reglas'

const props = withDefaults(
  defineProps<{ campana?: Campana | null; categorias: { valor: string; etiqueta: string }[]; cargando?: boolean; error?: string | null }>(),
  { campana: null, cargando: false, error: null },
)
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ enviar: [datos: NuevaCampana] }>()

const vacio = () => ({
  nombre: '', objetivo: 'visibilidad' as ObjetivoCampana, categoria: '', inicio: '', fin: '', modelo: 'tarifa_fija' as ModeloCobro,
  total: '', diario: '', ph: true, empresa: true, municipios: '', radio: '', tipos: [] as TipoCopropiedad[], bienesMin: '', bienesMax: '', estratos: [] as number[],
})
const f = ref(vacio())
const intentado = ref(false)
const OBJETIVOS = (Object.keys(OBJETIVO_CAMPANA) as ObjetivoCampana[]).map((o) => ({ valor: o, etiqueta: OBJETIVO_CAMPANA[o] }))
const MODELOS = (Object.keys(MODELO_COBRO) as ModeloCobro[]).map((m) => ({ valor: m, etiqueta: MODELO_COBRO[m] }))
const TIPOS_PH: { valor: TipoCopropiedad; texto: string }[] = [
  { valor: 'residencial', texto: 'Residencial' },
  { valor: 'comercial', texto: 'Comercial' },
  { valor: 'mixta', texto: 'Mixta' },
]
const entero = (t: string) => (/^\d+$/.test(t) ? Number.parseInt(t, 10) : null)

const errores = computed(() => {
  if (!intentado.value) return {}
  const e: Record<string, string> = {}
  if (f.value.nombre.trim().length < 3) e.nombre = 'Escriba el nombre de la campaña.'
  if (!f.value.categoria) e.categoria = 'Elija la categoría de la ficha.'
  if (!f.value.inicio || !f.value.fin) e.fechas = 'Elija el inicio y el fin.'
  else if (f.value.fin < f.value.inicio) e.fechas = 'El fin va después del inicio.'
  if (!leerDecimal(f.value.total)) e.total = 'Escriba el presupuesto total.'
  if (!f.value.ph && !f.value.empresa) e.tipos = 'Elija al menos un tipo de entidad.'
  if (f.value.radio && !(entero(f.value.radio) && entero(f.value.radio)! <= 100)) e.radio = 'El radio va de 1 a 100 km.'
  return e
})

watch(abierto, (si) => {
  if (!si) return
  intentado.value = false
  const c = props.campana
  if (!c) {
    f.value = { ...vacio(), categoria: props.categorias[0]?.valor ?? '' }
    return
  }
  const s = c.segmentacion
  f.value = {
    nombre: c.nombre, objetivo: c.objetivo, categoria: c.categoria, inicio: c.inicio.slice(0, 10), fin: c.fin.slice(0, 10), modelo: c.modelo,
    total: c.presupuesto_total, diario: c.presupuesto_diario ?? '',
    ph: !s.tipos_entidad.length || s.tipos_entidad.includes('propiedad_horizontal'), empresa: !s.tipos_entidad.length || s.tipos_entidad.includes('empresa'),
    municipios: s.municipios.join(', '), radio: s.radio_km ? String(s.radio_km) : '', tipos: [...s.tipos],
    bienesMin: s.bienes_min ? String(s.bienes_min) : '', bienesMax: s.bienes_max ? String(s.bienes_max) : '', estratos: [...s.estratos],
  }
})

function enviar() {
  intentado.value = true
  if (Object.keys(errores.value).length) return
  const v = f.value
  const ambos = v.ph && v.empresa
  emit('enviar', {
    nombre: v.nombre.trim(), objetivo: v.objetivo, categoria: v.categoria, inicio: v.inicio, fin: v.fin, modelo: v.modelo,
    presupuesto_total: leerDecimal(v.total) ?? '0', presupuesto_diario: leerDecimal(v.diario) ?? null,
    segmentacion: {
      entidades: props.campana?.segmentacion.entidades ?? [],
      tipos_entidad: ambos ? [] : v.ph ? ['propiedad_horizontal'] : ['empresa'],
      radio_km: entero(v.radio),
      municipios: v.municipios.split(/[\s,;]+/).filter((m) => /^\d{5}$/.test(m)),
      // Los criterios de PH solo aplican a las PH.
      tipos: v.ph ? v.tipos : [],
      bienes_min: v.ph ? entero(v.bienesMin) : null,
      bienes_max: v.ph ? entero(v.bienesMax) : null,
      estratos: v.ph ? v.estratos : [],
    },
  })
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    :titulo="campana ? `Editar ${campana.nombre}` : 'Nueva campaña'"
  >
    <form
      id="formulario-campana"
      class="campos"
      novalidate
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="f.nombre"
        etiqueta="Nombre"
        :error="errores.nombre"
      />
      <div class="filtros">
        <HudSelector
          v-model="f.objetivo"
          etiqueta="Objetivo"
          :opciones="OBJETIVOS"
        />
        <HudSelector
          v-model="f.categoria"
          etiqueta="Categoría"
          :opciones="categorias"
          vacio="La ficha no tiene categorías"
          :error="errores.categoria"
        />
        <HudFecha
          v-model="f.inicio"
          etiqueta="Inicio"
          :error="errores.fechas"
        />
        <HudFecha
          v-model="f.fin"
          etiqueta="Fin"
          :minimo="f.inicio || undefined"
        />
        <HudSelector
          v-model="f.modelo"
          etiqueta="Modelo de cobro"
          :opciones="MODELOS"
        />
        <HudCampoMonto
          v-model="f.total"
          etiqueta="Presupuesto total"
          :error="errores.total"
        />
        <HudCampoMonto
          v-model="f.diario"
          etiqueta="Tope diario (opcional)"
        />
      </div>
      <fieldset class="grupo">
        <legend>¿A quién le llega?</legend>
        <label class="casilla"><input
          v-model="f.ph"
          type="checkbox"
        > Propiedades horizontales</label>
        <label class="casilla"><input
          v-model="f.empresa"
          type="checkbox"
        > Empresas</label>
        <p
          v-if="errores.tipos"
          class="error"
        >
          {{ errores.tipos }}
        </p>
      </fieldset>
      <div class="filtros">
        <HudCampo
          v-model="f.municipios"
          etiqueta="Municipios (códigos DANE, opcional)"
          ayuda="Separados por coma. Vacío: todos."
        />
        <HudCampo
          v-model="f.radio"
          etiqueta="Radio desde el comercio (km)"
          modo-entrada="numeric"
          :error="errores.radio"
        />
      </div>
      <fieldset
        v-if="f.ph"
        class="grupo"
      >
        <legend>Solo para las PH</legend>
        <label
          v-for="t in TIPOS_PH"
          :key="t.valor"
          class="casilla"
        ><input
          v-model="f.tipos"
          type="checkbox"
          :value="t.valor"
        > {{ t.texto }}</label>
        <div class="filtros">
          <HudCampo
            v-model="f.bienesMin"
            etiqueta="Mínimo de bienes"
            modo-entrada="numeric"
          />
          <HudCampo
            v-model="f.bienesMax"
            etiqueta="Máximo de bienes"
            modo-entrada="numeric"
          />
        </div>
        <div class="estratos">
          <label
            v-for="e in [1, 2, 3, 4, 5, 6]"
            :key="e"
            class="casilla"
          ><input
            v-model="f.estratos"
            type="checkbox"
            :value="e"
          > Estrato {{ e }}</label>
        </div>
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
        form="formulario-campana"
        :cargando="cargando"
      >
        {{ campana ? 'Guardar' : 'Crear campaña' }}
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.grupo {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 4px;
  font-weight: 600;
}

.estratos {
  display: flex;
  flex-wrap: wrap;
  gap: 0 14px;
}
</style>

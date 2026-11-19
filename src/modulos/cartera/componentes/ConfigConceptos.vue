<script setup lang="ts">
/**
 * Conceptos de cobro: listar, crear (código, nombre, tipo, criterio de distribución, valor fijo o
 * módulo según el criterio, si genera interés y el concepto contable de las reglas `ph.*`) y
 * activar o desactivar. El código, el tipo y el criterio no cambian.
 */
import { computed, ref } from 'vue'
import type { ConceptoCobro, CriterioDistribucion, ModuloContribucion, TipoConceptoCobro } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { crearConcepto, guardarConcepto } from '../api'
import { CRITERIO, TIPO_CONCEPTO } from '../reglas'
import { useCartera } from '../store'

const props = defineProps<{ modulos: ModuloContribucion[] }>()

const entidad = useEntidad()
const cartera = useCartera()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const form = ref({ codigo: '', nombre: '', tipo: 'multa' as TipoConceptoCobro, criterio: 'valor_fijo' as CriterioDistribucion, valor: '', modulo: '', interes: false })
const problema = ref<string | null>(null)
const resultado = ref<string | null>(null)
const opcionesTipo = (Object.keys(TIPO_CONCEPTO) as TipoConceptoCobro[]).map((valor) => ({ valor, etiqueta: TIPO_CONCEPTO[valor] }))
const opcionesCriterio = (Object.keys(CRITERIO) as CriterioDistribucion[]).filter((c) => c !== 'por_tipo_bien').map((valor) => ({ valor, etiqueta: CRITERIO[valor] }))
const opcionesModulo = computed(() => props.modulos.filter((m) => m.activo).map((m) => ({ valor: m.id, etiqueta: m.nombre })))

const crear = useAccion(() => {
  const f = form.value
  return crearConcepto(id.value, {
    codigo: f.codigo.trim().toUpperCase(),
    nombre: f.nombre.trim(),
    tipo: f.tipo,
    criterio: f.criterio,
    valor_fijo: f.criterio === 'valor_fijo' ? f.valor : null,
    modulo_id: f.criterio === 'modulo' ? f.modulo : null,
    genera_interes: f.interes,
    concepto_contable: `ph.${f.tipo}`,
  })
})
const alternar = useAccion((_c, c: ConceptoCobro) =>
  guardarConcepto(id.value, c.id, { nombre: c.nombre, valor_fijo: c.valor_fijo ?? null, tarifas: c.tarifas, genera_interes: c.genera_interes, concepto_contable: c.concepto_contable, activo: !c.activo }),
)

async function alCrear() {
  const f = form.value
  problema.value = !f.codigo.trim() || !f.nombre.trim()
    ? 'Escriba el código y el nombre.'
    : f.criterio === 'valor_fijo' && !f.valor
      ? 'Escriba el valor fijo mensual.'
      : f.criterio === 'modulo' && !f.modulo
        ? 'Elija el módulo de contribución.'
        : null
  if (problema.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  resultado.value = `Concepto ${r.valor.codigo} creado.`
  form.value = { ...form.value, codigo: '', nombre: '', valor: '' }
  await cartera.recargar(id.value)
}

async function alAlternar(c: ConceptoCobro) {
  if (!(await alternar.ejecutar(c)).ok) return
  await cartera.recargar(id.value)
}
</script>

<template>
  <div class="campos">
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <ul
      class="lista"
      aria-label="Conceptos de cobro"
    >
      <li
        v-for="c in cartera.conceptos"
        :key="c.id"
      >
        <span class="crece">
          <strong>{{ c.codigo }} · {{ c.nombre }}</strong>
          <small>{{ TIPO_CONCEPTO[c.tipo] }} · {{ CRITERIO[c.criterio] }}{{ c.valor_fijo ? ` · ${moneda(c.valor_fijo)}` : '' }}{{ c.genera_interes ? ' · genera interés' : '' }}</small>
        </span>
        <HudInsignia :tono="c.activo ? 'exito' : 'neutro'">
          {{ c.activo ? 'Activo' : 'Inactivo' }}
        </HudInsignia>
        <HudBoton
          variante="fantasma"
          :cargando="alternar.cargando.value"
          @click="alAlternar(c)"
        >
          {{ c.activo ? 'Desactivar' : 'Activar' }}<span class="solo-lector"> {{ c.codigo }}</span>
        </HudBoton>
      </li>
    </ul>
    <form
      class="campos"
      novalidate
      aria-label="Concepto nuevo"
      @submit.prevent="alCrear"
    >
      <div class="filtros">
        <HudCampo
          v-model="form.codigo"
          etiqueta="Código del concepto"
          autocompletar="off"
        />
        <HudCampo
          v-model="form.nombre"
          etiqueta="Nombre del concepto"
        />
        <HudSelector
          v-model="form.tipo"
          etiqueta="Tipo"
          :opciones="opcionesTipo"
        />
        <HudSelector
          v-model="form.criterio"
          etiqueta="Distribución"
          :opciones="opcionesCriterio"
        />
        <HudCampoMonto
          v-if="form.criterio === 'valor_fijo'"
          v-model="form.valor"
          etiqueta="Valor mensual por unidad"
        />
        <HudSelector
          v-if="form.criterio === 'modulo'"
          v-model="form.modulo"
          etiqueta="Módulo de contribución"
          vacio="Elija el módulo"
          :opciones="opcionesModulo"
        />
      </div>
      <label class="casilla">
        <input
          v-model="form.interes"
          type="checkbox"
        >
        Genera intereses de mora
      </label>
      <p
        v-if="problema ?? crear.error.value ?? alternar.error.value"
        class="error"
        role="alert"
      >
        {{ problema ?? crear.error.value ?? alternar.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          tipo="submit"
          :cargando="crear.cargando.value"
        >
          Crear concepto
        </HudBoton>
      </div>
    </form>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

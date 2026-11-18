<script setup lang="ts">
/**
 * Crear una cuenta propia (código PUC, nombre, naturaleza y reglas de imputación) o editar una
 * existente (el código y la naturaleza no cambian). Sugiere el nombre del catálogo PUC y dice
 * cuál es la cuenta padre.
 */
import { computed, ref, watch } from 'vue'
import type { CambioCuentaContable, CuentaContable, Naturaleza, NuevaCuentaContable } from '@/api/tipos'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { catalogoPuc } from '../api'
import { NIVEL_CUENTA, nivelDeCodigo, padreDeCodigo } from '../reglas'

const props = withDefaults(
  defineProps<{
    entidadId: string
    /** Sin ella, una cuenta nueva. */
    cuenta?: CuentaContable | null
    /** Para nombrar la cuenta padre. */
    porCodigo: Map<string, CuentaContable>
    cargando?: boolean
    error?: string | null
  }>(),
  { cuenta: null, cargando: false, error: null },
)
const emit = defineEmits<{ crear: [datos: NuevaCuentaContable]; editar: [datos: CambioCuentaContable]; cancelar: [] }>()

const codigo = ref(props.cuenta?.codigo ?? '')
const nombre = ref(props.cuenta?.nombre ?? '')
const naturaleza = ref<Naturaleza | ''>('')
const movimiento = ref(props.cuenta?.acepta_movimiento ?? true)
const tercero = ref(props.cuenta?.exige_tercero ?? false)
const centro = ref(props.cuenta?.exige_centro_costo ?? false)
const activa = ref(props.cuenta?.activa ?? true)
const sugerido = ref<string | null>(null)
const problema = ref<string | null>(null)

const opcionesNaturaleza = [
  { valor: 'debito' as const, etiqueta: 'Débito' },
  { valor: 'credito' as const, etiqueta: 'Crédito' },
]
const padre = computed(() => {
  const p = padreDeCodigo(codigo.value.trim())
  if (!p) return null
  const c = props.porCodigo.get(p)
  return c ? `${p} · ${c.nombre}` : `${p} (todavía no existe: créela primero)`
})
const ayudaCodigo = computed(() => {
  const c = codigo.value.trim()
  if (!/^\d+$/.test(c)) return 'Solo dígitos, según el PUC (p. ej. 11100503).'
  return `${NIVEL_CUENTA[nivelDeCodigo(c)]}${padre.value ? `; depende de ${padre.value}` : ''}.`
})

let turno = 0
watch(codigo, async (c) => {
  sugerido.value = null
  const t = ++turno
  if (props.cuenta || !/^\d{4,}$/.test(c.trim())) return
  const lista = await catalogoPuc(props.entidadId, c.trim()).catch(() => [])
  if (t === turno) sugerido.value = lista.find((x) => x.codigo === c.trim())?.nombre ?? null
})

function guardar() {
  if (!nombre.value.trim()) {
    problema.value = 'Escriba el nombre de la cuenta.'
    return
  }
  if (props.cuenta) {
    problema.value = null
    emit('editar', { nombre: nombre.value.trim(), acepta_movimiento: movimiento.value, exige_tercero: tercero.value, exige_centro_costo: centro.value, activa: activa.value })
    return
  }
  if (!/^\d{1,10}$/.test(codigo.value.trim())) {
    problema.value = 'El código lleva solo dígitos (hasta 10).'
    return
  }
  problema.value = null
  emit('crear', {
    codigo: codigo.value.trim(), nombre: nombre.value.trim(), naturaleza: naturaleza.value || null,
    acepta_movimiento: movimiento.value, exige_tercero: tercero.value, exige_centro_costo: centro.value,
  })
}
</script>

<template>
  <form
    class="campos"
    novalidate
    @submit.prevent="guardar"
  >
    <HudCampo
      v-if="!cuenta"
      v-model="codigo"
      etiqueta="Código"
      modo-entrada="numeric"
      :ayuda="ayudaCodigo"
      requerido
    />
    <p
      v-else
      class="texto-2"
    >
      Código {{ cuenta.codigo }} · {{ NIVEL_CUENTA[cuenta.nivel] }} · naturaleza {{ cuenta.naturaleza === 'debito' ? 'débito' : 'crédito' }}
    </p>
    <HudCampo
      v-model="nombre"
      etiqueta="Nombre"
      requerido
    />
    <HudBoton
      v-if="sugerido && sugerido !== nombre"
      variante="fantasma"
      @click="nombre = sugerido"
    >
      Usar el nombre del PUC: «{{ sugerido }}»
    </HudBoton>
    <HudSelector
      v-if="!cuenta"
      v-model="naturaleza"
      etiqueta="Naturaleza"
      vacio="La del PUC (según la clase)"
      :opciones="opcionesNaturaleza"
    />
    <label class="casilla">
      <input
        v-model="movimiento"
        type="checkbox"
      > Acepta movimientos (se registra en ella)
    </label>
    <label class="casilla">
      <input
        v-model="tercero"
        type="checkbox"
      > Exige tercero
    </label>
    <label class="casilla">
      <input
        v-model="centro"
        type="checkbox"
      > Exige centro de costo
    </label>
    <label
      v-if="cuenta"
      class="casilla"
    >
      <input
        v-model="activa"
        type="checkbox"
      > Activa
    </label>
    <p
      v-if="problema ?? error"
      class="error"
      role="alert"
    >
      {{ problema ?? error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        {{ cuenta ? 'Guardar la cuenta' : 'Crear la cuenta' }}
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="emit('cancelar')"
      >
        Cancelar
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="../vistas/contabilidad.css"></style>

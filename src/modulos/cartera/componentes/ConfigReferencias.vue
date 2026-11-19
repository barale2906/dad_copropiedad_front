<script setup lang="ts">
/**
 * Referencia de pago de cada unidad (numérica, de 1 a 24 dígitos, única en la copropiedad): la
 * que el banco trae en el recaudo por referencia y se imprime en la cuenta de cobro. Avisa las
 * unidades sin referencia.
 */
import { computed, ref } from 'vue'
import type { BienCartera } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import { useEntidad } from '@/stores/entidad'
import { guardarDatosPago } from '../api'
import { useCartera } from '../store'

const entidad = useEntidad()
const cartera = useCartera()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const soloSin = ref(true)
const editando = ref<Record<string, string>>({})
const resultado = ref<string | null>(null)

const ordenados = computed(() => [...cartera.bienes].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })))
const sinReferencia = computed(() => ordenados.value.filter((b) => !b.referencia_pago))
const visibles = computed(() => (soloSin.value ? sinReferencia.value : ordenados.value))
const valor = (b: BienCartera) => editando.value[b.id] ?? b.referencia_pago ?? ''

const guardar = useAccion((_c, b: BienCartera) => guardarDatosPago(id.value, b.id, { referencia_pago: valor(b).trim() || null, pagador_persona_id: b.pagador_persona_id ?? null }))

async function alGuardar(b: BienCartera) {
  if (!(await guardar.ejecutar(b)).ok) return
  resultado.value = `Referencia de ${b.codigo} guardada.`
  const resto = { ...editando.value }
  delete resto[b.id]
  editando.value = resto
  await cartera.recargar(id.value)
}
</script>

<template>
  <div class="campos">
    <p
      class="texto-2"
      :class="{ aviso: sinReferencia.length > 0 }"
    >
      {{ sinReferencia.length ? `${sinReferencia.length} unidad(es) sin referencia de pago: su cuenta de cobro sale sin ella y el banco no la identifica.` : 'Todas las unidades tienen referencia de pago.' }}
    </p>
    <label class="casilla">
      <input
        v-model="soloSin"
        type="checkbox"
      >
      Ver solo las unidades sin referencia
    </label>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="guardar.error.value"
      class="error"
      role="alert"
    >
      {{ guardar.error.value }}
    </p>
    <ul
      v-if="visibles.length"
      class="lista"
      aria-label="Referencias de pago"
    >
      <li
        v-for="b in visibles"
        :key="b.id"
      >
        <strong class="crece">{{ b.codigo }}</strong>
        <HudCampo
          :model-value="valor(b)"
          :etiqueta="`Referencia de pago de ${b.codigo}`"
          modo-entrada="numeric"
          autocompletar="off"
          @update:model-value="editando = { ...editando, [b.id]: $event }"
        />
        <HudBoton
          variante="secundario"
          :cargando="guardar.cargando.value"
          :deshabilitado="valor(b) === (b.referencia_pago ?? '')"
          @click="alGuardar(b)"
        >
          Guardar<span class="solo-lector"> la referencia de {{ b.codigo }}</span>
        </HudBoton>
      </li>
    </ul>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

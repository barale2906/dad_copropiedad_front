<script setup lang="ts">
/**
 * Elegir el bien a cuyo nombre se hace algo (reservar, restringir, asignar, inscribir): los
 * bienes de la cuenta (titular o residente) y, con `bienes_privados.ver`, buscar cualquiera. `v-model` = id del bien.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import SelectorBien, { type OpcionBien } from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'

const props = withDefaults(defineProps<{ etiqueta?: string; soloBusqueda?: boolean; error?: string | null }>(), {
  etiqueta: 'Bien',
  soloBusqueda: false,
  error: null,
})
const bienId = defineModel<string>({ required: true })

const entidad = useEntidad()
const bienes = useBienes()
const propios = ref<OpcionBien[]>([])
const errorPropios = ref<string | null>(null)

const buscar = computed(() =>
  entidad.tienePermiso('bienes_privados.ver') ? async (q: string) => (await bienes.buscar(q)).datos : undefined,
)

onMounted(async () => {
  if (props.soloBusqueda) return
  try {
    propios.value = await bienes.asegurarMisBienes()
    if (!bienId.value && propios.value.length === 1) bienId.value = propios.value[0]!.id
  } catch (e) {
    errorPropios.value = mensajeDeError(e)
  }
})
</script>

<template>
  <div>
    <SelectorBien
      v-model="bienId"
      :etiqueta="etiqueta"
      :propios="propios"
      :buscar="buscar"
      :codigo-elegido="bienId ? bienes.codigo(bienId) : null"
      :error="error"
      :sin-bienes="soloBusqueda ? '' : 'Su cuenta no figura como titular ni residente de ningún bien. Pida a la administración que haga la reserva a su nombre.'"
    />
    <p
      v-if="errorPropios"
      class="error"
      role="alert"
    >
      {{ errorPropios }}
    </p>
  </div>
</template>

<style scoped>
.error {
  margin: 8px 0 0;
  color: var(--magenta);
}
</style>

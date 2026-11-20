<script setup lang="ts">
/** Módulos contratados de un cliente: encender o apagar cada uno desde ahora (venta por módulo). */
import { computed, ref } from 'vue'
import type { EntidadPlataforma, Modulo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { habilitarModulo, terminarModulo } from '../api-clientes'
import { modulosDe, NOMBRE_MODULO } from '../reglas'

const props = defineProps<{ cliente: EntidadPlataforma; puedeGestionar: boolean }>()
const emit = defineEmits<{ cambio: [modulos: Modulo[]] }>()

const enCurso = ref<Modulo | null>(null)
const resultado = ref<string | null>(null)
const modulos = computed(() => modulosDe(props.cliente.tipo))
const activo = (m: Modulo) => props.cliente.modulos.includes(m)

const cambiar = useAccion(async (_clave, m: Modulo) => {
  if (activo(m)) await terminarModulo(props.cliente.id, m)
  else await habilitarModulo(props.cliente.id, m)
  return m
})

async function alternar(m: Modulo) {
  enCurso.value = m
  resultado.value = null
  const r = await cambiar.ejecutar(m)
  enCurso.value = null
  if (!r.ok) return
  const encendido = !activo(m)
  emit('cambio', encendido ? [...props.cliente.modulos, m] : props.cliente.modulos.filter((x) => x !== m))
  resultado.value = `${NOMBRE_MODULO[m]} ${encendido ? 'quedó habilitado desde ahora' : 'quedó apagado desde ahora; su historial se conserva'}.`
}
</script>

<template>
  <ul class="lista">
    <li
      v-for="m in modulos"
      :key="m"
    >
      <span class="crece">
        <strong>{{ NOMBRE_MODULO[m] }}</strong>
      </span>
      <HudInsignia :tono="activo(m) ? 'exito' : 'neutro'">
        {{ activo(m) ? 'Contratado' : 'Sin contratar' }}
      </HudInsignia>
      <HudBoton
        v-if="puedeGestionar"
        :variante="activo(m) ? 'fantasma' : 'secundario'"
        :cargando="enCurso === m"
        @click="alternar(m)"
      >
        {{ activo(m) ? 'Apagar' : 'Habilitar' }}<span class="solo-lector"> {{ NOMBRE_MODULO[m] }}</span>
      </HudBoton>
    </li>
  </ul>
  <p
    v-if="resultado"
    class="ok"
    role="status"
  >
    {{ resultado }}
  </p>
  <p
    v-if="cambiar.error.value"
    class="error"
    role="alert"
  >
    {{ cambiar.error.value }}
  </p>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

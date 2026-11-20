<script setup lang="ts">
/**
 * «Ver como soporte»: pide el motivo (queda auditado), abre 2 h de solo lectura y entra a la
 * entidad con sus rutas normales; allí la franja de soporte avisa que nada se puede cambiar.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { EntidadPlataforma } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import IOjo from '~icons/tabler/eye'
import { abrirSoporte } from '../api-clientes'

const props = defineProps<{ cliente: EntidadPlataforma }>()

const router = useRouter()
const sesion = useSesion()
const entidad = useEntidad()
const abierto = ref(false)

const abrir = useAccion((_clave, motivo: string) => abrirSoporte(props.cliente.id, motivo))

function pedirMotivo() {
  abrir.reiniciar()
  abierto.value = true
}

async function confirmar(motivo: string) {
  const r = await abrir.ejecutar(motivo)
  if (!r.ok) return
  abierto.value = false
  sesion.agregarSoporte({
    entidad_id: props.cliente.id,
    nombre: props.cliente.nombre,
    nit: props.cliente.nit ?? null,
    tipo: props.cliente.tipo,
    estado: props.cliente.estado,
    roles: [],
  })
  await router.push({ name: 'maqueta', params: { entidadId: props.cliente.id }, query: { ver: 'maqueta' } })
}
</script>

<template>
  <div class="campos">
    <p class="texto-2">
      Abre la entidad en solo lectura durante 2 horas, sin datos sensibles, votos reservados ni convivencia. El acceso
      queda en la auditoría con su motivo.
    </p>
    <div>
      <HudBoton
        variante="secundario"
        @click="pedirMotivo"
      >
        <IOjo aria-hidden="true" /> Ver como soporte
      </HudBoton>
    </div>
    <ConfirmarConMotivo
      v-model:abierto="abierto"
      titulo="Ver como soporte"
      accion="Abrir en solo lectura"
      :descripcion="`Entrará a ${cliente.nombre} durante 2 horas (hasta las ${fechaHora(new Date(Date.now() + 7_200_000), entidad.zonaHoraria)}). Escriba por qué lo necesita.`"
      :cargando="abrir.cargando.value"
      :error="abrir.error.value"
      @confirmar="confirmar"
    />
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

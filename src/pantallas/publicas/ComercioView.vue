<script setup lang="ts">
/**
 * Mostrador del comercio (sin cuenta, `X-Comercio`): escribe el código del cupón que presenta el
 * cliente y ve un resultado claro: redimido (y cuántos usos quedan), desconocido, vencido o agotado.
 */
import { computed, onMounted, ref } from 'vue'
import { tomarCredencial } from '@/api/credencial-externa'
import { esCodigoDeEnlaceNoValido, redimirCupon } from '@/api/publico'
import type { RedencionCupon } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import EnlaceNoValido from './EnlaceNoValido.vue'
import MarcoPublico from './MarcoPublico.vue'

const codigo = ref('')
const sinEnlace = ref(false)
const resultado = ref<RedencionCupon | null>(null)
const redimir = useAccion((_clave, c: string) => redimirCupon(c))

const invalido = computed(() => sinEnlace.value || esCodigoDeEnlaceNoValido(redimir.codigo.value))
const mensaje = computed(() => {
  if (redimir.codigo.value === 'no_encontrado') return 'Ese código no existe. Revíselo con el cliente.'
  return redimir.error.value
})

async function enviar() {
  if (!codigo.value.trim()) return
  resultado.value = null
  const r = await redimir.ejecutar(codigo.value)
  if (r.ok) {
    resultado.value = r.valor
    codigo.value = ''
  }
}

onMounted(() => {
  if (!tomarCredencial('comercio')) sinEnlace.value = true
})
</script>

<template>
  <MarcoPublico
    titulo="Redimir un cupón"
    subtitulo="Escriba el código que le muestra el cliente."
  >
    <EnlaceNoValido
      v-if="invalido"
      quien="a DAD (su asesor comercial)"
    />
    <template v-else>
      <form
        class="formulario"
        novalidate
        @submit.prevent="enviar"
      >
        <HudCampo
          v-model="codigo"
          etiqueta="Código del cupón"
          autocompletar="off"
        />
        <HudBoton
          tipo="submit"
          bloque
          :deshabilitado="!codigo.trim() || redimir.segundosEspera.value > 0"
          :cargando="redimir.cargando.value"
        >
          {{ redimir.segundosEspera.value > 0 ? `Espere ${redimir.segundosEspera.value} s` : 'Redimir' }}
        </HudBoton>
      </form>
      <HudPanel
        v-if="resultado"
        etiqueta="Cupón redimido"
        resaltado
      >
        <p
          class="ok"
          role="status"
        >
          Listo: «{{ resultado.titulo }}» quedó redimido.
        </p>
        <p class="nota">
          Usos: {{ resultado.usos }}<template v-if="resultado.restantes != null">
            · quedan {{ resultado.restantes }}
          </template><template v-else>
            · sin límite
          </template>
        </p>
      </HudPanel>
      <p
        v-else-if="mensaje"
        class="error"
        role="alert"
      >
        {{ mensaje }}
      </p>
    </template>
  </MarcoPublico>
</template>

<style scoped>
.formulario {
  display: grid;
  gap: 12px;
}

.ok {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
}

.nota {
  margin: 6px 0 0;
  color: var(--texto-2);
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>

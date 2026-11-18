<script setup lang="ts">
/** Asistentes registrados: bienes, coeficiente, presencia y rótulo; salida, reingreso y rótulo Code 128. */
import { computed, ref } from 'vue'
import type { Asistente, MotivoSalida } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { coeficiente } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import LectorQr from '@/hud/componentes/LectorQr.vue'
import { asignarRotulo, reingreso, salida } from '../api'
import { coeficienteDe, MOTIVO_SALIDA, resumenBienes } from '../reglas'

const props = defineProps<{ entidadId: string; reunionId: string; asistentes: Asistente[] }>()
const emit = defineEmits<{ cambio: [texto: string] }>()

const filtro = ref('')
const visibles = computed(() => {
  const t = filtro.value.trim().toLowerCase()
  return t ? props.asistentes.filter((a) => a.nombre.toLowerCase().includes(t) || a.bienes.some((b) => b.codigo.toLowerCase().includes(t))) : props.asistentes
})
const presentes = computed(() => props.asistentes.filter((a) => a.presente).length)

// Salida
const saliendo = ref<Asistente | null>(null)
const abiertoSalida = computed({ get: () => !!saliendo.value, set: (si: boolean) => !si && (saliendo.value = null) })
const motivo = ref<MotivoSalida>('se_retiro')
const detalle = ref('')
const registrarSalida = useAccion(() => salida(props.entidadId, props.reunionId, saliendo.value?.id ?? '', motivo.value, detalle.value))
const volver = useAccion((_c, a: Asistente) => reingreso(props.entidadId, props.reunionId, a.id))

// Rótulo
const rotulando = ref<Asistente | null>(null)
const abiertoRotulo = computed({ get: () => !!rotulando.value, set: (si: boolean) => !si && (rotulando.value = null) })
const rotulo = useAccion((_c, codigo: string | null) => asignarRotulo(props.entidadId, props.reunionId, rotulando.value?.id ?? '', codigo))

async function confirmarSalida() {
  const nombre = saliendo.value?.nombre
  if (!(await registrarSalida.ejecutar()).ok) return
  saliendo.value = null
  emit('cambio', `Salida de ${nombre} registrada.`)
}

async function reingresar(a: Asistente) {
  if ((await volver.ejecutar(a)).ok) emit('cambio', `${a.nombre} volvió a la sala.`)
}

function abrirRotulo(a: Asistente) {
  rotulo.reiniciar()
  rotulando.value = a
}

async function guardarRotulo(codigo: string | null) {
  const nombre = rotulando.value?.nombre
  if (!(await rotulo.ejecutar(codigo)).ok) return
  rotulando.value = null
  emit('cambio', codigo ? `Rótulo ${codigo} entregado a ${nombre}.` : `Se retiró el rótulo de ${nombre}.`)
}

function abrirSalida(a: Asistente) {
  motivo.value = 'se_retiro'
  detalle.value = ''
  registrarSalida.reiniciar()
  saliendo.value = a
}
</script>

<template>
  <div class="campos">
    <div class="filtros">
      <HudCampo
        v-model="filtro"
        etiqueta="Filtrar asistentes"
        tipo="search"
        autocompletar="off"
      />
      <p class="texto-2">
        {{ presentes }} presente(s) de {{ asistentes.length }} registrado(s).
      </p>
    </div>
    <p
      v-if="volver.error.value"
      class="error"
      role="alert"
    >
      {{ volver.error.value }}
    </p>
    <p
      v-if="asistentes.length === 0"
      class="texto-2"
    >
      Aún no hay asistentes.
    </p>
    <ul
      v-else
      class="lista"
      aria-label="Asistentes"
    >
      <li
        v-for="a in visibles"
        :key="a.id"
      >
        <HudInsignia :tono="a.presente ? 'exito' : 'neutro'">
          {{ a.presente ? 'En la sala' : 'Salió' }}
        </HudInsignia>
        <span class="crece">
          <strong>{{ a.nombre }}</strong>
          <small>
            {{ resumenBienes(a) }}
            · {{ coeficiente(coeficienteDe(a)) }}{{ a.rotulo ? ` · rótulo ${a.rotulo}` : '' }}
          </small>
        </span>
        <div class="botones">
          <HudBoton
            v-if="a.presente"
            variante="fantasma"
            @click="abrirSalida(a)"
          >
            Salida<span class="solo-lector"> de {{ a.nombre }}</span>
          </HudBoton>
          <HudBoton
            v-else
            variante="secundario"
            :cargando="volver.cargando.value"
            @click="reingresar(a)"
          >
            Reingreso<span class="solo-lector"> de {{ a.nombre }}</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="abrirRotulo(a)"
          >
            Rótulo<span class="solo-lector"> de {{ a.nombre }}</span>
          </HudBoton>
        </div>
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="abiertoSalida"
      :titulo="saliendo ? `Salida de ${saliendo.nombre}` : ''"
    >
      <form
        id="formulario-salida"
        class="campos"
        @submit.prevent="confirmarSalida"
      >
        <HudSelector
          v-model="motivo"
          etiqueta="Motivo"
          :opciones="opcionesDe(MOTIVO_SALIDA)"
        />
        <HudCampo
          v-model="detalle"
          etiqueta="Detalle (opcional)"
          autocompletar="off"
        />
        <p class="texto-2">
          Sus bienes dejan de contar para el quórum hasta que vuelva.
        </p>
        <p
          v-if="registrarSalida.error.value"
          class="error"
          role="alert"
        >
          {{ registrarSalida.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="saliendo = null"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-salida"
          :cargando="registrarSalida.cargando.value"
        >
          Registrar salida
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="abiertoRotulo"
      :titulo="rotulando ? `Rótulo de ${rotulando.nombre}` : ''"
    >
      <div class="campos">
        <p class="texto-2">
          Lea el rótulo Code 128 que se le entrega (con el lector o la cámara) o escriba su código.
        </p>
        <LectorQr
          etiqueta="Código del rótulo"
          :formatos="['code_128']"
          ayuda="Pase el rótulo por el lector o escriba el código (ASM-0001) y presione Enter."
          :cargando="rotulo.cargando.value"
          @leido="guardarRotulo"
        />
        <p
          v-if="rotulo.error.value"
          class="error"
          role="alert"
        >
          {{ rotulo.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          v-if="rotulando?.rotulo"
          variante="fantasma"
          :cargando="rotulo.cargando.value"
          @click="guardarRotulo(null)"
        >
          Quitar el rótulo {{ rotulando.rotulo }}
        </HudBoton>
        <HudBoton
          variante="secundario"
          @click="rotulando = null"
        >
          Cerrar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="../vistas/asambleas.css"></style>

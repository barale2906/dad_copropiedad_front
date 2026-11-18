<script setup lang="ts">
/** Notas a los estados financieros del año: guardar con el mismo número crea una versión nueva. */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { NotaEstados } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { guardarNota, notas as pedirNotas } from '../../api'

const props = defineProps<{ entidadId: string; editable: boolean }>()

const entidad = useEntidad()
const actual = Number(hoyEn(entidad.zonaHoraria).slice(0, 4))
const anio = ref(String(actual))
const opcionesAnio = [actual + 1, actual, actual - 1, actual - 2].map((a) => ({ valor: String(a), etiqueta: String(a) }))
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<NotaEstados[]>([])
const resultado = ref<string | null>(null)
const numero = ref('')
const titulo = ref('')
const texto = ref('')
const siguiente = computed(() => String(Math.max(0, ...lista.value.map((n) => n.numero)) + 1))

const guardar = useAccion(() =>
  guardarNota(props.entidadId, { anio: Number(anio.value), numero: Number.parseInt(numero.value || siguiente.value, 10), titulo: titulo.value, texto: texto.value }),
)

function editar(n: NotaEstados) {
  numero.value = String(n.numero)
  titulo.value = n.titulo
  texto.value = n.texto
}

async function alGuardar() {
  const r = await guardar.ejecutar()
  if (!r.ok) return
  resultado.value = `Nota ${r.valor.numero} guardada (versión ${r.valor.version}).`
  numero.value = titulo.value = texto.value = ''
  await cargar()
}

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = (await pedirNotas(props.entidadId, Number(anio.value))).sort((a, b) => a.numero - b.numero)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(anio, cargar, { immediate: true })
</script>

<template>
  <div class="campos">
    <div class="filtros">
      <HudSelector
        v-model="anio"
        etiqueta="Año"
        :opciones="opcionesAnio"
      />
    </div>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <template v-else>
      <HudEstado
        v-if="!lista.length"
        estado="vacio"
        mensaje="No hay notas para este año."
      />
      <ol
        v-else
        class="lista"
        aria-label="Notas a los estados financieros"
      >
        <li
          v-for="n in lista"
          :key="n.id"
        >
          <span class="crece">
            <strong>Nota {{ n.numero }}. {{ n.titulo }} <small>(versión {{ n.version }})</small></strong>
            <span>{{ n.texto }}</span>
          </span>
          <HudBoton
            v-if="editable"
            variante="fantasma"
            @click="editar(n)"
          >
            Editar<span class="solo-lector"> la nota {{ n.numero }}</span>
          </HudBoton>
        </li>
      </ol>
      <form
        v-if="editable"
        class="campos"
        @submit.prevent="alGuardar"
      >
        <div class="filtros">
          <HudCampo
            v-model="numero"
            etiqueta="Número de la nota"
            modo-entrada="numeric"
            :ayuda="`Vacío: la siguiente (${siguiente}).`"
          />
          <HudCampo
            v-model="titulo"
            etiqueta="Título de la nota"
          />
        </div>
        <HudCampo
          v-model="texto"
          etiqueta="Texto de la nota"
          multilinea
        />
        <p
          v-if="guardar.error.value"
          class="error"
          role="alert"
        >
          {{ guardar.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="guardar.cargando.value"
          >
            Guardar la nota
          </HudBoton>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped src="../../vistas/contabilidad.css"></style>

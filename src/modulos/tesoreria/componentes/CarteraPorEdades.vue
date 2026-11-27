<script setup lang="ts">
/**
 * Saldos por tercero y tramo de edad a una fecha de corte, sobre `TablaEdades`. Sirve a la
 * cartera de clientes y a las cuentas por pagar: cambia de dónde salen las filas y los textos.
 */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { FilaCarteraClientes } from '@/api/tipos'
import { moneda, sumar } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import TablaEdades, { type FilaEdades } from '@/hud/componentes/TablaEdades.vue'
import { useEntidad } from '@/stores/entidad'
import { TRAMOS } from '../reglas'

const props = defineProps<{
  titulo: string
  /** Encabezado de la columna del tercero (`Cliente`, `Proveedor`). */
  tercero: string
  /** Mensaje cuando nadie tiene saldo. */
  vacio: string
  cargarFilas: (entidadId: string, corte: string) => Promise<FilaCarteraClientes[]>
}>()

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const corte = ref(hoyEn(entidad.zonaHoraria))
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<FilaCarteraClientes[]>([])

const filas = computed<FilaEdades[]>(() =>
  lista.value.map((f) => ({
    clave: f.persona_id,
    nombre: f.nombre,
    ...(Object.fromEntries(TRAMOS.map((t) => [t.id, f.tramos.find((x) => x.tramo === t.id)?.saldo ?? '0'])) as Omit<FilaEdades, 'clave' | 'nombre' | 'total'>),
    total: f.total,
  })),
)
const totalGeneral = computed(() => sumar('0', ...lista.value.map((f) => f.total)))
const vencido = computed(() => sumar('0', ...lista.value.flatMap((f) => f.tramos.filter((t) => t.tramo !== 'corriente').map((t) => t.saldo))))
const idTitulo = `titulo-${props.tercero.toLowerCase()}`

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await props.cargarFilas(id.value, corte.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(corte, cargar, { immediate: true })
</script>

<template>
  <section :aria-labelledby="idTitulo">
    <h1 :id="idTitulo">
      {{ titulo }}
    </h1>
    <div class="filtros">
      <HudFecha
        v-model="corte"
        etiqueta="Fecha de corte"
      />
    </div>
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
    <HudEstado
      v-else-if="!filas.length"
      estado="vacio"
      :mensaje="vacio"
    />
    <template v-else>
      <p class="texto-2 cifra">
        Total {{ moneda(totalGeneral) }} · vencido {{ moneda(vencido) }}
      </p>
      <TablaEdades
        :filas="filas"
        :titulo="`${titulo} por edades`"
        :encabezado="tercero"
      />
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

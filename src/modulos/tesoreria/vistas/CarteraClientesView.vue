<script setup lang="ts">
/** Cartera de clientes por edades (corriente, 1–30, 31–60, 61–90 y más de 90 días) a una fecha de corte. */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { FilaCarteraClientes } from '@/api/tipos'
import { moneda, sumar } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { carteraPorEdades } from '../api'
import { TRAMOS } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const corte = ref(hoyEn(entidad.zonaHoraria))
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<FilaCarteraClientes[]>([])

const filas = computed(() =>
  lista.value.map((f) => ({ ...f, ...Object.fromEntries(TRAMOS.map((t) => [t.id, f.tramos.find((x) => x.tramo === t.id)?.saldo ?? '0'])) }) as FilaCarteraClientes & Record<string, string>),
)
const COLUMNAS = [{ clave: 'nombre', titulo: 'Cliente' }, ...TRAMOS.map((t) => ({ clave: t.id, titulo: t.texto, alinear: 'fin' as const })), { clave: 'total', titulo: 'Total', alinear: 'fin' as const }]
const totalGeneral = computed(() => sumar('0', ...lista.value.map((f) => f.total)))
const vencido = computed(() => sumar('0', ...lista.value.flatMap((f) => f.tramos.filter((t) => t.tramo !== 'corriente').map((t) => t.saldo))))
const monto = (t: string) => (/^0(\.0+)?$/.test(t) ? '' : moneda(t))

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await carteraPorEdades(id.value, corte.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(corte, cargar, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-cartera">
    <h1 id="titulo-cartera">
      Cartera de clientes
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
      mensaje="Ningún cliente tiene saldo a esa fecha."
    />
    <template v-else>
      <p class="texto-2 cifra">
        Total {{ moneda(totalGeneral) }} · vencido {{ moneda(vencido) }}
      </p>
      <HudTabla
        :filas="filas"
        :columnas="COLUMNAS"
        clave="persona_id"
        titulo="Cartera por edades"
      >
        <template
          v-for="t in [...TRAMOS.map((x) => x.id), 'total']"
          :key="t"
          #[`celda-${t}`]="{ fila }"
        >
          <span class="cifra">{{ monto(String(fila[t] ?? '0')) }}</span>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="./tesoreria.css"></style>

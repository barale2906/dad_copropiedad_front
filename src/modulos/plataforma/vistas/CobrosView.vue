<script setup lang="ts">
/** Cobros de la plataforma: la bandeja de cortes, las suscripciones y el catálogo de productos. */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { Producto, Suscripcion } from '@/api/tipos'
import { usePestana } from '@/composables/usePestana'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { productos as pedirProductos, suscripciones as pedirSuscripciones } from '../api-cobros'
import CortesCobro from '../componentes/CortesCobro.vue'
import ProductosCobro from '../componentes/ProductosCobro.vue'
import SuscripcionesCobro from '../componentes/SuscripcionesCobro.vue'
import { useClientes, usePermisosPlataforma } from '../store'

const clientes = useClientes()
const { puede } = usePermisosPlataforma()
const TODAS = [
  { id: 'cortes', texto: 'Cortes' },
  { id: 'suscripciones', texto: 'Suscripciones' },
  { id: 'productos', texto: 'Productos' },
] as const
const comercial = computed(() => puede('plataforma.comercial.gestionar') || puede('plataforma.cobros.aprobar'))
const PESTANAS = computed(() => TODAS.filter((p) => (p.id === 'cortes' ? puede('plataforma.cobros.aprobar') || puede('plataforma.cobros.facturar') : comercial.value)))
const actual = usePestana(TODAS)
const pestana = computed(() => (PESTANAS.value.some((p) => p.id === actual.value) ? actual.value : PESTANAS.value[0]?.id))

const productos = ref<Producto[]>([])
const suscripciones = ref<Suscripcion[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)

async function cargar() {
  estado.value = 'cargando'
  try {
    ;[productos.value, suscripciones.value] = comercial.value ? await Promise.all([pedirProductos(), pedirSuscripciones()]) : [[], []]
    await clientes.asegurar()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-cobros">
    <header>
      <h1 id="titulo-cobros">
        Cobros
      </h1>
      <p class="texto-2">
        Lo que se cobra a cada entidad: productos con su tarifa, suscripciones y los cortes de cada periodo.
      </p>
    </header>
    <HudPestanas
      v-if="PESTANAS.length > 1"
      :pestanas="PESTANAS"
      etiqueta="Cobros de la plataforma"
    />
    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      :referencia="referencia"
      @reintentar="cargar()"
    />
    <template v-else>
      <CortesCobro
        v-if="pestana === 'cortes'"
        :suscripciones="suscripciones"
      />
      <SuscripcionesCobro
        v-else-if="pestana === 'suscripciones'"
        v-model="suscripciones"
        :productos="productos"
      />
      <ProductosCobro
        v-else-if="pestana === 'productos'"
        v-model="productos"
      />
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

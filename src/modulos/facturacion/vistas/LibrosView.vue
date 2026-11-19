<script setup lang="ts">
/**
 * Para el contador externo: libro de ventas y libro de compras (CSV) y el paquete con el XML y el
 * PDF de cada documento del periodo (ZIP). Cada descarga queda en la auditoría con su huella
 * SHA-256, que se muestra para verificar el archivo.
 */
import { computed, ref } from 'vue'
import type { Descarga } from '@/api/archivos'
import { useAccion } from '@/composables/useAccion'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import IDescargar from '~icons/tabler/download'
import { libroCompras, libroVentas, type Periodo, paquetePeriodo } from '../api'

type Tipo = 'ventas' | 'compras' | 'paquete'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const periodo = ref<Periodo>({ desde: `${hoy.slice(0, 8)}01`, hasta: hoy })
const descargas = ref<(Descarga & { tipo: Tipo })[]>([])
const errorPeriodo = computed(() => (periodo.value.hasta < periodo.value.desde ? 'La fecha final es anterior a la inicial.' : null))

const ARCHIVOS: { tipo: Tipo; texto: string; ayuda: string }[] = [
  { tipo: 'ventas', texto: 'Libro de ventas (CSV)', ayuda: 'Número interno, número y CUFE de la DIAN, cliente y valores.' },
  { tipo: 'compras', texto: 'Libro de compras (CSV)', ayuda: 'Facturas electrónicas recibidas.' },
  { tipo: 'paquete', texto: 'Paquete del periodo (ZIP)', ayuda: 'El XML y el PDF de cada documento transmitido.' },
]
const PEDIR: Record<Tipo, (id: string, p: Periodo) => Promise<Descarga>> = { ventas: libroVentas, compras: libroCompras, paquete: paquetePeriodo }

const descargar = useAccion((_c, tipo: Tipo) => PEDIR[tipo](id.value, { ...periodo.value }))

async function alDescargar(tipo: Tipo) {
  if (errorPeriodo.value) return
  const r = await descargar.ejecutar(tipo)
  if (r.ok) descargas.value = [{ ...r.valor, tipo }, ...descargas.value]
}
</script>

<template>
  <section aria-labelledby="titulo-libros">
    <header>
      <h1 id="titulo-libros">
        Libros y paquete para el contador
      </h1>
      <p class="texto-2">
        Elija el periodo y descargue lo que necesite. Cada archivo trae su huella para verificar que no cambió.
      </p>
    </header>
    <div class="filtros">
      <HudFecha
        v-model="periodo.desde"
        etiqueta="Desde"
        :maximo="periodo.hasta || undefined"
      />
      <HudFecha
        v-model="periodo.hasta"
        etiqueta="Hasta"
        :minimo="periodo.desde || undefined"
      />
    </div>
    <p
      v-if="errorPeriodo"
      class="error"
      role="alert"
    >
      {{ errorPeriodo }}
    </p>
    <ul
      class="lista"
      aria-label="Archivos para el contador"
    >
      <li
        v-for="a in ARCHIVOS"
        :key="a.tipo"
      >
        <span class="crece">
          <strong>{{ a.texto }}</strong>
          <small>{{ a.ayuda }}</small>
        </span>
        <HudBoton
          variante="secundario"
          :cargando="descargar.cargando.value"
          @click="alDescargar(a.tipo)"
        >
          <IDescargar aria-hidden="true" /> Descargar<span class="solo-lector"> {{ a.texto }}</span>
        </HudBoton>
      </li>
    </ul>
    <p
      v-if="descargar.error.value"
      class="error"
      role="alert"
    >
      {{ descargar.error.value }}
    </p>
    <HudPanel
      v-if="descargas.length"
      etiqueta="Descargado en esta sesión"
    >
      <ul
        class="lista"
        aria-label="Descargas con su huella"
        role="status"
      >
        <li
          v-for="(d, i) in descargas"
          :key="i"
        >
          <span class="crece">
            <strong>{{ d.nombre }}</strong>
            <small class="huella">SHA-256 {{ d.sha256 ?? 'no informado' }}</small>
          </span>
        </li>
      </ul>
    </HudPanel>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.huella {
  font-family: var(--fuente-mono);
  overflow-wrap: anywhere;
}
</style>

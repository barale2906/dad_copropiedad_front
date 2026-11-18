<script setup lang="ts">
/**
 * Tablero de la administración: PQRS pendientes y vencidas, mantenimiento (cumplimiento y
 * órdenes atrasadas), alertas de obligaciones, garantías y censo. Cada tarjeta se carga sola y
 * solo si la cuenta tiene el permiso; una que falle no tumba las demás.
 */
import { computed, onMounted, type Ref, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { AlertasCenso, AlertasMantenimiento, TableroMantenimiento, TableroTickets } from '@/api/tipos'
import { porcentaje } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import { useEntidad } from '@/stores/entidad'
import { alertasCenso, alertasMantenimiento, tableroMantenimiento, tableroTickets } from '../api'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const ruta = (accion: string, query: Record<string, string> = {}) => ({ name: 'modulo', params: { ...route.params, accion, id: '' }, query })

interface Carga<T> {
  estado: 'cargando' | 'listo' | 'error' | 'sin_permiso'
  datos: T | null
  error: string | null
}
const nueva = <T,>(): Carga<T> => ({ estado: 'cargando', datos: null, error: null })

const tickets: Ref<Carga<TableroTickets>> = ref(nueva())
const mant: Ref<Carga<TableroMantenimiento>> = ref(nueva())
const alertas: Ref<Carga<AlertasMantenimiento>> = ref(nueva())
const censo: Ref<Carga<AlertasCenso>> = ref(nueva())

const pendientes = computed(() => (tickets.value.datos?.pendientes_por_estado ?? []).reduce((s, c) => s + c.cantidad, 0))
const textoCarga = (c: Carga<unknown>) => (c.estado === 'error' ? 'No se pudo cargar' : undefined)

async function cargar<T>(destino: Ref<Carga<T>>, permitido: boolean, fn: () => Promise<T>) {
  if (!permitido) {
    destino.value = { estado: 'sin_permiso', datos: null, error: null }
    return
  }
  try {
    const datos = await fn()
    destino.value = { estado: 'listo', datos, error: null }
  } catch (e) {
    destino.value = { estado: 'error', datos: null, error: mensajeDeError(e) }
  }
}

onMounted(() => {
  const puedeMant = entidad.tienePermiso('mantenimiento.planificar') || entidad.tienePermiso('inventario.ver')
  void cargar(tickets, entidad.tienePermiso('tickets.ver_todos'), () => tableroTickets(id.value))
  void cargar(mant, puedeMant, () => tableroMantenimiento(id.value))
  void cargar(alertas, puedeMant, () => alertasMantenimiento(id.value))
  void cargar(censo, entidad.tienePermiso('censo.ver'), () => alertasCenso(id.value))
})
</script>

<template>
  <section aria-labelledby="titulo-tablero">
    <h1 id="titulo-tablero">
      Tablero de la administración
    </h1>

    <ul
      class="tarjetas"
      aria-label="Resumen"
    >
      <template v-if="tickets.estado !== 'sin_permiso'">
        <li>
          <TarjetaResumen
            titulo="PQRS pendientes"
            :valor="tickets.datos ? String(pendientes) : textoCarga(tickets)"
            :detalle="tickets.datos?.satisfaccion_promedio ? `Satisfacción ${tickets.datos.satisfaccion_promedio.toFixed(1)} de 5` : 'Por atender'"
            :cargando="tickets.estado === 'cargando'"
            tono="info"
            :a="ruta('tickets')"
          />
        </li>
        <li>
          <TarjetaResumen
            titulo="PQRS vencidas"
            :valor="tickets.datos ? String(tickets.datos.vencidos) : textoCarga(tickets)"
            :detalle="tickets.datos?.vencidos ? 'Atiéndalas primero' : 'Al día'"
            :tono="tickets.datos?.vencidos ? 'peligro' : 'exito'"
            :cargando="tickets.estado === 'cargando'"
            :a="ruta('tickets', { vencidos: '1' })"
          />
        </li>
      </template>
      <template v-if="mant.estado !== 'sin_permiso'">
        <li>
          <TarjetaResumen
            titulo="Preventivo cumplido"
            :valor="mant.datos?.cumplimiento_porcentaje ? porcentaje(mant.datos.cumplimiento_porcentaje, 0) : textoCarga(mant) ?? '—'"
            :detalle="mant.datos ? `${mant.datos.preventivas_cumplidas} de ${mant.datos.preventivas_programadas} este periodo` : undefined"
            :cargando="mant.estado === 'cargando'"
            tono="info"
            :a="ruta('mantenimiento')"
          />
        </li>
        <li>
          <TarjetaResumen
            titulo="Órdenes atrasadas"
            :valor="mant.datos ? String(mant.datos.ordenes_vencidas) : textoCarga(mant)"
            :detalle="mant.datos?.ordenes_vencidas ? 'Reprograme o ejecute' : 'Al día'"
            :tono="mant.datos?.ordenes_vencidas ? 'aviso' : 'exito'"
            :cargando="mant.estado === 'cargando'"
            :a="ruta('mantenimiento', { vista: 'ordenes' })"
          />
        </li>
      </template>
    </ul>

    <HudPanel
      v-if="alertas.datos && (alertas.datos.obligaciones.length || alertas.datos.garantias.length)"
      etiqueta="Alertas de mantenimiento"
      resaltado
    >
      <ul
        class="lista"
        aria-label="Alertas de mantenimiento"
      >
        <li
          v-for="o in alertas.datos.obligaciones"
          :key="o.id"
        >
          <span class="crece">
            <strong>{{ o.nombre }}</strong>
            <small>Próxima: {{ fechaCalendario(o.proxima) }}</small>
          </span>
        </li>
        <li
          v-for="a in alertas.datos.garantias"
          :key="a.id"
        >
          <span class="crece">
            <strong>Garantía de {{ a.nombre }}</strong>
            <small v-if="a.garantia_vence">Vence el {{ fechaCalendario(a.garantia_vence) }}</small>
          </span>
        </li>
      </ul>
    </HudPanel>

    <HudPanel
      v-if="censo.datos && (censo.datos.mascotas.length || censo.datos.residentes_sin_autorizacion.length)"
      etiqueta="Alertas del censo"
    >
      <ul
        class="lista"
        aria-label="Alertas del censo"
      >
        <li v-if="censo.datos.mascotas.length">
          {{ censo.datos.mascotas.length }} mascota(s) con vacunas vencidas o por vencer
        </li>
        <li v-if="censo.datos.residentes_sin_autorizacion.length">
          {{ censo.datos.residentes_sin_autorizacion.length }} residente(s) sin autorización de datos
        </li>
      </ul>
    </HudPanel>

    <p
      v-for="c in [tickets, mant, alertas, censo].filter((x) => x.error)"
      :key="c.error ?? ''"
      class="error"
      role="alert"
    >
      {{ c.error }}
    </p>
  </section>
</template>

<style scoped src="./administracion.css"></style>

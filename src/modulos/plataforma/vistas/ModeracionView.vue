<script setup lang="ts">
/**
 * Moderación del directorio y la publicidad: piezas por aprobar, campañas en revisión (con el
 * conflicto de interés marcado), reseñas reportadas y piezas reportadas. **Cuatro ojos**: quien
 * cargó o editó algo no lo puede moderar (409 `conflicto`).
 */
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { usePestana } from '@/composables/usePestana'
import { FORMATO_PIEZA } from '@/composables/textos-publicidad'
import { moneda } from '@/formato/decimales'
import { fecha, fechaCalendario } from '@/formato/fechas'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import {
  atenderReportes,
  campanasEnRevision,
  creativosPendientes,
  creativosReportados,
  decidirCampana,
  decidirCreativo,
  moderarResena,
  resenasReportadas,
} from '../api-publicidad'
import ColaModeracion, { type ElementoModeracion } from '../componentes/ColaModeracion.vue'
import { MODELO_COBRO, OBJETIVO_CAMPANA } from '../reglas'

const entidad = useEntidad()
const PESTANAS = [
  { id: 'piezas', texto: 'Piezas' },
  { id: 'campanas', texto: 'Campañas' },
  { id: 'resenas', texto: 'Reseñas reportadas' },
  { id: 'reportes', texto: 'Piezas reportadas' },
] as const
const pestana = usePestana(PESTANAS)
const cola = useTemplateRef<InstanceType<typeof ColaModeracion>>('cola')
const procesando = ref<string | null>(null)
const resultado = ref<string | null>(null)

const listados = {
  piezas: useListado((d) => creativosPendientes(d), { inmediato: false }),
  campanas: useListado((d) => campanasEnRevision(d), { inmediato: false }),
  resenas: useListado((d) => resenasReportadas(d), { inmediato: false }),
  reportes: useListado((d) => creativosReportados(d), { inmediato: false }),
}
const listado = computed(() => listados[pestana.value])
const cargados = new Set<string>()

const elementos = computed<ElementoModeracion[]>(() => {
  const z = entidad.zonaHoraria
  switch (pestana.value) {
    case 'piezas':
      return listados.piezas.filas.value.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        texto: c.texto,
        detalles: [FORMATO_PIEZA[c.formato], c.condiciones ? `Condiciones: ${c.condiciones}` : '', c.enlace ? `Enlace: ${c.enlace}` : '', c.cupon_codigo ? `Cupón ${c.cupon_codigo}` : ''].filter(Boolean),
        insignias: c.es_promocion ? [{ texto: 'Promoción', tono: 'aviso' as const }] : [],
      }))
    case 'campanas':
      return listados.campanas.filas.value.map((c) => ({
        id: c.id,
        titulo: c.nombre,
        detalles: [
          OBJETIVO_CAMPANA[c.objetivo],
          MODELO_COBRO[c.modelo],
          `Presupuesto ${moneda(c.presupuesto_total, 0)}`,
          `Del ${fechaCalendario(c.inicio.slice(0, 10))} al ${fechaCalendario(c.fin.slice(0, 10))}`,
        ],
        insignias: c.conflicto_interes ? [{ texto: 'Conflicto de interés', tono: 'peligro' as const }] : [],
      }))
    case 'resenas':
      return listados.resenas.filas.value.map((r) => ({
        id: r.resena_id,
        titulo: `${r.nombre_comercial} · ${r.calificacion} de 5`,
        texto: r.texto,
        detalles: [r.copropiedad, `Escrita el ${fecha(r.creada_en, z)}`, ...r.motivos.map((m) => `Reporte: ${m}`)],
        insignias: [{ texto: `${r.reportes} ${r.reportes === 1 ? 'reporte' : 'reportes'}`, tono: 'aviso' as const }],
      }))
    case 'reportes':
      return listados.reportes.filas.value.map((r) => ({
        id: r.creativo_id,
        titulo: `${r.nombre_comercial} · ${r.titulo}`,
        detalles: [`Primer reporte el ${fecha(r.primero_en, z)}`, ...r.motivos.map((m) => `Reporte: ${m}`)],
        insignias: [{ texto: `${r.reportes} ${r.reportes === 1 ? 'reporte' : 'reportes'}`, tono: 'aviso' as const }],
      }))
  }
  return []
})

const TEXTOS = {
  piezas: { aprobar: 'Aprobar', rechazar: 'Rechazar', descripcion: 'El equipo verá el motivo para corregir la pieza.' },
  campanas: { aprobar: 'Aprobar', rechazar: 'Rechazar', descripcion: 'Al aprobarla se fija la tarifa vigente. Diga por qué la rechaza.' },
  resenas: { aprobar: 'Mantener', rechazar: 'Ocultar', descripcion: 'La reseña deja de verse en el directorio. Escriba el motivo.' },
  reportes: { aprobar: 'Mantener', rechazar: 'Retirar pieza', descripcion: 'La pieza deja de entregarse. Escriba el motivo.' },
} as const
const textos = computed(() => TEXTOS[pestana.value])

const decidir = useAccion(async (_clave, id: string, aprobar: boolean, motivo: string | null) => {
  switch (pestana.value) {
    case 'piezas':
      await decidirCreativo(id, aprobar, motivo)
      break
    case 'campanas':
      await decidirCampana(id, aprobar, motivo)
      break
    case 'resenas': {
      const r = listados.resenas.filas.value.find((x) => x.resena_id === id)
      await moderarResena(id, r?.copropiedad_id ?? '', !aprobar, motivo)
      break
    }
    case 'reportes':
      await atenderReportes(id, !aprobar, motivo)
  }
})
const error = computed(() =>
  decidir.codigo.value === 'conflicto'
    ? 'Usted cargó o editó esto: debe moderarlo otra cuenta (cuatro ojos).'
    : decidir.error.value,
)

async function ejecutar(id: string, aprobar: boolean, motivo: string | null) {
  procesando.value = id
  resultado.value = null
  decidir.reiniciar()
  const r = await decidir.ejecutar(id, aprobar, motivo)
  procesando.value = null
  if (!r.ok) return
  cola.value?.cerrar()
  resultado.value = aprobar ? `${textos.value.aprobar}: listo.` : `${textos.value.rechazar}: listo.`
  await listado.value.recargar()
}

/** Cada cola se pide la primera vez que se abre su pestaña. */
function asegurar() {
  if (cargados.has(pestana.value)) return
  cargados.add(pestana.value)
  void listado.value.recargar()
}

watch(pestana, asegurar, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-moderacion">
    <header>
      <h1 id="titulo-moderacion">
        Moderación
      </h1>
      <p class="texto-2">
        Lo que cargó o editó otra persona del equipo. Lo suyo lo modera otra cuenta.
      </p>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Colas de moderación"
    />
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudEstado
      v-if="listado.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="listado.estado.value === 'error'"
      estado="error"
      :mensaje="listado.error.value ?? undefined"
      :referencia="listado.referencia.value"
      @reintentar="listado.recargar()"
    />
    <HudEstado
      v-else-if="listado.estado.value === 'vacio'"
      estado="vacio"
      mensaje="No hay nada por moderar en esta cola."
    />
    <template v-else>
      <ColaModeracion
        ref="cola"
        :elementos="elementos"
        :texto-aprobar="textos.aprobar"
        :texto-rechazar="textos.rechazar"
        :descripcion-rechazo="textos.descripcion"
        :procesando="procesando"
        :error="error"
        @aprobar="(id) => ejecutar(id, true, null)"
        @rechazar="(id, motivo) => ejecutar(id, false, motivo)"
      />
      <HudCargarMas
        :hay-mas="listado.hayMas.value"
        :cargando="listado.cargando.value"
        @cargar="listado.cargarMas()"
      />
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

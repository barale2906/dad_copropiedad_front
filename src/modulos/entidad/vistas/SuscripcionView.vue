<script setup lang="ts">
/**
 * Mi suscripción: el plan de la entidad con la plataforma (productos contratados), el consumo
 * del periodo en curso y sus facturas (cortes aprobados, facturados y pagados). Solo lectura.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { miSuscripcion, type SuscripcionDeLaEntidad } from '../api'
import { corteVencido, ESTADO_CORTE, ESTADO_SUSCRIPCION, finDePrueba, textoCiclo, ultimoDia } from '../suscripcion'

const entidad = useEntidad()

const estado = ref<'cargando' | 'listo' | 'vacio' | 'error'>('cargando')
const error = ref<string | null>(null)
const datos = ref<SuscripcionDeLaEntidad | null>(null)

const hoy = computed(() => hoyEn(entidad.zonaHoraria))
const prueba = computed(() => {
  const s = datos.value?.suscripcion
  const fin = s ? finDePrueba(s) : null
  return fin && fin > hoy.value ? fin : null
})

const COLUMNAS_LINEAS = [
  { clave: 'nombre', titulo: 'Producto' },
  { clave: 'precio', titulo: 'Precio', alinear: 'fin' as const },
  { clave: 'vigencia', titulo: 'Vigencia' },
]
const COLUMNAS_CORTES = [
  { clave: 'periodo', titulo: 'Periodo' },
  { clave: 'total', titulo: 'Total (antes de IVA)', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'vencimiento', titulo: 'Vence' },
]

async function cargar() {
  estado.value = 'cargando'
  try {
    datos.value = await miSuscripcion(entidad.activa?.entidad_id ?? '')
    estado.value = datos.value ? 'listo' : 'vacio'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section
    class="suscripcion"
    aria-labelledby="titulo-suscripcion"
  >
    <header>
      <h1 id="titulo-suscripcion">
        Mi suscripción
      </h1>
      <p class="texto-2">
        Su plan con DAD, el consumo de este periodo y sus facturas.
      </p>
    </header>

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
      v-else-if="estado === 'vacio'"
      estado="vacio"
      mensaje="La entidad aún no tiene una suscripción registrada con DAD."
    />
    <template v-else-if="datos">
      <p
        v-if="datos.suscripcion.suspendida_por_mora"
        class="alerta"
        role="alert"
      >
        La entidad está suspendida por facturas vencidas. Se reactiva al registrar el pago.
      </p>

      <HudPanel etiqueta="Plan">
        <dl class="datos">
          <div>
            <dt>Estado</dt>
            <dd>
              <HudInsignia :tono="ESTADO_SUSCRIPCION[datos.suscripcion.estado].tono">
                {{ ESTADO_SUSCRIPCION[datos.suscripcion.estado].texto }}
              </HudInsignia>
            </dd>
          </div>
          <div>
            <dt>Cobro</dt>
            <dd>{{ textoCiclo(datos.suscripcion.ciclo_meses) }}</dd>
          </div>
          <div>
            <dt>Desde</dt>
            <dd>{{ fechaCalendario(datos.suscripcion.inicio) }}</dd>
          </div>
          <div v-if="prueba">
            <dt>Prueba gratuita hasta</dt>
            <dd>{{ fechaCalendario(ultimoDia(prueba)) }}</dd>
          </div>
          <div>
            <dt>Plazo para pagar</dt>
            <dd>{{ datos.suscripcion.plazo_pago_dias }} días</dd>
          </div>
          <div>
            <dt>Las facturas llegan a</dt>
            <dd>{{ datos.suscripcion.correo_facturacion }}</dd>
          </div>
        </dl>
      </HudPanel>

      <HudPanel etiqueta="Productos contratados">
        <p
          v-if="datos.lineas.length === 0"
          class="texto-2"
        >
          Sin productos contratados.
        </p>
        <HudTabla
          v-else
          :filas="datos.lineas"
          :columnas="COLUMNAS_LINEAS"
          clave="id"
          titulo="Productos contratados"
        >
          <template #celda-precio="{ fila }">
            {{ fila.precio_pactado ? moneda(fila.precio_pactado) : 'Tarifa vigente' }}
          </template>
          <template #celda-vigencia="{ fila }">
            {{ fechaCalendario(fila.desde) }}{{ fila.hasta ? ` – ${fechaCalendario(ultimoDia(fila.hasta))}` : ' en adelante' }}
          </template>
        </HudTabla>
      </HudPanel>

      <HudPanel etiqueta="Consumo del periodo">
        <p
          v-if="datos.consumo.length === 0"
          class="texto-2"
        >
          Sin consumo registrado en este periodo.
        </p>
        <dl
          v-else
          class="datos"
        >
          <div
            v-for="c in datos.consumo"
            :key="c.metrica"
          >
            <dt>{{ c.metrica }}</dt>
            <dd>{{ c.cantidad.toLocaleString('es-CO') }}</dd>
          </div>
        </dl>
      </HudPanel>

      <HudPanel etiqueta="Facturas">
        <p
          v-if="datos.cortes.length === 0"
          class="texto-2"
        >
          Aún no hay facturas.
        </p>
        <HudTabla
          v-else
          :filas="datos.cortes"
          :columnas="COLUMNAS_CORTES"
          clave="id"
          titulo="Facturas de la suscripción"
        >
          <template #celda-periodo="{ fila }">
            {{ fechaCalendario(fila.periodo_desde) }} – {{ fechaCalendario(ultimoDia(fila.periodo_hasta)) }}
          </template>
          <template #celda-total="{ fila }">
            {{ moneda(fila.total) }}
          </template>
          <template #celda-estado="{ fila }">
            <HudInsignia :tono="corteVencido(fila, hoy) ? 'peligro' : ESTADO_CORTE[fila.estado].tono">
              {{ corteVencido(fila, hoy) ? 'Vencida' : ESTADO_CORTE[fila.estado].texto }}
            </HudInsignia>
          </template>
          <template #celda-vencimiento="{ fila }">
            {{ fila.vencimiento ? fechaCalendario(fila.vencimiento) : '—' }}
          </template>
        </HudTabla>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped>
.suscripcion {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(26px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.datos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px 20px;
  margin: 0;
}

.datos dt {
  color: var(--texto-3);
  font-size: 13px;
}

.datos dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.alerta {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--magenta);
  background: color-mix(in srgb, var(--magenta) 10%, transparent);
}
</style>

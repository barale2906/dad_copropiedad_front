<script setup lang="ts">
/**
 * Una campaña: datos, ciclo (enviar a revisión, activar, pausar, finalizar), edición mientras es
 * borrador o fue rechazada, sus piezas (cada una pasa por moderación) y las métricas por día.
 */
import { computed, ref, watch } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { Creativo, DetalleCampana, MetricasCampana, NuevaCampana, NuevoCreativo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { FORMATO_PIEZA } from '@/composables/textos-publicidad'
import { moneda, numero } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { accionCampana, campana, crearCreativo, editarCampana, editarCreativo, metricasCampana } from '../api-publicidad'
import { accionesCampana, campanaEditable, ESTADO_CAMPANA, ESTADO_CREATIVO, MODELO_COBRO, OBJETIVO_CAMPANA } from '../reglas'
import FormularioCampana from './FormularioCampana.vue'
import FormularioCreativo from './FormularioCreativo.vue'

const props = defineProps<{ comercioId: string; campanaId: string; categorias: { valor: string; etiqueta: string }[] }>()
const emit = defineEmits<{ cambio: [] }>()

const detalle = ref<DetalleCampana | null>(null)
const metricas = ref<MetricasCampana | null>(null)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const editando = ref(false)
const pieza = ref<Creativo | null>(null)
const abrirPieza = ref(false)
const resultado = ref<string | null>(null)

const c = computed(() => detalle.value?.campana ?? null)
const acciones = computed(() => (c.value ? accionesCampana(c.value.estado) : []))
const COLUMNAS = [
  { clave: 'dia', titulo: 'Día' },
  { clave: 'canal', titulo: 'Canal' },
  { clave: 'impresiones', titulo: 'Impresiones', alinear: 'fin' as const },
  { clave: 'clics', titulo: 'Clics', alinear: 'fin' as const },
  { clave: 'costo', titulo: 'Costo', alinear: 'fin' as const },
]
const CANAL = { app: 'App y web', pantalla: 'Pantalla del lobby', whatsapp: 'WhatsApp', correo: 'Correo' } as const
const dias = computed(() => (metricas.value?.dias ?? []).map((d) => ({ ...d, id: `${d.dia}-${d.canal}` })))

const ciclo = useAccion((_clave, accion: string) => accionCampana(props.comercioId, props.campanaId, accion), {
  alExito: (x) => {
    if (detalle.value) detalle.value = { ...detalle.value, campana: x }
    resultado.value = `La campaña quedó ${ESTADO_CAMPANA[x.estado].texto.toLowerCase()}.`
    emit('cambio')
  },
})
const guardar = useAccion((_clave, datos: NuevaCampana) => editarCampana(props.comercioId, props.campanaId, datos))
const guardarPieza = useAccion((clave, datos: NuevoCreativo) =>
  pieza.value ? editarCreativo(props.comercioId, props.campanaId, pieza.value.id, datos) : crearCreativo(props.comercioId, props.campanaId, datos, clave),
)

async function cargar() {
  estado.value = 'cargando'
  try {
    ;[detalle.value, metricas.value] = await Promise.all([
      campana(props.comercioId, props.campanaId),
      metricasCampana(props.comercioId, props.campanaId).catch(() => null),
    ])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

async function enviarCampana(datos: NuevaCampana) {
  const r = await guardar.ejecutar(datos)
  if (!r.ok || !detalle.value) return
  detalle.value = { ...detalle.value, campana: r.valor }
  editando.value = false
  resultado.value = 'Campaña guardada.'
  emit('cambio')
}

function editarPieza(x: Creativo | null) {
  guardarPieza.reiniciar()
  pieza.value = x
  abrirPieza.value = true
}

async function enviarPieza(datos: NuevoCreativo) {
  const r = await guardarPieza.ejecutar(datos)
  if (!r.ok || !detalle.value) return
  const creativos = detalle.value.creativos.filter((x) => x.id !== r.valor.id)
  detalle.value = { ...detalle.value, creativos: [...creativos, r.valor] }
  abrirPieza.value = false
  resultado.value = 'Pieza guardada: queda por moderar.'
}

function abrirEdicion() {
  guardar.reiniciar()
  editando.value = true
}

watch(() => props.campanaId, cargar, { immediate: true })
</script>

<template>
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
  <HudPanel
    v-else-if="c && detalle"
    :etiqueta="`Campaña ${c.nombre}`"
  >
    <div class="campos">
      <header class="encabezado">
        <div>
          <h3>{{ c.nombre }}</h3>
          <p class="texto-2">
            {{ OBJETIVO_CAMPANA[c.objetivo] }} · {{ MODELO_COBRO[c.modelo] }} · del {{ fechaCalendario(c.inicio.slice(0, 10)) }} al
            {{ fechaCalendario(c.fin.slice(0, 10)) }}
          </p>
        </div>
        <span class="botones">
          <HudInsignia
            v-if="c.conflicto_interes"
            tono="peligro"
          >Conflicto de interés</HudInsignia>
          <HudInsignia :tono="ESTADO_CAMPANA[c.estado].tono">{{ ESTADO_CAMPANA[c.estado].texto }}</HudInsignia>
        </span>
      </header>
      <p
        v-if="c.motivo_estado"
        class="aviso"
      >
        {{ c.motivo_estado }}
      </p>
      <dl class="datos">
        <div>
          <dt>Presupuesto</dt>
          <dd class="cifra">
            {{ moneda(c.presupuesto_total, 0) }}
          </dd>
        </div>
        <div>
          <dt>Consumido</dt>
          <dd class="cifra">
            {{ moneda(c.consumido, 0) }}
          </dd>
        </div>
        <div v-if="c.tarifa">
          <dt>Tarifa fijada</dt>
          <dd class="cifra">
            {{ moneda(c.tarifa, 2) }}
          </dd>
        </div>
        <div v-if="metricas">
          <dt>Alcance hoy</dt>
          <dd>{{ numero(String(metricas.alcance), 0) }} entidades</dd>
        </div>
      </dl>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <div class="botones">
        <HudBoton
          v-for="a in acciones"
          :key="a.accion"
          :variante="a.accion === 'finalizar' ? 'fantasma' : 'secundario'"
          :cargando="ciclo.cargando.value"
          @click="ciclo.ejecutar(a.accion)"
        >
          {{ a.texto }}
        </HudBoton>
        <HudBoton
          v-if="campanaEditable(c.estado)"
          variante="fantasma"
          @click="abrirEdicion"
        >
          Editar campaña
        </HudBoton>
      </div>
      <p
        v-if="ciclo.error.value"
        class="error"
        role="alert"
      >
        {{ ciclo.error.value }}
      </p>

      <h4>Piezas</h4>
      <p
        v-if="detalle.creativos.length === 0"
        class="texto-2"
      >
        La campaña aún no tiene piezas.
      </p>
      <ul
        v-else
        class="lista"
      >
        <li
          v-for="x in detalle.creativos"
          :key="x.id"
        >
          <span class="crece">
            <strong>{{ x.titulo }}</strong>
            <small>{{ FORMATO_PIEZA[x.formato] }}<template v-if="x.cupon_codigo"> · cupón {{ x.cupon_codigo }} ({{ x.cupon_usos }} usos)</template></small>
            <small v-if="x.motivo_estado">{{ x.motivo_estado }}</small>
          </span>
          <HudInsignia :tono="ESTADO_CREATIVO[x.estado].tono">
            {{ ESTADO_CREATIVO[x.estado].texto }}
          </HudInsignia>
          <HudBoton
            variante="fantasma"
            @click="editarPieza(x)"
          >
            Editar<span class="solo-lector"> la pieza {{ x.titulo }}</span>
          </HudBoton>
        </li>
      </ul>
      <div>
        <HudBoton
          variante="secundario"
          @click="editarPieza(null)"
        >
          Agregar pieza
        </HudBoton>
      </div>

      <template v-if="metricas">
        <h4>Métricas</h4>
        <dl class="datos">
          <div>
            <dt>Impresiones</dt>
            <dd>{{ numero(String(metricas.impresiones), 0) }}</dd>
          </div>
          <div>
            <dt>Clics</dt>
            <dd>{{ numero(String(metricas.clics), 0) }}</dd>
          </div>
          <div>
            <dt>Cupones redimidos</dt>
            <dd>{{ numero(String(metricas.redenciones), 0) }}</dd>
          </div>
        </dl>
        <HudTabla
          v-if="dias.length"
          :filas="dias"
          :columnas="COLUMNAS"
          clave="id"
          titulo="Métricas por día"
        >
          <template #celda-dia="{ fila }">
            {{ fechaCalendario(fila.dia.slice(0, 10)) }}
          </template>
          <template #celda-canal="{ fila }">
            {{ CANAL[fila.canal] }}
          </template>
          <template #celda-costo="{ fila }">
            <span class="cifra">{{ moneda(fila.costo, 0) }}</span>
          </template>
        </HudTabla>
      </template>
    </div>
    <FormularioCampana
      v-model:abierto="editando"
      :campana="c"
      :categorias="categorias"
      :cargando="guardar.cargando.value"
      :error="guardar.error.value"
      @enviar="enviarCampana"
    />
    <FormularioCreativo
      v-model:abierto="abrirPieza"
      :creativo="pieza"
      :cargando="guardarPieza.cargando.value"
      :error="guardarPieza.error.value"
      @enviar="enviarPieza"
    />
  </HudPanel>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
h3 {
  margin: 0;
  font-size: 20px;
}

h4 {
  margin: 6px 0 0;
  font-size: 17px;
}
</style>

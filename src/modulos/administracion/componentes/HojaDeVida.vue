<script setup lang="ts">
/**
 * Hoja de vida de un activo: datos, estado, archivos (manual, garantía…), movimientos,
 * órdenes de trabajo y costo acumulado. La baja es **definitiva** y exige soporte.
 */
import { computed, onMounted, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { EstadoActivo, HojaDeVida, TipoArchivoActivo, TipoMovimiento } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { adjuntarArchivoActivo, editarActivo, hojaDeVida, registrarMovimiento } from '../api'
import { CLASE_ACTIVO, ESTADO_ACTIVO, ESTADO_ORDEN, ESTADOS_EDITABLES, pideDestino, TIPO_ARCHIVO_ACTIVO, TIPO_MOVIMIENTO } from '../reglas'

const props = defineProps<{ entidadId: string; activoId: string; orden: (ordenId: string) => RouteLocationRaw }>()

const entidad = useEntidad()
const zona = computed(() => entidad.zonaHoraria)
const puedeEditar = computed(() => entidad.tienePermiso('inventario.editar') && hoja.value?.activo.estado !== 'dado_de_baja')
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const hoja = ref<HojaDeVida | null>(null)
const resultado = ref<string | null>(null)
const a = computed(() => hoja.value?.activo ?? null)

// Estado
const nuevoEstado = ref<EstadoActivo | ''>('')
const opcionesEstado = ESTADOS_EDITABLES.map((valor) => ({ valor, etiqueta: ESTADO_ACTIVO[valor].texto }))
const cambiarEstado = useAccion(() => editarActivo(props.entidadId, props.activoId, { estado: nuevoEstado.value || undefined }))

// Archivos
const tipoArchivo = ref<TipoArchivoActivo>('manual')
const archivos = useAdjuntos(() => props.entidadId, 'interno')
const adjuntar = useAccion((_c, archivo: string) => adjuntarArchivoActivo(props.entidadId, props.activoId, archivo, tipoArchivo.value))

// Movimientos
const moviendo = ref(false)
const tipoMovimiento = ref<TipoMovimiento>('traslado')
const destino = ref('')
const observacion = ref('')
const soporte = useAdjuntos(() => props.entidadId, 'interno')
const errorMovimiento = ref<string | null>(null)
const opcionesMovimiento = opcionesDe(TIPO_MOVIMIENTO)
const mover = useAccion((clave) =>
  registrarMovimiento(
    props.entidadId,
    props.activoId,
    {
      tipo: tipoMovimiento.value,
      ubicacion_destino: destino.value.trim() || null,
      observacion: observacion.value.trim() || null,
      soporte_archivo_id: soporte.ids()[0] ?? null,
    },
    clave,
  ),
)

async function guardarEstado() {
  if (!nuevoEstado.value || nuevoEstado.value === a.value?.estado) return
  if ((await cambiarEstado.ejecutar()).ok) {
    resultado.value = `Estado: ${ESTADO_ACTIVO[nuevoEstado.value].texto.toLowerCase()}.`
    await cargar()
  }
}

async function subirArchivos(lista: File[]) {
  const antes = archivos.adjuntos.value.length
  await archivos.subir(lista)
  for (const x of archivos.adjuntos.value.slice(antes)) {
    if (!(await adjuntar.ejecutar(x.id)).ok) return
  }
  archivos.limpiar()
  resultado.value = 'Archivo agregado a la hoja de vida.'
  await cargar()
}

function abrirMovimiento() {
  tipoMovimiento.value = 'traslado'
  destino.value = observacion.value = ''
  soporte.limpiar()
  errorMovimiento.value = null
  mover.reiniciar()
  moviendo.value = true
}

async function registrar() {
  errorMovimiento.value =
    pideDestino(tipoMovimiento.value) && !destino.value.trim() ? 'Indique a dónde va el activo.'
      : tipoMovimiento.value === 'baja' && !soporte.ids().length ? 'La baja exige un soporte (acta, concepto técnico…).'
        : null
  if (errorMovimiento.value) return
  if (!(await mover.ejecutar()).ok) return
  moviendo.value = false
  resultado.value = tipoMovimiento.value === 'baja' ? 'El activo quedó dado de baja.' : 'Movimiento registrado.'
  await cargar()
}

async function cargar() {
  try {
    hoja.value = await hojaDeVida(props.entidadId, props.activoId)
    nuevoEstado.value = hoja.value.activo.estado === 'dado_de_baja' ? '' : hoja.value.activo.estado
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error' || !a || !hoja"
    estado="error"
    :mensaje="error ?? undefined"
    @reintentar="cargar"
  />
  <template v-else>
    <header class="encabezado">
      <div>
        <small>{{ a.codigo }} · {{ CLASE_ACTIVO[a.clase] }}</small>
        <h1>{{ a.nombre }}</h1>
      </div>
      <HudInsignia :tono="ESTADO_ACTIVO[a.estado].tono">
        {{ ESTADO_ACTIVO[a.estado].texto }}
      </HudInsignia>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-for="e in [cambiarEstado.error.value, adjuntar.error.value, archivos.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>

    <HudPanel etiqueta="Datos">
      <dl class="datos">
        <div v-if="a.marca || a.modelo">
          <dt>Marca y modelo</dt><dd>{{ [a.marca, a.modelo].filter(Boolean).join(' ') }}</dd>
        </div>
        <div v-if="a.serie">
          <dt>Serie</dt><dd>{{ a.serie }}</dd>
        </div>
        <div v-if="a.ubicacion">
          <dt>Ubicación</dt><dd>{{ a.ubicacion }}</dd>
        </div>
        <div v-if="a.fecha_compra">
          <dt>Compra</dt><dd>{{ fechaCalendario(a.fecha_compra) }}</dd>
        </div>
        <div v-if="a.valor">
          <dt>Valor</dt><dd>{{ moneda(a.valor) }}</dd>
        </div>
        <div v-if="a.garantia_vence">
          <dt>Garantía hasta</dt><dd>{{ fechaCalendario(a.garantia_vence) }}</dd>
        </div>
        <div><dt>Costo en mantenimiento</dt><dd>{{ moneda(hoja.costo_total) }}</dd></div>
      </dl>
      <form
        v-if="puedeEditar"
        class="filtros acciones"
        @submit.prevent="guardarEstado"
      >
        <HudSelector
          v-model="nuevoEstado"
          etiqueta="Estado"
          :opciones="opcionesEstado"
        />
        <HudBoton
          tipo="submit"
          variante="secundario"
          :cargando="cambiarEstado.cargando.value"
          :deshabilitado="nuevoEstado === a.estado"
        >
          Cambiar estado
        </HudBoton>
        <HudBoton
          variante="secundario"
          @click="abrirMovimiento"
        >
          Registrar movimiento
        </HudBoton>
      </form>
    </HudPanel>

    <HudPanel etiqueta="Archivos">
      <div class="campos">
        <ul
          v-if="hoja.archivos.length"
          class="lista"
          aria-label="Archivos del activo"
        >
          <li
            v-for="(f, i) in hoja.archivos"
            :key="f.archivo_id"
          >
            <span class="crece">{{ TIPO_ARCHIVO_ACTIVO[f.tipo] }} {{ i + 1 }}</span>
            <HudBoton
              variante="fantasma"
              @click="archivos.abrir(f.archivo_id)"
            >
              Ver<span class="solo-lector"> {{ TIPO_ARCHIVO_ACTIVO[f.tipo] }} {{ i + 1 }}</span>
            </HudBoton>
          </li>
        </ul>
        <p
          v-else
          class="texto-2"
        >
          Aún no hay archivos.
        </p>
        <template v-if="puedeEditar">
          <HudSelector
            v-model="tipoArchivo"
            etiqueta="Tipo de archivo"
            :opciones="opcionesDe(TIPO_ARCHIVO_ACTIVO)"
          />
          <HudAdjuntos
            :adjuntos="archivos.adjuntos.value"
            acepta="image/*,application/pdf"
            :subiendo="archivos.subiendo.value || adjuntar.cargando.value"
            @subir="subirArchivos"
            @abrir="archivos.abrir"
            @quitar="archivos.quitar"
          />
        </template>
      </div>
    </HudPanel>

    <HudPanel etiqueta="Movimientos">
      <p
        v-if="hoja.movimientos.length === 0"
        class="texto-2"
      >
        Sin movimientos.
      </p>
      <ul
        v-else
        class="lista"
        aria-label="Movimientos del activo"
      >
        <li
          v-for="m in hoja.movimientos"
          :key="m.id"
        >
          <span class="crece">
            <strong>{{ TIPO_MOVIMIENTO[m.tipo] }}{{ m.ubicacion_destino ? ` a ${m.ubicacion_destino}` : '' }}</strong>
            <small>{{ fechaHora(m.ocurrido_en, zona) }}{{ m.observacion ? ` · ${m.observacion}` : '' }}</small>
          </span>
        </li>
      </ul>
    </HudPanel>

    <HudPanel
      v-if="hoja.ordenes.length"
      etiqueta="Órdenes de trabajo"
    >
      <ul
        class="lista"
        aria-label="Órdenes del activo"
      >
        <li
          v-for="o in hoja.ordenes"
          :key="o.id"
        >
          <HudInsignia :tono="ESTADO_ORDEN[o.estado].tono">
            {{ ESTADO_ORDEN[o.estado].texto }}
          </HudInsignia>
          <span class="crece">
            <RouterLink
              :to="orden(o.id)"
              class="fila"
            ><strong>{{ o.descripcion }}</strong></RouterLink>
            <small>{{ o.numero }} · {{ fechaCalendario(o.programada_para) }}</small>
          </span>
        </li>
      </ul>
    </HudPanel>

    <HudDialogo
      v-model:abierto="moviendo"
      titulo="Registrar movimiento"
    >
      <form
        id="formulario-movimiento"
        class="campos"
        novalidate
        @submit.prevent="registrar"
      >
        <HudSelector
          v-model="tipoMovimiento"
          etiqueta="Movimiento"
          :opciones="opcionesMovimiento"
        />
        <p
          v-if="tipoMovimiento === 'baja'"
          class="aviso"
        >
          La baja es definitiva: el activo no volverá a usarse ni a recibir órdenes.
        </p>
        <HudCampo
          v-if="pideDestino(tipoMovimiento) || tipoMovimiento === 'salida'"
          v-model="destino"
          :etiqueta="pideDestino(tipoMovimiento) ? 'A dónde va' : 'Destino (opcional)'"
          autocompletar="off"
        />
        <HudCampo
          v-model="observacion"
          etiqueta="Observación (opcional)"
          autocompletar="off"
        />
        <div>
          <p class="texto-2">
            Soporte{{ tipoMovimiento === 'baja' ? ' (obligatorio)' : ' (opcional)' }}
          </p>
          <HudAdjuntos
            :adjuntos="soporte.adjuntos.value"
            acepta="image/*,application/pdf"
            :subiendo="soporte.subiendo.value"
            @subir="soporte.subir"
            @abrir="soporte.abrir"
            @quitar="soporte.quitar"
          />
        </div>
        <p
          v-if="errorMovimiento || mover.error.value || soporte.error.value"
          class="error"
          role="alert"
        >
          {{ errorMovimiento ?? mover.error.value ?? soporte.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="moviendo = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-movimiento"
          :cargando="mover.cargando.value"
          :deshabilitado="soporte.subiendo.value"
        >
          {{ tipoMovimiento === 'baja' ? 'Dar de baja' : 'Registrar' }}
        </HudBoton>
      </template>
    </HudDialogo>
  </template>
</template>

<style scoped src="../vistas/administracion.css"></style>
<style scoped>
.encabezado h1 {
  margin: 2px 0 0;
}

.acciones {
  margin-top: 14px;
}
</style>

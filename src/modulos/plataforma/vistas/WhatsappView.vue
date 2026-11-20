<script setup lang="ts">
/**
 * WhatsApp de la plataforma: las líneas (cualquiera atiende cualquier entidad) con su calidad,
 * ritmo y franquicia de servicio, y las tarifas por país y categoría (la vigente es la más
 * reciente).
 */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { EstadoLinea, LineaWhatsapp, TarifaWhatsapp } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { leerDecimal, numero } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { actualizarLineaWhatsapp, crearLineaWhatsapp, crearTarifaWhatsapp, lineasWhatsapp, tarifasWhatsapp } from '../api-normativa'
import { ESTADO_LINEA } from '../reglas'

const entidad = useEntidad()
const lineas = ref<LineaWhatsapp[]>([])
const tarifas = ref<TarifaWhatsapp[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const resultado = ref<string | null>(null)
const nuevaLinea = ref({ phone_number_id: '', numero_visible: '', nombre: '' })
const editando = ref<LineaWhatsapp | null>(null)
const cambios = ref({ estado: 'activa' as EstadoLinea, limite: '', franquicia: '' })
const nuevaTarifa = ref({ pais: 'CO', categoria: 'servicio', moneda: 'COP', valor: '', desde: hoyEn(entidad.zonaHoraria) })

const COLUMNAS_LINEA = [
  { clave: 'nombre', titulo: 'Línea' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'uso', titulo: 'Este mes', alinear: 'fin' as const },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]
const COLUMNAS_TARIFA = [
  { clave: 'pais', titulo: 'País' },
  { clave: 'categoria', titulo: 'Categoría' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'vigente_desde', titulo: 'Desde' },
]
const CATEGORIAS = ['utilidad', 'servicio', 'marketing', 'autenticacion'].map((c) => ({ valor: c, etiqueta: c[0]!.toUpperCase() + c.slice(1) }))
const ESTADOS = (Object.keys(ESTADO_LINEA) as EstadoLinea[]).map((e) => ({ valor: e, etiqueta: ESTADO_LINEA[e].texto }))
const filasTarifa = computed(() => tarifas.value.map((t, i) => ({ ...t, id: `${t.pais}-${t.categoria}-${t.moneda}-${t.vigente_desde}-${i}` })))
const dialogoLinea = computed({ get: () => editando.value !== null, set: (v) => (v ? undefined : (editando.value = null)) })
const errorLinea = computed(() => {
  const l = nuevaLinea.value
  return l.phone_number_id.trim() && l.numero_visible.trim() && l.nombre.trim() ? null : 'Complete el id de Meta, el número y el nombre.'
})

const crearLinea = useAccion((clave) => crearLineaWhatsapp({ ...nuevaLinea.value }, clave), {
  alExito: (l) => {
    lineas.value = [...lineas.value, l]
    nuevaLinea.value = { phone_number_id: '', numero_visible: '', nombre: '' }
    resultado.value = 'Línea agregada.'
  },
})
const guardarLinea = useAccion((_clave, l: LineaWhatsapp) =>
  actualizarLineaWhatsapp(l.id, {
    estado: cambios.value.estado,
    limite_mps: Number.parseInt(cambios.value.limite, 10),
    franquicia_servicio_mes: Number.parseInt(cambios.value.franquicia, 10),
  }),
)
const crearTarifa = useAccion(
  (clave) => {
    const t = nuevaTarifa.value
    return crearTarifaWhatsapp({ pais: t.pais.trim().toUpperCase(), categoria: t.categoria, moneda: t.moneda.trim().toUpperCase(), valor: leerDecimal(t.valor, 6) ?? '', vigente_desde: t.desde }, clave)
  },
  {
    alExito: (t) => {
      tarifas.value = [t, ...tarifas.value]
      nuevaTarifa.value.valor = ''
      resultado.value = 'Tarifa registrada: rige desde su fecha.'
    },
  },
)

async function cargar() {
  estado.value = 'cargando'
  try {
    ;[lineas.value, tarifas.value] = await Promise.all([lineasWhatsapp(), tarifasWhatsapp()])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

function editar(l: LineaWhatsapp) {
  guardarLinea.reiniciar()
  cambios.value = { estado: l.estado, limite: String(l.limite_mps), franquicia: String(l.franquicia_servicio_mes) }
  editando.value = l
}

async function enviarCambios() {
  const l = editando.value
  if (!l || !/^\d+$/.test(cambios.value.limite) || !/^\d+$/.test(cambios.value.franquicia)) return
  if (!(await guardarLinea.ejecutar(l)).ok) return
  lineas.value = lineas.value.map((x) =>
    x.id === l.id
      ? { ...x, estado: cambios.value.estado, limite_mps: Number(cambios.value.limite), franquicia_servicio_mes: Number(cambios.value.franquicia) }
      : x,
  )
  editando.value = null
  resultado.value = 'Línea actualizada.'
}

function enviarLinea() {
  if (!errorLinea.value) void crearLinea.ejecutar()
}

function enviarTarifa() {
  if (leerDecimal(nuevaTarifa.value.valor, 6)) void crearTarifa.ejecutar()
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-whatsapp">
    <header>
      <h1 id="titulo-whatsapp">
        WhatsApp
      </h1>
      <p class="texto-2">
        Líneas de la plataforma y tarifas de Meta. Las conversaciones nuevas salen por la línea con más franquicia.
      </p>
    </header>
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
      :referencia="referencia"
      @reintentar="cargar()"
    />
    <template v-else>
      <h2>Líneas</h2>
      <HudEstado
        v-if="lineas.length === 0"
        estado="vacio"
        mensaje="Aún no hay líneas registradas."
      />
      <HudTabla
        v-else
        :filas="lineas"
        :columnas="COLUMNAS_LINEA"
        clave="id"
        titulo="Líneas de WhatsApp"
      >
        <template #celda-nombre="{ fila }">
          <span class="crece">
            <strong>{{ fila.nombre }}</strong>
            <small>{{ fila.numero_visible }} · {{ fila.limite_mps }} mensajes por segundo</small>
          </span>
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="ESTADO_LINEA[fila.estado].tono">
            {{ ESTADO_LINEA[fila.estado].texto }}
          </HudInsignia>
        </template>
        <template #celda-uso="{ fila }">
          <span class="crece cifra">
            <span>{{ numero(String(fila.servicio_mes), 0) }} de servicio · {{ numero(String(fila.plantillas_mes), 0) }} plantillas</span>
            <small>Le quedan {{ numero(String(fila.franquicia_disponible), 0) }} de {{ numero(String(fila.franquicia_servicio_mes), 0) }} gratis</small>
          </span>
        </template>
        <template #celda-acciones="{ fila }">
          <HudBoton
            variante="fantasma"
            @click="editar(fila)"
          >
            Editar<span class="solo-lector"> {{ fila.nombre }}</span>
          </HudBoton>
        </template>
      </HudTabla>
      <HudPanel etiqueta="Agregar línea">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarLinea"
        >
          <HudCampo
            v-model="nuevaLinea.phone_number_id"
            etiqueta="Id del número en Meta"
            autocompletar="off"
          />
          <HudCampo
            v-model="nuevaLinea.numero_visible"
            etiqueta="Número visible"
            tipo="tel"
          />
          <HudCampo
            v-model="nuevaLinea.nombre"
            etiqueta="Nombre"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!!errorLinea"
              :cargando="crearLinea.cargando.value"
            >
              Agregar línea
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crearLinea.error.value"
          class="error"
          role="alert"
        >
          {{ crearLinea.error.value }}
        </p>
      </HudPanel>

      <h2>Tarifas</h2>
      <HudTabla
        :filas="filasTarifa"
        :columnas="COLUMNAS_TARIFA"
        clave="id"
        titulo="Tarifas de WhatsApp"
      >
        <template #celda-valor="{ fila }">
          <span class="cifra">{{ numero(fila.valor, 4) }} {{ fila.moneda }}</span>
        </template>
        <template #celda-vigente_desde="{ fila }">
          {{ fechaCalendario(fila.vigente_desde.slice(0, 10)) }}
        </template>
      </HudTabla>
      <HudPanel etiqueta="Registrar tarifa">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarTarifa"
        >
          <HudCampo
            v-model="nuevaTarifa.pais"
            etiqueta="País (ISO)"
            :maximo="2"
          />
          <HudSelector
            v-model="nuevaTarifa.categoria"
            etiqueta="Categoría"
            :opciones="CATEGORIAS"
          />
          <HudCampo
            v-model="nuevaTarifa.moneda"
            etiqueta="Moneda"
            :maximo="3"
          />
          <HudCampo
            v-model="nuevaTarifa.valor"
            etiqueta="Valor por mensaje"
            modo-entrada="decimal"
          />
          <HudFecha
            v-model="nuevaTarifa.desde"
            etiqueta="Vigente desde"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!leerDecimal(nuevaTarifa.valor, 6)"
              :cargando="crearTarifa.cargando.value"
            >
              Registrar tarifa
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crearTarifa.error.value"
          class="error"
          role="alert"
        >
          {{ crearTarifa.error.value }}
        </p>
      </HudPanel>
    </template>

    <HudDialogo
      v-model:abierto="dialogoLinea"
      :titulo="editando ? `Editar ${editando.nombre}` : 'Editar línea'"
    >
      <form
        id="formulario-linea"
        class="campos"
        @submit.prevent="enviarCambios"
      >
        <HudSelector
          v-model="cambios.estado"
          etiqueta="Estado"
          :opciones="ESTADOS"
        />
        <HudCampo
          v-model="cambios.limite"
          etiqueta="Mensajes por segundo"
          modo-entrada="numeric"
        />
        <HudCampo
          v-model="cambios.franquicia"
          etiqueta="Mensajes de servicio gratis al mes"
          modo-entrada="numeric"
        />
        <p
          v-if="guardarLinea.error.value"
          class="error"
          role="alert"
        >
          {{ guardarLinea.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="editando = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-linea"
          :cargando="guardarLinea.cargando.value"
        >
          Guardar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

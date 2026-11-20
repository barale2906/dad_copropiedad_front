<script setup lang="ts">
/**
 * Publicidad de la plataforma: tarifas por modelo de cobro y la política vigente (una versión
 * nueva rige desde ya), liquidaciones del mes por comercio (facturada, pagada, corte de cobro) y
 * las entidades excluidas.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { ExclusionPublicidad, LiquidacionPublicidad, ModeloCobro, TarifaPublicidad } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { leerDecimal, moneda, sumar } from '@/formato/decimales'
import { fecha, fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import {
  cortePorLiquidacion,
  crearTarifaPublicidad,
  exclusiones,
  incluir,
  liquidaciones,
  liquidarMes,
  listarAnunciantes,
  marcarLiquidacion,
  publicarPolitica,
  tarifasPublicidad,
} from '../api-publicidad'
import { ESTADO_LIQUIDACION, MODELO_COBRO } from '../reglas'
import { useClientes, usePermisosPlataforma } from '../store'

const entidad = useEntidad()
const clientes = useClientes()
const { puede } = usePermisosPlataforma()
const hoy = hoyEn(entidad.zonaHoraria)
const TODAS = [
  { id: 'tarifas', texto: 'Tarifas y política' },
  { id: 'liquidaciones', texto: 'Liquidaciones' },
  { id: 'exclusiones', texto: 'Exclusiones' },
] as const
const PESTANAS = computed(() => TODAS.filter((p) => (p.id === 'exclusiones' ? puede('plataforma.publicidad.gestionar') : puede('plataforma.publicidad.liquidar'))))
const actual = usePestana(TODAS)
const pestana = computed(() => (PESTANAS.value.some((p) => p.id === actual.value) ? actual.value : PESTANAS.value[0]?.id))

const tarifas = ref<TarifaPublicidad[]>([])
const liqs = ref<LiquidacionPublicidad[]>([])
const excluidas = ref<ExclusionPublicidad[]>([])
const comercios = ref(new Map<string, string>())
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const resultado = ref<string | null>(null)
const nuevaTarifa = ref({ modelo: 'cpm' as ModeloCobro, valor: '', desde: hoy })
const politica = ref('')
const confirmandoPolitica = ref(false)
const mes = ref(hoy)

const MODELOS = (Object.keys(MODELO_COBRO) as ModeloCobro[]).map((m) => ({ valor: m, etiqueta: MODELO_COBRO[m] }))
const filasTarifa = computed(() => [...tarifas.value].sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde)).map((t, i) => ({ ...t, id: `${t.modelo}-${t.vigente_desde}-${i}` })))
const COLUMNAS_TARIFA = [
  { clave: 'modelo', titulo: 'Modelo' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'vigente_desde', titulo: 'Desde' },
]
const COLUMNAS_LIQ = [
  { clave: 'anunciante_id', titulo: 'Comercio' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]
const totalMes = computed(() => sumar('0', ...liqs.value.map((l) => l.valor)))

const crearTarifa = useAccion((clave) => crearTarifaPublicidad({ modelo: nuevaTarifa.value.modelo, valor: leerDecimal(nuevaTarifa.value.valor) ?? '0', vigente_desde: nuevaTarifa.value.desde }, clave), {
  alExito: (t) => {
    tarifas.value = [...tarifas.value, t]
    nuevaTarifa.value.valor = ''
    resultado.value = 'Tarifa registrada.'
  },
})
const publicar = useAccion((clave) => publicarPolitica(politica.value.trim(), clave), {
  alExito: (p) => {
    confirmandoPolitica.value = false
    politica.value = ''
    resultado.value = `Política versión ${p.version} publicada: rige desde ya.`
  },
})
const calcular = useAccion((clave) => liquidarMes(mes.value, clave), {
  alExito: (l) => {
    liqs.value = l
    resultado.value = 'Liquidaciones del mes calculadas.'
  },
})
const marcar = useAccion((_clave, l: LiquidacionPublicidad, e: 'facturada' | 'pagada') => marcarLiquidacion(l.anunciante_id, mes.value, e), {
  alExito: (l) => (liqs.value = liqs.value.map((x) => (x.id === l.id ? l : x))),
})
const corte = useAccion((clave, id: string) => cortePorLiquidacion(id, clave), {
  alExito: () => (resultado.value = 'Corte de cobro creado en borrador: revíselo en Cobros.'),
})
const volverAIncluir = useAccion((_clave, id: string) => incluir(id), {
  alExito: () => void cargar(),
})

async function cargar() {
  estado.value = 'cargando'
  error.value = null
  try {
    if (pestana.value === 'tarifas') tarifas.value = await tarifasPublicidad()
    else if (pestana.value === 'liquidaciones') {
      const [l, a] = await Promise.all([liquidaciones(mes.value), listarAnunciantes(undefined, { q: '', estado: '' })])
      liqs.value = l
      comercios.value = new Map(a.datos.map((x) => [x.id, x.nombre_comercial]))
    } else if (pestana.value === 'exclusiones') {
      ;[excluidas.value] = await Promise.all([exclusiones(), clientes.asegurar()])
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

function enviarTarifa() {
  if (leerDecimal(nuevaTarifa.value.valor)) void crearTarifa.ejecutar()
}

function abrirPolitica() {
  publicar.reiniciar()
  confirmandoPolitica.value = true
}

watch(pestana, cargar)
watch(mes, () => pestana.value === 'liquidaciones' && cargar())
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-publicidad">
    <header>
      <h1 id="titulo-publicidad">
        Publicidad
      </h1>
      <p class="texto-2">
        Lo que se cobra a los comercios, la política que aceptan las personas y a quién no le llega.
      </p>
    </header>
    <HudPestanas
      v-if="PESTANAS.length > 1"
      :pestanas="PESTANAS"
      etiqueta="Publicidad de la plataforma"
    />
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

    <template v-else-if="pestana === 'tarifas'">
      <h2>Tarifas</h2>
      <HudTabla
        :filas="filasTarifa"
        :columnas="COLUMNAS_TARIFA"
        clave="id"
        titulo="Tarifas de publicidad"
      >
        <template #celda-modelo="{ fila }">
          {{ MODELO_COBRO[fila.modelo] }}
        </template>
        <template #celda-valor="{ fila }">
          <span class="cifra">{{ moneda(fila.valor, 2) }}</span>
        </template>
        <template #celda-vigente_desde="{ fila }">
          {{ fechaCalendario(fila.vigente_desde.slice(0, 10)) }}
        </template>
      </HudTabla>
      <HudPanel etiqueta="Nueva tarifa">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarTarifa"
        >
          <HudSelector
            v-model="nuevaTarifa.modelo"
            etiqueta="Modelo"
            :opciones="MODELOS"
          />
          <HudCampoMonto
            v-model="nuevaTarifa.valor"
            etiqueta="Valor"
          />
          <HudFecha
            v-model="nuevaTarifa.desde"
            etiqueta="Vigente desde"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!leerDecimal(nuevaTarifa.valor)"
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
      <HudPanel etiqueta="Política de publicidad">
        <div class="campos">
          <HudCampo
            v-model="politica"
            etiqueta="Texto de la versión nueva"
            multilinea
            ayuda="Rige desde que se publica; es la que verán las personas al autorizar la publicidad."
          />
          <div>
            <HudBoton
              :deshabilitado="politica.trim().length < 20"
              @click="abrirPolitica"
            >
              Publicar versión nueva
            </HudBoton>
          </div>
        </div>
      </HudPanel>
    </template>

    <template v-else-if="pestana === 'liquidaciones'">
      <div class="filtros">
        <HudFecha
          v-model="mes"
          etiqueta="Mes (cualquier día)"
        />
        <div>
          <HudBoton
            variante="secundario"
            :cargando="calcular.cargando.value"
            @click="calcular.ejecutar()"
          >
            Calcular el mes
          </HudBoton>
        </div>
      </div>
      <p
        v-for="e in [calcular.error.value, marcar.error.value, corte.error.value].filter((x): x is string => !!x)"
        :key="e"
        class="error"
        role="alert"
      >
        {{ e }}
      </p>
      <HudEstado
        v-if="liqs.length === 0"
        estado="vacio"
        mensaje="El mes no tiene liquidaciones. Calcúlelo cuando termine."
      />
      <template v-else>
        <p class="texto-2 cifra">
          Total del mes: <strong>{{ moneda(totalMes, 0) }}</strong>
        </p>
        <HudTabla
          :filas="liqs"
          :columnas="COLUMNAS_LIQ"
          clave="id"
          titulo="Liquidaciones del mes"
        >
          <template #celda-anunciante_id="{ fila }">
            <span class="crece">
              <strong>{{ comercios.get(fila.anunciante_id) ?? 'Comercio' }}</strong>
              <small>Variable {{ moneda(fila.variable, 0) }} · fijos {{ moneda(fila.fijos, 0) }} · {{ fila.leads }} leads ({{ moneda(fila.valor_leads, 0) }})</small>
              <small>Costo de WhatsApp: {{ moneda(fila.costo_whatsapp, 0) }}</small>
            </span>
          </template>
          <template #celda-valor="{ fila }">
            <span class="cifra">{{ moneda(fila.valor, 0) }}</span>
          </template>
          <template #celda-estado="{ fila }">
            <HudInsignia :tono="ESTADO_LIQUIDACION[fila.estado].tono">
              {{ ESTADO_LIQUIDACION[fila.estado].texto }}
            </HudInsignia>
          </template>
          <template #celda-acciones="{ fila }">
            <span class="botones">
              <HudBoton
                v-if="fila.estado === 'calculada' && puede('plataforma.cobros.aprobar')"
                variante="fantasma"
                @click="corte.ejecutar(fila.id)"
              >
                Crear corte<span class="solo-lector"> de {{ comercios.get(fila.anunciante_id) ?? 'el comercio' }}</span>
              </HudBoton>
              <HudBoton
                v-if="fila.estado === 'calculada'"
                variante="fantasma"
                @click="marcar.ejecutar(fila, 'facturada')"
              >
                Marcar facturada
              </HudBoton>
              <HudBoton
                v-if="fila.estado === 'facturada'"
                variante="fantasma"
                @click="marcar.ejecutar(fila, 'pagada')"
              >
                Marcar pagada
              </HudBoton>
            </span>
          </template>
        </HudTabla>
      </template>
    </template>

    <template v-else-if="pestana === 'exclusiones'">
      <p class="texto-2">
        Para excluir una entidad, ábrala en Clientes. Excluirla no apaga su directorio.
      </p>
      <HudEstado
        v-if="excluidas.length === 0"
        estado="vacio"
        mensaje="Ninguna entidad está excluida de la publicidad."
      />
      <ul
        v-else
        class="lista"
      >
        <li
          v-for="x in excluidas"
          :key="x.entidad_id"
        >
          <span class="crece">
            <strong>{{ clientes.nombre(x.entidad_id) }}</strong>
            <small>{{ x.motivo }} · desde el {{ fecha(x.creada_en, entidad.zonaHoraria) }}</small>
          </span>
          <HudBoton
            variante="fantasma"
            :cargando="volverAIncluir.cargando.value"
            @click="volverAIncluir.ejecutar(x.entidad_id)"
          >
            Volver a incluir<span class="solo-lector"> {{ clientes.nombre(x.entidad_id) }}</span>
          </HudBoton>
        </li>
      </ul>
      <p
        v-if="volverAIncluir.error.value"
        class="error"
        role="alert"
      >
        {{ volverAIncluir.error.value }}
      </p>
    </template>

    <HudDialogo
      v-model:abierto="confirmandoPolitica"
      titulo="¿Publicar la política nueva?"
    >
      <p class="aviso">
        Rige desde ya y reemplaza la versión vigente. Las personas la verán al autorizar la publicidad.
      </p>
      <p
        v-if="publicar.error.value"
        class="error"
        role="alert"
      >
        {{ publicar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmandoPolitica = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="publicar.cargando.value"
          @click="publicar.ejecutar()"
        >
          Publicar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<script setup lang="ts">
/**
 * Bitácora de accesos: eventos de puentes, credenciales y registros manuales, filtrables por
 * resultado y fecha, y las alertas vigentes (intentos fallidos, puentes sin reportarse).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { AlertaAcceso, ResultadoAcceso, SentidoAcceso } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { aUtc, fechaHora, sumarDias } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IAlerta from '~icons/tabler/alert-triangle'
import { alertasAcceso, eventosAcceso, registrarEvento } from '../api'
import { RESULTADO_ACCESO, SENTIDO, textoAlerta } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const alertas = ref<AlertaAcceso[]>([])
const errorAlertas = ref<string | null>(null)
const resultado = ref<string | null>(null)

const filtroResultado = ref<ResultadoAcceso | ''>('')
const dia = ref('')
const filtros = computed(() => ({
  resultado: filtroResultado.value || undefined,
  desde: dia.value ? aUtc(`${dia.value}T00:00`, zona.value) : undefined,
  hasta: dia.value ? aUtc(`${sumarDias(dia.value, 1)}T00:00`, zona.value) : undefined,
}))
const opcionesResultado = (Object.keys(RESULTADO_ACCESO) as ResultadoAcceso[]).map((valor) => ({ valor, etiqueta: RESULTADO_ACCESO[valor].texto }))
const listado = useListado((despues, f: { resultado?: ResultadoAcceso; desde?: string; hasta?: string }) => eventosAcceso(id.value, despues, f), {
  filtros,
  retardo: 0,
})

// Registro manual
const registrando = ref(false)
const sentido = ref<SentidoAcceso>('entrada')
const resultadoManual = ref<ResultadoAcceso>('manual')
const motivo = ref('')
const placa = ref('')
const manual = useAccion((clave) =>
  registrarEvento(
    id.value,
    { sentido: sentido.value, resultado: resultadoManual.value, motivo: motivo.value.trim() || null, placa: placa.value.trim().toUpperCase() || null },
    clave,
  ),
)

function abrirManual() {
  sentido.value = 'entrada'
  resultadoManual.value = 'manual'
  motivo.value = placa.value = ''
  manual.reiniciar()
  registrando.value = true
}

async function guardarManual() {
  const r = await manual.ejecutar()
  if (!r.ok) return
  registrando.value = false
  resultado.value = 'Paso registrado en la bitácora.'
  await listado.recargar()
}

async function cargarAlertas() {
  errorAlertas.value = null
  try {
    alertas.value = await alertasAcceso(id.value)
  } catch (e) {
    errorAlertas.value = mensajeDeError(e)
  }
}

watch(id, cargarAlertas)
onMounted(cargarAlertas)
</script>

<template>
  <section aria-labelledby="titulo-bitacora">
    <header class="encabezado">
      <h1 id="titulo-bitacora">
        Bitácora de accesos
      </h1>
      <HudBoton
        v-if="entidad.tienePermiso('acceso.registrar')"
        variante="secundario"
        @click="abrirManual"
      >
        Registrar paso manual
      </HudBoton>
    </header>

    <p
      v-if="errorAlertas"
      class="error"
      role="alert"
    >
      {{ errorAlertas }}
    </p>
    <HudPanel
      v-if="alertas.length"
      etiqueta="Alertas"
      resaltado
    >
      <ul
        class="lista"
        aria-label="Alertas de acceso"
      >
        <li
          v-for="(a, i) in alertas"
          :key="i"
          class="urgente"
        >
          <IAlerta
            class="icono-alerta"
            aria-hidden="true"
          />
          <span class="crece">
            <strong>{{ textoAlerta(a.tipo) }}</strong>
            <small>
              {{ a.nombre ?? '' }}{{ a.intentos ? ` · ${a.intentos} intentos` : '' }}{{ a.momento ? ` · ${fechaHora(a.momento, zona)}` : '' }}
            </small>
          </span>
        </li>
      </ul>
    </HudPanel>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <div class="filtros">
      <HudSelector
        v-model="filtroResultado"
        etiqueta="Resultado"
        vacio="Todos"
        :opciones="opcionesResultado"
      />
      <HudFecha
        v-model="dia"
        etiqueta="Día"
      />
    </div>

    <HudEstado
      v-if="listado.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="listado.estado.value === 'error'"
      estado="error"
      :mensaje="listado.error.value ?? undefined"
      @reintentar="listado.recargar()"
    />
    <HudEstado
      v-else-if="listado.estado.value === 'vacio'"
      estado="vacio"
      mensaje="No hay eventos con ese filtro."
    />
    <template v-else>
      <ul
        class="lista"
        aria-label="Eventos de acceso"
      >
        <li
          v-for="e in listado.filas.value"
          :key="e.id"
        >
          <HudInsignia :tono="RESULTADO_ACCESO[e.resultado].tono">
            {{ RESULTADO_ACCESO[e.resultado].texto }}
          </HudInsignia>
          <span class="crece">
            <strong>{{ SENTIDO[e.sentido] }}{{ e.placa ? ` · placa ${e.placa}` : '' }}</strong>
            <small>{{ fechaHora(e.ocurrido_en, zona) }}{{ e.motivo ? ` · ${e.motivo}` : '' }}</small>
          </span>
        </li>
      </ul>
      <HudCargarMas
        :hay-mas="listado.hayMas.value"
        :cargando="listado.cargando.value"
        @cargar="listado.cargarMas()"
      />
    </template>

    <HudDialogo
      v-model:abierto="registrando"
      titulo="Registrar paso manual"
    >
      <form
        id="formulario-paso"
        class="campos"
        @submit.prevent="guardarManual"
      >
        <HudSelector
          v-model="sentido"
          etiqueta="Sentido"
          :opciones="opcionesDe(SENTIDO)"
        />
        <HudSelector
          v-model="resultadoManual"
          etiqueta="Resultado"
          :opciones="opcionesResultado"
        />
        <HudCampo
          v-model="motivo"
          etiqueta="Motivo (opcional)"
          autocompletar="off"
        />
        <HudCampo
          v-model="placa"
          etiqueta="Placa (opcional)"
          autocompletar="off"
        />
        <p
          v-if="manual.error.value"
          class="error"
          role="alert"
        >
          {{ manual.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="registrando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-paso"
          :cargando="manual.cargando.value"
        >
          Registrar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./porteria.css"></style>
<style scoped>
.filtros {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px;
}

.icono-alerta {
  width: 24px;
  height: 24px;
  color: var(--magenta);
}
</style>

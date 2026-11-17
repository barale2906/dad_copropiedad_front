<script setup lang="ts">
/**
 * Auditoría de la entidad: qué se hizo, cuándo y con qué resultado, filtrable por acción,
 * fechas y «solo mis acciones». Solo lectura; nunca muestra datos personales.
 */
import { computed, ref } from 'vue'
import type { EventoAuditado } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudFiltros from '@/hud/componentes/HudFiltros.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { listarAuditoria } from '../api'
import { aConsulta, detalleLegible, type FiltrosPantalla, resultadoVisible, textoActor } from '../auditoria'

const entidad = useEntidad()
const cuenta = useCuenta()

const VACIOS: FiltrosPantalla = { accion: '', desde: '', hasta: '', soloMias: false }
const filtros = ref<FiltrosPantalla>({ ...VACIOS })

const eventos = useListado(
  (despues, f: FiltrosPantalla) =>
    listarAuditoria(entidad.activa?.entidad_id ?? '', despues, aConsulta(f, entidad.zonaHoraria, cuenta.id)),
  { filtros },
)

const activos = computed(() => {
  const f = filtros.value
  return [
    f.accion && { clave: 'accion', etiqueta: `Acción: ${f.accion}` },
    f.desde && { clave: 'desde', etiqueta: `Desde ${fechaCalendario(f.desde)}` },
    f.hasta && { clave: 'hasta', etiqueta: `Hasta ${fechaCalendario(f.hasta)}` },
    f.soloMias && { clave: 'soloMias', etiqueta: 'Solo mis acciones' },
  ].filter((x): x is { clave: keyof FiltrosPantalla; etiqueta: string } => !!x)
})

const COLUMNAS = [
  { clave: 'ocurrido_en', titulo: 'Cuándo' },
  { clave: 'accion', titulo: 'Acción' },
  { clave: 'actor', titulo: 'Quién' },
  { clave: 'resultado', titulo: 'Resultado' },
  { clave: 'detalle', titulo: 'Detalle' },
]

function quitar(clave: string) {
  const k = clave as keyof FiltrosPantalla
  filtros.value = { ...filtros.value, [k]: VACIOS[k] }
}

const actor = (e: EventoAuditado) => textoActor(e.actor_id, cuenta.id)

// La cuenta se necesita para reconocer «Usted»; si no carga, se muestra «Otra cuenta».
cuenta.asegurar().catch(() => undefined)
</script>

<template>
  <section
    class="auditoria"
    aria-labelledby="titulo-auditoria"
  >
    <header>
      <h1 id="titulo-auditoria">
        Auditoría
      </h1>
      <p class="texto-2">
        Registro de las operaciones hechas en la entidad, de la más reciente a la más antigua.
      </p>
    </header>

    <HudFiltros
      :activos="activos"
      @quitar="quitar"
      @limpiar="filtros = { ...VACIOS }"
    >
      <HudCampo
        v-model="filtros.accion"
        etiqueta="Acción"
        autocompletar="off"
        ayuda="Exacta (roles.asignar) o el inicio terminado en punto (acceso.)."
      />
      <HudFecha
        v-model="filtros.desde"
        etiqueta="Desde"
        :maximo="filtros.hasta || undefined"
      />
      <HudFecha
        v-model="filtros.hasta"
        etiqueta="Hasta"
        :minimo="filtros.desde || undefined"
      />
      <label class="mias">
        <input
          v-model="filtros.soloMias"
          type="checkbox"
        >
        Solo mis acciones
      </label>
    </HudFiltros>

    <HudEstado
      v-if="eventos.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="eventos.estado.value === 'error'"
      estado="error"
      :mensaje="eventos.error.value ?? undefined"
      :referencia="eventos.referencia.value"
      @reintentar="eventos.recargar()"
    />
    <HudEstado
      v-else-if="eventos.estado.value === 'vacio'"
      estado="vacio"
      :mensaje="activos.length ? 'Ningún evento coincide con los filtros.' : 'Aún no hay eventos registrados.'"
    />
    <template v-else>
      <HudTabla
        :filas="eventos.filas.value"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Eventos de la auditoría"
      >
        <template #celda-ocurrido_en="{ fila }">
          {{ fechaHora(fila.ocurrido_en, entidad.zonaHoraria) }}
        </template>
        <template #celda-accion="{ fila }">
          <span class="accion">
            <code>{{ fila.accion }}</code>
            <small>{{ fila.entidad }}</small>
          </span>
        </template>
        <template #celda-actor="{ fila }">
          {{ actor(fila) }}
        </template>
        <template #celda-resultado="{ fila }">
          <HudInsignia :tono="resultadoVisible(fila.resultado).tono">
            {{ resultadoVisible(fila.resultado).texto }}
          </HudInsignia>
        </template>
        <template #celda-detalle="{ fila }">
          <details v-if="detalleLegible(fila.detalle)">
            <summary>Ver<span class="solo-lector"> el detalle de {{ fila.accion }}</span></summary>
            <pre>{{ detalleLegible(fila.detalle) }}</pre>
          </details>
          <span v-else>—</span>
        </template>
      </HudTabla>
      <HudCargarMas
        :hay-mas="eventos.hayMas.value"
        :cargando="eventos.cargando.value"
        @cargar="eventos.cargarMas()"
      />
    </template>
  </section>
</template>

<style scoped>
.auditoria {
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

.mias {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}

.mias input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.accion {
  display: grid;
  text-align: left;
}

code,
pre {
  font-family: var(--fuente-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}

pre {
  max-width: 320px;
  margin: 6px 0 0;
  white-space: pre-wrap;
}

small {
  color: var(--texto-3);
}

summary {
  min-height: 40px;
  padding: 8px 0;
  color: var(--cian);
  cursor: pointer;
}
</style>

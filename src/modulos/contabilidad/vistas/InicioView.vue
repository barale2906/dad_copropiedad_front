<script setup lang="ts">
/**
 * Inicio de la contabilidad: periodo en curso, comprobantes en borrador, reaperturas por
 * aprobar y la configuración vigente, cada uno con su enlace. Si la entidad aún no configuró
 * su contabilidad, lo dice y lleva a la configuración.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Comprobante, ConfiguracionContable, PeriodoContable, Reapertura } from '@/api/tipos'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import { useEntidad } from '@/stores/entidad'
import { usePerfilTributario } from '@/stores/perfil-tributario'
import { comprobantes, configuracion as pedirConfiguracion, periodos as pedirPeriodos, reaperturas as pedirReaperturas } from '../api'
import { ESTADO_PERIODO, MARCO_TECNICO, nombrePeriodo } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const perfil = usePerfilTributario()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const ruta = (accion: string, extra: Record<string, string> = {}) => ({ name: 'modulo', params: { ...route.params, accion, id: '' }, query: extra })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const config = ref<ConfiguracionContable | null>(null)
const lista = ref<PeriodoContable[]>([])
const borradores = ref<Comprobante[]>([])
const pendientes = ref<Reapertura[]>([])

const hoy = hoyEn(entidad.zonaHoraria)
const actual = computed(() => lista.value.find((p) => p.mes === Number(hoy.slice(5, 7))) ?? null)
const enRevision = computed(() => lista.value.filter((p) => p.estado === 'en_revision'))

async function cargar() {
  estado.value = 'cargando'
  try {
    const anio = Number(hoy.slice(0, 4))
    const [c, p, b] = await Promise.all([pedirConfiguracion(id.value), pedirPeriodos(id.value, anio), comprobantes(id.value, { estado: 'borrador', desde: `${anio - 1}-01-01`, hasta: `${anio}-12-31` })])
    config.value = c
    lista.value = p
    borradores.value = b
    const cerrados = p.filter((x) => x.estado === 'cerrado')
    pendientes.value = (await Promise.all(cerrados.map((x) => pedirReaperturas(id.value, x.id)))).flat().filter((r) => r.estado === 'pendiente')
    estado.value = 'listo'
    await perfil.asegurar().catch(() => undefined)
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-inicio">
    <h1 id="titulo-inicio">
      Contabilidad
    </h1>
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
    <template v-else>
      <p
        v-if="!config"
        class="aviso"
      >
        La contabilidad todavía no está configurada: defina el marco técnico y desde cuándo contabiliza, o aplique una plantilla.
        <HudBoton
          v-if="entidad.tienePermiso('contabilidad.configurar')"
          :a="ruta('configuracion')"
        >
          Configurar
        </HudBoton>
      </p>
      <p
        v-if="perfil.sinConfirmar"
        class="aviso"
      >
        No hay un perfil tributario confirmado: no se calculan retenciones ni IVA automáticamente y no se emiten documentos electrónicos.
        <HudBoton
          variante="secundario"
          :a="{ name: 'modulo', params: { ...route.params, seccion: 'tributario', accion: 'perfil', id: '' }, query: {} }"
        >
          Ver el perfil tributario
        </HudBoton>
      </p>
      <ul
        class="tarjetas"
        aria-label="Resumen contable"
      >
        <li>
          <TarjetaResumen
            titulo="Periodo actual"
            :valor="actual ? ESTADO_PERIODO[actual.estado].texto : 'Sin abrir'"
            :detalle="`${nombrePeriodo({ anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) })}${enRevision.length ? ` · ${enRevision.length} en revisión` : ''}`"
            :tono="actual?.estado === 'abierto' ? 'exito' : 'aviso'"
            :a="ruta('periodos')"
          />
        </li>
        <li>
          <TarjetaResumen
            titulo="Comprobantes en borrador"
            :valor="String(borradores.length)"
            :detalle="borradores.length ? 'Por revisar y contabilizar' : 'Todo contabilizado'"
            :tono="borradores.length ? 'aviso' : 'exito'"
            :a="ruta('comprobantes')"
          />
        </li>
        <li>
          <TarjetaResumen
            titulo="Reaperturas por aprobar"
            :valor="String(pendientes.length)"
            :detalle="pendientes.length ? 'Las aprueba otra persona' : 'Ninguna pendiente'"
            :tono="pendientes.length ? 'aviso' : 'neutro'"
            :a="ruta('periodos')"
          />
        </li>
        <li>
          <TarjetaResumen
            titulo="Configuración"
            :valor="config ? MARCO_TECNICO[config.marco_tecnico] : 'Sin configurar'"
            :detalle="config ? `Versión ${config.version} · desde ${fechaCalendario(config.vigente_desde)}${config.plantilla_origen ? ` · ${config.plantilla_origen}` : ''}` : 'Pendiente'"
            :tono="config ? 'info' : 'peligro'"
            :a="ruta('configuracion')"
          />
        </li>
      </ul>
      <div class="botones">
        <HudBoton
          v-if="entidad.tienePermiso('contabilidad.comprobantes.crear')"
          :a="{ ...ruta('comprobantes'), params: { ...route.params, accion: 'comprobantes', id: 'nuevo' } }"
        >
          Nuevo comprobante
        </HudBoton>
        <HudBoton
          variante="secundario"
          :a="ruta('reportes', { vista: 'balance' })"
        >
          Balance de prueba
        </HudBoton>
        <HudBoton
          variante="secundario"
          :a="ruta('reportes', { vista: 'estados' })"
        >
          Estados financieros
        </HudBoton>
      </div>
    </template>
  </section>
</template>

<style scoped src="./contabilidad.css"></style>
<style scoped>
.tarjetas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.aviso {
  display: grid;
  gap: 10px;
  justify-items: start;
}
</style>

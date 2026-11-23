<script setup lang="ts">
/**
 * Configuración de la nómina: la exoneración de aportes (art. 114-1 del ET; lo decide el
 * contador) y, con la contabilidad contratada, contabilizar la nómina aprobada antes de tenerla
 * (informe con lo contabilizado y lo que falló).
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { InformeContabilizacionNomina } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { configuracion as pedirConfiguracion, contabilizar, guardarConfiguracion } from '../api'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const puedeConfigurar = computed(() => entidad.tienePermiso('nomina.configurar'))
const puedeContabilizar = computed(() => entidad.tieneModulo('contabilidad') && entidad.tienePermiso('contabilidad.comprobantes.contabilizar'))
const rutaReglas = computed(() => ({ name: 'modulo', params: { ...route.params, seccion: 'contabilidad', accion: 'configuracion', id: '' }, query: {} }))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const exonerada = ref(false)
const actualizada = ref('')
const resultado = ref<string | null>(null)

const desde = ref(`${hoy.slice(0, 4)}-01-01`)
const hasta = ref(hoy)
const informe = ref<InformeContabilizacionNomina | null>(null)

const guardar = useAccion(() => guardarConfiguracion(id.value, exonerada.value))
const contabilizacion = useAccion(() => contabilizar(id.value, desde.value, hasta.value))

async function alGuardar() {
  const r = await guardar.ejecutar()
  if (!r.ok) return
  actualizada.value = r.valor.actualizada_en
  resultado.value = r.valor.exonerada_aportes
    ? 'Guardado: la entidad queda exonerada de salud, SENA e ICBF de quienes ganan menos de 10 salarios mínimos.'
    : 'Guardado: la entidad paga todos los aportes.'
}

async function alContabilizar() {
  const r = await contabilizacion.ejecutar()
  if (r.ok) informe.value = r.valor
}

async function cargar() {
  estado.value = 'cargando'
  try {
    const c = await pedirConfiguracion(id.value)
    exonerada.value = c.exonerada_aportes
    actualizada.value = c.actualizada_en
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-config-nomina">
    <h1 id="titulo-config-nomina">
      Configuración de la nómina
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
      <HudPanel etiqueta="Aportes">
        <p class="aviso">
          La exoneración de aportes (artículo 114-1 del Estatuto Tributario) la decide el contador: aplica a las
          personas jurídicas declarantes de renta. Si no está seguro, déjela sin marcar.
        </p>
        <label class="casilla">
          <input
            v-model="exonerada"
            type="checkbox"
            :disabled="!puedeConfigurar"
          >
          La entidad está exonerada de aportes a salud, SENA e ICBF
        </label>
        <small v-if="actualizada">Última actualización: {{ fechaHora(actualizada, entidad.zonaHoraria) }}</small>
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <p
          v-if="guardar.error.value"
          class="error"
          role="alert"
        >
          {{ guardar.error.value }}
        </p>
        <div
          v-if="puedeConfigurar"
          class="botones"
        >
          <HudBoton
            :cargando="guardar.cargando.value"
            @click="alGuardar"
          >
            Guardar
          </HudBoton>
        </div>
      </HudPanel>

      <HudPanel
        v-if="puedeContabilizar"
        etiqueta="Contabilizar la nómina aprobada"
      >
        <p class="texto-2">
          Con la contabilidad, aprobar y pagar contabilizan solos. Aquí se contabiliza la nómina aprobada antes de
          tener la contabilidad (se puede repetir: lo ya contabilizado no se duplica). Necesita las reglas de los
          eventos <code>nomina.liquidacion</code> y <code>nomina.pago</code>:
          <RouterLink :to="rutaReglas">
            configúrelas en la contabilidad
          </RouterLink>.
        </p>
        <div class="filtros">
          <HudFecha
            v-model="desde"
            etiqueta="Desde"
          />
          <HudFecha
            v-model="hasta"
            etiqueta="Hasta"
            :minimo="desde || undefined"
          />
        </div>
        <p
          v-if="contabilizacion.error.value"
          class="error"
          role="alert"
        >
          {{ contabilizacion.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            variante="secundario"
            :cargando="contabilizacion.cargando.value"
            :deshabilitado="!desde || !hasta || desde > hasta"
            @click="alContabilizar"
          >
            Contabilizar
          </HudBoton>
        </div>
        <template v-if="informe">
          <p
            class="ok"
            role="status"
          >
            Se contabilizaron {{ informe.contabilizados.length }} periodos.
          </p>
          <ul
            v-if="informe.fallidos.length"
            class="lista"
            aria-label="Periodos que no se contabilizaron"
          >
            <li
              v-for="f in informe.fallidos"
              :key="f.periodo_id"
            >
              <span class="crece error">{{ f.motivo }}</span>
            </li>
          </ul>
        </template>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
code {
  font-family: var(--fuente-mono);
  color: var(--cian);
}
</style>

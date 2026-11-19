<script setup lang="ts">
/**
 * La cartera en otros módulos: fijar los morosos de una reunión de asamblea con las unidades con
 * cartera vencida a un corte (`asambleas.convocar`) y restringir las reservas de las unidades
 * con vencido desde un umbral, levantando las que ya no lo superan (`reservas.restringir`).
 */
import { computed, onMounted, ref } from 'vue'
import type { Morosos, Reunion, SincronizacionMora } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, esDecimal } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { enviarMorosos, restringirPorMora, reuniones as pedirReuniones } from '../api'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puedeAsambleas = computed(() => entidad.tieneModulo('asambleas') && entidad.tienePermiso('asambleas.convocar'))
const puedeReservas = computed(() => entidad.tieneModulo('bienes_comunes') && entidad.tienePermiso('reservas.restringir'))

const lista = ref<Reunion[]>([])
const reunion = ref('')
const corte = ref(hoyEn(entidad.zonaHoraria))
const morosos = ref<Morosos | null>(null)
const umbral = ref('700000')
const sincronizacion = ref<SincronizacionMora | null>(null)

const abiertas = computed(() => lista.value.filter((r) => r.estado !== 'cerrada' && r.estado !== 'cancelada'))
const opcionesReunion = computed(() => abiertas.value.map((r) => ({ valor: r.id, etiqueta: `${r.titulo} · ${fechaCalendario(r.fecha_programada.slice(0, 10))}` })))
const errorUmbral = computed(() => (umbral.value && (!esDecimal(umbral.value) || comparar(umbral.value, '0') <= 0) ? 'Escriba un valor mayor que cero.' : null))

const marcar = useAccion(() => enviarMorosos(id.value, reunion.value, corte.value))
const restringir = useAccion(() => restringirPorMora(id.value, umbral.value))

async function alMarcar() {
  if (!reunion.value) return
  const r = await marcar.ejecutar()
  if (r.ok) morosos.value = r.valor
}

async function alRestringir() {
  if (errorUmbral.value || !umbral.value) return
  const r = await restringir.ejecutar()
  if (r.ok) sincronizacion.value = r.valor
}

onMounted(async () => {
  if (!puedeAsambleas.value) return
  lista.value = await pedirReuniones(id.value).catch(() => [])
  reunion.value = opcionesReunion.value[0]?.valor ?? ''
})
</script>

<template>
  <section aria-labelledby="titulo-integraciones">
    <header>
      <h1 id="titulo-integraciones">
        Morosos y restricciones
      </h1>
      <p class="texto-2">
        Lleve la mora de la cartera a las asambleas y a las reservas de zonas comunes.
      </p>
    </header>

    <HudPanel etiqueta="Morosos de una asamblea">
      <form
        v-if="puedeAsambleas"
        class="campos"
        novalidate
        @submit.prevent="alMarcar"
      >
        <p class="texto-2">
          Marca como morosas en el padrón de la reunión las unidades con cartera vencida al corte (cuentan para el quórum, según el reglamento).
        </p>
        <div class="filtros">
          <HudSelector
            v-model="reunion"
            etiqueta="Reunión"
            vacio="Elija la reunión"
            :opciones="opcionesReunion"
          />
          <HudFecha
            v-model="corte"
            etiqueta="Corte"
          />
        </div>
        <p
          v-if="morosos"
          class="ok"
          role="status"
        >
          Se marcaron {{ morosos.marcados }} unidad(es) morosa(s).
          {{ morosos.no_encontrados.length ? `No están en el padrón: ${morosos.no_encontrados.join(', ')}.` : '' }}
        </p>
        <p
          v-if="marcar.error.value"
          class="error"
          role="alert"
        >
          {{ marcar.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="marcar.cargando.value"
            :deshabilitado="!reunion"
          >
            Marcar morosos
          </HudBoton>
        </div>
      </form>
      <p
        v-else
        class="texto-2"
      >
        Requiere el módulo de asambleas y el permiso para convocarlas.
      </p>
    </HudPanel>

    <HudPanel etiqueta="Reservas restringidas por mora">
      <form
        v-if="puedeReservas"
        class="campos"
        novalidate
        @submit.prevent="alRestringir"
      >
        <p class="texto-2">
          Restringe las reservas de las unidades con vencido desde el umbral y levanta las que ya no lo superan (solo las que creó la cartera).
        </p>
        <div class="filtros">
          <HudCampoMonto
            v-model="umbral"
            etiqueta="Vencido desde"
            :error="errorUmbral"
          />
        </div>
        <p
          v-if="sincronizacion"
          class="ok"
          role="status"
        >
          {{ sincronizacion.restringidos }} unidad(es) restringida(s); {{ sincronizacion.levantadas }} restricción(es) levantada(s).
        </p>
        <p
          v-if="restringir.error.value"
          class="error"
          role="alert"
        >
          {{ restringir.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="restringir.cargando.value"
          >
            Aplicar restricciones
          </HudBoton>
        </div>
      </form>
      <p
        v-else
        class="texto-2"
      >
        Requiere el módulo de zonas comunes y el permiso para restringir reservas.
      </p>
    </HudPanel>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<script setup lang="ts">
/**
 * Censo de la PH: residentes, vehículos, mascotas, alertas (vacunas y pólizas, residentes sin
 * autorización de datos) y campañas de actualización por WhatsApp.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { AlertasCenso } from '@/api/tipos'
import { usePestana } from '@/composables/usePestana'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { alertasCenso } from '../api'
import { ALERTA } from '../censo'
import PanelCampanas from '../componentes/PanelCampanas.vue'
import PanelMascotas from '../componentes/PanelMascotas.vue'
import PanelResidentes from '../componentes/PanelResidentes.vue'
import PanelVehiculos from '../componentes/PanelVehiculos.vue'

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')

const PESTANAS = [
  { id: 'residentes', texto: 'Residentes' },
  { id: 'vehiculos', texto: 'Vehículos' },
  { id: 'mascotas', texto: 'Mascotas' },
  { id: 'alertas', texto: 'Alertas' },
  { id: 'campanas', texto: 'Campañas' },
] as const
const pestana = usePestana(PESTANAS)

const alertas = ref<AlertasCenso | null>(null)
const errorAlertas = ref<string | null>(null)

async function cargarAlertas() {
  errorAlertas.value = null
  try {
    alertas.value = await alertasCenso(id.value)
    await bienes.resolver(alertas.value.mascotas.map((a) => a.mascota.bien_privado_id))
  } catch (e) {
    errorAlertas.value = mensajeDeError(e)
  }
}

watch(pestana, (p) => p === 'alertas' && !alertas.value && cargarAlertas())
onMounted(() => pestana.value === 'alertas' && cargarAlertas())
</script>

<template>
  <section
    class="censo"
    aria-labelledby="titulo-censo"
  >
    <header>
      <h1 id="titulo-censo">
        Censo
      </h1>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Secciones del censo"
    />
    <PanelResidentes v-if="pestana === 'residentes'" />
    <PanelVehiculos v-else-if="pestana === 'vehiculos'" />
    <PanelMascotas v-else-if="pestana === 'mascotas'" />
    <PanelCampanas v-else-if="pestana === 'campanas'" />
    <template v-else>
      <HudEstado
        v-if="errorAlertas"
        estado="error"
        :mensaje="errorAlertas"
        @reintentar="cargarAlertas"
      />
      <HudEstado
        v-else-if="!alertas"
        estado="cargando"
      />
      <template v-else>
        <HudPanel etiqueta="Mascotas">
          <p
            v-if="alertas.mascotas.length === 0"
            class="texto-2"
          >
            Ninguna mascota tiene vacunas o pólizas vencidas o por vencer.
          </p>
          <ul
            v-else
            class="lista"
            aria-label="Alertas de mascotas"
          >
            <li
              v-for="a in alertas.mascotas"
              :key="a.mascota.id"
            >
              <strong>{{ a.mascota.nombre }}</strong> · {{ bienes.codigo(a.mascota.bien_privado_id) }}
              <HudInsignia
                v-for="x in a.alertas"
                :key="x"
                :tono="ALERTA[x].tono"
              >
                {{ ALERTA[x].texto }}
              </HudInsignia>
            </li>
          </ul>
        </HudPanel>
        <HudPanel etiqueta="Protección de datos">
          <p class="texto-2">
            {{ alertas.residentes_sin_autorizacion.length === 0
              ? 'Todos los residentes autorizaron el tratamiento de sus datos.'
              : `${alertas.residentes_sin_autorizacion.length} residentes no han autorizado el tratamiento de sus datos. Regístrelo en Datos y usuarios → Protección de datos.` }}
          </p>
        </HudPanel>
      </template>
    </template>
  </section>
</template>

<style scoped>
.censo {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.texto-2 {
  margin: 0;
  color: var(--texto-2);
}

.lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>

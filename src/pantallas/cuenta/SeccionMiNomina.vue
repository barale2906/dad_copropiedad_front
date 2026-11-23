<script setup lang="ts">
/**
 * «Mi nómina»: los desprendibles de la persona en todas las entidades donde trabaja (PDF) y su
 * certificado laboral en cada una. Solo aparece si la persona tiene desprendibles; basta la
 * sesión (no exige roles en la entidad). Móvil primero: la app copia este mismo flujo.
 */
import { computed, onMounted, ref } from 'vue'
import { guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import { miCertificadoLaboral, miDesprendible, misDesprendibles } from '@/api/nomina'
import type { DesprendibleDeCuenta } from '@/api/tipos'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import { ESTADO_PERIODO, textoPeriodo } from '@/formato/nomina'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import IDescargar from '~icons/tabler/download'

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<DesprendibleDeCuenta[]>([])
const pidiendo = ref<string | null>(null)
const errorDescarga = ref<string | null>(null)

/** Desprendibles por entidad, el más reciente primero. */
const porEntidad = computed(() => {
  const m = new Map<string, { id: string; nombre: string; desprendibles: DesprendibleDeCuenta[] }>()
  for (const d of [...lista.value].sort((a, b) => b.desde.localeCompare(a.desde))) {
    const g = m.get(d.entidad_id) ?? { id: d.entidad_id, nombre: d.entidad, desprendibles: [] }
    g.desprendibles.push(d)
    m.set(d.entidad_id, g)
  }
  return [...m.values()]
})

async function descargar(d: DesprendibleDeCuenta) {
  errorDescarga.value = null
  pidiendo.value = d.liquidacion_id
  try {
    const a = await miDesprendible(d.entidad_id, d.liquidacion_id)
    guardarBlob(a.blob, a.nombre === 'desprendible.pdf' ? `desprendible-${d.desde}.pdf` : a.nombre)
  } catch (e) {
    errorDescarga.value = mensajeDeError(e)
  } finally {
    pidiendo.value = null
  }
}

async function certificado(entidadId: string) {
  errorDescarga.value = null
  pidiendo.value = entidadId
  try {
    await miCertificadoLaboral(entidadId)
  } catch (e) {
    errorDescarga.value = mensajeDeError(e)
  } finally {
    pidiendo.value = null
  }
}

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await misDesprendibles()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudPanel
    v-if="estado === 'error' || lista.length"
    id="mi-nomina"
    aria-label="Mi nómina"
    etiqueta="Mi nómina"
  >
    <HudEstado
      v-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <template v-else>
      <p class="texto-2">
        Sus desprendibles de pago y su certificado laboral.
      </p>
      <p
        v-if="errorDescarga"
        class="error"
        role="alert"
      >
        {{ errorDescarga }}
      </p>
      <section
        v-for="g in porEntidad"
        :key="g.id"
        :aria-label="g.nombre"
        class="entidad"
      >
        <h3>{{ g.nombre }}</h3>
        <ul class="lista">
          <li
            v-for="d in g.desprendibles"
            :key="d.liquidacion_id"
          >
            <span class="crece">
              <strong>{{ textoPeriodo(d) }}</strong>
              <small>
                Neto {{ moneda(d.neto) }}{{ d.fecha_pago ? ` · pagado el ${fechaCalendario(d.fecha_pago)}` : '' }}
              </small>
            </span>
            <HudInsignia :tono="ESTADO_PERIODO[d.estado].tono">
              {{ ESTADO_PERIODO[d.estado].texto }}
            </HudInsignia>
            <HudBoton
              variante="secundario"
              :cargando="pidiendo === d.liquidacion_id"
              @click="descargar(d)"
            >
              <IDescargar aria-hidden="true" /> Desprendible<span class="solo-lector"> de {{ textoPeriodo(d) }}</span>
            </HudBoton>
          </li>
        </ul>
        <HudBoton
          variante="fantasma"
          :cargando="pidiendo === g.id"
          @click="certificado(g.id)"
        >
          <IDescargar aria-hidden="true" /> Certificado laboral<span class="solo-lector"> de {{ g.nombre }}</span>
        </HudBoton>
      </section>
    </template>
  </HudPanel>
</template>

<style scoped>
.texto-2 {
  margin: 0;
  color: var(--texto-2);
}

.entidad {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
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
  gap: 8px 12px;
  padding: 12px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.crece {
  display: grid;
  flex: 1 1 200px;
  gap: 2px;
}

small {
  color: var(--texto-3);
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>

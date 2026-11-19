<script setup lang="ts">
/**
 * Paz y salvo y certificados de deuda de una unidad. El código de verificación y el PDF se
 * entregan **una sola vez**: el PDF se descarga en el acto, el código se muestra para copiarlo y
 * la pantalla no se deja cerrar hasta confirmar que se guardó. Un paz y salvo solo se emite si
 * la unidad no debe nada (si debe, el backend responde 409 y se dice cuánto).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { guardarBlob } from '@/api/archivos'
import type { CertificadoCartera, CertificadoEmitido, EstadoCuenta, TipoCertificadoCartera } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, moneda } from '@/formato/decimales'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import { useEntidad } from '@/stores/entidad'
import { certificados as pedirCertificados, emitirCertificado, estadoCuenta } from '../api'
import ElegirUnidad from '../componentes/ElegirUnidad.vue'
import { TIPO_CERTIFICADO } from '../reglas'
import { useCartera } from '../store'

const entidad = useEntidad()
const cartera = useCartera()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const bien = ref('')
const cuenta = ref<EstadoCuenta | null>(null)
const emitidos = ref<CertificadoCartera[]>([])
const recien = ref<CertificadoEmitido | null>(null)
const guardado = ref(false)
const pendiente = computed(() => recien.value !== null && !guardado.value)

const emitir = useAccion((_c, tipo: TipoCertificadoCartera) => emitirCertificado(id.value, bien.value, tipo))

function descargarPdf(e: CertificadoEmitido) {
  const bytes = Uint8Array.from(atob(e.pdf_base64), (c) => c.charCodeAt(0))
  guardarBlob(new Blob([bytes], { type: 'application/pdf' }), `${e.certificado.tipo === 'paz_y_salvo' ? 'paz-y-salvo' : 'certificado-deuda'}-${cartera.codigo(e.certificado.bien_privado_id)}.pdf`)
}

async function alEmitir(tipo: TipoCertificadoCartera) {
  if (pendiente.value) return
  const r = await emitir.ejecutar(tipo)
  if (!r.ok) return
  recien.value = r.valor
  guardado.value = false
  descargarPdf(r.valor)
  await cargar()
}

function confirmarGuardado() {
  guardado.value = true
}

async function cargar() {
  if (!bien.value) {
    cuenta.value = null
    emitidos.value = []
    return
  }
  ;[cuenta.value, emitidos.value] = await Promise.all([estadoCuenta(id.value, bien.value).catch(() => null), pedirCertificados(id.value, bien.value).catch(() => [])])
}

/** Mientras el código no se haya guardado, avisa antes de salir de la página. */
function antesDeSalir(e: BeforeUnloadEvent) {
  if (pendiente.value) e.preventDefault()
}

onBeforeRouteLeave(() => !pendiente.value || window.confirm('Aún no confirma que guardó el código y el PDF: no se pueden volver a obtener. ¿Salir de todos modos?'))
watch(bien, () => {
  if (!pendiente.value) recien.value = null
  emitir.reiniciar()
  void cargar()
})
onMounted(() => {
  window.addEventListener('beforeunload', antesDeSalir)
  void cartera.asegurar(id.value)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', antesDeSalir))
</script>

<template>
  <section aria-labelledby="titulo-certificados">
    <header>
      <h1 id="titulo-certificados">
        Paz y salvo y certificados de deuda
      </h1>
      <p class="texto-2">
        El PDF y su código de verificación se entregan una sola vez: guárdelos al emitirlos.
      </p>
    </header>

    <HudPanel
      v-if="recien"
      etiqueta="Certificado emitido"
      resaltado
    >
      <div class="campos">
        <p
          class="ok"
          role="status"
        >
          {{ TIPO_CERTIFICADO[recien.certificado.tipo] }} de {{ cartera.codigo(recien.certificado.bien_privado_id) }} emitido; el PDF se descargó.
        </p>
        <SecretoUnaVez
          :valor="recien.codigo"
          etiqueta="Código de verificación"
          aviso="Este código y el PDF no se pueden volver a obtener."
        />
        <div class="botones">
          <HudBoton
            variante="secundario"
            @click="descargarPdf(recien)"
          >
            Descargar el PDF otra vez
          </HudBoton>
          <HudBoton
            v-if="!guardado"
            @click="confirmarGuardado"
          >
            Ya guardé el código y el PDF
          </HudBoton>
        </div>
      </div>
    </HudPanel>

    <div class="filtros">
      <ElegirUnidad v-model="bien" />
    </div>

    <template v-if="cuenta">
      <p
        class="texto-2"
        :class="{ aviso: comparar(cuenta.saldo, '0') > 0 }"
      >
        {{ cuenta.bien.codigo }}
        {{ comparar(cuenta.saldo, '0') > 0 ? `debe ${moneda(cuenta.saldo)} (${moneda(cuenta.vencido)} vencido): solo se puede emitir el certificado de deuda.` : 'está al día: puede emitir el paz y salvo.' }}
      </p>
      <p
        v-if="pendiente"
        class="aviso"
      >
        Confirme que guardó el certificado anterior antes de emitir otro.
      </p>
      <p
        v-if="emitir.error.value"
        class="error"
        role="alert"
      >
        {{ emitir.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          :cargando="emitir.cargando.value"
          :deshabilitado="pendiente || comparar(cuenta.saldo, '0') > 0"
          @click="alEmitir('paz_y_salvo')"
        >
          Emitir paz y salvo
        </HudBoton>
        <HudBoton
          variante="secundario"
          :cargando="emitir.cargando.value"
          :deshabilitado="pendiente"
          @click="alEmitir('deuda')"
        >
          Emitir certificado de deuda
        </HudBoton>
      </div>

      <HudPanel etiqueta="Certificados emitidos">
        <p
          v-if="emitidos.length === 0"
          class="texto-2"
        >
          Aún no se han emitido certificados de esta unidad.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Certificados emitidos"
        >
          <li
            v-for="c in emitidos"
            :key="c.id"
          >
            <span class="crece">
              <strong>{{ TIPO_CERTIFICADO[c.tipo] }}</strong>
              <small>Corte {{ fechaCalendario(c.corte) }} · emitido {{ fechaHora(c.emitido_en, entidad.zonaHoraria) }}</small>
            </span>
            <span class="cifra">{{ moneda(c.saldo) }}</span>
          </li>
        </ul>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

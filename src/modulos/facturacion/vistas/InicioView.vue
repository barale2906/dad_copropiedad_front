<script setup lang="ts">
/**
 * Inicio del facturador: lo facturado en el mes, lo que está por cobrar, los documentos que
 * requieren atención (rechazados o en contingencia) y los avisos: perfil tributario sin
 * confirmar y proveedor simulado.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { DocumentoElectronico, FacturaVenta } from '@/api/tipos'
import { moneda, restar, sumar } from '@/formato/decimales'
import { numeroDocumento } from '@/formato/facturacion'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import { useEntidad } from '@/stores/entidad'
import { usePerfilTributario } from '@/stores/perfil-tributario'
import IMas from '~icons/tabler/plus'
import { documentos as pedirDocumentos, facturas as pedirFacturas } from '../api'
import AvisoSimulado from '../componentes/AvisoSimulado.vue'
import { ESTADO_DOCUMENTO, requiereAtencion, TIPO_DOCUMENTO_ELECTRONICO } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const perfil = usePerfilTributario()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const electronica = computed(() => entidad.tieneModulo('facturacion_electronica'))
const hoy = hoyEn(entidad.zonaHoraria)
const ruta = (accion: string, recurso = '') => ({ name: 'modulo', params: { ...route.params, accion, id: recurso }, query: {} })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const delMes = ref<FacturaVenta[]>([])
const porCobrar = ref<FacturaVenta[]>([])
const documentos = ref<DocumentoElectronico[]>([])

const facturado = computed(() => sumar('0', ...delMes.value.filter((f) => f.estado !== 'anulada' && f.estado !== 'borrador').map((f) => f.total)))
const saldo = computed(() => sumar('0', ...porCobrar.value.map((f) => restar(f.total, f.pagado))))
const atencion = computed(() => documentos.value.filter(requiereAtencion))

async function cargar() {
  estado.value = 'cargando'
  try {
    const [mes, emitidas, parciales, docs] = await Promise.all([
      pedirFacturas(id.value, { desde: `${hoy.slice(0, 8)}01`, hasta: hoy }),
      pedirFacturas(id.value, { estado: 'emitida' }),
      pedirFacturas(id.value, { estado: 'pagada_parcial' }),
      electronica.value ? pedirDocumentos(id.value) : Promise.resolve([]),
      perfil.asegurar().catch(() => undefined),
    ])
    delMes.value = mes
    porCobrar.value = [...emitidas, ...parciales]
    documentos.value = docs
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-inicio-facturacion">
    <header class="encabezado">
      <div>
        <h1 id="titulo-inicio-facturacion">
          Facturación
        </h1>
        <p class="texto-2">
          Lo facturado este mes y lo que requiere su atención.
        </p>
      </div>
      <HudBoton
        v-if="entidad.tienePermiso('facturacion.facturas.gestionar')"
        :a="ruta('facturas', 'nueva')"
      >
        <IMas aria-hidden="true" /> Factura nueva
      </HudBoton>
    </header>

    <p
      v-if="perfil.sinConfirmar"
      class="aviso"
    >
      La entidad no tiene un perfil tributario confirmado: sin él no se factura con IVA ni se habilita la factura electrónica.
      <RouterLink :to="{ name: 'modulo', params: { entidadId: id, seccion: 'tributario', accion: 'perfil' } }">
        Ir al perfil tributario
      </RouterLink>
    </p>
    <AvisoSimulado :documentos="documentos" />

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
      <div class="filtros">
        <TarjetaResumen
          titulo="Facturado este mes"
          :valor="moneda(facturado)"
          :detalle="`${delMes.length} factura${delMes.length === 1 ? '' : 's'}`"
          tono="info"
          :a="ruta('facturas')"
        />
        <TarjetaResumen
          titulo="Por cobrar"
          :valor="moneda(saldo)"
          :detalle="`${porCobrar.length} factura${porCobrar.length === 1 ? '' : 's'} emitida${porCobrar.length === 1 ? '' : 's'}`"
          :tono="porCobrar.length ? 'aviso' : 'neutro'"
          :a="ruta('facturas')"
        />
        <TarjetaResumen
          v-if="electronica"
          titulo="Documentos por atender"
          :valor="String(atencion.length)"
          detalle="Rechazados o en contingencia"
          :tono="atencion.length ? 'peligro' : 'exito'"
          :a="ruta('documentos')"
        />
      </div>

      <HudPanel
        v-if="atencion.length"
        etiqueta="Requieren atención"
      >
        <ul
          class="lista"
          aria-label="Documentos que requieren atención"
        >
          <li
            v-for="d in atencion"
            :key="d.id"
          >
            <span class="crece">
              <strong>{{ TIPO_DOCUMENTO_ELECTRONICO[d.tipo] }} {{ numeroDocumento(d) }}</strong>
              <small>{{ d.estado === 'rechazado' ? d.respuesta ?? 'La DIAN lo rechazó: corrija y emita una nota.' : 'Se reintenta solo cada 30 minutos.' }}</small>
            </span>
            <HudInsignia :tono="ESTADO_DOCUMENTO[d.estado].tono">
              {{ ESTADO_DOCUMENTO[d.estado].texto }}
            </HudInsignia>
            <RouterLink
              v-if="d.tipo === 'factura' || d.tipo === 'nota_debito'"
              :to="ruta('facturas', d.origen_id)"
            >
              Ver la factura<span class="solo-lector"> de {{ numeroDocumento(d) }}</span>
            </RouterLink>
          </li>
        </ul>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

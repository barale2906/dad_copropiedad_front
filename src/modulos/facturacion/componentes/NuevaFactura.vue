<script setup lang="ts">
/**
 * Factura nueva: el editor (con el catálogo y, con contabilidad, las cuentas de ingreso) y
 * «Guardar borrador» o «Guardar y emitir». Avisa si el perfil tributario no está confirmado
 * (sin él no se factura con IVA). Emite la factura creada.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { FacturaVenta, ItemFacturacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { hoyEn, sumarDias } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import { useEntidad } from '@/stores/entidad'
import { usePerfilTributario } from '@/stores/perfil-tributario'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { crearFactura, emitirFactura, items as pedirItems } from '../api'
import { erroresFactura, type FacturaEditable, facturaVacia, peticionFactura } from '../reglas'
import EditorFactura from './EditorFactura.vue'

const emit = defineEmits<{ creada: [factura: FacturaVenta] }>()

const entidad = useEntidad()
const plan = usePlanCuentas()
const perfil = usePerfilTributario()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const contabilidad = computed(() => entidad.tieneModulo('contabilidad'))
const hoy = hoyEn(entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const catalogo = ref<ItemFacturacion[]>([])
const modelo = ref<FacturaEditable>(facturaVacia(hoy, sumarDias(hoy, 30)))
const intentado = ref(false)
const problemas = computed(() => (intentado.value ? erroresFactura(modelo.value) : []))
const cuentas = computed(() => plan.imputables.filter((c) => c.codigo.startsWith('4')).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const centros = computed(() => plan.centros.filter((c) => c.activo))
const codigoCuenta = (cuentaId: string) => plan.porId.get(cuentaId)?.codigo

const guardar = useAccion(async (clave, emitirTambien: boolean) => {
  const f = await crearFactura(id.value, peticionFactura(modelo.value, contabilidad.value), clave)
  return emitirTambien ? emitirFactura(id.value, f.id) : f
})

async function alGuardar(emitirTambien: boolean) {
  intentado.value = true
  if (erroresFactura(modelo.value).length) return
  const r = await guardar.ejecutar(emitirTambien)
  if (r.ok) emit('creada', r.valor)
}

async function cargar() {
  estado.value = 'cargando'
  try {
    const [lista] = await Promise.all([
      pedirItems(id.value),
      contabilidad.value ? plan.asegurar() : Promise.resolve(),
      perfil.asegurar().catch(() => undefined),
    ])
    catalogo.value = lista
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
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
  <form
    v-else
    class="campos"
    aria-label="Factura nueva"
    novalidate
    @submit.prevent="alGuardar(false)"
  >
    <p
      v-if="perfil.sinConfirmar"
      class="aviso"
    >
      La entidad no tiene un perfil tributario confirmado: sin él, las líneas no pueden llevar IVA. Confírmelo en Tributario → Perfil tributario.
    </p>
    <EditorFactura
      v-model="modelo"
      :entidad-id="id"
      :items="catalogo"
      :contabilidad="contabilidad"
      :cuentas="cuentas"
      :centros="centros"
      :codigo-cuenta="codigoCuenta"
    />
    <ul
      v-if="problemas.length"
      class="error"
      role="alert"
      aria-label="Qué falta para guardar"
    >
      <li
        v-for="p in problemas"
        :key="p"
      >
        {{ p }}
      </li>
    </ul>
    <p
      v-if="guardar.error.value"
      class="error"
      role="alert"
    >
      {{ guardar.error.value }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        variante="secundario"
        :cargando="guardar.cargando.value"
      >
        Guardar borrador
      </HudBoton>
      <HudBoton
        :cargando="guardar.cargando.value"
        @click="alGuardar(true)"
      >
        Guardar y emitir
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

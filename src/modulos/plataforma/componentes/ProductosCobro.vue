<script setup lang="ts">
/**
 * Catálogo comercial: productos (módulo que cobran, texto de la línea de la factura, ítem de
 * facturación) y su tarifa versionada (una nueva desde una fecha; nunca se edita).
 */
import { computed, ref } from 'vue'
import type { Modulo, ModeloTarifa, NuevoProducto, Producto } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { leerDecimal, moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { crearProducto, editarProducto, fijarTarifa } from '../api-cobros'
import { exigeMetrica, METRICAS_TARIFA, MODELO_TARIFA, NOMBRE_MODULO } from '../reglas'
import { usePermisosPlataforma } from '../store'

const productos = defineModel<Producto[]>({ required: true })

const entidad = useEntidad()
const { puede } = usePermisosPlataforma()
const hoy = hoyEn(entidad.zonaHoraria)
const vacio = () => ({ codigo: '', nombre: '', descripcion: '{producto} {periodo}', modulo: '' as Modulo | '', item: '', activo: true })
const f = ref(vacio())
const editando = ref<string | null>(null)
const tarifaDe = ref<string | null>(null)
const tarifa = ref({ modelo: 'plana' as ModeloTarifa, valor: '', incluidas: '', excedente: '', metrica: '', desde: hoy })
const resultado = ref<string | null>(null)
const intentado = ref(false)

const puedeGestionar = computed(() => puede('plataforma.comercial.gestionar'))
const MODULOS = [{ valor: '', etiqueta: 'Ninguno' }, ...(Object.keys(NOMBRE_MODULO) as Modulo[]).map((m) => ({ valor: m, etiqueta: NOMBRE_MODULO[m] }))]
const MODELOS = (Object.keys(MODELO_TARIFA) as ModeloTarifa[]).map((m) => ({ valor: m, etiqueta: MODELO_TARIFA[m] }))
const METRICAS = Object.entries(METRICAS_TARIFA).map(([valor, etiqueta]) => ({ valor, etiqueta }))
const errorCodigo = computed(() => (intentado.value && !/^[a-z0-9_]{2,40}$/.test(f.value.codigo) ? 'Use letras minúsculas sin tilde, números o guion bajo.' : null))
const tarifaValida = computed(() => {
  const t = tarifa.value
  if (!leerDecimal(t.valor) || !t.desde) return false
  if (exigeMetrica(t.modelo) && !t.metrica) return false
  return t.modelo !== 'por_paquete' || (/^\d+$/.test(t.incluidas) && !!leerDecimal(t.excedente))
})

const guardar = useAccion((clave) => {
  const datos: NuevoProducto = {
    codigo: f.value.codigo,
    nombre: f.value.nombre.trim(),
    descripcion_factura: f.value.descripcion.trim(),
    modulo: f.value.modulo || null,
    item_facturacion_id: f.value.item.trim() || null,
    activo: f.value.activo,
  }
  return editando.value ? editarProducto(editando.value, datos) : crearProducto(datos, clave)
})
const fijar = useAccion((clave) => {
  const t = tarifa.value
  return fijarTarifa(
    tarifaDe.value ?? '',
    {
      modelo: t.modelo,
      valor: leerDecimal(t.valor) ?? '0',
      incluidas: t.modelo === 'por_paquete' ? Number.parseInt(t.incluidas, 10) : null,
      valor_excedente: t.modelo === 'por_paquete' ? leerDecimal(t.excedente) : null,
      metrica: exigeMetrica(t.modelo) ? t.metrica : null,
      vigente_desde: t.desde,
    },
    clave,
  )
})

function editar(p: Producto) {
  guardar.reiniciar()
  intentado.value = false
  editando.value = p.id
  f.value = { codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion_factura, modulo: p.modulo ?? '', item: p.item_facturacion_id ?? '', activo: p.activo }
}

function nuevo() {
  guardar.reiniciar()
  intentado.value = false
  editando.value = null
  f.value = vacio()
}

async function enviar() {
  intentado.value = true
  if (errorCodigo.value || !f.value.nombre.trim() || !f.value.descripcion.trim()) return
  const r = await guardar.ejecutar()
  if (!r.ok) return
  productos.value = productos.value.some((p) => p.id === r.valor.id) ? productos.value.map((p) => (p.id === r.valor.id ? r.valor : p)) : [...productos.value, r.valor]
  resultado.value = `Producto «${r.valor.nombre}» guardado.`
  nuevo()
}

function abrirTarifa(p: Producto) {
  fijar.reiniciar()
  tarifaDe.value = tarifaDe.value === p.id ? null : p.id
  tarifa.value = { modelo: 'plana', valor: '', incluidas: '', excedente: '', metrica: '', desde: hoy }
}

async function enviarTarifa() {
  if (!tarifaValida.value) return
  const r = await fijar.ejecutar()
  if (!r.ok) return
  productos.value = productos.value.map((p) => (p.id === tarifaDe.value ? { ...p, tarifas: [r.valor, ...p.tarifas] } : p))
  resultado.value = 'Tarifa fijada: rige desde su fecha.'
  tarifaDe.value = null
}
</script>

<template>
  <div class="campos">
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudPanel
      v-if="puedeGestionar"
      :etiqueta="editando ? 'Editar producto' : 'Nuevo producto'"
    >
      <form
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <div class="filtros">
          <HudCampo
            v-model="f.codigo"
            etiqueta="Código"
            :error="errorCodigo"
            :ayuda="editando ? 'El código no cambia.' : undefined"
          />
          <HudCampo
            v-model="f.nombre"
            etiqueta="Nombre"
          />
          <HudSelector
            v-model="f.modulo"
            etiqueta="Módulo que cobra"
            :opciones="MODULOS"
          />
          <HudCampo
            v-model="f.item"
            etiqueta="Ítem de facturación (id, opcional)"
          />
        </div>
        <HudCampo
          v-model="f.descripcion"
          etiqueta="Texto de la línea de la factura"
          ayuda="Puede usar {producto}, {periodo}, {cantidad} e {incluidas}."
        />
        <label class="casilla"><input
          v-model="f.activo"
          type="checkbox"
        > Activo (se puede agregar a una suscripción)</label>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="guardar.cargando.value"
          >
            Guardar producto
          </HudBoton>
          <HudBoton
            v-if="editando"
            variante="fantasma"
            @click="nuevo"
          >
            Cancelar edición
          </HudBoton>
        </div>
        <p
          v-if="guardar.error.value"
          class="error"
          role="alert"
        >
          {{ guardar.error.value }}
        </p>
      </form>
    </HudPanel>

    <HudEstado
      v-if="productos.length === 0"
      estado="vacio"
      mensaje="Aún no hay productos en el catálogo."
    />
    <ul
      v-else
      class="lista"
    >
      <li
        v-for="p in productos"
        :key="p.id"
      >
        <span class="crece">
          <strong>{{ p.nombre }}</strong>
          <small>{{ p.codigo }}<template v-if="p.modulo"> · {{ NOMBRE_MODULO[p.modulo] }}</template></small>
          <small v-if="p.tarifas[0]">
            {{ MODELO_TARIFA[p.tarifas[0].modelo] }}: {{ moneda(p.tarifas[0].valor, 0) }} desde {{ fechaCalendario(p.tarifas[0].vigente_desde.slice(0, 10)) }}
          </small>
          <small v-else>Sin tarifa</small>
        </span>
        <HudInsignia :tono="p.activo ? 'exito' : 'neutro'">
          {{ p.activo ? 'Activo' : 'Inactivo' }}
        </HudInsignia>
        <template v-if="puedeGestionar">
          <HudBoton
            variante="fantasma"
            @click="editar(p)"
          >
            Editar<span class="solo-lector"> {{ p.nombre }}</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            :aria-expanded="tarifaDe === p.id"
            @click="abrirTarifa(p)"
          >
            Nueva tarifa<span class="solo-lector"> de {{ p.nombre }}</span>
          </HudBoton>
        </template>
      </li>
    </ul>

    <HudPanel
      v-if="tarifaDe"
      etiqueta="Nueva tarifa"
    >
      <form
        class="filtros"
        novalidate
        @submit.prevent="enviarTarifa"
      >
        <HudSelector
          v-model="tarifa.modelo"
          etiqueta="Modelo"
          :opciones="MODELOS"
        />
        <HudCampoMonto
          v-model="tarifa.valor"
          etiqueta="Valor"
        />
        <HudSelector
          v-if="exigeMetrica(tarifa.modelo)"
          v-model="tarifa.metrica"
          etiqueta="Qué se cuenta"
          :opciones="METRICAS"
          vacio="Elija la métrica"
        />
        <template v-if="tarifa.modelo === 'por_paquete'">
          <HudCampo
            v-model="tarifa.incluidas"
            etiqueta="Unidades incluidas"
            modo-entrada="numeric"
          />
          <HudCampoMonto
            v-model="tarifa.excedente"
            etiqueta="Valor de cada unidad adicional"
          />
        </template>
        <HudFecha
          v-model="tarifa.desde"
          etiqueta="Vigente desde"
        />
        <div>
          <HudBoton
            tipo="submit"
            :deshabilitado="!tarifaValida"
            :cargando="fijar.cargando.value"
          >
            Fijar tarifa
          </HudBoton>
        </div>
      </form>
      <p
        v-if="fijar.error.value"
        class="error"
        role="alert"
      >
        {{ fijar.error.value }}
      </p>
    </HudPanel>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

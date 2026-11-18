<script setup lang="ts">
/** Tipos de comprobante: los manuales se usan en el editor; los del sistema los generan los módulos. */
import { computed, ref } from 'vue'
import type { TipoComprobante } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { crearTipoComprobante, editarTipoComprobante } from '../../api'

const props = defineProps<{ entidadId: string; editable: boolean }>()

const plan = usePlanCuentas()
const codigo = ref('')
const nombre = ref('')
const manual = ref(true)
const resultado = ref<string | null>(null)
const editando = ref<TipoComprobante | null>(null)
const nombreEdicion = ref('')
const manualEdicion = ref(true)
const activoEdicion = ref(true)
const abierto = computed({ get: () => !!editando.value, set: (v) => !v && (editando.value = null) })

const crear = useAccion((clave) => crearTipoComprobante(props.entidadId, { codigo: codigo.value.trim().toUpperCase(), nombre: nombre.value.trim(), manual: manual.value }, clave))
const editar = useAccion((_c, t: TipoComprobante) =>
  editarTipoComprobante(props.entidadId, t.id, { codigo: t.codigo, nombre: nombreEdicion.value.trim(), manual: manualEdicion.value, activo: activoEdicion.value }),
)

async function alCrear() {
  const r = await crear.ejecutar()
  if (!r.ok) return
  codigo.value = nombre.value = ''
  resultado.value = `Tipo ${r.valor.codigo} creado.`
  await plan.recargar()
}

function abrir(t: TipoComprobante) {
  editando.value = t
  nombreEdicion.value = t.nombre
  manualEdicion.value = t.manual
  activoEdicion.value = t.activo
}

async function alGuardar() {
  if (!editando.value) return
  const r = await editar.ejecutar(editando.value)
  if (!r.ok) return
  editando.value = null
  resultado.value = `Tipo ${r.valor.codigo} guardado.`
  await plan.recargar()
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
    <form
      v-if="editable"
      class="filtros"
      @submit.prevent="alCrear"
    >
      <HudCampo
        v-model="codigo"
        etiqueta="Código del tipo"
        ayuda="Corto, p. ej. NC."
      />
      <HudCampo
        v-model="nombre"
        etiqueta="Nombre del tipo"
      />
      <label class="casilla">
        <input
          v-model="manual"
          type="checkbox"
        > Se registra a mano
      </label>
      <HudBoton
        tipo="submit"
        :cargando="crear.cargando.value"
        :deshabilitado="!codigo.trim() || !nombre.trim()"
      >
        Agregar tipo
      </HudBoton>
    </form>
    <p
      v-if="crear.error.value"
      class="error"
      role="alert"
    >
      {{ crear.error.value }}
    </p>
    <ul
      class="lista"
      aria-label="Tipos de comprobante"
    >
      <li
        v-for="t in plan.tipos"
        :key="t.id"
      >
        <span class="crece">
          <strong>{{ t.codigo }} · {{ t.nombre }}</strong>
          <small>{{ t.manual ? 'Manual (editor de comprobantes)' : 'Del sistema (lo generan los módulos)' }}</small>
        </span>
        <HudInsignia :tono="t.activo ? 'exito' : 'neutro'">
          {{ t.activo ? 'Activo' : 'Inactivo' }}
        </HudInsignia>
        <HudBoton
          v-if="editable"
          variante="fantasma"
          @click="abrir(t)"
        >
          Editar<span class="solo-lector"> el tipo {{ t.codigo }}</span>
        </HudBoton>
      </li>
    </ul>
    <HudDialogo
      v-model:abierto="abierto"
      :titulo="`Tipo ${editando?.codigo ?? ''}`"
    >
      <div class="campos">
        <HudCampo
          v-model="nombreEdicion"
          etiqueta="Nombre"
        />
        <label class="casilla">
          <input
            v-model="manualEdicion"
            type="checkbox"
          > Se registra a mano
        </label>
        <label class="casilla">
          <input
            v-model="activoEdicion"
            type="checkbox"
          > Activo
        </label>
        <p
          v-if="editar.error.value"
          class="error"
          role="alert"
        >
          {{ editar.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="editando = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="editar.cargando.value"
          @click="alGuardar"
        >
          Guardar el tipo
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="../../vistas/contabilidad.css"></style>

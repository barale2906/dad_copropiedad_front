<script setup lang="ts">
/** Bancos y cajas con su saldo contable a hoy; crear (la cuenta contable que la respalda) y editar. */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { saldoDeCuenta } from '@/api/contabilidad'
import { mensajeDeError } from '@/api/errores'
import type { CuentaTesoreria, TipoCuentaTesoreria } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import { moneda } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import { crearCuentaTesoreria, cuentasTesoreria, editarCuentaTesoreria } from '../api'
import { TIPO_CUENTA } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const configura = computed(() => entidad.tienePermiso('tesoreria.configurar'))
const ruta = (accion: string, c = '') => ({ name: 'modulo', params: { ...route.params, accion, id: c }, query: {} })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<CuentaTesoreria[]>([])
const saldos = ref<Record<string, string>>({})
const resultado = ref<string | null>(null)
const codigo = (c: CuentaTesoreria) => plan.porId.get(c.cuenta_contable_id)?.codigo ?? ''

// Nueva
const abiertoNueva = ref(false)
const tipo = ref<TipoCuentaTesoreria | ''>('banco')
const nombre = ref('')
const banco = ref('')
const numero = ref('')
const tipoBancaria = ref<'ahorros' | 'corriente' | ''>('corriente')
const contable = ref('')
const destinacion = ref('')
const opcionesContable = computed(() => plan.imputables.filter((c) => c.codigo.startsWith('11')).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const crear = useAccion((clave) =>
  crearCuentaTesoreria(id.value, {
    tipo: tipo.value || 'banco', nombre: nombre.value.trim(), banco: tipo.value === 'banco' ? banco.value.trim() || null : null,
    numero_cuenta: numero.value.trim() || null, tipo_cuenta: tipo.value === 'banco' ? tipoBancaria.value || null : null, cuenta_contable: contable.value, destinacion: destinacion.value.trim() || null,
  }, clave),
)

// Edición
const editando = ref<CuentaTesoreria | null>(null)
const abiertoEdicion = computed({ get: () => !!editando.value, set: (v) => !v && (editando.value = null) })
const nombreEd = ref('')
const destinacionEd = ref('')
const activaEd = ref(true)
const editar = useAccion((_c, c: CuentaTesoreria) => editarCuentaTesoreria(id.value, c.id, { nombre: nombreEd.value.trim(), destinacion: destinacionEd.value.trim() || null, activa: activaEd.value }))

function abrir(c: CuentaTesoreria) {
  editando.value = c
  nombreEd.value = c.nombre
  destinacionEd.value = c.destinacion ?? ''
  activaEd.value = c.activa
}

async function alCrear() {
  const r = await crear.ejecutar()
  if (!r.ok) return
  abiertoNueva.value = false
  nombre.value = banco.value = numero.value = contable.value = destinacion.value = ''
  resultado.value = `Cuenta «${r.valor.nombre}» creada.`
  await cargar()
}

async function alEditar() {
  if (!editando.value) return
  const r = await editar.ejecutar(editando.value)
  if (!r.ok) return
  editando.value = null
  resultado.value = `Cuenta «${r.valor.nombre}» guardada.`
  await cargar()
}

async function cargar() {
  try {
    await plan.asegurar()
    lista.value = await cuentasTesoreria(id.value)
    estado.value = 'listo'
    const hoy = hoyEn(entidad.zonaHoraria)
    const pares = await Promise.all(lista.value.map(async (c) => [c.id, await saldoDeCuenta(id.value, codigo(c), hoy).catch(() => '')] as const))
    saldos.value = Object.fromEntries(pares)
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-cuentas">
    <header class="encabezado">
      <h1 id="titulo-cuentas">
        Bancos y cajas
      </h1>
      <HudBoton
        v-if="configura"
        @click="abiertoNueva = true"
      >
        <IMas aria-hidden="true" /> Nueva cuenta
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
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
    <HudEstado
      v-else-if="!lista.length"
      estado="vacio"
      mensaje="Todavía no hay cuentas de tesorería."
    />
    <ul
      v-else
      class="lista"
      aria-label="Cuentas de tesorería"
    >
      <li
        v-for="c in lista"
        :key="c.id"
      >
        <span class="crece">
          <strong>{{ c.nombre }}</strong>
          <small>{{ TIPO_CUENTA[c.tipo] }}{{ c.banco ? ` · ${c.banco}` : '' }}{{ c.numero_enmascarado ? ` ${c.numero_enmascarado}` : '' }} · cuenta {{ codigo(c) }}</small>
          <small v-if="c.destinacion">{{ c.destinacion }}</small>
        </span>
        <span
          class="cifra saldo"
          :aria-label="`Saldo de ${c.nombre}`"
        >{{ saldos[c.id] ? moneda(saldos[c.id] ?? '0') : '…' }}</span>
        <HudInsignia
          v-if="!c.activa"
          tono="neutro"
        >
          Inactiva
        </HudInsignia>
        <div class="botones">
          <HudBoton
            v-if="c.tipo === 'banco' && entidad.tienePermiso('tesoreria.conciliar')"
            variante="secundario"
            :a="ruta('conciliacion', c.id)"
          >
            Conciliar<span class="solo-lector"> {{ c.nombre }}</span>
          </HudBoton>
          <HudBoton
            v-if="configura"
            variante="fantasma"
            @click="abrir(c)"
          >
            Editar<span class="solo-lector"> {{ c.nombre }}</span>
          </HudBoton>
        </div>
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="abiertoNueva"
      titulo="Nueva cuenta de tesorería"
    >
      <form
        id="form-cuenta"
        class="campos"
        @submit.prevent="alCrear"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesDe(TIPO_CUENTA)"
        />
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre"
        />
        <template v-if="tipo === 'banco'">
          <HudCampo
            v-model="banco"
            etiqueta="Banco"
          />
          <HudCampo
            v-model="numero"
            etiqueta="Número de cuenta"
            modo-entrada="numeric"
            ayuda="Solo se guardan los cuatro últimos dígitos."
          />
          <HudSelector
            v-model="tipoBancaria"
            etiqueta="Tipo de cuenta bancaria"
            :opciones="[{ valor: 'corriente', etiqueta: 'Corriente' }, { valor: 'ahorros', etiqueta: 'Ahorros' }]"
          />
        </template>
        <SelectorCuenta
          v-model="contable"
          :opciones="opcionesContable"
          etiqueta="Cuenta contable que la respalda"
        />
        <HudCampo
          v-model="destinacion"
          etiqueta="Destinación (opcional)"
          ayuda="Ej.: fondo de imprevistos."
        />
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abiertoNueva = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="form-cuenta"
          :cargando="crear.cargando.value"
          :deshabilitado="!nombre.trim() || !contable"
        >
          Crear la cuenta
        </HudBoton>
      </template>
    </HudDialogo>
    <HudDialogo
      v-model:abierto="abiertoEdicion"
      :titulo="`Editar ${editando?.nombre ?? ''}`"
    >
      <div class="campos">
        <HudCampo
          v-model="nombreEd"
          etiqueta="Nombre"
        />
        <HudCampo
          v-model="destinacionEd"
          etiqueta="Destinación (opcional)"
        />
        <label class="casilla">
          <input
            v-model="activaEd"
            type="checkbox"
          > Activa
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
          @click="alEditar"
        >
          Guardar la cuenta
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./tesoreria.css"></style>
<style scoped>
.saldo {
  font-size: 18px;
}
</style>

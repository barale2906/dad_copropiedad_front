<script setup lang="ts">
/**
 * Bandeja de cortes: calcular el de un periodo, revisar sus líneas y avanzar su ciclo (aprobar o
 * descartar con `cobros.aprobar`; facturar, factura externa o pago con `cobros.facturar`). Un
 * corte igual al anterior llega aprobado solo.
 */
import { computed, ref } from 'vue'
import type { Corte, EstadoCorte, Suscripcion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { moneda, numero } from '@/formato/decimales'
import { fecha, fechaCalendario, hoyEn } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { aprobarCorte, calcularCorte, cortes, descartarCorte, facturaExterna, facturarCorte, pagarCorte } from '../api-cobros'
import { type AccionCorte, accionesCorte, ESTADO_CORTE } from '../reglas'
import { useClientes, usePermisosPlataforma } from '../store'

const props = defineProps<{ suscripciones: Suscripcion[] }>()

const entidad = useEntidad()
const clientes = useClientes()
const { puede } = usePermisosPlataforma()
const hoy = hoyEn(entidad.zonaHoraria)
const filtros = ref<{ estado: EstadoCorte | ''; suscripcion: string }>({ estado: 'borrador', suscripcion: '' })
const lista = useListado((d, f: { estado: EstadoCorte | ''; suscripcion: string }) => cortes(d, f), { filtros, retardo: 0 })
const abierto = ref<Corte | null>(null)
const calculo = ref({ suscripcion: '', desde: `${hoy.slice(0, 8)}01`, hasta: '' })
const externa = ref({ numero: '', fecha: hoy })
const pago = ref(hoy)
const paso = ref<AccionCorte | null>(null)
const resultado = ref<string | null>(null)

const ESTADOS = [{ valor: '', etiqueta: 'Todos' }, ...(Object.keys(ESTADO_CORTE) as EstadoCorte[]).map((e) => ({ valor: e, etiqueta: ESTADO_CORTE[e].texto }))]
const opcionesSuscripcion = computed(() => props.suscripciones.map((s) => ({ valor: s.id, etiqueta: clientes.nombre(s.entidad_id) })))
const porEvento = computed(() => props.suscripciones.find((s) => s.id === calculo.value.suscripcion)?.ciclo_meses == null)
const permitidas = computed(() =>
  abierto.value
    ? accionesCorte(abierto.value.estado).filter((a) => (a === 'aprobar' || a === 'descartar' ? puede('plataforma.cobros.aprobar') : puede('plataforma.cobros.facturar')))
    : [],
)
const dialogo = computed({ get: () => abierto.value !== null, set: (v) => (v ? undefined : (abierto.value = null)) })
const pidiendoMotivo = computed({ get: () => paso.value === 'descartar', set: (v) => (v ? undefined : (paso.value = null)) })
const TEXTO_ACCION: Record<AccionCorte, string> = {
  aprobar: 'Aprobar',
  descartar: 'Descartar',
  facturar: 'Facturar en DAD',
  factura_externa: 'Registrar factura externa',
  pago: 'Registrar pago',
}
const nombreDe = (c: Corte) => (c.suscripcion_id ? clientes.nombre(props.suscripciones.find((s) => s.id === c.suscripcion_id)?.entidad_id ?? '') : 'Liquidación de publicidad')

const calcular = useAccion((clave) => calcularCorte(calculo.value.suscripcion, calculo.value.desde, porEvento.value ? calculo.value.hasta || null : null, clave), {
  alExito: (c) => {
    resultado.value = c.estado === 'aprobado' && !c.aprobado_por ? 'Corte calculado: es igual al anterior y quedó aprobado solo.' : 'Corte calculado: revíselo y apruébelo.'
    abierto.value = c
    void lista.recargar()
  },
})
const avanzar = useAccion((clave, a: AccionCorte, motivo?: string) => {
  const id = abierto.value?.id ?? ''
  switch (a) {
    case 'aprobar':
      return aprobarCorte(id, clave)
    case 'descartar':
      return descartarCorte(id, motivo ?? '')
    case 'facturar':
      return facturarCorte(id, clave)
    case 'factura_externa':
      return facturaExterna(id, externa.value.numero.trim(), externa.value.fecha)
    case 'pago':
      return pagarCorte(id, pago.value, clave)
  }
})

async function ejecutar(a: AccionCorte, motivo?: string) {
  if (a === 'descartar' && motivo === undefined) {
    avanzar.reiniciar()
    paso.value = 'descartar'
    return
  }
  if ((a === 'factura_externa' && !externa.value.numero.trim()) || ((a === 'pago' || a === 'factura_externa') && paso.value !== a)) {
    paso.value = a
    return
  }
  const r = await avanzar.ejecutar(a, motivo)
  if (!r.ok) return
  abierto.value = r.valor
  paso.value = null
  resultado.value = `Corte ${ESTADO_CORTE[r.valor.estado].texto.toLowerCase()}.`
  await lista.recargar()
}

function abrir(c: Corte) {
  avanzar.reiniciar()
  paso.value = null
  abierto.value = c
}

function enviarCalculo() {
  if (calculo.value.suscripcion && calculo.value.desde) void calcular.ejecutar()
}
</script>

<template>
  <div class="campos">
    <HudPanel
      v-if="puede('plataforma.cobros.aprobar')"
      etiqueta="Calcular un corte"
    >
      <form
        class="filtros"
        novalidate
        @submit.prevent="enviarCalculo"
      >
        <HudSelector
          v-model="calculo.suscripcion"
          etiqueta="Suscripción"
          :opciones="opcionesSuscripcion"
          vacio="Elija la entidad"
        />
        <HudFecha
          v-model="calculo.desde"
          etiqueta="Primer día del periodo"
        />
        <HudFecha
          v-if="porEvento && calculo.suscripcion"
          v-model="calculo.hasta"
          etiqueta="Fin (excluido)"
          :minimo="calculo.desde || undefined"
        />
        <div>
          <HudBoton
            tipo="submit"
            :deshabilitado="!calculo.suscripcion"
            :cargando="calcular.cargando.value"
          >
            Calcular
          </HudBoton>
        </div>
      </form>
      <p
        v-if="calcular.error.value"
        class="error"
        role="alert"
      >
        {{ calcular.error.value }}
      </p>
    </HudPanel>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <div class="filtros">
      <HudSelector
        v-model="filtros.estado"
        etiqueta="Estado"
        :opciones="ESTADOS"
      />
      <HudSelector
        v-model="filtros.suscripcion"
        etiqueta="Entidad"
        :opciones="[{ valor: '', etiqueta: 'Todas' }, ...opcionesSuscripcion]"
      />
    </div>
    <HudEstado
      v-if="lista.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="lista.estado.value === 'error'"
      estado="error"
      :mensaje="lista.error.value ?? undefined"
      :referencia="lista.referencia.value"
      @reintentar="lista.recargar()"
    />
    <HudEstado
      v-else-if="lista.estado.value === 'vacio'"
      estado="vacio"
      mensaje="No hay cortes con ese filtro."
    />
    <template v-else>
      <ul class="lista">
        <li
          v-for="c in lista.filas.value"
          :key="c.id"
        >
          <span class="crece">
            <strong>{{ nombreDe(c) }}</strong>
            <small>Del {{ fechaCalendario(c.periodo_desde) }} al {{ fechaCalendario(c.periodo_hasta) }} (excluido)</small>
          </span>
          <span class="cifra">{{ moneda(c.total, 0) }}</span>
          <HudInsignia :tono="ESTADO_CORTE[c.estado].tono">
            {{ ESTADO_CORTE[c.estado].texto }}
          </HudInsignia>
          <HudBoton
            variante="fantasma"
            @click="abrir(c)"
          >
            Abrir<span class="solo-lector"> el corte de {{ nombreDe(c) }}</span>
          </HudBoton>
        </li>
      </ul>
      <HudCargarMas
        :hay-mas="lista.hayMas.value"
        :cargando="lista.cargando.value"
        @cargar="lista.cargarMas()"
      />
    </template>

    <HudDialogo
      v-model:abierto="dialogo"
      :titulo="abierto ? `Corte de ${nombreDe(abierto)}` : 'Corte'"
    >
      <div
        v-if="abierto"
        class="campos"
      >
        <p class="texto-2">
          Del {{ fechaCalendario(abierto.periodo_desde) }} al {{ fechaCalendario(abierto.periodo_hasta) }} (excluido) ·
          <HudInsignia :tono="ESTADO_CORTE[abierto.estado].tono">{{ ESTADO_CORTE[abierto.estado].texto }}</HudInsignia>
        </p>
        <ul class="lista">
          <li
            v-for="(l, i) in abierto.lineas"
            :key="i"
          >
            <span class="crece">
              <strong>{{ l.descripcion }}</strong>
              <small>{{ numero(l.cantidad, 2) }} × {{ moneda(l.valor_unitario, 2) }}</small>
            </span>
            <span class="cifra">{{ moneda(l.valor, 0) }}</span>
          </li>
        </ul>
        <p class="cifra">
          Total antes de impuestos: <strong>{{ moneda(abierto.total, 0) }}</strong>
        </p>
        <p
          v-if="abierto.motivo"
          class="aviso"
        >
          {{ abierto.motivo }}
        </p>
        <dl class="datos">
          <div v-if="abierto.estado === 'aprobado' && !abierto.aprobado_por">
            <dt>Aprobación</dt>
            <dd>Automática: igual al corte anterior</dd>
          </div>
          <div v-if="abierto.factura_externa">
            <dt>Factura externa</dt>
            <dd>{{ abierto.factura_externa }}</dd>
          </div>
          <div v-if="abierto.facturado_en">
            <dt>Facturado</dt>
            <dd>{{ fecha(abierto.facturado_en, entidad.zonaHoraria) }}</dd>
          </div>
          <div v-if="abierto.vencimiento">
            <dt>Vence</dt>
            <dd>{{ fechaCalendario(abierto.vencimiento.slice(0, 10)) }}</dd>
          </div>
          <div v-if="abierto.pagado_en">
            <dt>Pagado</dt>
            <dd>{{ fecha(abierto.pagado_en, entidad.zonaHoraria) }}</dd>
          </div>
        </dl>
        <div
          v-if="paso === 'factura_externa'"
          class="filtros"
        >
          <HudCampo
            v-model="externa.numero"
            etiqueta="Número de la factura"
          />
          <HudFecha
            v-model="externa.fecha"
            etiqueta="Fecha de la factura"
          />
        </div>
        <HudFecha
          v-if="paso === 'pago'"
          v-model="pago"
          etiqueta="Fecha del pago"
        />
        <p
          v-if="avanzar.error.value && paso !== 'descartar'"
          class="error"
          role="alert"
        >
          {{ avanzar.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          v-for="a in permitidas"
          :key="a"
          :variante="a === 'descartar' ? 'fantasma' : 'primario'"
          :cargando="avanzar.cargando.value && paso !== 'descartar'"
          @click="ejecutar(a)"
        >
          {{ paso === a ? `Confirmar: ${TEXTO_ACCION[a].toLowerCase()}` : TEXTO_ACCION[a] }}
        </HudBoton>
      </template>
    </HudDialogo>
    <ConfirmarConMotivo
      v-model:abierto="pidiendoMotivo"
      titulo="Descartar el corte"
      accion="Descartar"
      descripcion="El corte no se cobrará. Diga por qué."
      :cargando="avanzar.cargando.value"
      :error="avanzar.error.value"
      @confirmar="(m) => ejecutar('descartar', m)"
    />
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

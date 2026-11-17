<script setup lang="ts">
/**
 * Mis visitas y paquetes (móvil primero): responder las visitas que anuncia la portería (la
 * **primera decisión gana**: si otro residente ya respondió, se refresca), pre-autorizar una visita
 * y compartir su QR, y ver los paquetes por recoger.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { BienPrivado, Correspondencia, TipoVisita, Visita } from '@/api/tipos'
import { TIPO_PAQUETE, TIPO_VISITA } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { aUtc, fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import QrCompartir from '@/hud/componentes/QrCompartir.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { misPaquetes, misVisitas, preautorizar, qrDeVisita, responderVisita } from '../api'
import { ESTADO_VISITA, esperaRespuesta, qrVigente } from '../reglas'

const PESTANAS = [
  { id: 'visitas', texto: 'Visitas' },
  { id: 'paquetes', texto: 'Paquetes' },
] as const

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const pestana = usePestana(PESTANAS)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const visitas = ref<Visita[]>([])
const paquetes = ref<Correspondencia[]>([])
const resultado = ref<string | null>(null)

const porResponder = computed(() => visitas.value.filter(esperaRespuesta))
const vigentes = computed(() => visitas.value.filter((v) => qrVigente(v)))
const recientes = computed(() => visitas.value.filter((v) => !esperaRespuesta(v) && !qrVigente(v)).slice(0, 10))
const porRecoger = computed(() => paquetes.value.filter((p) => p.estado === 'recibida'))
const entregados = computed(() => paquetes.value.filter((p) => p.estado !== 'recibida').slice(0, 10))

// Responder
const elegida = ref<Visita | null>(null)
const responder = useAccion((_c, v: Visita, autorizar: boolean) => responderVisita(id.value, v.id, autorizar))

async function decidir(v: Visita, autorizar: boolean) {
  elegida.value = v
  const r = await responder.ejecutar(v, autorizar)
  if (!r.ok) return
  resultado.value = r.valor.decidida_ahora
    ? `${v.visitante_nombre}: ${autorizar ? 'autorizada, la portería ya puede dejarla pasar' : 'rechazada'}.`
    : `Otro residente ya respondió: la visita quedó ${ESTADO_VISITA[r.valor.visita.estado].texto.toLowerCase()}.`
  await cargar()
}

// Pre-autorizar y QR
const abierto = ref(false)
const propios = ref<BienPrivado[]>([])
const bienId = ref('')
const tipo = ref<TipoVisita>('visita')
const nombre = ref('')
const documento = ref('')
const placa = ref('')
const desde = ref('')
const hasta = ref('')
const usos = ref('1')
const intentado = ref(false)
const qr = ref<{ texto: string; visita: Pick<Visita, 'visitante_nombre' | 'ventana_hasta'> } | null>(null)
const opcionesTipo = (Object.keys(TIPO_VISITA) as TipoVisita[]).map((valor) => ({ valor, etiqueta: TIPO_VISITA[valor] }))
const opcionesBien = computed(() => propios.value.map((b) => ({ valor: b.id, etiqueta: b.codigo })))
const errorForm = computed(() => {
  if (!intentado.value) return null
  if (!bienId.value) return 'Elija el bien que visita.'
  if (!nombre.value.trim()) return 'Escriba el nombre del visitante.'
  if (!desde.value || !hasta.value || hasta.value <= desde.value) return 'Indique desde y hasta cuándo puede ingresar.'
  if (!/^[1-9]\d?$/.test(usos.value.trim())) return 'Los ingresos permitidos van de 1 a 99.'
  return null
})
const mensajeQr = computed(() =>
  qr.value
    ? `Hola ${qr.value.visita.visitante_nombre}: muestre este código en la portería de ${entidad.activa?.nombre ?? 'la copropiedad'}.`
    : '',
)

const autorizar = useAccion((clave) =>
  preautorizar(
    id.value,
    {
      bien_privado_id: bienId.value,
      tipo: tipo.value,
      visitante_nombre: nombre.value.trim(),
      visitante_documento: documento.value.trim() || null,
      placa: placa.value.replace(/[\s-]/g, '').toUpperCase() || null,
      desde: aUtc(desde.value, zona.value),
      hasta: aUtc(hasta.value, zona.value),
      usos: Number.parseInt(usos.value, 10),
    },
    clave,
  ),
)

async function abrirPreautorizar() {
  nombre.value = documento.value = placa.value = desde.value = hasta.value = ''
  usos.value = '1'
  tipo.value = 'visita'
  intentado.value = false
  qr.value = null
  autorizar.reiniciar()
  abierto.value = true
  propios.value = await bienes.asegurarPropios().catch(() => [])
  bienId.value = propios.value.length === 1 ? (propios.value[0]?.id ?? '') : ''
}

async function enviar() {
  intentado.value = true
  if (errorForm.value) return
  const r = await autorizar.ejecutar()
  if (!r.ok) return
  qr.value = { texto: r.valor.qr, visita: r.valor.visita }
  visitas.value = [r.valor.visita, ...visitas.value]
}

const verQr = useAccion((_c, v: Visita) => qrDeVisita(id.value, v.id))

async function compartirDe(v: Visita) {
  const r = await verQr.ejecutar(v)
  if (!r.ok) return
  qr.value = { texto: r.valor, visita: v }
  abierto.value = true
}

async function cargar() {
  try {
    const [v, p] = await Promise.all([misVisitas(id.value), misPaquetes(id.value)])
    visitas.value = v.datos
    paquetes.value = p.datos
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-visitas">
    <header>
      <h1 id="titulo-visitas">
        Mis visitas y paquetes
      </h1>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Visitas o paquetes"
    />
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="responder.error.value || verQr.error.value"
      class="error"
      role="alert"
    >
      {{ responder.error.value ?? verQr.error.value }}
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

    <template v-else-if="pestana === 'visitas'">
      <HudPanel
        v-if="porResponder.length"
        etiqueta="Esperan su respuesta"
        resaltado
      >
        <ul
          class="lista"
          aria-label="Visitas por responder"
        >
          <li
            v-for="v in porResponder"
            :key="v.id"
          >
            <span class="visita">
              <strong>{{ v.visitante_nombre }}</strong>
              <small>{{ TIPO_VISITA[v.tipo] }}{{ v.placa ? ` · placa ${v.placa}` : '' }} · {{ fechaHora(v.creada_en, zona) }}</small>
            </span>
            <span class="botones">
              <HudBoton
                :cargando="responder.cargando.value && elegida?.id === v.id"
                @click="decidir(v, true)"
              >
                Autorizar<span class="solo-lector"> a {{ v.visitante_nombre }}</span>
              </HudBoton>
              <HudBoton
                variante="fantasma"
                @click="decidir(v, false)"
              >
                Rechazar<span class="solo-lector"> a {{ v.visitante_nombre }}</span>
              </HudBoton>
            </span>
          </li>
        </ul>
      </HudPanel>

      <div class="botones">
        <HudBoton @click="abrirPreautorizar">
          <IMas aria-hidden="true" /> Pre-autorizar una visita
        </HudBoton>
      </div>

      <HudPanel
        v-if="vigentes.length"
        etiqueta="Pre-autorizadas vigentes"
      >
        <ul
          class="lista"
          aria-label="Pre-autorizaciones vigentes"
        >
          <li
            v-for="v in vigentes"
            :key="v.id"
          >
            <span class="visita">
              <strong>{{ v.visitante_nombre }}</strong>
              <small>Hasta {{ v.ventana_hasta ? fechaHora(v.ventana_hasta, zona) : '—' }} · {{ v.usos }} de {{ v.usos_permitidos }} ingresos</small>
            </span>
            <HudBoton
              variante="secundario"
              :cargando="verQr.cargando.value"
              @click="compartirDe(v)"
            >
              Compartir QR<span class="solo-lector"> de {{ v.visitante_nombre }}</span>
            </HudBoton>
          </li>
        </ul>
      </HudPanel>

      <HudPanel etiqueta="Visitas recientes">
        <p
          v-if="recientes.length === 0"
          class="texto-2"
        >
          Sin visitas recientes.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Visitas recientes"
        >
          <li
            v-for="v in recientes"
            :key="v.id"
          >
            <span class="visita">
              <strong>{{ v.visitante_nombre }}</strong>
              <small>{{ TIPO_VISITA[v.tipo] }} · {{ fechaHora(v.creada_en, zona) }}</small>
            </span>
            <HudInsignia :tono="ESTADO_VISITA[v.estado].tono">
              {{ ESTADO_VISITA[v.estado].texto }}
            </HudInsignia>
          </li>
        </ul>
      </HudPanel>
    </template>

    <template v-else>
      <HudPanel
        etiqueta="Por recoger en portería"
        :resaltado="porRecoger.length > 0"
      >
        <p
          v-if="porRecoger.length === 0"
          class="texto-2"
        >
          No tiene nada por recoger.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Paquetes por recoger"
        >
          <li
            v-for="p in porRecoger"
            :key="p.id"
          >
            <span class="visita">
              <strong>{{ TIPO_PAQUETE[p.tipo] }}{{ p.remitente ? ` de ${p.remitente}` : '' }}</strong>
              <small>Llegó {{ fechaHora(p.recibida_en, zona) }}{{ p.ubicacion ? ` · ${p.ubicacion}` : '' }}</small>
            </span>
          </li>
        </ul>
      </HudPanel>
      <HudPanel
        v-if="entregados.length"
        etiqueta="Entregados"
      >
        <ul
          class="lista"
          aria-label="Paquetes entregados"
        >
          <li
            v-for="p in entregados"
            :key="p.id"
          >
            {{ TIPO_PAQUETE[p.tipo] }}{{ p.remitente ? ` de ${p.remitente}` : '' }} · {{ p.estado === 'entregada' ? 'entregado' : 'devuelto' }}
          </li>
        </ul>
      </HudPanel>
    </template>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="qr ? 'Comparta el código con su visita' : 'Pre-autorizar una visita'"
    >
      <QrCompartir
        v-if="qr"
        :texto="qr.texto"
        :mensaje="mensajeQr"
        nombre-archivo="visita.png"
        :descripcion="`Código QR de ingreso de ${qr.visita.visitante_nombre}`"
      />
      <form
        v-else
        id="formulario-visita"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudSelector
          v-if="opcionesBien.length > 1"
          v-model="bienId"
          etiqueta="Bien que visita"
          vacio="Elija el bien"
          :opciones="opcionesBien"
        />
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesTipo"
        />
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre del visitante"
          requerido
        />
        <HudCampo
          v-model="documento"
          etiqueta="Documento (opcional)"
        />
        <HudCampo
          v-model="placa"
          etiqueta="Placa (opcional)"
          autocompletar="off"
        />
        <HudFecha
          v-model="desde"
          etiqueta="Puede ingresar desde"
          con-hora
          requerido
        />
        <HudFecha
          v-model="hasta"
          etiqueta="Hasta"
          con-hora
          :minimo="desde || undefined"
          requerido
        />
        <HudCampo
          v-model="usos"
          etiqueta="Ingresos permitidos"
          modo-entrada="numeric"
        />
        <p
          v-if="errorForm || autorizar.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? autorizar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abierto = false"
        >
          {{ qr ? 'Listo' : 'Cancelar' }}
        </HudBoton>
        <HudBoton
          v-if="!qr"
          tipo="submit"
          form="formulario-visita"
          :cargando="autorizar.cargando.value"
        >
          Generar QR
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./portal.css"></style>
<style scoped>
.lista > li {
  justify-content: space-between;
}

.visita {
  display: grid;
}
</style>

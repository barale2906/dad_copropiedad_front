<script setup lang="ts">
/** Correspondencia: pendientes por entregar (entregar con firma o foto, devolver) e historial. */
import { computed, ref } from 'vue'
import type { Correspondencia, EstadoCorrespondencia } from '@/api/tipos'
import { TIPO_PAQUETE } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { usePestana } from '@/composables/usePestana'
import { fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IPaquete from '~icons/tabler/package'
import { devolverCorrespondencia, listarCorrespondencia } from '../api'
import DialogoEntregar from '../componentes/DialogoEntregar.vue'
import DialogoRecibir from '../componentes/DialogoRecibir.vue'

const PESTANAS = [
  { id: 'pendientes', texto: 'Por entregar' },
  { id: 'entregada', texto: 'Entregados' },
  { id: 'devuelta', texto: 'Devueltos' },
] as const
const ESTADO: Record<EstadoCorrespondencia, { texto: string; tono: 'info' | 'exito' | 'neutro' }> = {
  recibida: { texto: 'Por entregar', tono: 'info' },
  entregada: { texto: 'Entregado', tono: 'exito' },
  devuelta: { texto: 'Devuelto', tono: 'neutro' },
}

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const pestana = usePestana(PESTANAS)
const puedeEntregar = computed(() => entidad.tienePermiso('acceso.correspondencia.entregar'))

const resultado = ref<string | null>(null)
const recibiendo = ref(false)
const entregando = ref(false)
const devolviendo = ref(false)
const elegido = ref<Correspondencia | null>(null)

const filtros = computed(() => ({ estado: pestana.value === 'pendientes' ? 'recibida' : pestana.value }) as { estado: EstadoCorrespondencia })
const listado = useListado(
  async (despues, f: { estado: EstadoCorrespondencia }) => {
    const p = await listarCorrespondencia(id.value, f.estado, despues)
    await bienes.resolver(p.datos.map((c) => c.bien_privado_id))
    return p
  },
  { filtros, retardo: 0 },
)

const devolver = useAccion((_c, motivo: string) => devolverCorrespondencia(id.value, elegido.value?.id ?? '', motivo), {
  alConflicto: () => listado.recargar(),
})

function abrir(c: Correspondencia, que: 'entregar' | 'devolver') {
  elegido.value = c
  resultado.value = null
  devolver.reiniciar()
  if (que === 'entregar') entregando.value = true
  else devolviendo.value = true
}

async function confirmarDevolucion(motivo: string) {
  const r = await devolver.ejecutar(motivo)
  if (!r.ok) return
  devolviendo.value = false
  resultado.value = 'Correspondencia devuelta.'
  await listado.recargar()
}

async function hecho(texto: string) {
  resultado.value = texto
  await listado.recargar()
}

const titulo = (c: Correspondencia) => `${TIPO_PAQUETE[c.tipo]}${c.remitente ? ` de ${c.remitente}` : ''}`
</script>

<template>
  <section aria-labelledby="titulo-correspondencia">
    <header class="encabezado">
      <h1 id="titulo-correspondencia">
        Correspondencia
      </h1>
      <HudBoton @click="recibiendo = true">
        <IPaquete aria-hidden="true" /> Recibir paquete
      </HudBoton>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Estado de la correspondencia"
    />
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudEstado
      v-if="listado.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="listado.estado.value === 'error'"
      estado="error"
      :mensaje="listado.error.value ?? undefined"
      @reintentar="listado.recargar()"
    />
    <HudEstado
      v-else-if="listado.estado.value === 'vacio'"
      estado="vacio"
      :mensaje="pestana === 'pendientes' ? 'No hay correspondencia por entregar.' : 'No hay correspondencia en este estado.'"
    />
    <template v-else>
      <ul
        class="lista"
        aria-label="Correspondencia"
      >
        <li
          v-for="c in listado.filas.value"
          :key="c.id"
        >
          <HudInsignia :tono="ESTADO[c.estado].tono">
            {{ bienes.codigo(c.bien_privado_id) }}
          </HudInsignia>
          <span class="crece">
            <strong>{{ titulo(c) }}</strong>
            <small>
              Recibido {{ fechaHora(c.recibida_en, zona) }}{{ c.ubicacion ? ` · ${c.ubicacion}` : '' }}{{ c.guia ? ` · guía ${c.guia}` : '' }}
              · {{ c.avisos_enviados }} aviso{{ c.avisos_enviados === 1 ? '' : 's' }}
            </small>
            <small v-if="c.motivo_devolucion">Motivo: {{ c.motivo_devolucion }}</small>
          </span>
          <div
            v-if="c.estado === 'recibida' && puedeEntregar"
            class="botones"
          >
            <HudBoton @click="abrir(c, 'entregar')">
              Entregar<span class="solo-lector"> {{ titulo(c) }} de {{ bienes.codigo(c.bien_privado_id) }}</span>
            </HudBoton>
            <HudBoton
              variante="fantasma"
              @click="abrir(c, 'devolver')"
            >
              Devolver<span class="solo-lector"> {{ titulo(c) }} de {{ bienes.codigo(c.bien_privado_id) }}</span>
            </HudBoton>
          </div>
        </li>
      </ul>
      <HudCargarMas
        :hay-mas="listado.hayMas.value"
        :cargando="listado.cargando.value"
        @cargar="listado.cargarMas()"
      />
    </template>

    <DialogoRecibir
      v-model:abierto="recibiendo"
      :entidad-id="id"
      @recibida="hecho('Paquete registrado: se avisó al residente.')"
    />
    <DialogoEntregar
      v-model:abierto="entregando"
      :entidad-id="id"
      :paquete="elegido"
      @entregado="(_c, quien) => hecho(`Entregado a ${quien}.`)"
    />
    <ConfirmarConMotivo
      v-model:abierto="devolviendo"
      titulo="Devolver la correspondencia"
      accion="Devolver"
      descripcion="Se registra como devuelta (por ejemplo, al remitente o a la transportadora)."
      :cargando="devolver.cargando.value"
      :error="devolver.error.value"
      @confirmar="confirmarDevolucion"
    />
  </section>
</template>

<style scoped src="./porteria.css"></style>
<style scoped>
.lista :deep(.hud-boton) {
  min-height: 56px;
}
</style>

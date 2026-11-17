<script setup lang="ts">
/**
 * Mis bienes: los bienes de los que la cuenta es titular (parqueaderos y depósitos con su número)
 * y, en cada uno, proponer cambios del censo (residente, vehículo o mascota) y ver el estado de
 * las propuestas. Lo propuesto solo entra al censo cuando la administración lo aprueba.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { type RouteLocationRaw, useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { BienPrivado, CambioCenso, TipoCambioCenso } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { coeficiente } from '@/formato/decimales'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { misPropuestas, proponerCambio } from '../api'

const ESTADO: Record<CambioCenso['estado'], { texto: string; tono: 'aviso' | 'exito' | 'neutro' }> = {
  pendiente: { texto: 'Pendiente de aprobación', tono: 'aviso' },
  aprobado: { texto: 'Aprobado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'neutro' },
}
const TIPO: Record<TipoCambioCenso, string> = { residencia: 'Residente', vehiculo: 'Vehículo', mascota: 'Mascota' }
const OPCIONES_CALIDAD = [
  { valor: 'familiar', etiqueta: 'Familiar' },
  { valor: 'tenedor', etiqueta: 'Arrendatario' },
  { valor: 'huesped_temporal', etiqueta: 'Huésped temporal' },
  { valor: 'empleado_domestico', etiqueta: 'Empleado doméstico' },
]
const OPCIONES_VEHICULO = [
  { valor: 'carro', etiqueta: 'Carro' },
  { valor: 'moto', etiqueta: 'Moto' },
  { valor: 'bicicleta', etiqueta: 'Bicicleta' },
]
const OPCIONES_ESPECIE = [
  { valor: 'perro', etiqueta: 'Perro' },
  { valor: 'gato', etiqueta: 'Gato' },
  { valor: 'otro', etiqueta: 'Otra' },
]
const TIPO_BIEN: Partial<Record<BienPrivado['tipo'], string>> = { apartamento: 'Apartamento', casa: 'Casa', local: 'Local', parqueadero: 'Parqueadero', deposito: 'Depósito', bodega: 'Bodega' }

const route = useRoute()
const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const propios = ref<BienPrivado[]>([])
const propuestas = ref<CambioCenso[]>([])
const resultado = ref<string | null>(null)

const bienId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const bien = computed(() => propios.value.find((b) => b.id === bienId.value) ?? null)
const delBien = computed(() => propuestas.value.filter((p) => p.bien_privado_id === bienId.value))
const ruta = (b = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: b } })
const esAnexo = (b: BienPrivado) => b.tipo === 'parqueadero' || b.tipo === 'deposito' || b.tipo === 'bodega'

// Proponer
const abierto = ref(false)
const tipo = ref<TipoCambioCenso>('residencia')
const campos = ref({ nombre: '', documento: '', telefono: '', calidad: 'familiar', placa: '', vehiculo: 'carro', marca: '', especie: 'perro', mascota: '' })
const intentado = ref(false)
const errorForm = computed(() => {
  if (!intentado.value) return null
  const c = campos.value
  if (tipo.value === 'residencia' && (!c.nombre.trim() || !c.documento.trim())) return 'Escriba el nombre y el documento del residente.'
  if (tipo.value === 'vehiculo' && c.vehiculo !== 'bicicleta' && !c.placa.trim()) return 'Escriba la placa.'
  if (tipo.value === 'mascota' && !c.mascota.trim()) return 'Escriba el nombre de la mascota.'
  return null
})

function datosPropuesta(): Record<string, unknown> {
  const c = campos.value
  if (tipo.value === 'residencia') {
    return { calidad: c.calidad, es_responsable: false, persona: { nombre: c.nombre.trim(), documento: c.documento.trim(), telefono: c.telefono.trim() || null } }
  }
  if (tipo.value === 'vehiculo') return { tipo: c.vehiculo, placa: c.placa.replace(/[\s-]/g, '').toUpperCase() || null, marca: c.marca.trim() || null }
  return { especie: c.especie, nombre: c.mascota.trim() }
}

const proponer = useAccion(() => proponerCambio(id.value, bienId.value, tipo.value, datosPropuesta()))

function abrir(t: TipoCambioCenso) {
  tipo.value = t
  campos.value = { nombre: '', documento: '', telefono: '', calidad: 'familiar', placa: '', vehiculo: 'carro', marca: '', especie: 'perro', mascota: '' }
  intentado.value = false
  proponer.reiniciar()
  abierto.value = true
}

async function enviar() {
  intentado.value = true
  if (errorForm.value) return
  const r = await proponer.ejecutar()
  if (!r.ok) return
  abierto.value = false
  propuestas.value = [r.valor, ...propuestas.value]
  resultado.value = 'Propuesta enviada: la administración la revisará y le avisaremos.'
}

async function cargar() {
  estado.value = 'cargando'
  try {
    const [lista, mias] = await Promise.all([bienes.asegurarPropios(), misPropuestas(id.value).catch(() => [])])
    propios.value = lista
    propuestas.value = mias
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(bienId, () => (resultado.value = null))
onMounted(cargar)
</script>

<template>
  <section
    class="mis-bienes"
    aria-labelledby="titulo-mis-bienes"
  >
    <header>
      <RouterLink
        v-if="bienId"
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Mis bienes
      </RouterLink>
      <h1 id="titulo-mis-bienes">
        {{ bien ? bien.codigo : 'Mis bienes' }}
      </h1>
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
      v-else-if="propios.length === 0"
      estado="vacio"
      mensaje="Su cuenta no figura como titular de ningún bien. Si es residente, pida a la administración que lo registre."
    />

    <template v-else-if="bienId">
      <HudEstado
        v-if="!bien"
        estado="vacio"
        mensaje="Ese bien no está a su nombre."
      />
      <template v-else>
        <HudPanel :etiqueta="TIPO_BIEN[bien.tipo] ?? 'Bien'">
          <dl class="datos">
            <div><dt>Código</dt><dd>{{ bien.codigo }}</dd></div>
            <div><dt>Coeficiente</dt><dd>{{ bien.coeficiente ? coeficiente(bien.coeficiente) : 'Sin asignar' }}</dd></div>
            <div v-if="bien.area_privada_m2">
              <dt>Área privada</dt><dd>{{ bien.area_privada_m2.replace('.', ',') }} m²</dd>
            </div>
          </dl>
        </HudPanel>
        <HudPanel etiqueta="¿Cambió algo en su hogar?">
          <p class="texto-2">
            Avísenos quién vive, sus vehículos y mascotas. La administración lo revisa antes de registrarlo.
          </p>
          <div class="botones">
            <HudBoton
              variante="secundario"
              @click="abrir('residencia')"
            >
              Reportar residente
            </HudBoton>
            <HudBoton
              variante="secundario"
              @click="abrir('vehiculo')"
            >
              Reportar vehículo
            </HudBoton>
            <HudBoton
              variante="secundario"
              @click="abrir('mascota')"
            >
              Reportar mascota
            </HudBoton>
          </div>
        </HudPanel>
        <HudPanel etiqueta="Mis propuestas">
          <p
            v-if="delBien.length === 0"
            class="texto-2"
          >
            Aún no ha propuesto cambios para este bien.
          </p>
          <ul
            v-else
            class="lista"
            aria-label="Propuestas enviadas"
          >
            <li
              v-for="p in delBien"
              :key="p.id"
            >
              <span>{{ TIPO[p.tipo] }} · {{ fechaHora(p.propuesto_en, zona) }}</span>
              <HudInsignia :tono="ESTADO[p.estado].tono">
                {{ ESTADO[p.estado].texto }}
              </HudInsignia>
              <small v-if="p.motivo">Motivo: {{ p.motivo }}</small>
            </li>
          </ul>
        </HudPanel>
      </template>
    </template>

    <ul
      v-else
      class="tarjetas"
      aria-label="Mis bienes"
    >
      <li
        v-for="b in propios"
        :key="b.id"
      >
        <RouterLink
          :to="ruta(b.id)"
          class="tarjeta"
        >
          <strong>{{ b.codigo }}</strong>
          <span>{{ TIPO_BIEN[b.tipo] ?? 'Bien' }}{{ esAnexo(b) && b.numero ? ` n.º ${b.numero}` : '' }}</span>
          <small>Coeficiente {{ b.coeficiente ? coeficiente(b.coeficiente) : 'sin asignar' }}</small>
        </RouterLink>
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="`Reportar ${TIPO[tipo].toLowerCase()}`"
    >
      <form
        id="formulario-propuesta"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <template v-if="tipo === 'residencia'">
          <HudCampo
            v-model="campos.nombre"
            etiqueta="Nombre completo"
            requerido
          />
          <HudCampo
            v-model="campos.documento"
            etiqueta="Documento"
            requerido
          />
          <HudCampo
            v-model="campos.telefono"
            etiqueta="Teléfono (opcional)"
            tipo="tel"
          />
          <HudSelector
            v-model="campos.calidad"
            etiqueta="Es"
            :opciones="OPCIONES_CALIDAD"
          />
        </template>
        <template v-else-if="tipo === 'vehiculo'">
          <HudSelector
            v-model="campos.vehiculo"
            etiqueta="Tipo"
            :opciones="OPCIONES_VEHICULO"
          />
          <HudCampo
            v-model="campos.placa"
            etiqueta="Placa"
            autocompletar="off"
          />
          <HudCampo
            v-model="campos.marca"
            etiqueta="Marca (opcional)"
          />
        </template>
        <template v-else>
          <HudSelector
            v-model="campos.especie"
            etiqueta="Especie"
            :opciones="OPCIONES_ESPECIE"
          />
          <HudCampo
            v-model="campos.mascota"
            etiqueta="Nombre de la mascota"
            requerido
          />
        </template>
        <p
          v-if="errorForm || proponer.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? proponer.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-propuesta"
          :cargando="proponer.cargando.value"
        >
          Enviar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./portal.css"></style>

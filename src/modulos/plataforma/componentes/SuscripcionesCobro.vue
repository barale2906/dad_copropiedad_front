<script setup lang="ts">
/**
 * Suscripciones (una vigente por entidad): crearla (ciclo en meses o por evento, prueba, plazo,
 * correo y pagador), sus líneas (agregar un producto con precio pactado opcional, terminarla) y
 * cambios (correo, plazo o terminarla). Avisa los módulos habilitados que no se cobran.
 */
import { computed, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DetalleSuscripcion, Producto, Suscripcion } from '@/api/tipos'
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
import { agregarLinea, cambiarSuscripcion, crearSuscripcion, suscripcion, terminarLinea } from '../api-cobros'
import { ESTADO_SUSCRIPCION, NOMBRE_MODULO } from '../reglas'
import { useClientes, usePermisosPlataforma } from '../store'

const props = defineProps<{ productos: Producto[] }>()
const suscripciones = defineModel<Suscripcion[]>({ required: true })

const entidad = useEntidad()
const clientes = useClientes()
const { puede } = usePermisosPlataforma()
const hoy = hoyEn(entidad.zonaHoraria)
const puedeGestionar = computed(() => puede('plataforma.comercial.gestionar'))
const nueva = ref({ entidad: '', pagador: '', ciclo: '1', inicio: hoy, prueba: '0', plazo: '15', correo: '' })
const detalle = ref<DetalleSuscripcion | null>(null)
const errorDetalle = ref<string | null>(null)
const linea = ref({ producto: '', desde: hoy, precio: '', motivo: '' })
const terminando = ref<string | null>(null)
const fin = ref(hoy)
const cambios = ref({ correo: '', plazo: '', terminar: '', motivo: '' })
const resultado = ref<string | null>(null)

const CICLOS = [
  { valor: '1', etiqueta: 'Mensual' },
  { valor: '3', etiqueta: 'Trimestral' },
  { valor: '6', etiqueta: 'Semestral' },
  { valor: '12', etiqueta: 'Anual' },
  { valor: '', etiqueta: 'Por evento (se corta a pedido)' },
]
const sinCobro = computed(() => (detalle.value?.modulos_sin_cobro ?? []).map((m) => NOMBRE_MODULO[m]).join(', '))
const opcionesProducto = computed(() => props.productos.filter((p) => p.activo).map((p) => ({ valor: p.id, etiqueta: p.nombre })))
const nuevaValida = computed(() => !!(nueva.value.entidad && nueva.value.inicio && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nueva.value.correo.trim())))
const lineaValida = computed(() => !!(linea.value.producto && linea.value.desde && (!linea.value.precio || (leerDecimal(linea.value.precio) && linea.value.motivo.trim()))))

const crear = useAccion((clave) =>
  crearSuscripcion(
    {
      entidad_id: nueva.value.entidad,
      pagador_entidad_id: nueva.value.pagador || null,
      ciclo_meses: nueva.value.ciclo ? Number.parseInt(nueva.value.ciclo, 10) : null,
      inicio: nueva.value.inicio,
      dias_prueba: Number.parseInt(nueva.value.prueba || '0', 10),
      plazo_pago_dias: Number.parseInt(nueva.value.plazo || '15', 10),
      correo_facturacion: nueva.value.correo.trim(),
    },
    clave,
  ),
)
const agregar = useAccion((clave) =>
  agregarLinea(
    detalle.value?.suscripcion.id ?? '',
    { producto_id: linea.value.producto, desde: linea.value.desde, precio_pactado: leerDecimal(linea.value.precio) ?? null, motivo_precio: linea.value.motivo.trim() || null },
    clave,
  ),
)
const terminar = useAccion((_clave, id: string) => terminarLinea(id, fin.value))
const cambiar = useAccion(() =>
  cambiarSuscripcion(detalle.value?.suscripcion.id ?? '', {
    correo_facturacion: cambios.value.correo.trim() || null,
    plazo_pago_dias: cambios.value.plazo ? Number.parseInt(cambios.value.plazo, 10) : null,
    terminar_en: cambios.value.terminar || null,
    motivo: cambios.value.motivo.trim() || null,
  }),
)

async function abrir(id: string) {
  errorDetalle.value = null
  try {
    detalle.value = await suscripcion(id)
    cambios.value = { correo: '', plazo: '', terminar: '', motivo: '' }
  } catch (e) {
    errorDetalle.value = mensajeDeError(e)
  }
}

async function enviarNueva() {
  if (!nuevaValida.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  suscripciones.value = [...suscripciones.value, r.valor]
  resultado.value = `Suscripción de ${clientes.nombre(r.valor.entidad_id)} creada.`
  await abrir(r.valor.id)
}

async function enviarLinea() {
  if (!lineaValida.value || !(await agregar.ejecutar()).ok || !detalle.value) return
  resultado.value = 'Producto agregado a la suscripción.'
  linea.value = { producto: '', desde: hoy, precio: '', motivo: '' }
  await abrir(detalle.value.suscripcion.id)
}

function pedirFin(id: string) {
  terminar.reiniciar()
  fin.value = hoy
  terminando.value = id
}

async function terminarLaLinea(id: string) {
  if (!(await terminar.ejecutar(id)).ok || !detalle.value) return
  resultado.value = 'La línea deja de cobrarse desde esa fecha.'
  terminando.value = null
  await abrir(detalle.value.suscripcion.id)
}

async function enviarCambios() {
  if (cambios.value.terminar && !cambios.value.motivo.trim()) return
  const r = await cambiar.ejecutar()
  if (!r.ok || !detalle.value) return
  suscripciones.value = suscripciones.value.map((s) => (s.id === r.valor.id ? r.valor : s))
  resultado.value = 'Suscripción actualizada.'
  await abrir(r.valor.id)
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
      etiqueta="Nueva suscripción"
    >
      <form
        class="filtros"
        novalidate
        @submit.prevent="enviarNueva"
      >
        <HudSelector
          v-model="nueva.entidad"
          etiqueta="Entidad"
          :opciones="clientes.opciones"
          vacio="Elija la entidad"
        />
        <HudSelector
          v-model="nueva.pagador"
          etiqueta="Paga (opcional)"
          :opciones="[{ valor: '', etiqueta: 'La misma entidad' }, ...clientes.opciones]"
        />
        <HudSelector
          v-model="nueva.ciclo"
          etiqueta="Ciclo"
          :opciones="CICLOS"
        />
        <HudFecha
          v-model="nueva.inicio"
          etiqueta="Inicio"
        />
        <HudCampo
          v-model="nueva.prueba"
          etiqueta="Días de prueba (0 a 30)"
          modo-entrada="numeric"
        />
        <HudCampo
          v-model="nueva.plazo"
          etiqueta="Días para pagar"
          modo-entrada="numeric"
        />
        <HudCampo
          v-model="nueva.correo"
          etiqueta="Correo de facturación"
          tipo="email"
        />
        <div>
          <HudBoton
            tipo="submit"
            :deshabilitado="!nuevaValida"
            :cargando="crear.cargando.value"
          >
            Crear suscripción
          </HudBoton>
        </div>
      </form>
      <p
        v-if="crear.error.value"
        class="error"
        role="alert"
      >
        {{ crear.error.value }}
      </p>
    </HudPanel>

    <HudEstado
      v-if="suscripciones.length === 0"
      estado="vacio"
      mensaje="Aún no hay suscripciones."
    />
    <ul
      v-else
      class="lista"
    >
      <li
        v-for="s in suscripciones"
        :key="s.id"
      >
        <span class="crece">
          <strong>{{ clientes.nombre(s.entidad_id) }}</strong>
          <small>{{ s.ciclo_meses ? `Cada ${s.ciclo_meses} ${s.ciclo_meses === 1 ? 'mes' : 'meses'}` : 'Por evento' }} · desde {{ fechaCalendario(s.inicio.slice(0, 10)) }} · {{ s.correo_facturacion }}</small>
        </span>
        <HudInsignia
          v-if="s.suspendida_por_mora"
          tono="peligro"
        >
          En mora
        </HudInsignia>
        <HudInsignia :tono="ESTADO_SUSCRIPCION[s.estado].tono">
          {{ ESTADO_SUSCRIPCION[s.estado].texto }}
        </HudInsignia>
        <HudBoton
          variante="fantasma"
          @click="abrir(s.id)"
        >
          Abrir<span class="solo-lector"> la suscripción de {{ clientes.nombre(s.entidad_id) }}</span>
        </HudBoton>
      </li>
    </ul>
    <p
      v-if="errorDetalle"
      class="error"
      role="alert"
    >
      {{ errorDetalle }}
    </p>

    <HudPanel
      v-if="detalle"
      :etiqueta="`Suscripción de ${clientes.nombre(detalle.suscripcion.entidad_id)}`"
    >
      <div class="campos">
        <p
          v-if="detalle.modulos_sin_cobro.length"
          class="aviso"
        >
          Habilitados sin producto que los cobre: {{ sinCobro }}.
        </p>
        <h3>Productos</h3>
        <p
          v-if="detalle.lineas.length === 0"
          class="texto-2"
        >
          La suscripción aún no tiene productos.
        </p>
        <ul
          v-else
          class="lista"
        >
          <li
            v-for="l in detalle.lineas"
            :key="l.id"
          >
            <span class="crece">
              <strong>{{ l.nombre }}</strong>
              <small>Desde {{ fechaCalendario(l.desde.slice(0, 10)) }}<template v-if="l.hasta"> hasta {{ fechaCalendario(l.hasta.slice(0, 10)) }}</template><template v-if="l.precio_pactado"> · precio pactado {{ moneda(l.precio_pactado, 0) }} ({{ l.motivo_precio }})</template></small>
            </span>
            <template v-if="puedeGestionar && !l.hasta">
              <HudFecha
                v-if="terminando === l.id"
                v-model="fin"
                :etiqueta="`Deja de cobrarse ${l.nombre} desde`"
              />
              <HudBoton
                variante="fantasma"
                :deshabilitado="terminando === l.id && !fin"
                :cargando="terminar.cargando.value && terminando === l.id"
                @click="terminando === l.id ? terminarLaLinea(l.id) : pedirFin(l.id)"
              >
                {{ terminando === l.id ? 'Confirmar fin' : 'Terminar' }}<span class="solo-lector"> {{ l.nombre }}</span>
              </HudBoton>
            </template>
          </li>
        </ul>
        <p
          v-if="terminar.error.value"
          class="error"
          role="alert"
        >
          {{ terminar.error.value }}
        </p>
        <form
          v-if="puedeGestionar"
          class="filtros"
          novalidate
          @submit.prevent="enviarLinea"
        >
          <HudSelector
            v-model="linea.producto"
            etiqueta="Producto"
            :opciones="opcionesProducto"
            vacio="Elija un producto"
          />
          <HudFecha
            v-model="linea.desde"
            etiqueta="Se cobra desde"
          />
          <HudCampoMonto
            v-model="linea.precio"
            etiqueta="Precio pactado (opcional)"
          />
          <HudCampo
            v-if="linea.precio"
            v-model="linea.motivo"
            etiqueta="Motivo del precio pactado"
          />
          <div>
            <HudBoton
              tipo="submit"
              variante="secundario"
              :deshabilitado="!lineaValida"
              :cargando="agregar.cargando.value"
            >
              Agregar producto
            </HudBoton>
          </div>
        </form>
        <p
          v-if="agregar.error.value"
          class="error"
          role="alert"
        >
          {{ agregar.error.value }}
        </p>

        <template v-if="puedeGestionar">
          <h3>Cambios</h3>
          <form
            class="filtros"
            novalidate
            @submit.prevent="enviarCambios"
          >
            <HudCampo
              v-model="cambios.correo"
              etiqueta="Nuevo correo de facturación"
              tipo="email"
            />
            <HudCampo
              v-model="cambios.plazo"
              etiqueta="Nuevo plazo de pago (días)"
              modo-entrada="numeric"
            />
            <HudFecha
              v-model="cambios.terminar"
              etiqueta="Terminar la suscripción el"
            />
            <HudCampo
              v-if="cambios.terminar"
              v-model="cambios.motivo"
              etiqueta="Motivo de la terminación"
            />
            <div>
              <HudBoton
                tipo="submit"
                variante="secundario"
                :cargando="cambiar.cargando.value"
              >
                Guardar cambios
              </HudBoton>
            </div>
          </form>
          <p
            v-if="cambiar.error.value"
            class="error"
            role="alert"
          >
            {{ cambiar.error.value }}
          </p>
        </template>
      </div>
    </HudPanel>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
h3 {
  margin: 6px 0 0;
  font-size: 17px;
}
</style>

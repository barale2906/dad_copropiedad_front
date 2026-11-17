<script setup lang="ts">
/**
 * «Mi hogar»: el inicio de propietarios y residentes (móvil primero). Tarjetas con sus bienes,
 * saldo, paquetes, visitas por responder, reservas, solicitudes y comunicados; cada una carga por
 * su cuenta (si una falla, las demás siguen) y solo aparece si el módulo está contratado.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { comparar, moneda, sumar } from '@/formato/decimales'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import ICalendario from '~icons/tabler/calendar-event'
import ICarta from '~icons/tabler/mail'
import ICubo from '~icons/tabler/cube-3d-sphere'
import ICasa from '~icons/tabler/home'
import ICaja from '~icons/tabler/package'
import IPersona from '~icons/tabler/user-check'
import IAyuda from '~icons/tabler/message-report'
import IBilletera from '~icons/tabler/wallet'
import { bienesCartera, estadoCuenta, misComunicados, misPaquetes, misReservas, misTickets, misVisitas } from '../api'
import { esperaRespuesta } from '../reglas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'
interface Dato {
  valor?: string
  detalle?: string
  tono?: Tono
  cargando: boolean
}

const route = useRoute()
const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const ruta = (accion: string) => ({ name: 'modulo', params: { entidadId: route.params.entidadId, seccion: 'mi', accion } })
/** La maqueta a un toque (`?ver=maqueta` evita volver a «Mi hogar»). */
const rutaMaqueta = { name: 'maqueta', params: { entidadId: route.params.entidadId }, query: { ver: 'maqueta' } }
const rutaReservas = { name: 'modulo', params: { entidadId: route.params.entidadId, seccion: 'zonas-comunes', accion: 'mis-reservas' } }

const vacio = (): Dato => ({ cargando: true })
const datos = ref<Record<string, Dato>>({
  bienes: vacio(),
  cartera: vacio(),
  paquetes: vacio(),
  visitas: vacio(),
  reservas: vacio(),
  pqrs: vacio(),
  comunicados: vacio(),
})

const con = {
  cartera: entidad.tieneModulo('contabilidad_ph'),
  porteria: entidad.tieneModulo('control_acceso'),
  reservas: entidad.tieneModulo('bienes_comunes') && entidad.tienePermiso('reservas.crear'),
  gestion: entidad.tieneModulo('gestion_administrativa'),
}

/** Carga una tarjeta; si falla, la tarjeta lo dice y las demás siguen. */
async function cargar(clave: string, fn: () => Promise<Omit<Dato, 'cargando'>>) {
  try {
    // Esperar antes de copiar: copiar primero pisaría lo que terminan las demás tarjetas.
    const dato = await fn()
    datos.value = { ...datos.value, [clave]: { ...dato, cargando: false } }
  } catch {
    datos.value = { ...datos.value, [clave]: { valor: '—', detalle: 'No se pudo consultar', tono: 'neutro', cargando: false } }
  }
}

onMounted(() => {
  void cargar('bienes', async () => {
    const lista = await bienes.asegurarPropios()
    return { valor: String(lista.length), detalle: lista.map((b) => b.codigo).join(', ') || 'Ninguno a su nombre', tono: 'info' }
  })
  if (con.cartera) {
    void cargar('cartera', async () => {
      const lista = await bienesCartera(id.value)
      const estados = await Promise.all(lista.map((b) => estadoCuenta(id.value, b.id)))
      const saldo = sumar('0', ...estados.map((e) => e.saldo))
      const vencido = sumar('0', ...estados.map((e) => e.vencido))
      const mora = comparar(vencido, '0') > 0
      return { valor: moneda(saldo), detalle: mora ? `En mora: ${moneda(vencido)}` : 'Al día', tono: mora ? 'peligro' : 'exito' }
    })
  }
  if (con.porteria) {
    void cargar('paquetes', async () => {
      const n = (await misPaquetes(id.value)).datos.filter((p) => p.estado === 'recibida').length
      return { valor: String(n), detalle: n ? 'Por recoger en portería' : 'Nada por recoger', tono: n ? 'aviso' : 'neutro' }
    })
    void cargar('visitas', async () => {
      const n = (await misVisitas(id.value)).datos.filter(esperaRespuesta).length
      return { valor: String(n), detalle: n ? 'Esperan su respuesta' : 'Ninguna por responder', tono: n ? 'peligro' : 'neutro' }
    })
  }
  if (con.reservas) {
    void cargar('reservas', async () => {
      const ahora = Date.now()
      const n = (await misReservas(id.value)).filter((r) => ['solicitada', 'aprobada'].includes(r.estado) && Date.parse(r.inicio) > ahora).length
      return { valor: String(n), detalle: n ? 'Próximas' : 'Sin reservas próximas', tono: 'info' }
    })
  }
  if (con.gestion) {
    void cargar('pqrs', async () => {
      const abiertas = (await misTickets()).filter((t) => t.copropiedad_id === id.value && !['resuelto', 'cerrado', 'rechazado', 'duplicado'].includes(t.estado))
      const esperan = abiertas.filter((t) => t.estado === 'en_espera_solicitante').length
      return { valor: String(abiertas.length), detalle: esperan ? `${esperan} esperan su respuesta` : 'Abiertas', tono: esperan ? 'peligro' : 'info' }
    })
    void cargar('comunicados', async () => {
      const n = (await misComunicados(id.value, undefined, 50)).datos.filter((c) => !c.leido_en).length
      return { valor: String(n), detalle: n ? 'Sin leer' : 'Todos leídos', tono: n ? 'aviso' : 'neutro' }
    })
  }
})
</script>

<template>
  <section
    class="inicio"
    aria-labelledby="titulo-inicio"
  >
    <header class="encabezado">
      <div>
        <h1 id="titulo-inicio">
          Mi hogar
        </h1>
        <p class="texto-2">
          {{ entidad.activa?.nombre }}
        </p>
      </div>
      <RouterLink
        :to="rutaMaqueta"
        class="maqueta"
      >
        <ICubo aria-hidden="true" /> Ver la maqueta
      </RouterLink>
    </header>
    <ul
      class="tarjetas"
      aria-label="Resumen"
    >
      <li>
        <TarjetaResumen
          titulo="Mis bienes"
          v-bind="datos.bienes"
          :a="ruta('bienes')"
        >
          <template #icono>
            <ICasa />
          </template>
        </TarjetaResumen>
      </li>
      <li v-if="con.cartera">
        <TarjetaResumen
          titulo="Mi saldo"
          v-bind="datos.cartera"
          :a="ruta('cartera')"
        >
          <template #icono>
            <IBilletera />
          </template>
        </TarjetaResumen>
      </li>
      <li v-if="con.porteria">
        <TarjetaResumen
          titulo="Visitas"
          v-bind="datos.visitas"
          :a="ruta('visitas')"
        >
          <template #icono>
            <IPersona />
          </template>
        </TarjetaResumen>
      </li>
      <li v-if="con.porteria">
        <TarjetaResumen
          titulo="Paquetes"
          v-bind="datos.paquetes"
          :a="{ ...ruta('visitas'), query: { vista: 'paquetes' } }"
        >
          <template #icono>
            <ICaja />
          </template>
        </TarjetaResumen>
      </li>
      <li v-if="con.reservas">
        <TarjetaResumen
          titulo="Reservas"
          v-bind="datos.reservas"
          :a="rutaReservas"
        >
          <template #icono>
            <ICalendario />
          </template>
        </TarjetaResumen>
      </li>
      <li v-if="con.gestion">
        <TarjetaResumen
          titulo="Solicitudes"
          v-bind="datos.pqrs"
          :a="ruta('pqrs')"
        >
          <template #icono>
            <IAyuda />
          </template>
        </TarjetaResumen>
      </li>
      <li v-if="con.gestion">
        <TarjetaResumen
          titulo="Comunicados"
          v-bind="datos.comunicados"
          :a="ruta('comunicados')"
        >
          <template #icono>
            <ICarta />
          </template>
        </TarjetaResumen>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.inicio {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-size: clamp(26px, 6vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.maqueta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  color: var(--cian);
}

.tarjetas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tarjetas li {
  display: grid;
}
</style>

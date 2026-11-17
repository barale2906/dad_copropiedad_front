<script setup lang="ts">
/**
 * Pantalla del turno (tableta, de pie, con prisa): botones grandes para anunciar, ingreso con QR,
 * recibir y entregar paquetes y minuta, y las visitas abiertas (primero las que esperan llamada).
 * Refresca cada 15 s y al volver a la pestaña: la web no recibe avisos de la portería.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Visita } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useRefresco } from '@/composables/useRefresco'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { usePreferencias } from '@/stores/preferencias'
import IMinuta from '~icons/tabler/notebook'
import IPaquete from '~icons/tabler/package'
import IEntregar from '~icons/tabler/package-export'
import IQr from '~icons/tabler/qrcode'
import IAnunciar from '~icons/tabler/user-plus'
import { ingresoVisita, listarCorrespondencia, listarVisitas, salidaVisita } from '../api'
import DialogoAnunciar from '../componentes/DialogoAnunciar.vue'
import DialogoQr from '../componentes/DialogoQr.vue'
import DialogoRecibir from '../componentes/DialogoRecibir.vue'
import ListaVisitas from '../componentes/ListaVisitas.vue'
import { accionesDeVisita, ordenarTurno, visitaAbierta } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const bienes = useBienes()
const prefs = usePreferencias()
const id = computed(() => entidad.activa?.entidad_id ?? '')

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const visitas = ref<Visita[]>([])
const porEntregar = ref(0)
const ahora = ref(new Date())
const resultado = ref<string | null>(null)
const dialogo = ref<'anunciar' | 'qr' | 'recibir' | null>(null)
const abierto = (d: NonNullable<typeof dialogo.value>) =>
  computed({ get: () => dialogo.value === d, set: (si: boolean) => (dialogo.value = si ? d : null) })
const anunciar = abierto('anunciar')
const qr = abierto('qr')
const recibir = abierto('recibir')

const abiertas = computed(() => ordenarTurno(visitas.value.filter(visitaAbierta)))
const porLlamar = computed(() => abiertas.value.filter((v) => v.estado === 'requiere_llamada').length)
const ruta = (accion: string, visitaId = '') => ({ name: 'modulo', params: { ...route.params, accion, id: visitaId } })
const detalle = (v: Visita) => ruta('visitas', v.id)

const paso = useAccion((_c, v: Visita, que: 'ingreso' | 'salida') =>
  que === 'ingreso' ? ingresoVisita(id.value, v.id) : salidaVisita(id.value, v.id), { alConflicto: () => cargar() })

async function registrar(v: Visita, que: 'ingreso' | 'salida') {
  const r = await paso.ejecutar(v, que)
  if (!r.ok) return
  resultado.value = `${v.visitante_nombre}: ${que === 'ingreso' ? 'ingreso registrado' : 'salida registrada'}.`
  await cargar()
}

function avisar(texto: string) {
  resultado.value = texto
  void cargar()
}

async function cargar() {
  try {
    const [v, p] = await Promise.all([
      listarVisitas(id.value),
      entidad.tienePermiso('acceso.correspondencia.entregar') ? listarCorrespondencia(id.value, 'recibida') : null,
    ])
    visitas.value = v.datos
    porEntregar.value = p?.datos.length ?? 0
    await bienes.resolver(v.datos.map((x) => x.bien_privado_id))
    ahora.value = new Date()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    if (estado.value !== 'listo') estado.value = 'error'
  }
}

useRefresco(cargar, { cada: 15_000 })
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-turno">
    <header class="encabezado">
      <h1 id="titulo-turno">
        Turno de portería
      </h1>
      <label class="equipo">
        <input
          v-model="prefs.turnoAlEntrar"
          type="checkbox"
        > Abrir el turno al entrar en este equipo
      </label>
    </header>

    <nav
      class="atajos"
      aria-label="Acciones del turno"
    >
      <button
        type="button"
        @click="dialogo = 'anunciar'"
      >
        <IAnunciar aria-hidden="true" /> Anunciar visita
      </button>
      <button
        type="button"
        @click="dialogo = 'qr'"
      >
        <IQr aria-hidden="true" /> Ingreso con QR
      </button>
      <button
        type="button"
        @click="dialogo = 'recibir'"
      >
        <IPaquete aria-hidden="true" /> Recibir paquete
      </button>
      <RouterLink
        v-if="entidad.tienePermiso('acceso.correspondencia.entregar')"
        :to="ruta('correspondencia')"
      >
        <IEntregar aria-hidden="true" /> Entregar paquete
        <span
          v-if="porEntregar"
          class="cuenta"
        >{{ porEntregar }}<span class="solo-lector"> por entregar</span></span>
      </RouterLink>
      <RouterLink
        v-if="entidad.tienePermiso('acceso.minuta.ver')"
        :to="ruta('minuta')"
      >
        <IMinuta aria-hidden="true" /> Minuta
      </RouterLink>
    </nav>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="paso.error.value"
      class="error"
      role="alert"
    >
      {{ paso.error.value }}
    </p>
    <p
      v-if="porLlamar"
      class="aviso"
      role="alert"
    >
      {{ porLlamar === 1 ? 'Una visita espera' : `${porLlamar} visitas esperan` }} que usted llame al residente.
    </p>

    <h2>Visitas abiertas</h2>
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
      v-else-if="abiertas.length === 0"
      estado="vacio"
      mensaje="No hay visitas abiertas."
    />
    <ListaVisitas
      v-else
      :visitas="abiertas"
      titulo="Visitas abiertas"
      :detalle="detalle"
      :ahora="ahora"
    >
      <template #acciones="{ visita: v }">
        <HudBoton
          v-if="v.estado === 'requiere_llamada'"
          :a="detalle(v)"
        >
          Llamar<span class="solo-lector"> por {{ v.visitante_nombre }}</span>
        </HudBoton>
        <HudBoton
          v-if="accionesDeVisita(v.estado).includes('ingreso')"
          :cargando="paso.cargando.value"
          @click="registrar(v, 'ingreso')"
        >
          Dejar pasar<span class="solo-lector"> a {{ v.visitante_nombre }}</span>
        </HudBoton>
        <HudBoton
          v-if="accionesDeVisita(v.estado).includes('salida')"
          variante="secundario"
          :cargando="paso.cargando.value"
          @click="registrar(v, 'salida')"
        >
          Salida<span class="solo-lector"> de {{ v.visitante_nombre }}</span>
        </HudBoton>
      </template>
    </ListaVisitas>

    <DialogoAnunciar
      v-model:abierto="anunciar"
      :entidad-id="id"
      @anunciada="(v) => avisar(`Visita de ${v.visitante_nombre} anunciada: se avisó al residente.`)"
    />
    <DialogoQr
      v-model:abierto="qr"
      :entidad-id="id"
      @ingreso="() => cargar()"
    />
    <DialogoRecibir
      v-model:abierto="recibir"
      :entidad-id="id"
      @recibida="() => avisar('Paquete registrado: se avisó al residente.')"
    />
  </section>
</template>

<style scoped src="./porteria.css"></style>
<style scoped>
.atajos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
  gap: 10px;
}

.atajos > button,
.atajos > a {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 96px;
  padding: 14px;
  border: 1px solid var(--linea-fuerte);
  background: var(--superficie);
  color: var(--texto);
  font: inherit;
  font-family: var(--fuente-display);
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

.atajos svg {
  width: 32px;
  height: 32px;
  color: var(--cian);
}

.atajos > button:hover,
.atajos > a:hover,
.atajos > button:focus-visible,
.atajos > a:focus-visible {
  border-color: var(--cian);
  background: var(--cian-tenue);
}

.cuenta {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 26px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ambar);
  color: var(--fondo);
  font-size: 14px;
}

.equipo {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  color: var(--texto-2);
  cursor: pointer;
}

.equipo input {
  width: 22px;
  height: 22px;
  accent-color: var(--cian);
}

h2 {
  margin: 8px 0 0;
  font-size: 20px;
}

:deep(.hud-boton) {
  min-height: 56px;
}
</style>

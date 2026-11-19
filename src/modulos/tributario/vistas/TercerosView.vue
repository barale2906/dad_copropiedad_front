<script setup lang="ts">
/**
 * Terceros (clientes y proveedores): búsqueda por nombre o documento con retardo, crear con sus
 * datos fiscales y editar los datos fiscales (tipo de documento, régimen, responsabilidades,
 * CIIU, dirección y correo de facturación). El documento se muestra con su dígito de verificación.
 */
import { computed, ref } from 'vue'
import { crearTercero, guardarDatosFiscales } from '@/api/terceros'
import type { DatosFiscales, NuevoTercero, Tercero } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { documentoLegible, REGIMEN_IVA, TIPO_PERSONA } from '@/formato/tributario'
import FormularioTercero from '@/hud/componentes/FormularioTercero.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { useTercerosConocidos } from '@/stores/terceros'
import IMas from '~icons/tabler/plus'
import { terceros as pedirTerceros } from '../api'

const entidad = useEntidad()
const conocidos = useTercerosConocidos()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const gestiona = computed(() => entidad.tienePermiso('terceros.gestionar'))

const texto = ref('')
const filtros = computed(() => ({ texto: texto.value }))
const listado = useListado(
  async (despues, f: { texto: string }) => {
    const p = await pedirTerceros(id.value, despues, f.texto)
    conocidos.recordar(p.datos.map((t) => ({ id: t.persona_id, nombre: t.nombre })))
    return p
  },
  { filtros, retardo: 300 },
)
const filas = computed(() =>
  listado.filas.value.map((t) => ({
    ...t, documentoTexto: `${t.tipo_documento ?? ''} ${documentoLegible(t.documento, t.tipo_documento)}`.trim(), tipoTexto: TIPO_PERSONA[t.tipo],
    regimen: t.fiscal.regimen_iva ? REGIMEN_IVA[t.fiscal.regimen_iva] : 'Sin definir', correo: t.fiscal.correo_facturacion ?? '—',
  })),
)
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'documentoTexto', titulo: 'Documento' },
  { clave: 'tipoTexto', titulo: 'Tipo' },
  { clave: 'regimen', titulo: 'Régimen de IVA' },
  { clave: 'correo', titulo: 'Correo de facturación' },
  { clave: 'acciones', titulo: 'Acciones' },
]

const resultado = ref<string | null>(null)
const creando = ref(false)
const editando = ref<Tercero | null>(null)
const abiertoEdicion = computed({ get: () => !!editando.value, set: (v) => !v && (editando.value = null) })
const crear = useAccion((clave, datos: NuevoTercero) => crearTercero(id.value, datos, clave))
const guardar = useAccion((_c, t: Tercero, datos: DatosFiscales) => guardarDatosFiscales(id.value, t.persona_id, datos))

async function alCrear(datos: NuevoTercero) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  creando.value = false
  resultado.value = `Tercero «${r.valor.nombre}» listo.`
  texto.value = r.valor.documento ?? r.valor.nombre
  await listado.recargar()
}

async function alGuardar(datos: DatosFiscales) {
  const t = editando.value
  if (!t) return
  const r = await guardar.ejecutar(t, datos)
  if (!r.ok) return
  editando.value = null
  resultado.value = `Datos fiscales de «${t.nombre}» guardados.`
  await listado.recargar()
}
</script>

<template>
  <section aria-labelledby="titulo-terceros">
    <header class="encabezado">
      <h1 id="titulo-terceros">
        Terceros
      </h1>
      <HudBoton
        v-if="gestiona"
        @click="creando = true"
      >
        <IMas aria-hidden="true" /> Nuevo tercero
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <div class="filtros">
      <HudCampo
        v-model="texto"
        etiqueta="Buscar tercero"
        ayuda="Nombre o documento."
      />
    </div>
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
      v-else-if="!filas.length"
      estado="vacio"
      mensaje="No hay terceros con esa búsqueda."
    />
    <template v-else>
      <HudTabla
        :filas="filas"
        :columnas="COLUMNAS"
        clave="persona_id"
        titulo="Terceros"
      >
        <template #celda-acciones="{ fila }">
          <HudBoton
            v-if="gestiona"
            variante="fantasma"
            @click="editando = fila"
          >
            Datos fiscales<span class="solo-lector"> de {{ fila.nombre }}</span>
          </HudBoton>
        </template>
      </HudTabla>
      <HudCargarMas
        :hay-mas="listado.hayMas.value"
        :cargando="listado.cargando.value"
        @cargar="listado.cargarMas()"
      />
    </template>
    <HudDialogo
      v-model:abierto="creando"
      titulo="Nuevo tercero"
    >
      <FormularioTercero
        v-if="creando"
        :cargando="crear.cargando.value"
        :error="crear.error.value"
        @crear="alCrear"
        @cancelar="creando = false"
      />
    </HudDialogo>
    <HudDialogo
      v-model:abierto="abiertoEdicion"
      :titulo="`Datos fiscales de ${editando?.nombre ?? ''}`"
    >
      <FormularioTercero
        v-if="editando"
        :tercero="editando"
        :cargando="guardar.cargando.value"
        :error="guardar.error.value"
        @fiscal="alGuardar"
        @cancelar="editando = null"
      />
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

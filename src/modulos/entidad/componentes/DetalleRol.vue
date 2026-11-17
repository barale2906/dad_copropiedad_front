<script setup lang="ts">
/**
 * Un rol con su matriz de permisos. Los roles propios se editan (con `roles.gestionar`); las
 * plantillas del sistema solo se consultan y sirven de base para un rol propio.
 */
import { computed, ref, watch } from 'vue'
import type { Permiso, Rol } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { cambiarPermisos } from '../api'
import { diferencia, etiquetaPermiso, type GrupoPermisos, noOtorgables } from '../permisos'
import MatrizPermisos from './MatrizPermisos.vue'

const props = defineProps<{
  rol: Rol
  grupos: GrupoPermisos[]
  entidadId: string
  puedeGestionar: boolean
}>()
const emit = defineEmits<{ guardado: [rol: Rol]; crearDesde: [rolId: string] }>()

const entidad = useEntidad()

const elegidos = ref<Permiso[]>([])
const guardadoOk = ref(false)

const editable = computed(() => props.puedeGestionar && !props.rol.es_plantilla)
const cambios = computed(() => diferencia(props.rol.permisos, elegidos.value))
const hayCambios = computed(() => cambios.value.agregados.length + cambios.value.quitados.length > 0)
const ajenos = computed(() => noOtorgables(elegidos.value, entidad.tienePermiso))

const guardar = useAccion((_clave, permisos: Permiso[]) => cambiarPermisos(props.entidadId, props.rol.id, permisos))

watch(
  () => props.rol,
  (r, antes) => {
    elegidos.value = [...r.permisos]
    guardar.reiniciar()
    if (r.id !== antes?.id) guardadoOk.value = false
  },
  { immediate: true },
)

watch(hayCambios, (si) => {
  if (si) guardadoOk.value = false
})

async function enviar() {
  const r = await guardar.ejecutar(elegidos.value)
  if (!r.ok) return
  emit('guardado', r.valor)
  guardadoOk.value = true
  // Si la cuenta tiene este rol, sus permisos efectivos cambiaron: se repinta todo.
  if (entidad.tieneRol(props.rol.codigo)) await entidad.refrescar().catch(() => undefined)
}

function descartar() {
  elegidos.value = [...props.rol.permisos]
  guardar.reiniciar()
}
</script>

<template>
  <div class="detalle">
    <HudPanel :etiqueta="rol.es_plantilla ? 'Rol del sistema' : 'Rol propio'">
      <div class="encabezado">
        <div>
          <h2>{{ rol.nombre }}</h2>
          <p class="codigo">
            {{ rol.codigo }}
          </p>
          <p
            v-if="rol.descripcion"
            class="texto-2"
          >
            {{ rol.descripcion }}
          </p>
        </div>
        <HudInsignia :tono="rol.es_plantilla ? 'info' : 'neutro'">
          {{ rol.es_plantilla ? 'Plantilla' : 'Propio' }}
        </HudInsignia>
      </div>
      <p
        v-if="rol.es_plantilla"
        class="nota"
      >
        Los roles del sistema no se editan.
        <template v-if="puedeGestionar">
          Si necesita otra combinación de permisos, cree un rol propio a partir de este.
        </template>
      </p>
      <HudBoton
        v-if="rol.es_plantilla && puedeGestionar"
        variante="secundario"
        @click="emit('crearDesde', rol.id)"
      >
        Crear un rol a partir de este
      </HudBoton>
    </HudPanel>

    <MatrizPermisos
      v-model="elegidos"
      :grupos="grupos"
      :solo-lectura="!editable"
      :puede-otorgar="entidad.tienePermiso"
    />

    <div
      v-if="editable"
      class="pie"
    >
      <p
        v-if="ajenos.length"
        class="aviso"
        role="alert"
      >
        Este rol tiene {{ ajenos.length }} permisos que usted no tiene
        ({{ ajenos.map(etiquetaPermiso).join(', ') }}). Quítelos para guardar, o pida el cambio
        a alguien que los tenga.
      </p>
      <p
        v-else-if="hayCambios"
        class="resumen"
        aria-live="polite"
      >
        Cambios sin guardar: {{ cambios.agregados.length }} permisos agregados y
        {{ cambios.quitados.length }} quitados.
      </p>
      <p
        v-if="guardar.error.value"
        class="error"
        role="alert"
      >
        {{ guardar.error.value }}
      </p>
      <p
        v-if="guardadoOk"
        class="ok"
        role="status"
      >
        Permisos guardados.
      </p>
      <div class="botones">
        <HudBoton
          variante="fantasma"
          :deshabilitado="!hayCambios"
          @click="descartar"
        >
          Descartar cambios
        </HudBoton>
        <HudBoton
          :cargando="guardar.cargando.value"
          :deshabilitado="!hayCambios || ajenos.length > 0"
          @click="enviar"
        >
          Guardar permisos
        </HudBoton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detalle {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: clamp(22px, 3vw, 28px);
}

.codigo {
  margin: 2px 0 0;
  color: var(--texto-3);
  font-family: var(--fuente-mono);
  font-size: 13px;
}

.texto-2,
.nota {
  color: var(--texto-2);
}

.texto-2 {
  margin: 8px 0 0;
}

.nota {
  margin: 12px 0;
}

.pie {
  position: sticky;
  bottom: 0;
  display: grid;
  gap: 8px;
  padding: 12px 0;
  background: var(--fondo);
  border-top: 1px solid var(--linea);
}

.pie p {
  margin: 0;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.resumen {
  color: var(--texto-2);
}

.aviso {
  color: var(--ambar);
}

.error {
  color: var(--magenta);
}

.ok {
  color: var(--verde);
}
</style>

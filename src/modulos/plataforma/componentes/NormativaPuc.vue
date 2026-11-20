<script setup lang="ts">
/** Carga del PUC: se pega el CSV, se revisa (vista previa con errores por fila) y se carga. */
import { computed, ref } from 'vue'
import { useAccion } from '@/composables/useAccion'
import { numero } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import TablaErroresImportacion from '@/hud/componentes/TablaErroresImportacion.vue'
import { cargarPuc } from '../api-normativa'
import { leerPuc } from '../reglas'
import EditorTablaNormativa from './EditorTablaNormativa.vue'

const texto = ref('')
const resultado = ref<string | null>(null)
const lectura = computed(() => leerPuc(texto.value))
const cargar = useAccion(() => cargarPuc(lectura.value.cuentas), {
  alExito: (n) => {
    resultado.value = `Se insertaron o actualizaron ${numero(String(n), 0)} cuentas del PUC.`
    texto.value = ''
  },
})
</script>

<template>
  <EditorTablaNormativa
    titulo="Plan Único de Cuentas"
    descripcion="Inserta o actualiza cuentas del catálogo; no borra las que no vengan."
  >
    <div class="campos">
      <HudCampo
        v-model="texto"
        etiqueta="Cuentas (CSV: código, nombre, naturaleza)"
        multilinea
        ayuda="Una cuenta por línea, por ejemplo: 110505,Caja general,debito. La naturaleza puede ser D o C."
      />
      <p
        v-if="texto.trim()"
        class="texto-2"
        role="status"
      >
        Vista previa: {{ lectura.cuentas.length }} cuentas listas<template v-if="lectura.errores.length">
          y {{ lectura.errores.length }} filas con errores
        </template>.
      </p>
      <TablaErroresImportacion
        v-if="lectura.errores.length"
        :errores="lectura.errores"
        titulo="Corrija estas filas antes de cargar"
      />
      <div>
        <HudBoton
          :deshabilitado="lectura.cuentas.length === 0 || lectura.errores.length > 0"
          :cargando="cargar.cargando.value"
          @click="cargar.ejecutar()"
        >
          Cargar {{ lectura.cuentas.length || '' }} cuentas
        </HudBoton>
      </div>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-if="cargar.error.value"
        class="error"
        role="alert"
      >
        {{ cargar.error.value }}
      </p>
    </div>
  </EditorTablaNormativa>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

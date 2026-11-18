<script setup lang="ts">
/** Anexos de la convocatoria (estados financieros, presupuesto, informes…): subir, ver y quitar. */
import { ref } from 'vue'
import type { DocumentoReunion, TipoDocumentoReunion } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { anexarDocumento, quitarDocumento } from '../api'
import { TIPO_DOCUMENTO } from '../reglas'

const props = defineProps<{ entidadId: string; reunionId: string; documentos: DocumentoReunion[]; editable: boolean }>()
const emit = defineEmits<{ cambio: [] }>()

const tipo = ref<TipoDocumentoReunion>('informe')
const titulo = ref('')
const archivos = useAdjuntos(() => props.entidadId, 'interno')
const anexar = useAccion((_c, archivo: string) => anexarDocumento(props.entidadId, props.reunionId, archivo, tipo.value, titulo.value.trim() || TIPO_DOCUMENTO[tipo.value]))
const quitar = useAccion((_c, archivo: string) => quitarDocumento(props.entidadId, props.reunionId, archivo))

async function subir(lista: File[]) {
  const antes = archivos.adjuntos.value.length
  await archivos.subir(lista)
  for (const a of archivos.adjuntos.value.slice(antes)) {
    if (!(await anexar.ejecutar(a.id)).ok) return
  }
  archivos.limpiar()
  titulo.value = ''
  emit('cambio')
}

async function sacar(archivo: string) {
  if ((await quitar.ejecutar(archivo)).ok) emit('cambio')
}
</script>

<template>
  <div class="campos">
    <ul
      v-if="documentos.length"
      class="lista"
      aria-label="Anexos de la convocatoria"
    >
      <li
        v-for="d in documentos"
        :key="d.archivo_id"
      >
        <span class="crece">
          <strong>{{ d.titulo }}</strong>
          <small>{{ TIPO_DOCUMENTO[d.tipo] }}</small>
        </span>
        <HudBoton
          variante="fantasma"
          @click="archivos.abrir(d.archivo_id)"
        >
          Ver<span class="solo-lector"> {{ d.titulo }}</span>
        </HudBoton>
        <HudBoton
          v-if="editable"
          variante="fantasma"
          :cargando="quitar.cargando.value"
          @click="sacar(d.archivo_id)"
        >
          Quitar<span class="solo-lector"> {{ d.titulo }}</span>
        </HudBoton>
      </li>
    </ul>
    <p
      v-else
      class="texto-2"
    >
      Sin anexos.
    </p>
    <template v-if="editable">
      <div class="filtros">
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo de anexo"
          :opciones="opcionesDe(TIPO_DOCUMENTO)"
        />
        <HudCampo
          v-model="titulo"
          etiqueta="Título del anexo (opcional)"
          autocompletar="off"
        />
      </div>
      <HudAdjuntos
        :adjuntos="archivos.adjuntos.value"
        acepta="application/pdf,image/*"
        :subiendo="archivos.subiendo.value || anexar.cargando.value"
        @subir="subir"
        @abrir="archivos.abrir"
        @quitar="archivos.quitar"
      />
    </template>
    <p
      v-for="e in [archivos.error.value, anexar.error.value, quitar.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>
  </div>
</template>

<style scoped src="../vistas/asambleas.css"></style>

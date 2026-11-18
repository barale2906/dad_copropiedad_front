import { type MaybeRefOrGetter, ref, toValue } from 'vue'
import { abrirArchivo, subirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { ClasificacionArchivo } from '@/api/tipos'

export interface AdjuntoSubido {
  id: string
  nombre: string
}

/**
 * Adjuntos de un formulario (va con `<HudAdjuntos>`): sube uno a uno con la clasificación dada,
 * deja el error legible si alguno falla (conservando los que sí subieron), abre con enlace
 * firmado y quita de la lista.
 *
 * ```ts
 * const fotos = useAdjuntos(() => entidad.activa?.entidad_id ?? '', 'interno')
 * // <HudAdjuntos :adjuntos="fotos.adjuntos.value" :subiendo="fotos.subiendo.value" @subir="fotos.subir" …>
 * ```
 */
export function useAdjuntos(entidadId: MaybeRefOrGetter<string>, clasificacion: ClasificacionArchivo = 'interno') {
  const adjuntos = ref<AdjuntoSubido[]>([])
  const subiendo = ref(false)
  const error = ref<string | null>(null)

  async function subir(archivos: File[]) {
    subiendo.value = true
    error.value = null
    try {
      for (const a of archivos) {
        const f = await subirArchivo(toValue(entidadId), a, clasificacion)
        adjuntos.value = [...adjuntos.value, { id: f.id, nombre: f.nombre }]
      }
    } catch (e) {
      error.value = mensajeDeError(e)
    } finally {
      subiendo.value = false
    }
  }

  async function abrir(archivoId: string) {
    error.value = null
    try {
      await abrirArchivo(toValue(entidadId), archivoId)
    } catch (e) {
      error.value = mensajeDeError(e)
    }
  }

  function quitar(archivoId: string) {
    adjuntos.value = adjuntos.value.filter((a) => a.id !== archivoId)
  }

  function limpiar() {
    adjuntos.value = []
    error.value = null
  }

  const ids = () => adjuntos.value.map((a) => a.id)

  return { adjuntos, subiendo, error, subir, abrir, quitar, limpiar, ids }
}

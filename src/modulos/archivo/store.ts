import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Archivo } from '@/api/tipos'

/**
 * Archivos subidos en esta sesión, por entidad (más recientes primero). El contrato aún no
 * permite listar el archivo de la entidad (solicitud S11 al backend).
 */
export const useArchivoSubido = defineStore('archivo-subido', () => {
  const porEntidad = ref<Record<string, Archivo[]>>({})

  const de = (entidadId: string): Archivo[] => porEntidad.value[entidadId] ?? []

  function agregar(entidadId: string, a: Archivo) {
    porEntidad.value = { ...porEntidad.value, [entidadId]: [a, ...de(entidadId)] }
  }

  return { porEntidad, de, agregar }
})

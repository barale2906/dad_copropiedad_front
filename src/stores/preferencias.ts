import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { NivelCalidad } from '@/escena/calidad'

export type VistaInicio = 'maqueta' | 'lista'

const CLAVE = 'dad.preferencias'

interface Guardadas {
  vista: VistaInicio
  calidad: NivelCalidad | 'auto'
}

function leer(): Partial<Guardadas> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Guardadas>
  } catch {
    return {}
  }
}

/** Preferencias de este navegador (vista de inicio y calidad 3D). */
export const usePreferencias = defineStore('preferencias', () => {
  const g = leer()
  const vista = ref<VistaInicio>(g.vista ?? 'maqueta')
  const calidad = ref<NivelCalidad | 'auto'>(g.calidad ?? 'auto')

  watch([vista, calidad], () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ vista: vista.value, calidad: calidad.value }))
    } catch {
      /* sin almacenamiento */
    }
  })

  return { vista, calidad }
})

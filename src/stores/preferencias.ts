import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { NivelCalidad } from '@/escena/calidad'

export type VistaInicio = 'maqueta' | 'lista'

const CLAVE = 'dad.preferencias'

interface Guardadas {
  vista: VistaInicio
  calidad: NivelCalidad | 'auto'
  /** Equipo de portería: al entrar abre el turno en lugar de la maqueta. */
  turnoAlEntrar: boolean
}

function leer(): Partial<Guardadas> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Guardadas>
  } catch {
    return {}
  }
}

/** Preferencias de este navegador (vista de inicio, calidad 3D y si es un equipo de portería). */
export const usePreferencias = defineStore('preferencias', () => {
  const g = leer()
  const vista = ref<VistaInicio>(g.vista ?? 'maqueta')
  const calidad = ref<NivelCalidad | 'auto'>(g.calidad ?? 'auto')
  const turnoAlEntrar = ref(g.turnoAlEntrar === true)

  watch([vista, calidad, turnoAlEntrar], () => {
    try {
      const guardadas: Guardadas = { vista: vista.value, calidad: calidad.value, turnoAlEntrar: turnoAlEntrar.value }
      localStorage.setItem(CLAVE, JSON.stringify(guardadas))
    } catch {
      /* sin almacenamiento */
    }
  })

  return { vista, calidad, turnoAlEntrar }
})

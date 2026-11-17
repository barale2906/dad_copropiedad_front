import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Razón social de las organizaciones vistas en esta sesión, por id. Los contratos solo traen
 * `organizacion_id` (solicitud S12 al backend); mientras tanto se muestran las que se conocen.
 */
export const useOrganizacionesConocidas = defineStore('organizaciones-conocidas', () => {
  const nombres = ref<Record<string, string>>({})

  function recordar(id: string, razonSocial: string) {
    nombres.value = { ...nombres.value, [id]: razonSocial }
  }

  const nombre = (id: string): string | null => nombres.value[id] ?? null

  return { nombres, recordar, nombre }
})

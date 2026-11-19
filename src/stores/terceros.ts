import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Nombres de los terceros vistos en la sesión (búsquedas y selecciones). Las respuestas de
 * comprobantes, recibos, egresos y facturas traen solo `persona_id` (solicitud S18): con esto se
 * muestran los nombres conocidos y «Tercero» para los demás.
 */
export const useTercerosConocidos = defineStore('terceros-conocidos', () => {
  const nombres = ref<Record<string, string>>({})

  function recordar(lista: { id: string; nombre: string }[]) {
    nombres.value = { ...nombres.value, ...Object.fromEntries(lista.filter((t) => t.nombre).map((t) => [t.id, t.nombre])) }
  }

  const nombre = (id: string | null | undefined, porDefecto = 'Tercero') => (id ? (nombres.value[id] ?? porDefecto) : '—')

  return { nombres, recordar, nombre }
})

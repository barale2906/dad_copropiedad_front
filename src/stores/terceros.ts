import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, exigir } from '@/api/cliente'

/**
 * Nombres de los terceros de la entidad activa. Las respuestas de comprobantes, recibos, egresos
 * y facturas traen solo `persona_id`: los nombres se toman de lo visto en la sesión (búsquedas y
 * selecciones) y los que faltan se piden con `GET …/terceros/{persona_id}` (`resolver`), una vez
 * por tercero. Se reinicia al cambiar de entidad.
 */
export const useTercerosConocidos = defineStore('terceros-conocidos', () => {
  const entidadId = ref<string | null>(null)
  const nombres = ref<Record<string, string>>({})
  /** Pedidos en curso o que fallaron (sin permiso, no existe): no se repiten en la sesión. */
  let pedidos = new Set<string>()

  /** Lo recordado antes de la primera consulta es de la entidad activa: solo se olvida al cambiar. */
  function para(id: string) {
    if (entidadId.value === id) return
    if (entidadId.value !== null) {
      nombres.value = {}
      pedidos = new Set()
    }
    entidadId.value = id
  }

  function recordar(lista: { id: string; nombre: string }[]) {
    nombres.value = { ...nombres.value, ...Object.fromEntries(lista.filter((t) => t.nombre).map((t) => [t.id, t.nombre])) }
  }

  /**
   * Pide en paralelo los nombres que aún no se conocen (mismos permisos que el listado de
   * terceros). Si uno falla, se sigue mostrando el texto por defecto.
   */
  async function resolver(entidad: string, ids: (string | null | undefined)[]): Promise<void> {
    para(entidad)
    const faltan = [...new Set(ids)].filter((x): x is string => !!x && !(x in nombres.value) && !pedidos.has(x))
    faltan.forEach((x) => pedidos.add(x))
    await Promise.all(
      faltan.map(async (personaId) => {
        try {
          const t = await exigir(
            api().GET('/api/v1/entidades/{entidad_id}/terceros/{persona_id}', {
              params: { path: { entidad_id: entidad, persona_id: personaId } },
            }),
          )
          // Si la entidad cambió mientras se consultaba, el nombre es de la anterior.
          if (entidadId.value === entidad) recordar([{ id: personaId, nombre: t.nombre }])
        } catch {
          /* se muestra el texto por defecto */
        }
      }),
    )
  }

  const nombre = (id: string | null | undefined, porDefecto = 'Tercero') => (id ? (nombres.value[id] ?? porDefecto) : '—')

  return { nombres, recordar, resolver, nombre }
})

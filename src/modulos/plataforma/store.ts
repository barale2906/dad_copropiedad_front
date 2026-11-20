import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { EntidadPlataforma, Permiso } from '@/api/tipos'
import { useCuenta } from '@/stores/cuenta'
import { listarEntidades } from './api-clientes'

/** Páginas que se recorren como máximo al buscar todos los clientes (50 por página). */
const MAXIMO_PAGINAS = 40

/**
 * Clientes de la plataforma que comparten las vistas de la consola: la ficha de un cliente, las
 * suscripciones, las exclusiones y los cortes solo traen `entidad_id` y aquí se nombran. Se
 * piden una vez (todas las páginas) y se recargan tras un alta o un cambio de estado.
 */
export const useClientes = defineStore('plataforma-clientes', () => {
  const lista = ref<EntidadPlataforma[]>([])
  const cargados = ref(false)
  let pendiente: Promise<void> | null = null

  const opciones = computed(() =>
    [...lista.value].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((e) => ({ valor: e.id, etiqueta: e.nombre })),
  )

  async function recargar(): Promise<void> {
    const todos: EntidadPlataforma[] = []
    let despues: string | undefined
    for (let i = 0; i < MAXIMO_PAGINAS; i++) {
      const p = await listarEntidades(despues)
      todos.push(...p.datos)
      if (!p.siguiente) break
      despues = p.siguiente
    }
    lista.value = todos
    cargados.value = true
  }

  /** Carga una vez (las llamadas simultáneas comparten la consulta). */
  function asegurar(): Promise<void> {
    if (cargados.value) return Promise.resolve()
    pendiente ??= recargar().finally(() => (pendiente = null))
    return pendiente
  }

  const porId = (id: string) => lista.value.find((e) => e.id === id) ?? null
  const nombre = (id: string) => porId(id)?.nombre ?? 'Entidad sin nombre'

  /** Refleja un cambio (estado, módulos) sin volver a pedir la lista. */
  function actualizar(e: EntidadPlataforma) {
    lista.value = lista.value.some((x) => x.id === e.id) ? lista.value.map((x) => (x.id === e.id ? e : x)) : [...lista.value, e]
  }

  return { lista, cargados, opciones, asegurar, recargar, porId, nombre, actualizar }
})

/** Permisos de plataforma de la cuenta (`GET /yo`): la consola no usa los de la entidad. */
export function usePermisosPlataforma() {
  const cuenta = useCuenta()
  return { puede: (p: Permiso) => cuenta.permisosPlataforma.has(p) }
}

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CategoriaDirectorio } from '@/api/tipos'
import { categorias as pedirCategorias } from './api'
import { categoriaPrincipal, opcionesCategorias } from './reglas'

/**
 * Categorías del directorio de la entidad activa, que comparten el listado, la ficha y «Busco …»
 * (para nombrar la categoría de cada tarjeta). Se piden una vez por entidad.
 */
export const useCategoriasDirectorio = defineStore('categorias-directorio', () => {
  const entidadId = ref<string | null>(null)
  const lista = ref<CategoriaDirectorio[]>([])
  let pendiente: Promise<void> | null = null

  const opciones = computed(() => opcionesCategorias(lista.value))

  /** Carga una vez por entidad (las llamadas simultáneas comparten la misma consulta). */
  function asegurar(id: string): Promise<void> {
    if (entidadId.value === id) return Promise.resolve()
    pendiente ??= pedirCategorias(id)
      .then((c) => {
        lista.value = c
        entidadId.value = id
      })
      .finally(() => (pendiente = null))
    return pendiente
  }

  const nombre = (codigos: readonly string[]) => categoriaPrincipal(codigos, lista.value)

  return { lista, opciones, asegurar, nombre }
})

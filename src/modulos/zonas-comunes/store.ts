import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CobroRecurso, Recurso } from '@/api/tipos'
import { listarRecursos, obtenerCobro } from './api'

/**
 * Datos de apoyo de Zonas comunes compartidos entre sus vistas: los recursos de la PH (las
 * reservas solo traen `recurso_id`) y cómo se cobra cada recurso. Se cargan una vez por entidad
 * y bajo demanda. Los códigos de los bienes están en `useBienes` (`src/stores/bienes.ts`).
 */
export const useZonasComunes = defineStore('zonas-comunes', () => {
  const entidadId = ref<string | null>(null)
  const recursos = ref<Recurso[]>([])
  const cargados = ref(false)
  const cobros = ref<Record<string, CobroRecurso>>({})

  function para(id: string) {
    if (entidadId.value === id) return
    entidadId.value = id
    recursos.value = []
    cargados.value = false
    cobros.value = {}
  }

  /** Todos los recursos de la PH (una sola vez; `forzar` para recargar tras editar). */
  async function asegurarRecursos(id: string, forzar = false): Promise<Recurso[]> {
    para(id)
    if (!cargados.value || forzar) {
      recursos.value = await listarRecursos(id)
      cargados.value = true
    }
    return recursos.value
  }

  function recordarRecurso(r: Recurso) {
    const i = recursos.value.findIndex((x) => x.id === r.id)
    recursos.value = i < 0 ? [...recursos.value, r] : recursos.value.map((x) => (x.id === r.id ? r : x))
  }

  const nombreRecurso = (id: string) => recursos.value.find((r) => r.id === id)?.nombre ?? 'Recurso'
  const recurso = (id: string) => recursos.value.find((r) => r.id === id) ?? null

  /** Cómo se cobra un recurso (decide si se ofrece «Registrar pago» o «Facturar»). */
  async function cobroDe(id: string, recursoId: string): Promise<CobroRecurso | null> {
    para(id)
    if (!cobros.value[recursoId]) {
      try {
        const cobro = await obtenerCobro(id, recursoId)
        cobros.value = { ...cobros.value, [recursoId]: cobro }
      } catch {
        return null
      }
    }
    return cobros.value[recursoId] ?? null
  }

  function recordarCobro(recursoId: string, c: CobroRecurso) {
    cobros.value = { ...cobros.value, [recursoId]: c }
  }

  return {
    recursos,
    cobros,
    asegurarRecursos,
    recordarRecurso,
    nombreRecurso,
    recurso,
    cobroDe,
    recordarCobro,
  }
})

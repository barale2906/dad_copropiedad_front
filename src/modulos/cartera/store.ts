import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BienCartera, ConceptoCobro } from '@/api/tipos'
import { bienes as pedirBienes, conceptos as pedirConceptos } from './api'

/**
 * Unidades (con su referencia de pago) y conceptos de cobro de la PH activa, que comparten las
 * vistas de la cartera. Se piden una vez por entidad; `recargar` tras cambiarlos.
 */
export const useCartera = defineStore('cartera', () => {
  const entidadId = ref<string | null>(null)
  const bienes = ref<BienCartera[]>([])
  const conceptos = ref<ConceptoCobro[]>([])
  let pendiente: Promise<void> | null = null

  const porCodigo = (a: BienCartera, b: BienCartera) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })
  const opcionesBien = computed(() => [...bienes.value].sort(porCodigo).map((b) => ({ valor: b.id, etiqueta: b.codigo })))

  async function recargar(id: string): Promise<void> {
    const [b, c] = await Promise.all([pedirBienes(id), pedirConceptos(id)])
    entidadId.value = id
    bienes.value = b
    conceptos.value = c
  }

  /** Carga una vez por entidad (las llamadas simultáneas comparten la misma consulta). */
  function asegurar(id: string): Promise<void> {
    if (entidadId.value === id && bienes.value.length) return Promise.resolve()
    pendiente ??= recargar(id).finally(() => (pendiente = null))
    return pendiente
  }

  const codigo = (bienId: string) => bienes.value.find((b) => b.id === bienId)?.codigo ?? 'Unidad'
  const concepto = (conceptoId: string) => conceptos.value.find((c) => c.id === conceptoId) ?? null

  return { bienes, conceptos, opcionesBien, asegurar, recargar, codigo, concepto }
})

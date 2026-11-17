import { computed } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Pestaña actual según `?vista=` (la primera si falta o no se conoce). Va con `<HudPestanas>`.
 *
 * ```ts
 * const PESTANAS = [{ id: 'datos', texto: 'Datos' }, { id: 'horario', texto: 'Horario' }] as const
 * const pestana = usePestana(PESTANAS)
 * ```
 */
export function usePestana<I extends string>(pestanas: readonly { id: I }[]) {
  const route = useRoute()
  return computed<I>(() => pestanas.find((p) => p.id === route.query.vista)?.id ?? (pestanas[0]?.id as I))
}

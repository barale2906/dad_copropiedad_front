import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { buscarTerceros } from '@/api/contabilidad'
import { crearTercero } from '@/api/terceros'
import type { NuevoTercero, Tercero } from '@/api/tipos'
import { uuid } from '@/api/uuid'
import { documentoLegible } from '@/formato/tributario'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { useEntidad } from '@/stores/entidad'
import { useTercerosConocidos } from '@/stores/terceros'

/** Opción de selector para un tercero: nombre y documento legible (NIT con su dígito). */
export const opcionTercero = (t: Pick<Tercero, 'persona_id' | 'nombre' | 'tipo_documento' | 'documento'>): OpcionPersona => ({
  id: t.persona_id,
  nombre: t.nombre,
  detalle: t.documento ? `${t.tipo_documento ?? ''} ${documentoLegible(t.documento, t.tipo_documento)}`.trim() : null,
})

/**
 * Funciones para `<SelectorTercero :buscar :crear>`: buscar por nombre o documento y, con
 * `terceros.gestionar`, crear en línea. Los nombres se recuerdan en la sesión
 * (`useTercerosConocidos`) para mostrarlos en listas que solo traen `persona_id`.
 */
export function useBuscarTerceros(entidadId: MaybeRefOrGetter<string>) {
  const entidad = useEntidad()
  const conocidos = useTercerosConocidos()

  async function buscar(q: string): Promise<OpcionPersona[]> {
    const r = await buscarTerceros(toValue(entidadId), q)
    const lista = r.datos.map(opcionTercero)
    conocidos.recordar(lista)
    return lista
  }

  async function crear(datos: NuevoTercero): Promise<OpcionPersona> {
    const opcion = opcionTercero(await crearTercero(toValue(entidadId), datos, uuid()))
    conocidos.recordar([opcion])
    return opcion
  }

  const puedeCrear = computed(() => entidad.tienePermiso('terceros.gestionar'))
  /** Para `:crear`: la función solo si la cuenta puede crear terceros. */
  const crearSiPuede = computed(() => (puedeCrear.value ? crear : null))

  return { buscar, crear, puedeCrear, crearSiPuede }
}

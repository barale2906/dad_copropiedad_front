/** Personas de la PH (`personas.ver`): búsqueda por nombre sin tildes o documento, por cursor. */
import { api, exigir } from './cliente'

export function buscarPersonas(copropiedadId: string, q: string | undefined, despues?: string, limite = 20) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/personas', {
      params: { path: { copropiedad_id: copropiedadId }, query: { q: q?.trim() || undefined, limite, despues } },
    }),
  )
}

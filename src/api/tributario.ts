/** Perfil tributario de la entidad (lo leen facturación, contabilidad y tributario). */
import { api, exigir } from './cliente'
import type { PerfilTributario } from './tipos'

/** Todas las versiones del perfil (borradores y confirmadas). */
export function perfilesTributarios(id: string): Promise<PerfilTributario[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/tributario/perfiles', { params: { path: { entidad_id: id } } }))
}

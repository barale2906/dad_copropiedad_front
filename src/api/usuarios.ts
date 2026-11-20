/**
 * Usuarios, roles y asignaciones de una entidad. Los mismos esquemas sirven dos rutas: la de la
 * propia entidad (`/entidades/{id}/…`, su administrador) y la de la plataforma
 * (`/plataforma/entidades/{id}/…`, `plataforma.entidades.usuarios`). El destino es el id de la
 * entidad o `{ plataforma: id }`.
 */
import { api, exigir, idempotencia } from './cliente'
import type { Asignacion, NuevoRol, NuevoUsuario, Permiso, PermisoDelCatalogo, Rol, UsuarioCreado } from './tipos'

/** Id de la entidad (ruta de la entidad) o `{ plataforma: id }` (ruta de la consola). */
export type DestinoUsuarios = string | { plataforma: string }

const partes = (d: DestinoUsuarios) => (typeof d === 'string' ? { id: d, plataforma: false } : { id: d.plataforma, plataforma: true })
const ruta = (id: string) => ({ path: { entidad_id: id } })

/** Página de usuarios con sus roles (búsqueda `q` por nombre, usuario o correo). */
export function listarUsuarios(destino: DestinoUsuarios, despues?: string, q?: string) {
  const { id, plataforma } = partes(destino)
  const params = { ...ruta(id), query: { limite: 50, despues, q: q?.trim() || undefined } }
  return plataforma
    ? exigir(api().GET('/api/v1/plataforma/entidades/{entidad_id}/usuarios', { params }))
    : exigir(api().GET('/api/v1/entidades/{entidad_id}/usuarios', { params }))
}

/** Crea el usuario con su rol, o asigna el rol a la cuenta que ya tiene ese correo. */
export function crearUsuario(destino: DestinoUsuarios, datos: NuevoUsuario, clave: string): Promise<UsuarioCreado> {
  const { id, plataforma } = partes(destino)
  const opciones = { params: ruta(id), body: datos, headers: idempotencia(clave) }
  return plataforma
    ? exigir(api().POST('/api/v1/plataforma/entidades/{entidad_id}/usuarios', opciones))
    : exigir(api().POST('/api/v1/entidades/{entidad_id}/usuarios', opciones))
}

/** Reenvía el código para definir la contraseña (422 si ya la definió). */
export async function reenviarCodigo(destino: DestinoUsuarios, cuentaId: string): Promise<void> {
  const { id, plataforma } = partes(destino)
  const params = { path: { entidad_id: id, cuenta_id: cuentaId } }
  if (plataforma) await exigir(api().POST('/api/v1/plataforma/entidades/{entidad_id}/usuarios/{cuenta_id}/codigo-contrasena', { params }))
  else await exigir(api().POST('/api/v1/entidades/{entidad_id}/usuarios/{cuenta_id}/codigo-contrasena', { params }))
}

/** Roles de la entidad (plantillas del sistema y propios). */
export function listarRoles(destino: DestinoUsuarios): Promise<Rol[]> {
  const { id, plataforma } = partes(destino)
  return plataforma
    ? exigir(api().GET('/api/v1/plataforma/entidades/{entidad_id}/roles', { params: ruta(id) }))
    : exigir(api().GET('/api/v1/entidades/{entidad_id}/roles', { params: ruta(id) }))
}

/** Historial de asignaciones de una cuenta en la entidad (más recientes primero). */
export function asignacionesDe(destino: DestinoUsuarios, cuentaId: string): Promise<Asignacion[]> {
  const { id, plataforma } = partes(destino)
  const params = { ...ruta(id), query: { cuenta_id: cuentaId } }
  return plataforma
    ? exigir(api().GET('/api/v1/plataforma/entidades/{entidad_id}/asignaciones', { params }))
    : exigir(api().GET('/api/v1/entidades/{entidad_id}/asignaciones', { params }))
}

/** Asigna un rol a una cuenta existente (solo por la consola de la plataforma). */
export function asignarRol(entidadId: string, cuentaId: string, rolId: string, clave: string): Promise<Asignacion> {
  return exigir(
    api().POST('/api/v1/plataforma/entidades/{entidad_id}/asignaciones', {
      params: ruta(entidadId),
      body: { cuenta_id: cuentaId, rol_id: rolId },
      headers: idempotencia(clave),
    }),
  )
}

/** Termina una asignación desde ahora (409 si dejaría la entidad sin administrador). */
export async function quitarAsignacion(destino: DestinoUsuarios, asignacionId: string): Promise<void> {
  const { id, plataforma } = partes(destino)
  const params = { path: { entidad_id: id, asignacion_id: asignacionId } }
  if (plataforma) await exigir(api().DELETE('/api/v1/plataforma/entidades/{entidad_id}/asignaciones/{asignacion_id}', { params }))
  else await exigir(api().DELETE('/api/v1/entidades/{entidad_id}/asignaciones/{asignacion_id}', { params }))
}

/** Catálogo completo de permisos (de la plataforma y de las entidades). */
export function catalogoPermisos(): Promise<PermisoDelCatalogo[]> {
  return exigir(api().GET('/api/v1/permisos'))
}

/** Crea un rol propio de la entidad. */
export function crearRol(entidadId: string, datos: NuevoRol, clave: string): Promise<Rol> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/roles', { params: ruta(entidadId), body: datos, headers: idempotencia(clave) }))
}

/** Reemplaza los permisos de un rol propio de la entidad. */
export function cambiarPermisos(entidadId: string, rolId: string, permisos: Permiso[]): Promise<Rol> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/roles/{rol_id}/permisos', {
      params: { path: { entidad_id: entidadId, rol_id: rolId } },
      body: { permisos },
    }),
  )
}

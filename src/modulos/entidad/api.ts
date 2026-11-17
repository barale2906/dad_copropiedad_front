/** Llamadas del módulo «Datos y usuarios» (`/entidades/{id}/…`). */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  Asignacion,
  Importacion,
  NuevoRol,
  NuevoUsuario,
  Permiso,
  PermisoDelCatalogo,
  Rol,
  UsuarioCreado,
  VistaPreviaUsuarios,
} from '@/api/tipos'

const ruta = (entidadId: string) => ({ path: { entidad_id: entidadId } })

/** Página de usuarios de la entidad (búsqueda `q` por nombre, usuario o correo). */
export function listarUsuarios(entidadId: string, despues?: string, q?: string) {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/usuarios', {
      params: { ...ruta(entidadId), query: { limite: 50, despues, q: q?.trim() || undefined } },
    }),
  )
}

/** Crea el usuario con su rol, o asigna el rol a la cuenta que ya tiene ese correo. */
export function crearUsuario(entidadId: string, datos: NuevoUsuario, clave: string): Promise<UsuarioCreado> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/usuarios', {
      params: ruta(entidadId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

export async function reenviarCodigo(entidadId: string, cuentaId: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/entidades/{entidad_id}/usuarios/{cuenta_id}/codigo-contrasena', {
      params: { path: { entidad_id: entidadId, cuenta_id: cuentaId } },
    }),
  )
}

export function listarRoles(entidadId: string): Promise<Rol[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/roles', { params: ruta(entidadId) }))
}

/** Catálogo completo de permisos (de la plataforma y de las entidades). */
export function catalogoPermisos(): Promise<PermisoDelCatalogo[]> {
  return exigir(api().GET('/api/v1/permisos'))
}

/** Crea un rol propio (403 si incluye permisos que quien lo crea no tiene; 409 si el código existe). */
export function crearRol(entidadId: string, datos: NuevoRol, clave: string): Promise<Rol> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/roles', {
      params: ruta(entidadId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

/** Reemplaza los permisos de un rol propio (las plantillas responden 409). */
export function cambiarPermisos(entidadId: string, rolId: string, permisos: Permiso[]): Promise<Rol> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/roles/{rol_id}/permisos', {
      params: { path: { entidad_id: entidadId, rol_id: rolId } },
      body: { permisos },
    }),
  )
}

/** Historial de asignaciones de una cuenta en la entidad (más recientes primero). */
export function asignacionesDe(entidadId: string, cuentaId: string): Promise<Asignacion[]> {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/asignaciones', {
      params: { ...ruta(entidadId), query: { cuenta_id: cuentaId } },
    }),
  )
}

/** Termina una asignación desde ahora (409 si dejaría la entidad sin administrador). */
export async function quitarAsignacion(entidadId: string, asignacionId: string): Promise<void> {
  await exigir(
    api().DELETE('/api/v1/entidades/{entidad_id}/asignaciones/{asignacion_id}', {
      params: { path: { entidad_id: entidadId, asignacion_id: asignacionId } },
    }),
  )
}

export function descargarPlantilla(entidadId: string) {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/usuarios/importaciones/plantilla', {
      params: ruta(entidadId),
      parseAs: 'blob',
    }),
    'plantilla-usuarios.csv',
  )
}

/** Sube la planilla (CSV o XLSX) y devuelve la vista previa; no crea nada todavía. */
export function importarUsuarios(entidadId: string, archivo: File): Promise<VistaPreviaUsuarios> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/usuarios/importaciones', {
      params: { ...ruta(entidadId), query: { nombre: archivo.name } },
      // El contrato describe el cuerpo como bytes; se envía el archivo tal cual.
      body: [],
      bodySerializer: () => archivo,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  )
}

/** Crea todos los usuarios de la importación validada, o ninguno. */
export function confirmarImportacion(entidadId: string, importacionId: string, clave: string): Promise<Importacion> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/usuarios/importaciones/{importacion_id}/confirmar', {
      params: { path: { entidad_id: entidadId, importacion_id: importacionId } },
      headers: idempotencia(clave),
    }),
  )
}

/** Llamadas del módulo «Datos y usuarios» (`/entidades/{id}/…`). */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import { ErrorApi } from '@/api/errores'
import type {
  Asignacion,
  CambiosCopropiedad,
  CambiosEntidad,
  DatosCopropiedad,
  FichaCopropiedad,
  FichaEntidad,
  Horario,
  MiSuscripcion,
  NuevoPuntoAtencion,
  PuntoAtencion,
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

/** Ficha genérica de la entidad (empresa o plataforma). */
export function fichaEntidad(entidadId: string): Promise<FichaEntidad> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}', { params: ruta(entidadId) }))
}

/** Cambia los datos generales (solo los campos enviados). 422 si el NIT no es válido. */
export function editarEntidad(entidadId: string, cambios: CambiosEntidad): Promise<FichaEntidad> {
  return exigir(api().PATCH('/api/v1/entidades/{entidad_id}', { params: ruta(entidadId), body: cambios }))
}

const rutaPH = (copropiedadId: string) => ({ path: { copropiedad_id: copropiedadId } })

/** Ficha de la PH con sus cargos vigentes y las advertencias legales. */
export function fichaCopropiedad(copropiedadId: string): Promise<FichaCopropiedad> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}', { params: rutaPH(copropiedadId) }))
}

export function editarCopropiedad(copropiedadId: string, cambios: CambiosCopropiedad): Promise<DatosCopropiedad> {
  return exigir(
    api().PATCH('/api/v1/copropiedades/{copropiedad_id}', { params: rutaPH(copropiedadId), body: cambios }),
  )
}

export function puntosAtencion(copropiedadId: string): Promise<PuntoAtencion[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/puntos-atencion', { params: rutaPH(copropiedadId) }))
}

export function crearPuntoAtencion(copropiedadId: string, datos: NuevoPuntoAtencion, clave: string): Promise<PuntoAtencion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/puntos-atencion', {
      params: rutaPH(copropiedadId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

/** Reemplaza el horario completo de un punto de atención. */
export async function cambiarHorario(copropiedadId: string, puntoId: string, horario: Horario): Promise<void> {
  await exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/puntos-atencion/{punto_id}/horario', {
      params: { path: { copropiedad_id: copropiedadId, punto_id: puntoId } },
      body: horario,
    }),
  )
}

/**
 * Producto contratado en la suscripción. El contrato hoy lo tipa mal (`LineaRespuesta` choca
 * con la de WhatsApp y la de contabilidad: solicitud S10 al backend); estos son los campos que
 * envía `routes/cobros.rs`.
 */
export interface LineaSuscripcion {
  id: string
  producto_id: string
  producto: string
  nombre: string
  precio_pactado?: string | null
  motivo_precio?: string | null
  desde: string
  hasta?: string | null
}

export type SuscripcionDeLaEntidad = Omit<MiSuscripcion, 'lineas'> & { lineas: LineaSuscripcion[] }

/** Plan, consumo y facturas de la entidad con la plataforma; `null` si no tiene suscripción (404). */
export async function miSuscripcion(entidadId: string): Promise<SuscripcionDeLaEntidad | null> {
  try {
    const r = await exigir(api().GET('/api/v1/entidades/{entidad_id}/suscripcion', { params: ruta(entidadId) }))
    return r as unknown as SuscripcionDeLaEntidad
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 404) return null
    throw e
  }
}

export interface FiltrosAuditoria {
  /** Prefijo de acción terminado en punto (`acceso.`) o acción exacta. */
  accion?: string
  actorId?: string
  /** Instantes UTC (ISO). */
  desde?: string
  hasta?: string
}

/** Página de la auditoría (más recientes primero). Nunca trae datos personales. */
export function listarAuditoria(entidadId: string, despues: string | undefined, f: FiltrosAuditoria = {}) {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/auditoria', {
      params: {
        ...ruta(entidadId),
        query: { limite: 50, despues, accion: f.accion || undefined, actor_id: f.actorId, desde: f.desde, hasta: f.hasta },
      },
    }),
  )
}


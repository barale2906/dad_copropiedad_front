/**
 * Clientes de la plataforma (PH, empresas y la propia), su estado, sus módulos, el acceso de
 * soporte y las cuentas y roles de la plataforma. Todo exige segundo factor.
 */
import { api, exigir, idempotencia, siExiste } from '@/api/cliente'
import type {
  AccesoSoporte,
  AsignacionPlataforma,
  CuentaPlataforma,
  EntidadPlataforma,
  EstadoEntidad,
  Modulo,
  NuevaCopropiedad,
  NuevaEntidad,
  NuevoRol,
  NuevoUsuarioPlataforma,
  Permiso,
  Rol,
  TipoEntidad,
  UsuarioPlataformaCreado,
} from '@/api/tipos'
import type { Pagina } from '@/composables/useListado'

const en = (id: string) => ({ path: { entidad_id: id } })

// Clientes ---------------------------------------------------------------------------------

/** Filtros del listado de clientes (vacío = sin filtrar); el backend los aplica en todas las páginas. */
export interface FiltrosEntidades {
  q?: string
  tipo?: TipoEntidad | ''
  estado?: EstadoEntidad | ''
}

/** PH, empresas y la plataforma en una tabla (búsqueda `q` por nombre o NIT, tipo y estado). */
export function listarEntidades(despues: string | undefined, f: FiltrosEntidades = {}): Promise<Pagina<EntidadPlataforma>> {
  const query = { despues, limite: 50, q: f.q?.trim() || undefined, tipo: f.tipo || undefined, estado: f.estado || undefined }
  return exigir(api().GET('/api/v1/plataforma/entidades', { params: { query } }))
}

/** Un cliente por su id (la ficha); `null` si no existe. */
export function entidadPlataforma(entidadId: string): Promise<EntidadPlataforma | null> {
  return siExiste(exigir(api().GET('/api/v1/plataforma/entidades/{entidad_id}', { params: en(entidadId) })))
}

/** Alta de una PH con su primer administrador (nuevo o existente, nunca los dos). */
export function altaCopropiedad(datos: NuevaCopropiedad, clave: string) {
  return exigir(api().POST('/api/v1/plataforma/copropiedades', { body: datos, headers: idempotencia(clave) }))
}

/** Alta de una empresa con su primer administrador (nuevo o existente, nunca los dos). */
export function altaEmpresa(datos: NuevaEntidad, clave: string) {
  return exigir(api().POST('/api/v1/plataforma/entidades', { body: datos, headers: idempotencia(clave) }))
}

/** Activa, suspende, reactiva o retira una entidad (409 si una asamblea está instalada). */
export async function cambiarEstado(entidadId: string, estado: EstadoEntidad): Promise<EstadoEntidad> {
  const r = await exigir(api().POST('/api/v1/plataforma/entidades/{entidad_id}/estado', { params: en(entidadId), body: { estado } }))
  return r.estado
}

/** Habilita un módulo desde ahora (venta por módulo); trae la línea de cobro si se agregó a la suscripción. */
export function habilitarModulo(entidadId: string, modulo: Modulo) {
  return exigir(
    api().POST('/api/v1/plataforma/copropiedades/{copropiedad_id}/modulos', { params: { path: { copropiedad_id: entidadId } }, body: { modulo } }),
  )
}

/** Termina un módulo desde ahora (se conserva el historial). */
export function terminarModulo(entidadId: string, modulo: Modulo) {
  return exigir(
    api().DELETE('/api/v1/plataforma/copropiedades/{copropiedad_id}/modulos/{modulo}', {
      params: { path: { copropiedad_id: entidadId, modulo } },
    }),
  )
}

/** Abre 2 h de solo lectura en la entidad, con el motivo (queda auditado). */
export function abrirSoporte(entidadId: string, motivo: string): Promise<AccesoSoporte> {
  return exigir(api().POST('/api/v1/plataforma/entidades/{entidad_id}/soporte', { params: en(entidadId), body: { motivo } }))
}

/** Designa la empresa que opera la plataforma. */
export async function designarPropia(entidadId: string): Promise<void> {
  await exigir(api().PUT('/api/v1/plataforma/entidad-plataforma', { body: { entidad_id: entidadId } }))
}

// Cuentas y roles de la plataforma -----------------------------------------------------------

/** Una cuenta por usuario o correo **exactos**; `null` si no existe. */
export function buscarCuenta(identificador: string): Promise<CuentaPlataforma | null> {
  return siExiste(exigir(api().GET('/api/v1/plataforma/cuentas', { params: { query: { identificador: identificador.trim() } } })))
}

/** Crea un usuario de la plataforma (o reutiliza la cuenta del correo) con un rol opcional. */
export function crearUsuarioPlataforma(datos: NuevoUsuarioPlataforma, clave: string): Promise<UsuarioPlataformaCreado> {
  return exigir(api().POST('/api/v1/plataforma/cuentas', { body: datos, headers: idempotencia(clave) }))
}

/** Bloquea la cuenta y cierra sus sesiones. */
export async function bloquearCuenta(cuentaId: string): Promise<void> {
  await exigir(api().POST('/api/v1/plataforma/cuentas/{cuenta_id}/bloquear', { params: { path: { cuenta_id: cuentaId } } }))
}

/** Desbloquea la cuenta (también el bloqueo temporal por intentos), con motivo. */
export async function desbloquearCuenta(cuentaId: string, motivo: string): Promise<void> {
  await exigir(api().POST('/api/v1/plataforma/cuentas/{cuenta_id}/desbloquear', { params: { path: { cuenta_id: cuentaId } }, body: { motivo } }))
}

export function rolesPlataforma(): Promise<Rol[]> {
  return exigir(api().GET('/api/v1/plataforma/roles'))
}

export function crearRolPlataforma(datos: NuevoRol, clave: string): Promise<Rol> {
  return exigir(api().POST('/api/v1/plataforma/roles', { body: datos, headers: idempotencia(clave) }))
}

export function permisosRolPlataforma(rolId: string, permisos: Permiso[]): Promise<Rol> {
  return exigir(api().PUT('/api/v1/plataforma/roles/{rol_id}/permisos', { params: { path: { rol_id: rolId } }, body: { permisos } }))
}

/** Historial de los roles de plataforma de una cuenta (las más recientes primero; `vigente_hasta` nulo = vigente). */
export function asignacionesPlataforma(cuentaId: string): Promise<AsignacionPlataforma[]> {
  return exigir(api().GET('/api/v1/plataforma/asignaciones', { params: { query: { cuenta_id: cuentaId } } }))
}

/** Asigna un rol de plataforma a una cuenta; devuelve el id de la asignación. */
export async function asignarRolPlataforma(cuentaId: string, rolId: string, clave: string): Promise<string> {
  const r = await exigir(api().POST('/api/v1/plataforma/asignaciones', { body: { cuenta_id: cuentaId, rol_id: rolId }, headers: idempotencia(clave) }))
  return r.id
}

/** Termina una asignación de plataforma (nunca la del último superusuario: 409). */
export async function quitarRolPlataforma(asignacionId: string): Promise<void> {
  await exigir(api().DELETE('/api/v1/plataforma/asignaciones/{asignacion_id}', { params: { path: { asignacion_id: asignacionId } } }))
}

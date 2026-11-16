/** Reglas de interfaz de los usuarios de la entidad (funciones puras). */
import type { Asignacion, Rol, Usuario } from '@/api/tipos'

export interface EstadoVisible {
  texto: string
  tono: 'exito' | 'aviso' | 'peligro' | 'neutro'
}

/** Cómo se muestra el estado de un usuario: bloqueado > contraseña pendiente > activo. */
export function estadoDeUsuario(u: Pick<Usuario, 'estado' | 'contrasena_pendiente'>): EstadoVisible {
  if (u.estado === 'bloqueada') return { texto: 'Bloqueado', tono: 'peligro' }
  if (u.estado === 'eliminada') return { texto: 'Eliminado', tono: 'neutro' }
  if (u.contrasena_pendiente) return { texto: 'Contraseña pendiente', tono: 'aviso' }
  return { texto: 'Activo', tono: 'exito' }
}

/** Nombres de los roles a partir de sus códigos (si no se conoce el rol, el código). */
export function nombresDeRoles(codigos: string[], roles: Rol[]): string[] {
  const porCodigo = new Map(roles.map((r) => [r.codigo, r.nombre]))
  return codigos.map((c) => porCodigo.get(c) ?? c)
}

/** ¿La asignación sigue vigente en `ahora`? */
export function vigente(a: Pick<Asignacion, 'vigente_desde' | 'vigente_hasta'>, ahora: Date = new Date()): boolean {
  const t = ahora.getTime()
  return Date.parse(a.vigente_desde) <= t && (!a.vigente_hasta || Date.parse(a.vigente_hasta) > t)
}

export interface AsignacionVisible {
  id: string
  rol: string
  /** Solo las manuales se quitan a mano; las derivadas vencen con el hecho que las originó. */
  quitable: boolean
  origen: Asignacion['origen']
}

const ORIGEN: Record<Asignacion['origen'], string> = {
  manual: 'asignado',
  contrato_servicio: 'por contrato de servicio',
  propiedad: 'por ser propietario',
  residencia: 'por ser residente',
  asamblea: 'por elección en asamblea',
}

/** Texto del origen de una asignación derivada (para explicar por qué no se puede quitar). */
export const textoOrigen = (o: Asignacion['origen']) => ORIGEN[o]

/** Asignaciones vigentes de una cuenta, con el nombre del rol y si se pueden quitar. */
export function asignacionesVigentes(
  asignaciones: Asignacion[],
  roles: Rol[],
  ahora: Date = new Date(),
): AsignacionVisible[] {
  const porId = new Map(roles.map((r) => [r.id, r.nombre]))
  return asignaciones
    .filter((a) => vigente(a, ahora))
    .map((a) => ({ id: a.id, rol: porId.get(a.rol_id) ?? 'Rol', quitable: a.origen === 'manual', origen: a.origen }))
}

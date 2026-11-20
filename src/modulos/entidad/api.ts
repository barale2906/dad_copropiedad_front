/** Llamadas del módulo «Datos y usuarios» (`/entidades/{id}/…`). */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia, siExiste } from '@/api/cliente'
import type {
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
  VistaPreviaUsuarios,
} from '@/api/tipos'

const ruta = (entidadId: string) => ({ path: { entidad_id: entidadId } })

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

/** Plan, consumo y facturas de la entidad (el contrato ya tipa bien sus líneas: S10 atendida). */
export type SuscripcionDeLaEntidad = MiSuscripcion

/** Plan, consumo y facturas de la entidad con la plataforma; `null` si no tiene suscripción (404). */
export function miSuscripcion(entidadId: string): Promise<SuscripcionDeLaEntidad | null> {
  return siExiste(exigir(api().GET('/api/v1/entidades/{entidad_id}/suscripcion', { params: ruta(entidadId) })))
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


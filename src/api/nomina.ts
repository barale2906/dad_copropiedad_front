/**
 * «Mi nómina» (`/yo/nomina/…`): los desprendibles de la persona en todas las entidades donde
 * trabaja y su certificado laboral. Basta la sesión (no exige roles en la entidad), por eso vive
 * en `api/` y no en el módulo: la usa Mi cuenta.
 */
import { recibirArchivo, type ArchivoRecibido, descargar, type Descarga } from './archivos'
import { api, exigir } from './cliente'
import type { DesprendibleDeCuenta } from './tipos'

/** Vacía si la persona no es empleada en ninguna entidad (la sección no se muestra). */
export function misDesprendibles(): Promise<DesprendibleDeCuenta[]> {
  return exigir(api().GET('/api/v1/yo/nomina/desprendibles'))
}

/** PDF de un desprendible propio. */
export function miDesprendible(entidadId: string, liquidacionId: string): Promise<ArchivoRecibido> {
  return recibirArchivo(
    api().GET('/api/v1/yo/nomina/{entidad_id}/desprendibles/{liquidacion_id}', {
      params: { path: { entidad_id: entidadId, liquidacion_id: liquidacionId } },
      parseAs: 'blob',
    }),
    'desprendible.pdf',
  )
}

/** Certificado laboral propio en la entidad (con el salario). */
export function miCertificadoLaboral(entidadId: string): Promise<Descarga> {
  return descargar(
    api().GET('/api/v1/yo/nomina/{entidad_id}/certificado-laboral', { params: { path: { entidad_id: entidadId } }, parseAs: 'blob' }),
    'certificado-laboral.pdf',
  )
}

/**
 * Terceros de la entidad (clientes y proveedores con sus datos fiscales). Lo usan tributario,
 * contabilidad, tesorería, facturación y cartera; la búsqueda está en `./contabilidad`
 * (`buscarTerceros`).
 */
import { api, exigir, idempotencia } from './cliente'
import type { DatosFiscales, NuevoTercero, Tercero } from './tipos'

/** Crea el tercero (si ya existe una persona con ese documento, se reutiliza). */
export function crearTercero(id: string, datos: NuevoTercero, clave: string): Promise<Tercero> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/terceros', { params: { path: { entidad_id: id } }, body: datos, headers: idempotencia(clave) }))
}

/** Reemplaza los datos fiscales (dirección y correo son datos personales). */
export function guardarDatosFiscales(id: string, personaId: string, datos: DatosFiscales): Promise<DatosFiscales> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/terceros/{persona_id}/datos-fiscales', { params: { path: { entidad_id: id, persona_id: personaId } }, body: datos }),
  )
}

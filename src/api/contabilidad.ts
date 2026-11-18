/**
 * Lo contable que usan varios módulos (contabilidad, tesorería, cartera, facturación): plan de
 * cuentas, centros de costo, tipos de comprobante y búsqueda de terceros (`/entidades/{id}/…`).
 */
import { api, exigir } from './cliente'
import type { CentroCosto, CuentaContable, TipoComprobante } from './tipos'

const e = (id: string) => ({ path: { entidad_id: id } })

/** Plan de cuentas propio de la entidad (todas las cuentas, activas e inactivas). */
export function cuentasContables(id: string): Promise<CuentaContable[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/cuentas', { params: e(id) }))
}

export function centrosCosto(id: string): Promise<CentroCosto[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/centros-costo', { params: e(id) }))
}

export function tiposComprobante(id: string): Promise<TipoComprobante[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tipos-comprobante', { params: e(id) }))
}

/** Terceros por nombre o documento (`contabilidad.ver`, `facturacion.ver` o `terceros.gestionar`), por cursor. */
export function buscarTerceros(id: string, texto: string, despues?: string, limite = 10) {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/terceros', { params: { ...e(id), query: { texto: texto.trim() || undefined, limite, despues } } }),
  )
}

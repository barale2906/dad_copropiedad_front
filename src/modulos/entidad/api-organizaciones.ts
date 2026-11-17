/** Llamadas de organizaciones y contratos de servicio de la PH, y búsqueda de cuentas. */
import { api, exigir, idempotencia } from '@/api/cliente'
import { ErrorApi } from '@/api/errores'
import type { Asignacion, ContratoServicio, CuentaEncontrada, FichaOrganizacion, NuevaOrganizacion, NuevoContrato } from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const contrato = (id: string, contratoId: string) => ({ path: { copropiedad_id: id, contrato_id: contratoId } })

/** `null` si es 404: el 404 de estas búsquedas significa «no existe», no un error. */
async function o404<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 404) return null
    throw e
  }
}

/** Organización por NIT exacto, o `null` si no existe (entonces se puede crear). */
export function buscarOrganizacion(id: string, nit: string): Promise<FichaOrganizacion | null> {
  return o404(
    exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/organizaciones', { params: { ...ph(id), query: { nit } } })),
  )
}

/** Crea la organización (o devuelve la existente con ese NIT: `creada: false`). */
export function crearOrganizacion(id: string, datos: NuevaOrganizacion, clave: string) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/organizaciones', {
      params: ph(id),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

export function contratos(id: string): Promise<ContratoServicio[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/contratos-servicio', { params: ph(id) }))
}

export function crearContrato(id: string, datos: NuevoContrato, clave: string): Promise<ContratoServicio> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/contratos-servicio', {
      params: ph(id),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

/** Termina el contrato; devuelve cuántos roles derivados vencieron con él. */
export async function terminarContrato(id: string, contratoId: string): Promise<number> {
  const r = await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/contratos-servicio/{contrato_id}/terminar', {
      params: contrato(id, contratoId),
    }),
  )
  return r.roles_vencidos
}

/** Rol derivado del contrato para el personal de la organización (vence con él; 409 si no está vigente). */
export function asignarPorContrato(
  id: string,
  contratoId: string,
  datos: { cuenta_id: string; rol_id: string },
  clave: string,
): Promise<Asignacion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/contratos-servicio/{contrato_id}/asignaciones', {
      params: contrato(id, contratoId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

/** Cuenta por usuario o correo **exactos** (nunca listados), o `null` si no hay una activa. */
export function buscarCuenta(entidadId: string, identificador: string): Promise<CuentaEncontrada | null> {
  return o404(
    exigir(
      api().GET('/api/v1/entidades/{entidad_id}/cuentas', {
        params: { path: { entidad_id: entidadId }, query: { identificador: identificador.trim() } },
      }),
    ),
  )
}

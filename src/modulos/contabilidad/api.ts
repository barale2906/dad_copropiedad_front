/**
 * Llamadas del módulo «Contabilidad» (`/entidades/{id}/contabilidad/…`). El plan de cuentas,
 * los centros y los tipos de comprobante se leen con `usePlanCuentas` (`@/api/contabilidad`).
 */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  Asiento,
  BorradorComprobante,
  CambioCuentaContable,
  CentroCosto,
  Comprobante,
  CuentaContable,
  CuentaPuc,
  EstadoComprobante,
  EstadoPeriodo,
  NuevaCuentaContable,
  NuevoCentroCosto,
  PeriodoContable,
  Reapertura,
} from '@/api/tipos'

const e = (id: string) => ({ path: { entidad_id: id } })
const comp = (id: string, c: string) => ({ path: { entidad_id: id, comprobante_id: c } })

// Plan de cuentas y centros ------------------------------------------------------------------

/** Catálogo PUC (para crear cuentas propias); `prefijo` filtra por el inicio del código. */
export function catalogoPuc(id: string, prefijo?: string): Promise<CuentaPuc[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/puc', { params: { ...e(id), query: { prefijo: prefijo?.trim() || undefined } } }))
}

/** Crea una cuenta (409 si el código ya existe; 422 si falta el padre). */
export function crearCuenta(id: string, datos: NuevaCuentaContable, clave: string): Promise<CuentaContable> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/cuentas', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

/** El código y la naturaleza no cambian. */
export function editarCuenta(id: string, cuentaId: string, datos: CambioCuentaContable): Promise<CuentaContable> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/cuentas/{cuenta_id}', { params: { path: { entidad_id: id, cuenta_id: cuentaId } }, body: datos }),
  )
}

export function crearCentro(id: string, datos: NuevoCentroCosto, clave: string): Promise<CentroCosto> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/centros-costo', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

export function editarCentro(id: string, centroId: string, datos: NuevoCentroCosto): Promise<CentroCosto> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/centros-costo/{centro_id}', { params: { path: { entidad_id: id, centro_id: centroId } }, body: datos }),
  )
}

// Comprobantes -------------------------------------------------------------------------------

export interface FiltrosComprobantes {
  desde?: string
  hasta?: string
  tipo_comprobante_id?: string
  estado?: EstadoComprobante
}

/** Comprobantes (sin líneas) entre dos fechas `YYYY-MM-DD`. */
export function comprobantes(id: string, f: FiltrosComprobantes = {}): Promise<Comprobante[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes', { params: { ...e(id), query: f } }))
}

export function comprobante(id: string, c: string): Promise<Comprobante> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes/{comprobante_id}', { params: comp(id, c) }))
}

export function crearComprobante(id: string, datos: BorradorComprobante, clave: string): Promise<Comprobante> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

/** Reemplaza el borrador (solo en borrador). */
export function guardarComprobante(id: string, c: string, datos: BorradorComprobante): Promise<Comprobante> {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes/{comprobante_id}', { params: comp(id, c), body: datos }))
}

export async function borrarComprobante(id: string, c: string): Promise<void> {
  await exigir(api().DELETE('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes/{comprobante_id}', { params: comp(id, c) }))
}

/** Valida sin guardar: 422 `regla_contable` si no cuadra o una cuenta no admite la línea. */
export function previsualizar(id: string, datos: BorradorComprobante): Promise<Asiento> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes/previsualizar', { params: e(id), body: datos }))
}

/** Asigna el número y lo vuelve definitivo (422 si no cuadra o el periodo no está abierto). */
export function contabilizar(id: string, c: string): Promise<Comprobante> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes/{comprobante_id}/contabilizar', { params: comp(id, c) }))
}

/** Crea el comprobante inverso con el motivo; el original queda marcado como revertido. */
export function revertir(id: string, c: string, motivo: string, fecha: string | null = null): Promise<Comprobante> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/contabilidad/comprobantes/{comprobante_id}/revertir', {
      params: comp(id, c),
      body: { motivo: motivo.trim(), fecha },
    }),
  )
}

// Periodos -----------------------------------------------------------------------------------

export function periodos(id: string, anio?: number): Promise<PeriodoContable[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/periodos', { params: { ...e(id), query: { anio } } }))
}

export function abrirPeriodo(id: string, anio: number, mes: number): Promise<PeriodoContable> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/periodos', { params: e(id), body: { anio, mes } }))
}

/** A revisión, cerrado, o de revisión a abierto (un cerrado se reabre con una reapertura). */
export function cambiarPeriodo(id: string, periodoId: string, estado: EstadoPeriodo): Promise<PeriodoContable> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/periodos/{periodo_id}/estado', {
      params: { path: { entidad_id: id, periodo_id: periodoId } },
      body: { estado },
    }),
  )
}

export function reaperturas(id: string, periodoId: string): Promise<Reapertura[]> {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/periodos/{periodo_id}/reaperturas', { params: { path: { entidad_id: id, periodo_id: periodoId } } }),
  )
}

export function solicitarReapertura(id: string, periodoId: string, motivo: string, alcance: string | null): Promise<Reapertura> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/contabilidad/periodos/{periodo_id}/reaperturas', {
      params: { path: { entidad_id: id, periodo_id: periodoId } },
      body: { motivo: motivo.trim(), alcance: alcance?.trim() || null },
    }),
  )
}

/** Aprueba o rechaza (otra cuenta: 409 si es la que la solicitó). */
export function decidirReapertura(id: string, reaperturaId: string, aprobar: boolean): Promise<Reapertura> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/reaperturas/{reapertura_id}', {
      params: { path: { entidad_id: id, reapertura_id: reaperturaId } },
      body: { aprobar },
    }),
  )
}

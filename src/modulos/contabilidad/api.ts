/**
 * Llamadas del módulo «Contabilidad» (`/entidades/{id}/contabilidad/…`). El plan de cuentas,
 * los centros y los tipos de comprobante se leen con `usePlanCuentas` (`@/api/contabilidad`).
 */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  Asiento,
  BorradorComprobante,
  CambioCuentaContable,
  CentroCosto,
  Comprobante,
  ConfiguracionContable,
  CuentaContable,
  CuentaPuc,
  EstadoComprobante,
  EstadoPeriodo,
  EstadosFinancieros,
  FilaBalance,
  LibroMayor,
  NotaEstados,
  NuevaConfiguracionContable,
  NuevaCuentaContable,
  NuevaNotaEstados,
  NuevaReglaContable,
  NuevoCentroCosto,
  NuevoTipoComprobante,
  PeriodoContable,
  PlantillaContable,
  PlantillaContableResumen,
  Reapertura,
  ReglaContable,
  ResumenAplicacionPlantilla,
  Rubro,
  SaldosIniciales,
  TipoComprobante,
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

// Configuración ------------------------------------------------------------------------------

/** Configuración vigente o `null` si la entidad aún no configuró su contabilidad. */
export function configuracion(id: string): Promise<ConfiguracionContable | null> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/configuracion', { params: e(id) }))
}

/** Crea una versión nueva de la configuración (no se edita la anterior). */
export function guardarConfiguracion(id: string, datos: NuevaConfiguracionContable): Promise<ConfiguracionContable> {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/configuracion', { params: e(id), body: datos }))
}

export function crearTipoComprobante(id: string, datos: NuevoTipoComprobante, clave: string): Promise<TipoComprobante> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tipos-comprobante', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

export function editarTipoComprobante(id: string, tipoId: string, datos: NuevoTipoComprobante): Promise<TipoComprobante> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/tipos-comprobante/{tipo_id}', { params: { path: { entidad_id: id, tipo_id: tipoId } }, body: datos }),
  )
}

/** Reglas de contabilización (todas las versiones). */
export function reglas(id: string): Promise<ReglaContable[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reglas', { params: e(id) }))
}

/** Versión nueva de la regla de un evento (rige desde `vigente_desde`). */
export function crearRegla(id: string, datos: NuevaReglaContable, clave: string): Promise<ReglaContable> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/reglas', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

export function rubros(id: string): Promise<Rubro[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/rubros', { params: e(id) }))
}

/** Reemplaza todos los rubros de los estados financieros. */
export function guardarRubros(id: string, lista: Rubro[]): Promise<Rubro[]> {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/rubros', { params: e(id), body: lista }))
}

export function notas(id: string, anio: number): Promise<NotaEstados[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/notas', { params: { ...e(id), query: { anio } } }))
}

/** Versión nueva de una nota (mismo año y número = nueva versión). */
export function guardarNota(id: string, datos: NuevaNotaEstados): Promise<NotaEstados> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/notas', { params: e(id), body: datos }))
}

/** Plantillas publicadas (de la plataforma y de las organizaciones contables vinculadas). */
export function plantillas(id: string): Promise<PlantillaContableResumen[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/plantillas', { params: e(id) }))
}

/** Aplica una plantilla (o, con `previsualizar`, solo cuenta qué haría). */
export function aplicarPlantilla(id: string, plantillaId: string, previsualizar: boolean): Promise<ResumenAplicacionPlantilla> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/plantillas/aplicar', { params: e(id), body: { plantilla_id: plantillaId, previsualizar } }))
}

/** Guarda la configuración actual como plantilla en borrador. */
export function guardarComoPlantilla(id: string, nombre: string, tipoEmpresa: string): Promise<PlantillaContable> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/plantillas/guardar', { params: e(id), body: { nombre: nombre.trim(), tipo_empresa: tipoEmpresa } }))
}

// Apertura y cierre --------------------------------------------------------------------------

/** Comprobante de saldos iniciales (tipo `AP` por defecto), ya contabilizado. */
export function saldosIniciales(id: string, datos: SaldosIniciales, clave: string): Promise<Comprobante> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/saldos-iniciales', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

/** Cierre anual: lleva el resultado del año al patrimonio (periodo 13). */
export function cierreAnual(id: string, anio: number, clave: string): Promise<Comprobante> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/cierre-anual', { params: e(id), body: { anio }, headers: idempotencia(clave) }))
}

// Reportes -----------------------------------------------------------------------------------

/** Rango de fechas `YYYY-MM-DD` (obligatorio en los reportes). */
export interface Rango {
  desde: string
  hasta: string
}

export interface FiltrosBalance extends Rango {
  por_tercero?: boolean
  por_centro_costo?: boolean
}

export function balancePrueba(id: string, f: FiltrosBalance): Promise<FilaBalance[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reportes/balance-prueba', { params: { ...e(id), query: f } }))
}

/** Libro diario: comprobantes contabilizados con sus líneas. */
export function libroDiario(id: string, r: Rango): Promise<Comprobante[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reportes/libro-diario', { params: { ...e(id), query: r } }))
}

/** Mayor de una cuenta (por código), o auxiliar de un tercero con `persona_id`. */
export function libroMayor(id: string, cuenta: string, r: Rango, personaId?: string): Promise<LibroMayor> {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reportes/libro-mayor', { params: { ...e(id), query: { ...r, cuenta, persona_id: personaId } } }),
  )
}

/** Estados financieros a la fecha de corte (solo JSON: se imprimen desde el navegador). */
export function estadosFinancieros(id: string, corte: string): Promise<EstadosFinancieros> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reportes/estados-financieros', { params: { ...e(id), query: { corte } } }))
}

// Exportar en CSV (`contabilidad.exportar`); el resultado trae la huella `X-Contenido-Sha256`.

export function exportarBalance(id: string, f: FiltrosBalance) {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reportes/balance-prueba', { params: { ...e(id), query: { ...f, formato: 'csv' } }, parseAs: 'blob' }),
    'balance-prueba.csv',
  )
}

export function exportarDiario(id: string, r: Rango) {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reportes/libro-diario', { params: { ...e(id), query: { ...r, formato: 'csv' } }, parseAs: 'blob' }),
    'libro-diario.csv',
  )
}

export function exportarMayor(id: string, cuenta: string, r: Rango, personaId?: string) {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/reportes/libro-mayor', {
      params: { ...e(id), query: { ...r, cuenta, persona_id: personaId, formato: 'csv' } },
      parseAs: 'blob',
    }),
    'libro-mayor.csv',
  )
}

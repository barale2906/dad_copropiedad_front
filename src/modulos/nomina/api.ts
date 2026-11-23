/**
 * Llamadas del módulo «Nómina» (`/entidades/{id}/nomina/…`, ADR 0025 del backend). Se vende
 * sola: cualquier entidad (PH o empresa) la contrata sin la contabilidad. Las versiones de un
 * contrato no se editan ni se borran: se agrega una nueva desde una fecha posterior.
 *
 * Ninguna operación de nómina acepta `Idempotency-Key`: los reintentos los evita el backend con
 * sus reglas (código de empleado único, periodos que no se cruzan, 409 de estado).
 */
import { descargar, recibirArchivo, type ArchivoRecibido, type Descarga } from '@/api/archivos'
import { api, exigir } from '@/api/cliente'
import type {
  CatalogoLaboral,
  CesantiasContrato,
  ConfiguracionNomina,
  ContratoConVersiones,
  ContratoLaboral,
  ContratoPorVencer,
  CondicionesContrato,
  DeduccionRetencion,
  EmpleadoResumen,
  EnvioDesprendibles,
  EstadoEmpleado,
  FichaEmpleado,
  Importacion,
  InformeContabilizacionNomina,
  IngresosEmpleado,
  MotivoTerminacion,
  NovedadNomina,
  NuevaDeduccion,
  NuevaNovedad,
  NuevoContratoLaboral,
  NuevoEmpleado,
  PeriodicidadPago,
  PeriodoLiquidado,
  PeriodoNomina,
  ResumenAportes,
  SaldoVacaciones,
  SimulacionTerminacion,
  VersionContrato,
  VistaPreviaEmpleados,
  VistaPreviaNovedades,
} from '@/api/tipos'

const e = (id: string) => ({ path: { entidad_id: id } })
const emp = (id: string, x: string) => ({ path: { entidad_id: id, empleado_id: x } })
const con = (id: string, x: string) => ({ path: { entidad_id: id, contrato_id: x } })
const per = (id: string, x: string) => ({ path: { entidad_id: id, periodo_id: x } })

/** Sube una planilla tal cual (el contrato describe el cuerpo como bytes). */
const planilla = (archivo: File) => ({
  body: [] as number[],
  bodySerializer: () => archivo,
  headers: { 'Content-Type': 'application/octet-stream' },
})

// Catálogo y configuración ----------------------------------------------------------------------

/** Parámetros vigentes en la fecha (con su `unidad`) y administradoras activas. */
export function catalogo(id: string, fecha?: string): Promise<CatalogoLaboral> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/catalogo', { params: { ...e(id), query: { fecha } } }))
}

export function configuracion(id: string): Promise<ConfiguracionNomina> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/configuracion', { params: e(id) }))
}

/** Exoneración de aportes (art. 114-1 del ET): lo decide el contador. */
export function guardarConfiguracion(id: string, exoneradaAportes: boolean): Promise<ConfiguracionNomina> {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/nomina/configuracion', { params: e(id), body: { exonerada_aportes: exoneradaAportes } }))
}

/** Contabiliza lo aprobado entre las fechas (la nómina de antes de tener la contabilidad). */
export function contabilizar(id: string, desde: string, hasta: string): Promise<InformeContabilizacionNomina> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/contabilizacion', { params: e(id), body: { desde, hasta } }))
}

// Empleados y contratos -------------------------------------------------------------------------

export interface FiltrosEmpleados {
  q?: string
  estado?: EstadoEmpleado
}

/** Una página de empleados (por cursor). */
export async function empleados(id: string, despues: string | undefined, f: FiltrosEmpleados = {}) {
  const r = await exigir(
    api().GET('/api/v1/entidades/{entidad_id}/nomina/empleados', {
      params: { ...e(id), query: { q: f.q?.trim() || undefined, estado: f.estado, despues, limite: 50 } },
    }),
  )
  return { datos: r.datos as EmpleadoResumen[], siguiente: r.siguiente ?? null }
}

/** Ficha con todos los contratos y versiones (salarios y cuentas en `null` sin `nomina.salarios.ver`). */
export function empleado(id: string, empleadoId: string): Promise<FichaEmpleado> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/empleados/{empleado_id}', { params: emp(id, empleadoId) }))
}

/** Alta con su primer contrato; con `persona` crea la persona si su documento no existe. */
export function crearEmpleado(id: string, datos: NuevoEmpleado): Promise<FichaEmpleado> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/empleados', { params: e(id), body: datos }))
}

/** Otro contrato del mismo empleado (409 si se cruza en fechas con los demás). */
export function agregarContrato(id: string, empleadoId: string, datos: NuevoContratoLaboral): Promise<ContratoConVersiones> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/empleados/{empleado_id}/contratos', { params: emp(id, empleadoId), body: datos }))
}

/** Versión nueva de las condiciones desde una fecha posterior a la última. */
export function modificarContrato(id: string, contratoId: string, vigenteDesde: string, condiciones: CondicionesContrato): Promise<VersionContrato> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/nomina/contratos/{contrato_id}/versiones', {
      params: con(id, contratoId),
      body: { vigente_desde: vigenteDesde, condiciones },
    }),
  )
}

/** Solo a término fijo. */
export function prorrogar(id: string, contratoId: string, fechaFin: string): Promise<ContratoLaboral> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/contratos/{contrato_id}/prorroga', { params: con(id, contratoId), body: { fecha_fin: fechaFin } }))
}

export function terminar(id: string, contratoId: string, fecha: string, motivo: MotivoTerminacion): Promise<ContratoLaboral> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/contratos/{contrato_id}/terminacion', { params: con(id, contratoId), body: { fecha, motivo } }))
}

/** Costo del retiro en la fecha y con el motivo; no guarda nada. */
export function simularTerminacion(id: string, contratoId: string, fecha: string, motivo: MotivoTerminacion): Promise<SimulacionTerminacion> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/nomina/contratos/{contrato_id}/simulacion-terminacion', { params: con(id, contratoId), body: { fecha, motivo } }),
  )
}

export function vacaciones(id: string, contratoId: string, fecha?: string): Promise<SaldoVacaciones> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/contratos/{contrato_id}/vacaciones', { params: { ...con(id, contratoId), query: { fecha } } }))
}

/** A término fijo, sin terminar, que vencen en los próximos días (45 por omisión, los del correo). */
export function porVencer(id: string, dias?: number): Promise<ContratoPorVencer[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/contratos/por-vencer', { params: { ...e(id), query: { dias } } }))
}

/** Certificado laboral en PDF; con el salario exige `nomina.salarios.ver`. */
export function certificadoLaboral(id: string, empleadoId: string, conSalario: boolean): Promise<Descarga> {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/nomina/empleados/{empleado_id}/certificado-laboral', {
      params: { ...emp(id, empleadoId), query: { con_salario: conSalario } },
      parseAs: 'blob',
    }),
    'certificado-laboral.pdf',
  )
}

// Deducciones de la retención -------------------------------------------------------------------

export function deducciones(id: string, empleadoId: string): Promise<DeduccionRetencion[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/empleados/{empleado_id}/deducciones', { params: emp(id, empleadoId) }))
}

/** Se aplica desde la liquidación siguiente; `dependientes` va sin valor. */
export function crearDeduccion(id: string, empleadoId: string, datos: NuevaDeduccion): Promise<DeduccionRetencion> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/empleados/{empleado_id}/deducciones', { params: emp(id, empleadoId), body: datos }))
}

export function terminarDeduccion(id: string, deduccionId: string, hasta: string): Promise<DeduccionRetencion> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/nomina/deducciones/{deduccion_id}/terminacion', {
      params: { path: { entidad_id: id, deduccion_id: deduccionId } },
      body: { hasta },
    }),
  )
}

// Novedades -------------------------------------------------------------------------------------

/** Las que tocan el rango (con las anuladas marcadas). */
export function novedades(id: string, desde: string, hasta: string, contratoId?: string): Promise<NovedadNomina[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/novedades', { params: { ...e(id), query: { desde, hasta, contrato_id: contratoId } } }))
}

export function registrarNovedad(id: string, contratoId: string, datos: NuevaNovedad): Promise<NovedadNomina> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/contratos/{contrato_id}/novedades', { params: con(id, contratoId), body: datos }))
}

export async function anularNovedad(id: string, novedadId: string, motivo: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/entidades/{entidad_id}/nomina/novedades/{novedad_id}/anulacion', {
      params: { path: { entidad_id: id, novedad_id: novedadId } },
      body: { motivo: motivo.trim() },
    }),
  )
}

// Periodos y desprendibles ----------------------------------------------------------------------

/** Los periodos, el más reciente primero (a lo sumo 120). */
export function periodos(id: string): Promise<PeriodoNomina[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/periodos', { params: e(id) }))
}

/** `desde` es el día 1 (mensual) o el 1 o el 16 (quincenal). */
export function abrirPeriodo(id: string, periodicidad: PeriodicidadPago, desde: string): Promise<PeriodoNomina> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/periodos', { params: e(id), body: { periodicidad, desde } }))
}

/** Con sus liquidaciones y líneas (exige `nomina.salarios.ver`). */
export function periodo(id: string, periodoId: string): Promise<PeriodoLiquidado> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/periodos/{periodo_id}', { params: per(id, periodoId) }))
}

/** Liquida o vuelve a liquidar (mientras no esté aprobado). */
export function liquidar(id: string, periodoId: string): Promise<PeriodoLiquidado> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/periodos/{periodo_id}/liquidacion', { params: per(id, periodoId) }))
}

/** La aprueba otra cuenta; 409 si hubo novedades después de liquidar. */
export function aprobar(id: string, periodoId: string): Promise<PeriodoNomina> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/periodos/{periodo_id}/aprobacion', { params: per(id, periodoId) }))
}

export function pagar(id: string, periodoId: string, fechaPago: string): Promise<PeriodoNomina> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/periodos/{periodo_id}/pago', { params: per(id, periodoId), body: { fecha_pago: fechaPago } }))
}

/** Envía por correo los desprendibles del periodo aprobado o pagado. */
export function enviarDesprendibles(id: string, periodoId: string): Promise<EnvioDesprendibles> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/periodos/{periodo_id}/desprendibles', { params: per(id, periodoId) }))
}

/** PDF del desprendible (periodo aprobado o pagado; antes, 409). */
export function desprendible(id: string, liquidacionId: string): Promise<ArchivoRecibido> {
  return recibirArchivo(
    api().GET('/api/v1/entidades/{entidad_id}/nomina/liquidaciones/{liquidacion_id}/desprendible', {
      params: { path: { entidad_id: id, liquidacion_id: liquidacionId } },
      parseAs: 'blob',
    }),
    'desprendible.pdf',
  )
}

// Reportes --------------------------------------------------------------------------------------

export function cesantias(id: string, anio: number): Promise<CesantiasContrato[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/cesantias', { params: { ...e(id), query: { anio } } }))
}

/** Insumo de la PILA: por empleado y por administradora, con lo aprobado del mes. */
export function aportes(id: string, anio: number, mes: number): Promise<ResumenAportes> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/aportes', { params: { ...e(id), query: { anio, mes } } }))
}

/** Insumo del certificado de ingresos y retenciones (formulario 220). */
export function ingresosRetenciones(id: string, anio: number): Promise<IngresosEmpleado[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/nomina/ingresos-retenciones', { params: { ...e(id), query: { anio } } }))
}

// Importaciones ---------------------------------------------------------------------------------

export function plantillaEmpleados(id: string): Promise<Descarga> {
  return descargar(api().GET('/api/v1/entidades/{entidad_id}/nomina/importaciones/plantilla', { params: e(id), parseAs: 'blob' }), 'plantilla-empleados.csv')
}

export function importarEmpleados(id: string, archivo: File): Promise<VistaPreviaEmpleados> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/nomina/importaciones', { params: { ...e(id), query: { nombre: archivo.name } }, ...planilla(archivo) }))
}

export function confirmarEmpleados(id: string, importacionId: string): Promise<Importacion> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/nomina/importaciones/{importacion_id}/confirmar', {
      params: { path: { entidad_id: id, importacion_id: importacionId } },
    }),
  )
}

export function plantillaNovedades(id: string): Promise<Descarga> {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/nomina/novedades/importaciones/plantilla', { params: e(id), parseAs: 'blob' }),
    'plantilla-novedades.csv',
  )
}

export function importarNovedades(id: string, archivo: File): Promise<VistaPreviaNovedades> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/nomina/novedades/importaciones', { params: { ...e(id), query: { nombre: archivo.name } }, ...planilla(archivo) }),
  )
}

export function confirmarNovedades(id: string, importacionId: string): Promise<Importacion> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/nomina/novedades/importaciones/{importacion_id}/confirmar', {
      params: { path: { entidad_id: id, importacion_id: importacionId } },
    }),
  )
}

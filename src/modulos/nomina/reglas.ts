/**
 * Reglas de la nómina (funciones puras). El backend decide (salario mínimo, afiliaciones,
 * cuatro ojos, fechas de los periodos); aquí se anticipa lo que se muestra y se arma la
 * petición.
 */
import type {
  ClaseLineaNomina,
  CondicionesContrato,
  ContratoConVersiones,
  EstadoPeriodoNomina,
  FichaEmpleado,
  Jornada,
  LineaLiquidacionNomina,
  MedioPagoNomina,
  PeriodicidadPago,
  PeriodoNomina,
  TipoContratoLaboral,
  TipoSalario,
  VersionContrato,
} from '@/api/tipos'
import { puedeAprobar } from '@/composables/reglas'
import { restar, sumar } from '@/formato/decimales'
import { sumarDias } from '@/formato/fechas'

// Líneas de una liquidación ---------------------------------------------------------------------

export interface GrupoLineas {
  clase: ClaseLineaNomina
  lineas: LineaLiquidacionNomina[]
  total: string
}

const ORDEN_CLASES: ClaseLineaNomina[] = ['devengo', 'deduccion', 'aporte_empleador', 'provision']

/** Agrupa las líneas en devengos, deducciones, aportes del empleador y provisiones (sin grupos vacíos). */
export function agruparLineas(lineas: LineaLiquidacionNomina[]): GrupoLineas[] {
  return ORDEN_CLASES.flatMap((clase) => {
    const propias = lineas.filter((l) => l.clase === clase)
    return propias.length ? [{ clase, lineas: propias, total: sumar(...propias.map((l) => l.valor)) }] : []
  })
}

/** Neto a pagar: devengos menos deducciones. Las provisiones y los aportes del empleador no cuentan. */
export function netoDeLineas(lineas: LineaLiquidacionNomina[]): string {
  const total = (c: ClaseLineaNomina) => sumar('0', ...lineas.filter((l) => l.clase === c).map((l) => l.valor))
  return restar(total('devengo'), total('deduccion'))
}

// Periodos --------------------------------------------------------------------------------------

export type AccionPeriodo = 'liquidar' | 'aprobar' | 'pagar' | 'desprendibles'

export interface PermisosPeriodo {
  liquidar: boolean
  aprobar: boolean
}

/**
 * Abierto → liquidado (se puede volver a liquidar) → aprobado (por **otra** cuenta: a quien
 * liquidó no se le ofrece) → pagado. Los desprendibles existen desde que se aprueba.
 */
export function accionesPeriodo(p: Pick<PeriodoNomina, 'estado' | 'liquidado_por'>, q: PermisosPeriodo, cuentaId: string | null | undefined): AccionPeriodo[] {
  const r: AccionPeriodo[] = []
  if ((p.estado === 'abierto' || p.estado === 'liquidado') && q.liquidar) r.push('liquidar')
  if (p.estado === 'liquidado' && q.aprobar && puedeAprobar([p.liquidado_por], cuentaId)) r.push('aprobar')
  if (p.estado === 'aprobado' && q.liquidar) r.push('pagar')
  if ((p.estado === 'aprobado' || p.estado === 'pagado') && q.liquidar) r.push('desprendibles')
  return r
}

/** Lo liquidó la cuenta de la sesión: lo aprueba otra persona. */
export const pendienteDeOtro = (p: Pick<PeriodoNomina, 'estado' | 'liquidado_por'>, cuentaId: string | null | undefined) =>
  p.estado === 'liquidado' && !!cuentaId && p.liquidado_por === cuentaId

/** Con el desprendible disponible (periodo aprobado o pagado). */
export const conDesprendibles = (estado: EstadoPeriodoNomina) => estado === 'aprobado' || estado === 'pagado'

/** Fechas de inicio posibles de un periodo en el mes `YYYY-MM`: el 1, o el 1 y el 16 en la quincenal. */
export function iniciosDePeriodo(periodicidad: PeriodicidadPago, mes: string): string[] {
  return periodicidad === 'mensual' ? [`${mes}-01`] : [`${mes}-01`, `${mes}-16`]
}

/** El periodo que contiene la fecha (el más reciente si hay varios). */
export function periodoDeLaFecha(lista: PeriodoNomina[], fecha: string): PeriodoNomina | null {
  return lista.find((p) => p.desde <= fecha && fecha <= p.hasta) ?? null
}

/** ¿La fecha cae en un periodo aprobado o pagado? Ahí ya no se registran novedades. */
export function fechaCerrada(lista: PeriodoNomina[], fecha: string): boolean {
  return lista.some((p) => conDesprendibles(p.estado) && p.desde <= fecha && fecha <= p.hasta)
}

// Contratos -------------------------------------------------------------------------------------

/** Los campos del formulario que dependen del tipo de contrato y de las condiciones. */
export interface CamposCondiciones {
  fechaFin: boolean
  descripcionObra: boolean
  etapaAprendizaje: boolean
  horasSemanales: boolean
  cuenta: boolean
}

export function camposCondiciones(tipo: TipoContratoLaboral, tipoSalario: TipoSalario, jornada: Jornada, medio: MedioPagoNomina): CamposCondiciones {
  return {
    fechaFin: tipo === 'termino_fijo' || tipo === 'aprendizaje',
    descripcionObra: tipo === 'obra_labor',
    etapaAprendizaje: tipoSalario === 'apoyo_sostenimiento',
    horasSemanales: jornada === 'parcial',
    cuenta: medio === 'transferencia',
  }
}

/** El aprendiz va con apoyo de sostenimiento, y solo él. */
export const tipoSalarioDe = (tipo: TipoContratoLaboral, actual: TipoSalario): TipoSalario =>
  tipo === 'aprendizaje' ? 'apoyo_sostenimiento' : actual === 'apoyo_sostenimiento' ? 'ordinario' : actual

/** Condiciones vacías para el alta. */
export function condicionesVacias(): CondicionesContrato {
  return {
    cargo: '',
    salario: '',
    tipo_salario: 'ordinario',
    etapa_aprendizaje: null,
    jornada: 'completa',
    horas_semanales: null,
    periodicidad: 'mensual',
    eps_id: '',
    afp_id: null,
    cesantias_id: null,
    ccf_id: null,
    arl_id: null,
    clase_riesgo: '1',
    pensionado: false,
    centro_costo_id: null,
    medio_pago: 'transferencia',
    cuenta: { banco: '', tipo: 'ahorros', numero: '' },
  }
}

/** Condiciones de una versión, para empezar la siguiente (sin salario ni cuenta si no se ven). */
export function condicionesDe(v: VersionContrato): CondicionesContrato {
  return {
    cargo: v.cargo,
    salario: v.salario ?? '',
    tipo_salario: v.tipo_salario,
    etapa_aprendizaje: v.etapa_aprendizaje ?? null,
    jornada: v.jornada,
    horas_semanales: v.horas_semanales ?? null,
    periodicidad: v.periodicidad,
    eps_id: v.eps_id,
    afp_id: v.afp_id ?? null,
    cesantias_id: v.cesantias_id ?? null,
    ccf_id: v.ccf_id ?? null,
    arl_id: v.arl_id ?? null,
    clase_riesgo: v.clase_riesgo ?? null,
    pensionado: v.pensionado,
    centro_costo_id: v.centro_costo_id ?? null,
    medio_pago: v.medio_pago,
    cuenta: v.cuenta ?? (v.medio_pago === 'transferencia' ? { banco: '', tipo: 'ahorros', numero: '' } : null),
  }
}

/**
 * Lo que se envía: quita los campos que no aplican (etapa sin aprendiz, horas sin jornada
 * parcial, cuenta sin transferencia, centro de costo sin contabilidad).
 */
export function limpiarCondiciones(c: CondicionesContrato, conContabilidad: boolean): CondicionesContrato {
  const vacio = (x: string | null | undefined) => (x && x.trim() ? x : null)
  return {
    ...c,
    cargo: c.cargo.trim(),
    etapa_aprendizaje: c.tipo_salario === 'apoyo_sostenimiento' ? (c.etapa_aprendizaje ?? 'lectiva') : null,
    horas_semanales: c.jornada === 'parcial' ? vacio(c.horas_semanales) : null,
    afp_id: vacio(c.afp_id),
    cesantias_id: vacio(c.cesantias_id),
    ccf_id: vacio(c.ccf_id),
    arl_id: vacio(c.arl_id),
    centro_costo_id: conContabilidad ? vacio(c.centro_costo_id) : null,
    cuenta: c.medio_pago === 'transferencia' && c.cuenta ? { ...c.cuenta, banco: c.cuenta.banco.trim(), numero: c.cuenta.numero.trim() } : null,
  }
}

/** Qué falta antes de enviar (el backend valida además el salario mínimo y las afiliaciones). */
export function faltantesCondiciones(c: CondicionesContrato): string[] {
  const f: string[] = []
  if (!c.cargo.trim()) f.push('el cargo')
  if (!c.salario.trim()) f.push('el salario')
  if (!c.eps_id) f.push('la EPS')
  if (c.jornada === 'parcial' && !c.horas_semanales?.trim()) f.push('las horas semanales')
  if (c.medio_pago === 'transferencia' && (!c.cuenta?.banco.trim() || !c.cuenta.numero.trim())) f.push('el banco y el número de la cuenta')
  return f
}

/** La versión vigente en la fecha (la última que empezó antes o ese día; si ninguna, la primera). */
export function versionVigente(c: ContratoConVersiones, fecha: string): VersionContrato | null {
  const orden = [...c.versiones].sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))
  return orden.filter((v) => v.vigente_desde <= fecha).at(-1) ?? orden[0] ?? null
}

/** La fecha mínima de una versión nueva: el día siguiente a la última. */
export function minimoNuevaVersion(c: ContratoConVersiones): string {
  const ultima = c.versiones.map((v) => v.vigente_desde).sort().at(-1) ?? c.contrato.fecha_inicio
  return sumarDias(ultima, 1)
}

/** Contratos del empleado, el más reciente primero. */
export const contratosOrdenados = (f: FichaEmpleado) => [...f.contratos].sort((a, b) => b.contrato.fecha_inicio.localeCompare(a.contrato.fecha_inicio))

export const terminado = (c: ContratoConVersiones) => !!c.contrato.fecha_terminacion

/** El contrato sin terminar del empleado (a lo sumo uno, porque no se cruzan). */
export const contratoVigente = (f: FichaEmpleado) => contratosOrdenados(f).find((c) => !terminado(c)) ?? null

/** Días de una fecha a otra (`YYYY-MM-DD`), negativos si `hasta` ya pasó. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)
}

/**
 * Semáforo de un contrato por vencer: rojo si quedan menos de 30 días (ya no alcanza el preaviso
 * y se prorroga solo si no se termina), ámbar de 30 a 45.
 */
export function semaforoContrato(fechaFin: string, hoy: string): { tono: 'peligro' | 'aviso'; texto: string } {
  const dias = diasEntre(hoy, fechaFin)
  const texto = dias <= 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
  return { tono: dias < 30 ? 'peligro' : 'aviso', texto }
}

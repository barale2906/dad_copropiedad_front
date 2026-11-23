/**
 * Textos de la nómina (los catálogos del contrato) y reglas puras que comparten el módulo, «Mi
 * nómina» en Mi cuenta y el catálogo laboral de la consola de la plataforma. Son `Record`
 * completos a propósito: si el contrato agrega un valor, no compila hasta darle su texto.
 */
import type {
  ClaseLineaNomina,
  ClaseRiesgo,
  CodigoParametroLaboral,
  CodigoTablaLaboral,
  ConceptoNomina,
  EstadoEmpleado,
  EstadoPeriodoNomina,
  EtapaAprendizaje,
  GrupoCertificado,
  Jornada,
  MedidaNovedad,
  MedioPagoNomina,
  MotivoTerminacion,
  PeriodicidadPago,
  TipoAdministradora,
  TipoContratoLaboral,
  TipoCuentaNomina,
  TipoDeduccion,
  TipoNovedad,
  TipoSalario,
  UnidadParametroLaboral,
} from '@/api/tipos'
import { fechaCalendario } from './fechas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'
export interface TextoConTono {
  texto: string
  tono: Tono
}

export const PERIODICIDAD: Record<PeriodicidadPago, string> = { mensual: 'Mensual', quincenal: 'Quincenal' }

export const ESTADO_PERIODO: Record<EstadoPeriodoNomina, TextoConTono> = {
  abierto: { texto: 'Abierto', tono: 'info' },
  liquidado: { texto: 'Liquidado', tono: 'aviso' },
  aprobado: { texto: 'Aprobado', tono: 'exito' },
  pagado: { texto: 'Pagado', tono: 'neutro' },
}

export const ESTADO_EMPLEADO: Record<EstadoEmpleado, TextoConTono> = {
  activo: { texto: 'Activo', tono: 'exito' },
  retirado: { texto: 'Retirado', tono: 'neutro' },
}

export const TIPO_CONTRATO: Record<TipoContratoLaboral, string> = {
  termino_indefinido: 'Término indefinido',
  termino_fijo: 'Término fijo',
  obra_labor: 'Obra o labor',
  aprendizaje: 'Aprendizaje',
}

export const TIPO_SALARIO: Record<TipoSalario, string> = {
  ordinario: 'Ordinario',
  integral: 'Integral',
  apoyo_sostenimiento: 'Apoyo de sostenimiento (aprendiz)',
}

export const ETAPA_APRENDIZAJE: Record<EtapaAprendizaje, string> = { lectiva: 'Lectiva', productiva: 'Productiva' }
export const JORNADA: Record<Jornada, string> = { completa: 'Completa', parcial: 'Parcial' }
export const MEDIO_PAGO: Record<MedioPagoNomina, string> = { transferencia: 'Transferencia', cheque: 'Cheque', efectivo: 'Efectivo' }
export const TIPO_CUENTA: Record<TipoCuentaNomina, string> = { ahorros: 'Ahorros', corriente: 'Corriente' }
export const CLASE_RIESGO: Record<ClaseRiesgo, string> = {
  '1': 'Clase I (mínimo)',
  '2': 'Clase II (bajo)',
  '3': 'Clase III (medio)',
  '4': 'Clase IV (alto)',
  '5': 'Clase V (máximo)',
}

export const TIPO_ADMINISTRADORA: Record<TipoAdministradora, string> = {
  eps: 'EPS',
  afp: 'Fondo de pensiones',
  cesantias: 'Fondo de cesantías',
  ccf: 'Caja de compensación',
  arl: 'ARL',
}

export const MOTIVO_TERMINACION: Record<MotivoTerminacion, string> = {
  renuncia: 'Renuncia',
  mutuo_acuerdo: 'Mutuo acuerdo',
  vencimiento_termino: 'Vencimiento del término',
  fin_obra: 'Fin de la obra o labor',
  justa_causa: 'Despido con justa causa',
  sin_justa_causa: 'Despido sin justa causa',
  periodo_prueba: 'Durante el periodo de prueba',
  fallecimiento: 'Fallecimiento',
  otro: 'Otro',
}

export const TIPO_NOVEDAD: Record<TipoNovedad, string> = {
  hora_extra_diurna: 'Hora extra diurna',
  hora_extra_nocturna: 'Hora extra nocturna',
  hora_extra_dominical_diurna: 'Hora extra dominical diurna',
  hora_extra_dominical_nocturna: 'Hora extra dominical nocturna',
  recargo_nocturno: 'Recargo nocturno',
  recargo_dominical: 'Recargo dominical o festivo',
  recargo_nocturno_dominical: 'Recargo nocturno dominical',
  incapacidad_comun: 'Incapacidad común',
  incapacidad_laboral: 'Incapacidad laboral',
  licencia_maternidad: 'Licencia de maternidad',
  licencia_paternidad: 'Licencia de paternidad',
  licencia_remunerada: 'Licencia remunerada',
  vacaciones: 'Vacaciones disfrutadas',
  licencia_no_remunerada: 'Licencia no remunerada',
  ausencia: 'Ausencia',
  suspension: 'Suspensión',
  bonificacion_salarial: 'Bonificación salarial',
  bonificacion_no_salarial: 'Bonificación no salarial',
  comision: 'Comisión',
  auxilio_no_salarial: 'Auxilio no salarial',
  prestamo: 'Préstamo',
  libranza: 'Libranza',
  embargo: 'Embargo',
  otra_deduccion: 'Otra deducción',
}

/**
 * Medida de cada novedad (la misma regla del backend): las de horas y las de valor llevan una
 * fecha y su cantidad; las de días, el primero y el último día.
 */
export function medidaDe(tipo: TipoNovedad): MedidaNovedad {
  if (tipo.startsWith('hora_extra') || tipo.startsWith('recargo')) return 'horas'
  if (['bonificacion_salarial', 'bonificacion_no_salarial', 'comision', 'auxilio_no_salarial', 'prestamo', 'libranza', 'embargo', 'otra_deduccion'].includes(tipo)) return 'valor'
  return 'dias'
}

/** Solo en domingo o festivo (si no, el backend responde 422). */
export const esDominical = (tipo: TipoNovedad) => tipo.includes('dominical')

/** Revela la salud del empleado: solo se ve con `personas.datos_sensibles.ver`. */
export const esSensible = (tipo: TipoNovedad) =>
  tipo.startsWith('incapacidad') || tipo === 'licencia_maternidad' || tipo === 'licencia_paternidad'

export const MEDIDA_NOVEDAD: Record<MedidaNovedad, string> = { horas: 'Horas', dias: 'Días', valor: 'Valor' }

export const CONCEPTO_NOMINA: Record<ConceptoNomina, string> = {
  basico: 'Salario básico',
  apoyo_sostenimiento: 'Apoyo de sostenimiento',
  auxilio_transporte: 'Auxilio de transporte',
  hora_extra_diurna: 'Horas extra diurnas',
  hora_extra_nocturna: 'Horas extra nocturnas',
  hora_extra_dominical_diurna: 'Horas extra dominicales diurnas',
  hora_extra_dominical_nocturna: 'Horas extra dominicales nocturnas',
  recargo_nocturno: 'Recargo nocturno',
  recargo_dominical: 'Recargo dominical o festivo',
  recargo_nocturno_dominical: 'Recargo nocturno dominical',
  incapacidad_comun: 'Incapacidad común',
  incapacidad_laboral: 'Incapacidad laboral',
  licencia_maternidad: 'Licencia de maternidad',
  licencia_paternidad: 'Licencia de paternidad',
  licencia_remunerada: 'Licencia remunerada',
  vacaciones: 'Vacaciones disfrutadas',
  bonificacion_salarial: 'Bonificación salarial',
  bonificacion_no_salarial: 'Bonificación no salarial',
  comision: 'Comisiones',
  auxilio_no_salarial: 'Auxilio no salarial',
  prima: 'Prima de servicios',
  cesantias: 'Cesantías',
  intereses_cesantias: 'Intereses sobre cesantías',
  vacaciones_compensadas: 'Vacaciones compensadas',
  indemnizacion: 'Indemnización',
  salud: 'Salud',
  pension: 'Pensión',
  fondo_solidaridad: 'Fondo de solidaridad pensional',
  retencion_fuente: 'Retención en la fuente',
  prestamo: 'Préstamo',
  libranza: 'Libranza',
  embargo: 'Embargo',
  otra_deduccion: 'Otra deducción',
  salud_empleador: 'Salud (empleador)',
  pension_empleador: 'Pensión (empleador)',
  arl: 'ARL',
  caja_compensacion: 'Caja de compensación',
  icbf: 'ICBF',
  sena: 'SENA',
  provision_cesantias: 'Provisión de cesantías',
  provision_intereses: 'Provisión de intereses',
  provision_prima: 'Provisión de prima',
  provision_vacaciones: 'Provisión de vacaciones',
}

export const CLASE_LINEA: Record<ClaseLineaNomina, string> = {
  devengo: 'Devengos',
  deduccion: 'Deducciones',
  aporte_empleador: 'Aportes del empleador',
  provision: 'Provisiones (informativas)',
}

export const TIPO_DEDUCCION: Record<TipoDeduccion, string> = {
  dependientes: 'Dependientes',
  intereses_vivienda: 'Intereses de vivienda',
  medicina_prepagada: 'Medicina prepagada',
  aportes_voluntarios: 'Aportes voluntarios (AFC o pensión voluntaria)',
}

export const GRUPO_CERTIFICADO: Record<GrupoCertificado, string> = {
  salarios: 'Salarios',
  comisiones: 'Comisiones',
  prestaciones: 'Prestaciones sociales',
  cesantias: 'Cesantías e intereses',
  otros_pagos: 'Otros pagos',
  aportes_salud: 'Aportes a salud',
  aportes_pension: 'Aportes a pensión',
  retencion_fuente: 'Retención en la fuente',
}

export const PARAMETRO_LABORAL: Record<CodigoParametroLaboral, string> = {
  salario_minimo: 'Salario mínimo',
  auxilio_transporte: 'Auxilio de transporte',
  tope_auxilio_transporte: 'Tope para el auxilio de transporte',
  jornada_maxima_semanal: 'Jornada máxima semanal',
  inicio_jornada_nocturna: 'Inicio de la jornada nocturna',
  fin_jornada_nocturna: 'Fin de la jornada nocturna',
  recargo_nocturno: 'Recargo nocturno',
  hora_extra_diurna: 'Hora extra diurna',
  hora_extra_nocturna: 'Hora extra nocturna',
  recargo_dominical_festivo: 'Recargo dominical o festivo',
  salud_empleador: 'Salud a cargo del empleador',
  salud_empleado: 'Salud a cargo del empleado',
  pension_empleador: 'Pensión a cargo del empleador',
  pension_empleado: 'Pensión a cargo del empleado',
  caja_compensacion: 'Caja de compensación',
  icbf: 'ICBF',
  sena: 'SENA',
  arl_clase_1: 'ARL clase I',
  arl_clase_2: 'ARL clase II',
  arl_clase_3: 'ARL clase III',
  arl_clase_4: 'ARL clase IV',
  arl_clase_5: 'ARL clase V',
  salario_integral_minimo: 'Salario integral mínimo',
  factor_salario_integral: 'Factor prestacional del salario integral',
  limite_pagos_no_salariales: 'Límite de los pagos no salariales',
  dias_incapacidad_empleador: 'Días de incapacidad a cargo del empleador',
  incapacidad_eps: 'Pago de la incapacidad por la EPS',
  dias_cesantias: 'Días de cesantías por año',
  intereses_cesantias: 'Intereses sobre cesantías',
  dias_prima: 'Días de prima por año',
  dias_vacaciones: 'Días de vacaciones por año',
  apoyo_aprendiz_lectiva: 'Apoyo del aprendiz en etapa lectiva',
  apoyo_aprendiz_productiva: 'Apoyo del aprendiz en etapa productiva',
  tope_ibc: 'Tope del ingreso base de cotización',
  tope_exoneracion_aportes: 'Tope de la exoneración de aportes',
  renta_exenta_laboral: 'Renta exenta laboral',
  tope_renta_exenta_laboral: 'Tope de la renta exenta laboral',
  limite_beneficios_retencion: 'Límite de beneficios en la retención',
  tope_beneficios_retencion: 'Tope de beneficios en la retención',
  porcentaje_dependientes: 'Deducción por dependientes',
  tope_dependientes: 'Tope de la deducción por dependientes',
  tope_intereses_vivienda: 'Tope de intereses de vivienda',
  tope_medicina_prepagada: 'Tope de medicina prepagada',
  limite_aportes_voluntarios: 'Límite de aportes voluntarios',
  tope_aportes_voluntarios: 'Tope de aportes voluntarios',
}

export const UNIDAD_PARAMETRO: Record<UnidadParametroLaboral, string> = {
  pesos: 'Pesos',
  porcentaje: 'Porcentaje',
  salarios_minimos: 'Salarios mínimos',
  horas_semana: 'Horas por semana',
  hora_del_dia: 'Hora del día',
  dias: 'Días',
  uvt_anuales: 'UVT al año',
}

export const TABLA_LABORAL: Record<CodigoTablaLaboral, string> = {
  retencion_salarios: 'Retención en la fuente por salarios',
  fondo_solidaridad: 'Fondo de solidaridad pensional',
}

/** «Quincenal · 1 al 15 de oct. 2026» o «Mensual · 1 al 31 de oct. 2026». */
export function textoPeriodo(p: { periodicidad: PeriodicidadPago; desde: string; hasta: string }): string {
  return `${PERIODICIDAD[p.periodicidad]} · ${fechaCalendario(p.desde)} al ${fechaCalendario(p.hasta)}`
}

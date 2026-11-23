/**
 * Demo de la nómina (plan 17), en la PH y en «DAD Servicios»: catálogo laboral vigente (también
 * para la consola de la plataforma), cinco empleados —Andrés Administrador (indefinido; es la
 * cuenta de la sesión: sus desprendibles salen en «Mi nómina»), Marta Gómez (término fijo que
 * vence en 30 días), Julián Rojas (aprendiz), Lucía Vigilante (término fijo que vence en 20 días)
 * y Pedro Contreras (retirado)—, novedades del mes (una incapacidad, que es dato sensible) y
 * tres periodos mensuales: el de hace dos meses pagado, el del mes pasado **liquidado por otra
 * cuenta** (la de la sesión lo aprueba; `revisor` no) y el del mes en curso abierto. Valida lo
 * que valida el backend: cuatro ojos al aprobar, novedades después de liquidar (409), periodos
 * aprobados (422), dominicales fuera de domingo (422), código repetido (409) y desprendibles
 * antes de aprobar (409). Se reinicia en cada inicio de sesión.
 */
import type {
  Administradora,
  CatalogoLaboral,
  ClaseLineaNomina,
  CondicionesContrato,
  ConceptoNomina,
  ContratoConVersiones,
  DeduccionRetencion,
  DesprendibleDeCuenta,
  EmpleadoResumen,
  FichaEmpleado,
  Importacion,
  LineaLiquidacionNomina,
  LiquidacionNomina,
  MotivoTerminacion,
  NovedadNomina,
  NuevaAdministradora,
  NuevaDeduccion,
  NuevaNovedad,
  NuevaTablaLaboral,
  NuevoContratoLaboral,
  NuevoEmpleado,
  NuevoParametroLaboral,
  ParametroLaboral,
  PeriodoNomina,
  TipoContratoLaboral,
  TipoNovedad,
  VersionContrato,
} from '@/api/tipos'
import { comparar, multiplicar, restar, sumar } from '@/formato/decimales'
import { esDominical, medidaDe } from '@/formato/nomina'
import { cuentaDemoId } from './cuenta'
import { cuerpo, error, fechaDemo, json, type Manejador, sinContenido } from './http'
import { personasDemo } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const ahora = () => new Date().toISOString()
const dias = (d: number) => fechaDemo(d)
const n2 = (x: string) => {
  const [e = '0', d = ''] = x.split('.')
  return `${e}.${(d + '00').slice(0, 2)}`
}
const redondear = (x: string) => n2(multiplicar(x, '1').replace(/(\.\d{2})\d+$/, '$1'))

/** Entidades con la nómina contratada en el demo (la PH y «DAD Servicios»). */
const ENTIDADES_NOMINA = ['01930000-0000-7000-8000-000000000001', '01930000-0000-7000-8000-000000000003']
const OTRA_CUENTA = '01930000-0000-7000-8000-00000000c002'
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
const pdf = (nombre: string) =>
  new Response(PDF, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nombre}"`, 'X-Request-Id': 'demo' } })
const csv = (texto: string, nombre: string) =>
  new Response(texto, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nombre}"`, 'X-Request-Id': 'demo' } })

// Catálogo laboral (compartido con la consola de la plataforma) ---------------------------------

const ANIO = fechaDemo().slice(0, 4)
const SALARIO_MINIMO = '1423500.00'
const AUXILIO = '200000.00'

let catalogo: CatalogoLaboral = { parametros: [], administradoras: [], tablas: [] }

function parametro(n: number, p: ParametroLaboral['parametro'], unidad: ParametroLaboral['unidad'], valor: string, fuente: string): ParametroLaboral {
  return { id: id(n), parametro: p, unidad, valor, fuente, vigente_desde: `${ANIO}-01-01`, creado_en: '2026-01-02T12:00:00Z' }
}

function administradora(n: number, tipo: Administradora['tipo'], codigo: string, nombre: string): Administradora {
  return { id: id(n), tipo, codigo, nit: `8${String(n).slice(-8)}-1`, nombre, activa: true }
}

const EPS_SURA = id(17101)
const NUEVA_EPS = id(17102)
const PORVENIR = id(17103)
const PROTECCION = id(17104)
const CESANTIAS = id(17105)
const COMPENSAR = id(17106)
const POSITIVA = id(17107)

function iniciarCatalogo(): void {
  catalogo = {
    parametros: [
      parametro(17001, 'salario_minimo', 'pesos', SALARIO_MINIMO, `Decreto del salario mínimo ${ANIO}`),
      parametro(17002, 'auxilio_transporte', 'pesos', AUXILIO, `Decreto del auxilio de transporte ${ANIO}`),
      parametro(17003, 'tope_auxilio_transporte', 'salarios_minimos', '2', 'Ley 15 de 1959'),
      parametro(17004, 'jornada_maxima_semanal', 'horas_semana', '44', 'Ley 2101 de 2021'),
      parametro(17005, 'salud_empleado', 'porcentaje', '4', 'Ley 1122 de 2007'),
      parametro(17006, 'pension_empleado', 'porcentaje', '4', 'Ley 100 de 1993'),
      parametro(17007, 'pension_empleador', 'porcentaje', '12', 'Ley 100 de 1993'),
      parametro(17008, 'caja_compensacion', 'porcentaje', '4', 'Ley 21 de 1982'),
      parametro(17009, 'hora_extra_diurna', 'porcentaje', '25', 'Código Sustantivo del Trabajo art. 168'),
      parametro(17010, 'dias_vacaciones', 'dias', '15', 'Código Sustantivo del Trabajo art. 186'),
    ],
    administradoras: [
      administradora(17101, 'eps', 'EPS010', 'EPS Sura'),
      administradora(17102, 'eps', 'EPS037', 'Nueva EPS'),
      administradora(17103, 'afp', '230301', 'Porvenir'),
      administradora(17104, 'afp', '230201', 'Protección'),
      administradora(17105, 'cesantias', '230302', 'Porvenir Cesantías'),
      administradora(17106, 'ccf', 'CCF22', 'Compensar'),
      administradora(17107, 'arl', '14-23', 'Positiva'),
    ],
    tablas: [
      {
        tabla: 'retencion_salarios',
        vigente_desde: '2026-01-01',
        fuente: 'Estatuto Tributario art. 383',
        tramos: [
          { desde: '0', hasta: '95', tarifa: '0', adicional: '0' },
          { desde: '95', hasta: '150', tarifa: '19', adicional: '0' },
          { desde: '150', hasta: '360', tarifa: '28', adicional: '10' },
          { desde: '360', hasta: null, tarifa: '33', adicional: '69' },
        ],
      },
      {
        tabla: 'fondo_solidaridad',
        vigente_desde: '2026-01-01',
        fuente: 'Ley 797 de 2003',
        tramos: [
          { desde: '4', hasta: '16', tarifa: '1', adicional: '0' },
          { desde: '16', hasta: null, tarifa: '2', adicional: '0' },
        ],
      },
    ],
  }
}

/** Lo vigente en la fecha: la última versión de cada parámetro y las administradoras activas. */
function catalogoVigente(fecha: string): CatalogoLaboral {
  const ultimos = new Map<string, ParametroLaboral>()
  for (const p of [...catalogo.parametros].sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))) {
    if (p.vigente_desde <= fecha) ultimos.set(p.parametro, p)
  }
  return { parametros: [...ultimos.values()], administradoras: catalogo.administradoras.filter((a) => a.activa), tablas: catalogo.tablas.filter((t) => t.vigente_desde <= fecha) }
}

// Datos de cada entidad -------------------------------------------------------------------------

interface Empleado {
  id: string
  codigo: string
  persona_id: string
  nombre: string
  tipo_documento: FichaEmpleado['tipo_documento']
  documento: string
  correo: string | null
  /** Es la persona de la cuenta de la sesión (sus desprendibles salen en «Mi nómina»). */
  deLaCuenta: boolean
  contratos: ContratoConVersiones[]
}

interface Datos {
  empleados: Empleado[]
  novedades: NovedadNomina[]
  periodos: PeriodoNomina[]
  liquidaciones: Map<string, LiquidacionNomina[]>
  deducciones: DeduccionRetencion[]
  exonerada: boolean
  actualizada: string
  importaciones: Map<string, { importacion: Importacion; aplicar: () => void }>
}

let datos = new Map<string, Datos>()
let consecutivo = 17500
let cuentaActual = ''
const nuevoId = () => id(++consecutivo)

function condiciones(cargo: string, salario: string, extra: Partial<CondicionesContrato> = {}): CondicionesContrato {
  return {
    cargo,
    salario,
    tipo_salario: 'ordinario',
    etapa_aprendizaje: null,
    jornada: 'completa',
    horas_semanales: null,
    periodicidad: 'mensual',
    eps_id: EPS_SURA,
    afp_id: PORVENIR,
    cesantias_id: CESANTIAS,
    ccf_id: COMPENSAR,
    arl_id: POSITIVA,
    clase_riesgo: '1',
    pensionado: false,
    centro_costo_id: null,
    medio_pago: 'transferencia',
    cuenta: { banco: 'Bancolombia', tipo: 'ahorros', numero: '0012345678' },
    ...extra,
  }
}

function versionDe(contratoId: string, desde: string, c: CondicionesContrato): VersionContrato {
  return { id: nuevoId(), contrato_id: contratoId, vigente_desde: desde, ...c, pensionado: c.pensionado ?? false, creada_en: ahora() }
}

function contratoDe(empleadoId: string, p: NuevoContratoLaboral): ContratoConVersiones {
  const contratoId = nuevoId()
  return {
    contrato: {
      id: contratoId,
      empleado_id: empleadoId,
      tipo: p.tipo,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin ?? null,
      descripcion_obra: p.descripcion_obra ?? null,
      fecha_terminacion: null,
      motivo_terminacion: null,
      creado_en: ahora(),
    },
    versiones: [versionDe(contratoId, p.fecha_inicio, p.condiciones)],
  }
}

function empleadoDe(codigo: string, nombre: string, documento: string, contrato: NuevoContratoLaboral, extra: Partial<Empleado> = {}): Empleado {
  const empleadoId = nuevoId()
  return {
    id: empleadoId,
    codigo,
    persona_id: nuevoId(),
    nombre,
    tipo_documento: 'CC',
    documento,
    correo: `${nombre.split(' ')[0]!.toLowerCase()}@demo.dad`,
    deLaCuenta: false,
    contratos: [contratoDe(empleadoId, contrato)],
    ...extra,
  }
}

/** Primer día del mes `meses` meses antes (o después) del actual. */
function inicioMes(meses: number): string {
  const [a, m] = fechaDemo().split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(a, m - 1 + meses, 1))
  return d.toISOString().slice(0, 10)
}
function finMes(desde: string): string {
  const [a, m] = desde.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

function sembrar(): Datos {
  const empleados = [
    empleadoDe('E-001', 'Andrés Administrador', '79111222', { tipo: 'termino_indefinido', fecha_inicio: '2024-02-01', condiciones: condiciones('Administrador', '3500000.00') }, { deLaCuenta: true }),
    empleadoDe('E-002', 'Marta Gómez', '52333444', {
      tipo: 'termino_fijo',
      fecha_inicio: dias(-335),
      fecha_fin: dias(30),
      condiciones: condiciones('Auxiliar de aseo', SALARIO_MINIMO, { eps_id: NUEVA_EPS, medio_pago: 'efectivo', cuenta: null }),
    }),
    empleadoDe('E-003', 'Julián Rojas', '1001555666', {
      tipo: 'aprendizaje',
      fecha_inicio: dias(-60),
      fecha_fin: dias(120),
      condiciones: condiciones('Aprendiz contable', SALARIO_MINIMO, { tipo_salario: 'apoyo_sostenimiento', etapa_aprendizaje: 'productiva', afp_id: null, cesantias_id: null }),
    }),
    empleadoDe('E-004', 'Lucía Vigilante', '52777888', {
      tipo: 'termino_fijo',
      fecha_inicio: dias(-345),
      fecha_fin: dias(20),
      condiciones: condiciones('Supervisora de seguridad', '2100000.00', { clase_riesgo: '4', afp_id: PROTECCION }),
    }),
    empleadoDe('E-005', 'Pedro Contreras', '80999000', {
      tipo: 'obra_labor',
      fecha_inicio: '2025-03-01',
      descripcion_obra: 'Impermeabilización de las cubiertas',
      condiciones: condiciones('Oficial de obra', '1800000.00'),
    }),
  ]
  const pedro = empleados[4]!.contratos[0]!.contrato
  pedro.fecha_terminacion = dias(-60)
  pedro.motivo_terminacion = 'fin_obra'
  const d: Datos = {
    empleados,
    novedades: [],
    periodos: [],
    liquidaciones: new Map(),
    deducciones: [],
    exonerada: false,
    actualizada: '2026-01-02T12:00:00Z',
    importaciones: new Map(),
  }
  const [andres, marta] = empleados
  d.novedades.push(
    novedad(andres!.contratos[0]!.contrato.id, 'hora_extra_diurna', inicioMes(0), null, '4', 'Cierre de mes'),
    novedad(marta!.contratos[0]!.contrato.id, 'incapacidad_comun', inicioMes(0), sumarFecha(inicioMes(0), 1), null, 'Incapacidad por gripe'),
    novedad(andres!.contratos[0]!.contrato.id, 'bonificacion_no_salarial', inicioMes(-1), null, '150000', 'Bono de fin de año'),
  )
  d.deducciones.push({ id: nuevoId(), empleado_id: andres!.id, tipo: 'dependientes', valor_mensual: '0', vigente_desde: '2026-01-01', vigente_hasta: null, soporte_archivo_id: null, creado_en: ahora() })
  // Hace dos meses: pagado. El mes pasado: liquidado por otra cuenta. Este mes: abierto.
  const pagado = abrir(d, inicioMes(-2))
  liquidarEn(d, pagado, OTRA_CUENTA)
  Object.assign(pagado, { estado: 'pagado', aprobado_por: cuentaDemoId(''), aprobado_en: ahora(), fecha_pago: sumarFecha(pagado.hasta, 0) })
  const pasado = abrir(d, inicioMes(-1))
  liquidarEn(d, pasado, OTRA_CUENTA)
  abrir(d, inicioMes(0))
  return d
}

function sumarFecha(f: string, n: number): string {
  const d = new Date(`${f}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function novedad(contratoId: string, tipo: TipoNovedad, desde: string, hasta: string | null, cantidad: string | null, descripcion: string | null): NovedadNomina {
  return {
    id: nuevoId(),
    contrato_id: contratoId,
    tipo,
    medida: medidaDe(tipo),
    desde,
    hasta: hasta ?? desde,
    cantidad: cantidad ?? '0',
    descripcion,
    soporte_archivo_id: null,
    creado_en: ahora(),
    anulada: false,
    motivo_anulacion: null,
  }
}

function abrir(d: Datos, desde: string): PeriodoNomina {
  const p: PeriodoNomina = { id: nuevoId(), periodicidad: 'mensual', desde, hasta: finMes(desde), estado: 'abierto', liquidado_por: null, liquidado_en: null, aprobado_por: null, aprobado_en: null, fecha_pago: null }
  d.periodos.unshift(p)
  d.periodos.sort((a, b) => b.desde.localeCompare(a.desde))
  return p
}

function de(entidadId: string): Datos {
  let d = datos.get(entidadId)
  if (!d) {
    d = sembrar()
    datos.set(entidadId, d)
  }
  return d
}

// Liquidación simplificada (el cálculo real es del backend) -------------------------------------

const pct = (base: string, p: string) => redondear(multiplicar(base, multiplicar(p, '0.01')))

function linea(concepto: ConceptoNomina, clase: ClaseLineaNomina, cantidad: string, valor: string): LineaLiquidacionNomina {
  return { concepto, clase, cantidad, valor: redondear(valor) }
}

function versionEn(c: ContratoConVersiones, fecha: string) {
  return [...c.versiones].sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde)).filter((v) => v.vigente_desde <= fecha).at(-1) ?? c.versiones[0]!
}

function liquidarContrato(d: Datos, e: Empleado, c: ContratoConVersiones, p: PeriodoNomina): LiquidacionNomina | null {
  const k = c.contrato
  const desde = k.fecha_inicio > p.desde ? k.fecha_inicio : p.desde
  const fin = k.fecha_terminacion ?? p.hasta
  const hasta = fin < p.hasta ? fin : p.hasta
  if (desde > hasta) return null
  const v = versionEn(c, hasta)
  const salario = v.salario ?? '0'
  const diasPeriodo = Math.min(30, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1)
  const propias = d.novedades.filter((n) => !n.anulada && n.contrato_id === k.id && n.desde <= hasta && n.hasta >= desde)
  const diasAusencia = propias.filter((n) => n.medida === 'dias').reduce((s, n) => s + Math.round((Date.parse(n.hasta) - Date.parse(n.desde)) / 86_400_000) + 1, 0)
  const diasPagados = Math.max(0, diasPeriodo - diasAusencia)
  const diario = multiplicar(salario, String(1 / 30))
  const lineas: LineaLiquidacionNomina[] = []
  const aprendiz = v.tipo_salario === 'apoyo_sostenimiento'
  lineas.push(linea(aprendiz ? 'apoyo_sostenimiento' : 'basico', 'devengo', String(diasPagados), multiplicar(diario, String(diasPagados))))
  for (const n of propias) {
    if (n.medida === 'dias') {
      const nd = Math.round((Date.parse(n.hasta) - Date.parse(n.desde)) / 86_400_000) + 1
      if (n.tipo === 'incapacidad_comun' || n.tipo === 'incapacidad_laboral' || n.tipo === 'vacaciones' || n.tipo === 'licencia_remunerada' || n.tipo === 'licencia_maternidad' || n.tipo === 'licencia_paternidad') {
        lineas.push(linea(n.tipo, 'devengo', String(nd), multiplicar(diario, String(nd))))
      }
    } else if (n.medida === 'horas') {
      const hora = multiplicar(salario, String(1 / 240))
      // Las novedades de horas y de valor tienen su concepto con el mismo código.
      lineas.push(linea(n.tipo as ConceptoNomina, 'devengo', n.cantidad, multiplicar(multiplicar(hora, '1.25'), n.cantidad)))
    } else {
      const deduccion = ['prestamo', 'libranza', 'embargo', 'otra_deduccion'].includes(n.tipo)
      lineas.push(linea(n.tipo as ConceptoNomina, deduccion ? 'deduccion' : 'devengo', '1', n.cantidad))
    }
  }
  if (!aprendiz && comparar(salario, multiplicar(SALARIO_MINIMO, '2')) <= 0) {
    lineas.push(linea('auxilio_transporte', 'devengo', String(diasPagados), multiplicar(multiplicar(AUXILIO, String(1 / 30)), String(diasPagados))))
  }
  const ibc = redondear(multiplicar(diario, String(diasPeriodo)))
  if (!aprendiz) {
    lineas.push(linea('salud', 'deduccion', '4', pct(ibc, '4')), linea('pension', 'deduccion', '4', pct(ibc, '4')))
    lineas.push(linea('pension_empleador', 'aporte_empleador', '12', pct(ibc, '12')), linea('caja_compensacion', 'aporte_empleador', '4', pct(ibc, '4')))
    if (!d.exonerada) lineas.push(linea('salud_empleador', 'aporte_empleador', '8.5', pct(ibc, '8.5')), linea('icbf', 'aporte_empleador', '3', pct(ibc, '3')), linea('sena', 'aporte_empleador', '2', pct(ibc, '2')))
    lineas.push(
      linea('provision_cesantias', 'provision', '8.33', pct(ibc, '8.33')),
      linea('provision_intereses', 'provision', '1', pct(ibc, '1')),
      linea('provision_prima', 'provision', '8.33', pct(ibc, '8.33')),
      linea('provision_vacaciones', 'provision', '4.17', pct(ibc, '4.17')),
    )
  } else {
    lineas.push(linea('salud_empleador', 'aporte_empleador', '12.5', pct(ibc, '12.5')))
  }
  lineas.push(linea('arl', 'aporte_empleador', '0.522', pct(ibc, '0.522')))
  const total = (clase: ClaseLineaNomina) => sumar('0', ...lineas.filter((l) => l.clase === clase).map((l) => l.valor))
  return {
    id: nuevoId(),
    contrato_id: k.id,
    empleado_id: e.id,
    dias: diasPagados,
    ibc,
    devengos: total('devengo'),
    deducciones: total('deduccion'),
    neto: restar(total('devengo'), total('deduccion')),
    aportes_empleador: total('aporte_empleador'),
    lineas,
  }
}

function liquidarEn(d: Datos, p: PeriodoNomina, cuenta: string): LiquidacionNomina[] {
  const lista = d.empleados.flatMap((e) => e.contratos.flatMap((c) => liquidarContrato(d, e, c, p) ?? []))
  d.liquidaciones.set(p.id, lista)
  Object.assign(p, { estado: 'liquidado', liquidado_por: cuenta, liquidado_en: ahora() })
  return lista
}

// Respuestas ------------------------------------------------------------------------------------

function estadoDe(e: Empleado): EmpleadoResumen['estado'] {
  return e.contratos.some((c) => !c.contrato.fecha_terminacion) ? 'activo' : 'retirado'
}

function resumen(e: Empleado): EmpleadoResumen {
  const ultimo = [...e.contratos].sort((a, b) => b.contrato.fecha_inicio.localeCompare(a.contrato.fecha_inicio))[0]
  const version = ultimo ? versionEn(ultimo, fechaDemo()) : null
  const primero = [...e.contratos].sort((a, b) => a.contrato.fecha_inicio.localeCompare(b.contrato.fecha_inicio))[0]
  return { id: e.id, codigo: e.codigo, persona_id: e.persona_id, nombre: e.nombre, documento: e.documento, estado: estadoDe(e), cargo: version?.cargo ?? null, fecha_ingreso: primero?.contrato.fecha_inicio ?? null }
}

const ficha = (e: Empleado): FichaEmpleado => ({ id: e.id, codigo: e.codigo, persona_id: e.persona_id, nombre: e.nombre, tipo_documento: e.tipo_documento, documento: e.documento, contratos: e.contratos })

function buscarContrato(d: Datos, contratoId: string) {
  for (const e of d.empleados) {
    const c = e.contratos.find((x) => x.contrato.id === contratoId)
    if (c) return { e, c }
  }
  return null
}

const enPeriodoCerrado = (d: Datos, fecha: string) => d.periodos.some((p) => (p.estado === 'aprobado' || p.estado === 'pagado') && p.desde <= fecha && fecha <= p.hasta)

function validarContrato(p: NuevoContratoLaboral): string | null {
  if ((p.tipo === 'termino_fijo' || p.tipo === 'aprendizaje') && !p.fecha_fin) return 'El contrato a término fijo o de aprendizaje lleva la fecha de terminación.'
  if (p.tipo === 'obra_labor' && !p.descripcion_obra?.trim()) return 'El contrato por obra o labor lleva la descripción de la obra.'
  if ((p.tipo === 'aprendizaje') !== (p.condiciones.tipo_salario === 'apoyo_sostenimiento')) return 'El aprendiz lleva apoyo de sostenimiento, y solo él.'
  return validarCondiciones(p.condiciones)
}

function validarCondiciones(c: CondicionesContrato): string | null {
  if (c.tipo_salario === 'ordinario' && c.jornada === 'completa' && comparar(c.salario || '0', SALARIO_MINIMO) < 0) return `El salario no puede ser menor que el mínimo (${SALARIO_MINIMO}).`
  if (c.medio_pago === 'transferencia' && !c.cuenta) return 'El pago por transferencia lleva la cuenta.'
  if (c.jornada === 'parcial' && !c.horas_semanales) return 'La jornada parcial lleva las horas semanales.'
  return null
}

function simulacion(c: ContratoConVersiones, fecha: string, motivo: MotivoTerminacion) {
  const v = versionEn(c, fecha)
  const salario = v.salario ?? '0'
  const diasAnio = Math.min(360, Math.max(1, Math.round((Date.parse(fecha) - Date.parse(`${fecha.slice(0, 4)}-01-01`)) / 86_400_000) + 1))
  const ces = redondear(multiplicar(salario, String(diasAnio / 360)))
  const lineas: LineaLiquidacionNomina[] = [
    linea('cesantias', 'devengo', String(diasAnio), ces),
    linea('intereses_cesantias', 'devengo', String(diasAnio), multiplicar(ces, String((0.12 * diasAnio) / 360))),
    linea('prima', 'devengo', String(diasAnio % 180), multiplicar(salario, String((diasAnio % 180) / 360))),
    linea('vacaciones_compensadas', 'devengo', '7.5', multiplicar(salario, String(7.5 / 30))),
  ]
  if (motivo === 'sin_justa_causa') lineas.push(linea('indemnizacion', 'devengo', '30', salario))
  return { lineas, total: sumar('0', ...lineas.map((l) => l.valor)) }
}

function importacionDe(errores: { fila: number; columna?: string | null; mensaje: string }[], total: number, empleados: number, novedades: number): Importacion {
  return {
    id: nuevoId(),
    archivo_id: nuevoId(),
    estado: errores.length ? 'con_errores' : 'validada',
    total_filas: total,
    filas_validas: total - new Set(errores.map((e) => e.fila)).size,
    errores,
    resumen: { bienes_privados: 0, agrupaciones_nuevas: 0, titulares: 0, personas_nuevas: empleados, coeficientes: 0, usuarios: 0, cuentas_nuevas: 0, empleados, novedades },
    creada_en: ahora(),
  }
}

const filasCsv = (texto: string) =>
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(1)
    .map((l) => l.split(/[;,]/).map((x) => x.trim()))

const TIPOS_CONTRATO: TipoContratoLaboral[] = ['termino_fijo', 'termino_indefinido', 'obra_labor', 'aprendizaje']

/** Reinicia el demo en cada inicio de sesión. */
export function iniciarNomina(usuario: string): void {
  consecutivo = 17500
  cuentaActual = cuentaDemoId(usuario)
  datos = new Map()
  iniciarCatalogo()
}

// Consola de la plataforma: el catálogo completo -----------------------------------------------

async function plataformaNomina(req: Request, ruta: string): Promise<Response | null> {
  const m = req.method
  if (m === 'GET' && ruta === '/plataforma/nomina/catalogo') return json(catalogo)
  if (m === 'POST' && ruta === '/plataforma/nomina/parametros') {
    const p = await cuerpo<NuevoParametroLaboral>(req)
    if (catalogo.parametros.some((x) => x.parametro === p.parametro && x.vigente_desde === p.vigente_desde)) return error(409, 'conflicto', 'Ya hay una versión de ese parámetro desde esa fecha.')
    const unidad = catalogo.parametros.find((x) => x.parametro === p.parametro)?.unidad ?? 'pesos'
    const nuevo: ParametroLaboral = { id: nuevoId(), ...p, unidad, creado_en: ahora() }
    catalogo.parametros.push(nuevo)
    return json(nuevo, 201)
  }
  if (m === 'POST' && ruta === '/plataforma/nomina/tablas') {
    const t = await cuerpo<NuevaTablaLaboral>(req)
    if (!t.tramos.length) return error(422, 'validacion', 'La tabla lleva al menos un tramo.')
    catalogo.tablas.push(t)
    return json(t, 201)
  }
  if (m === 'POST' && ruta === '/plataforma/nomina/administradoras') {
    const a = await cuerpo<NuevaAdministradora>(req)
    if (catalogo.administradoras.some((x) => x.tipo === a.tipo && x.codigo === a.codigo)) return error(409, 'conflicto', 'Ya existe una administradora con ese código PILA.')
    const nueva: Administradora = { id: nuevoId(), ...a, activa: true }
    catalogo.administradoras.push(nueva)
    return json(nueva, 201)
  }
  const adm = ruta.match(/^\/plataforma\/nomina\/administradoras\/([^/]+)$/)
  if (m === 'PUT' && adm) {
    const a = catalogo.administradoras.find((x) => x.id === adm[1])
    if (!a) return error(404, 'no_encontrado', 'La administradora no existe.')
    Object.assign(a, await cuerpo<{ nombre: string; activa: boolean }>(req))
    return json(a)
  }
  return null
}

// «Mi nómina» -------------------------------------------------------------------------------------

function misDesprendibles(): DesprendibleDeCuenta[] {
  if (cuentaActual === OTRA_CUENTA) return []
  return ENTIDADES_NOMINA.slice(0, 1).flatMap((entidadId) => {
    const d = de(entidadId)
    const propios = new Set(d.empleados.filter((e) => e.deLaCuenta).map((e) => e.id))
    return d.periodos
      .filter((p) => p.estado === 'aprobado' || p.estado === 'pagado')
      .flatMap((p) =>
        (d.liquidaciones.get(p.id) ?? [])
          .filter((l) => propios.has(l.empleado_id))
          .map((l) => ({
            entidad_id: entidadId,
            entidad: 'Conjunto Residencial Los Robles',
            liquidacion_id: l.id,
            periodicidad: p.periodicidad,
            desde: p.desde,
            hasta: p.hasta,
            estado: p.estado,
            fecha_pago: p.fecha_pago ?? null,
            devengos: l.devengos,
            deducciones: l.deducciones,
            neto: l.neto,
          })),
      )
  })
}

function miNomina(req: Request, ruta: string): Response | null {
  if (req.method !== 'GET') return null
  if (ruta === '/yo/nomina/desprendibles') return json(misDesprendibles())
  const des = ruta.match(/^\/yo\/nomina\/([^/]+)\/desprendibles\/([^/]+)$/)
  if (des) return misDesprendibles().some((x) => x.liquidacion_id === des[2]) ? pdf('desprendible.pdf') : error(404, 'no_encontrado', 'El desprendible no existe.')
  if (/^\/yo\/nomina\/[^/]+\/certificado-laboral$/.test(ruta)) return cuentaActual === OTRA_CUENTA ? error(404, 'no_encontrado', 'Usted no es empleado de esta entidad.') : pdf('certificado-laboral.pdf')
  return null
}

// Manejador -------------------------------------------------------------------------------------

export const nomina: Manejador = async (req, ruta) => {
  if (ruta.startsWith('/plataforma/nomina')) return plataformaNomina(req, ruta)
  if (ruta.startsWith('/yo/nomina')) return miNomina(req, ruta)
  const base = ruta.match(/^\/entidades\/([^/]+)\/nomina(\/.*)$/)
  if (!base) return null
  const [, entidadId = '', sub = ''] = base
  if (!ENTIDADES_NOMINA.includes(entidadId)) return error(403, 'modulo_no_habilitado', 'La nómina no está contratada en esta entidad.')
  const d = de(entidadId)
  const m = req.method
  const q = new URL(req.url).searchParams

  if (m === 'GET' && sub === '/catalogo') return json(catalogoVigente(q.get('fecha') ?? fechaDemo()))
  if (sub === '/configuracion') {
    if (m === 'PUT') {
      d.exonerada = (await cuerpo<{ exonerada_aportes: boolean }>(req)).exonerada_aportes
      d.actualizada = ahora()
    }
    return json({ exonerada_aportes: d.exonerada, actualizada_en: d.actualizada })
  }
  if (m === 'POST' && sub === '/contabilizacion') {
    const r = await cuerpo<{ desde: string; hasta: string }>(req)
    if (r.desde > r.hasta) return error(422, 'validacion', 'La fecha inicial va antes de la final.')
    const enRango = d.periodos.filter((p) => (p.estado === 'aprobado' || p.estado === 'pagado') && p.desde >= r.desde && p.hasta <= r.hasta)
    return json({ contabilizados: enRango.map((p) => p.id), fallidos: [] })
  }

  // Empleados
  if (sub === '/empleados') {
    if (m === 'GET') {
      const texto = (q.get('q') ?? '').toLowerCase()
      const estado = q.get('estado')
      const lista = d.empleados
        .map(resumen)
        .filter((e) => (!texto || e.nombre.toLowerCase().includes(texto) || e.codigo.toLowerCase().includes(texto) || (e.documento ?? '').includes(texto)) && (!estado || e.estado === estado))
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
      const limite = Number(q.get('limite') ?? 50)
      const desde = q.get('despues') ? lista.findIndex((e) => e.id === q.get('despues')) + 1 : 0
      const pagina = lista.slice(desde, desde + limite)
      return json({ datos: pagina, siguiente: desde + limite < lista.length ? (pagina.at(-1)?.id ?? null) : null })
    }
    if (m === 'POST') {
      const p = await cuerpo<NuevoEmpleado>(req)
      if (d.empleados.some((e) => e.codigo === p.codigo.trim())) return error(409, 'conflicto', `Ya hay un empleado con el código ${p.codigo}.`)
      const problema = validarContrato(p.contrato)
      if (problema) return error(422, 'validacion', problema)
      const existente = p.persona_id ? personasDemo().find((x) => x.id === p.persona_id) : null
      if (p.persona_id && d.empleados.some((e) => e.persona_id === p.persona_id)) return error(409, 'conflicto', 'Esa persona ya es empleada de la entidad.')
      if (p.persona && d.empleados.some((e) => e.documento === p.persona?.documento)) return error(409, 'conflicto', 'Esa persona ya es empleada de la entidad.')
      const e = empleadoDe(p.codigo.trim(), existente?.nombre ?? p.persona?.nombre ?? 'Empleado', existente?.documento ?? p.persona?.documento ?? '', p.contrato, {
        persona_id: p.persona_id ?? nuevoId(),
        tipo_documento: p.persona?.tipo_documento ?? 'CC',
        correo: p.persona?.correo ?? null,
      })
      d.empleados.push(e)
      return json(ficha(e), 201)
    }
  }
  const emp = sub.match(/^\/empleados\/([^/]+)(\/.*)?$/)
  if (emp) {
    const e = d.empleados.find((x) => x.id === emp[1])
    if (!e) return error(404, 'no_encontrado', 'El empleado no existe.')
    const resto = emp[2] ?? ''
    if (m === 'GET' && resto === '') return json(ficha(e))
    if (m === 'POST' && resto === '/contratos') {
      const p = await cuerpo<NuevoContratoLaboral>(req)
      if (e.contratos.some((c) => !c.contrato.fecha_terminacion || c.contrato.fecha_terminacion >= p.fecha_inicio)) return error(409, 'conflicto', 'El contrato nuevo se cruza en fechas con otro del empleado.')
      const problema = validarContrato(p)
      if (problema) return error(422, 'validacion', problema)
      const c = contratoDe(e.id, p)
      e.contratos.push(c)
      return json(c, 201)
    }
    if (resto === '/deducciones') {
      if (m === 'GET') return json(d.deducciones.filter((x) => x.empleado_id === e.id))
      const p = await cuerpo<NuevaDeduccion>(req)
      if (p.tipo !== 'dependientes' && !p.valor_mensual) return error(422, 'validacion', 'La deducción lleva su valor mensual.')
      const nueva: DeduccionRetencion = { id: nuevoId(), empleado_id: e.id, tipo: p.tipo, valor_mensual: p.valor_mensual ?? '0', vigente_desde: p.vigente_desde, vigente_hasta: null, soporte_archivo_id: p.soporte_archivo_id ?? null, creado_en: ahora() }
      d.deducciones.push(nueva)
      return json(nueva, 201)
    }
    if (m === 'GET' && resto === '/certificado-laboral') return pdf(`certificado-laboral-${e.codigo}.pdf`)
  }
  const ded = sub.match(/^\/deducciones\/([^/]+)\/terminacion$/)
  if (m === 'POST' && ded) {
    const x = d.deducciones.find((y) => y.id === ded[1])
    if (!x) return error(404, 'no_encontrado', 'La deducción no existe.')
    const { hasta } = await cuerpo<{ hasta: string }>(req)
    if (hasta < x.vigente_desde) return error(422, 'validacion', 'La deducción no puede terminar antes de empezar.')
    x.vigente_hasta = hasta
    return json(x)
  }

  // Contratos
  if (m === 'GET' && sub === '/contratos/por-vencer') {
    const plazo = Number(q.get('dias') ?? 45)
    if (plazo > 120 || plazo < 1) return error(422, 'validacion', 'Los días van de 1 a 120.')
    const hoy = fechaDemo()
    const limite = sumarFecha(hoy, plazo)
    return json(
      d.empleados
        .flatMap((e) => e.contratos.filter((c) => c.contrato.tipo === 'termino_fijo' && !c.contrato.fecha_terminacion && c.contrato.fecha_fin && c.contrato.fecha_fin >= hoy && c.contrato.fecha_fin <= limite).map((c) => ({ e, c })))
        .map(({ e, c }) => ({ contrato_id: c.contrato.id, empleado_id: e.id, codigo: e.codigo, nombre: e.nombre, fecha_fin: c.contrato.fecha_fin!, fecha_limite_preaviso: sumarFecha(c.contrato.fecha_fin!, -30) }))
        .sort((a, b) => a.fecha_fin.localeCompare(b.fecha_fin)),
    )
  }
  const con = sub.match(/^\/contratos\/([^/]+)\/([a-z-]+)$/)
  if (con) {
    const hallado = buscarContrato(d, con[1] ?? '')
    if (!hallado) return error(404, 'no_encontrado', 'El contrato no existe.')
    const { c } = hallado
    const k = c.contrato
    const accion = con[2]
    if (m === 'GET' && accion === 'vacaciones') {
      const fecha = q.get('fecha') ?? fechaDemo()
      const trabajados = Math.max(0, Math.round((Date.parse(k.fecha_terminacion ?? fecha) - Date.parse(k.fecha_inicio)) / 86_400_000) + 1)
      const disfrutados = d.novedades.filter((n) => !n.anulada && n.contrato_id === k.id && n.tipo === 'vacaciones').reduce((s, n) => s + Math.round((Date.parse(n.hasta) - Date.parse(n.desde)) / 86_400_000) + 1, 0)
      const causados = ((trabajados * 15) / 360).toFixed(2)
      return json({ dias_trabajados: trabajados, causados, disfrutados: disfrutados.toFixed(2), pendientes: (Number(causados) - disfrutados).toFixed(2) })
    }
    if (m !== 'POST') return null
    if (accion === 'simulacion-terminacion') {
      const p = await cuerpo<{ fecha: string; motivo: MotivoTerminacion }>(req)
      if (k.fecha_terminacion) return error(409, 'conflicto_estado', 'El contrato ya está terminado.')
      return json(simulacion(c, p.fecha, p.motivo))
    }
    if (accion === 'novedades') {
      const p = await cuerpo<NuevaNovedad>(req)
      if (k.fecha_terminacion && p.desde > k.fecha_terminacion) return error(422, 'validacion', 'La novedad cae fuera de las fechas del contrato.')
      if (enPeriodoCerrado(d, p.desde) || (p.hasta && enPeriodoCerrado(d, p.hasta))) return error(422, 'validacion', 'Esas fechas son de un periodo ya aprobado: ya no se registran novedades.')
      const medida = medidaDe(p.tipo)
      if (medida === 'dias' && (!p.hasta || p.hasta < p.desde || p.cantidad)) return error(422, 'validacion', `La novedad ${p.tipo} lleva el último día (no antes del primero) y no lleva cantidad.`)
      if (medida !== 'dias' && (p.hasta || !p.cantidad || comparar(p.cantidad, '0') <= 0)) return error(422, 'validacion', `La novedad ${p.tipo} lleva una sola fecha y su cantidad.`)
      if (medida === 'horas' && comparar(p.cantidad ?? '0', '24') > 0) return error(422, 'validacion', 'Las horas van de 0 a 24 en un día.')
      if (esDominical(p.tipo) && new Date(`${p.desde}T12:00:00Z`).getUTCDay() !== 0) return error(422, 'validacion', `La novedad ${p.tipo} es de un domingo o festivo.`)
      const n = novedad(k.id, p.tipo, p.desde, p.hasta ?? null, p.cantidad ?? null, p.descripcion ?? null)
      n.soporte_archivo_id = p.soporte_archivo_id ?? null
      d.novedades.push(n)
      return json(n, 201)
    }
    if (k.fecha_terminacion) return error(409, 'conflicto_estado', 'El contrato está terminado: ya no acepta cambios.')
    if (accion === 'versiones') {
      const p = await cuerpo<{ vigente_desde: string; condiciones: CondicionesContrato }>(req)
      if (c.versiones.some((v) => v.vigente_desde >= p.vigente_desde)) return error(422, 'validacion', 'La versión nueva empieza después de la última.')
      const problema = validarCondiciones(p.condiciones)
      if (problema) return error(422, 'validacion', problema)
      const v = versionDe(k.id, p.vigente_desde, p.condiciones)
      c.versiones.push(v)
      return json(v, 201)
    }
    if (accion === 'prorroga') {
      const { fecha_fin } = await cuerpo<{ fecha_fin: string }>(req)
      if (k.tipo !== 'termino_fijo') return error(422, 'validacion', 'Solo se prorroga un contrato a término fijo.')
      if (k.fecha_fin && fecha_fin <= k.fecha_fin) return error(422, 'validacion', 'La prórroga termina después de la fecha actual.')
      k.fecha_fin = fecha_fin
      return json(k)
    }
    if (accion === 'terminacion') {
      const p = await cuerpo<{ fecha: string; motivo: MotivoTerminacion }>(req)
      if (c.versiones.some((v) => v.vigente_desde > p.fecha)) return error(422, 'validacion', 'El contrato no termina antes de su última versión.')
      Object.assign(k, { fecha_terminacion: p.fecha, motivo_terminacion: p.motivo })
      return json(k)
    }
  }

  // Novedades
  if (m === 'GET' && sub === '/novedades') {
    const desde = q.get('desde')
    const hasta = q.get('hasta')
    if (!desde || !hasta || desde > hasta) return error(422, 'validacion', 'El rango de fechas no es válido.')
    const contrato = q.get('contrato_id')
    return json(d.novedades.filter((n) => n.desde <= hasta && n.hasta >= desde && (!contrato || n.contrato_id === contrato)))
  }
  const anu = sub.match(/^\/novedades\/([^/]+)\/anulacion$/)
  if (m === 'POST' && anu) {
    const n = d.novedades.find((x) => x.id === anu[1])
    if (!n) return error(404, 'no_encontrado', 'La novedad no existe.')
    if (n.anulada) return error(409, 'conflicto_estado', 'La novedad ya estaba anulada.')
    if (enPeriodoCerrado(d, n.desde)) return error(409, 'conflicto_estado', 'La novedad es de un periodo aprobado: ya no se anula.')
    Object.assign(n, { anulada: true, motivo_anulacion: (await cuerpo<{ motivo: string }>(req)).motivo })
    return sinContenido()
  }

  // Periodos
  if (sub === '/periodos') {
    if (m === 'GET') return json(d.periodos)
    const p = await cuerpo<{ periodicidad: PeriodoNomina['periodicidad']; desde: string }>(req)
    const dia = p.desde.slice(8)
    if (dia !== '01' && !(p.periodicidad === 'quincenal' && dia === '16')) return error(422, 'validacion', 'El periodo empieza el día 1 (o el 16 en la quincenal).')
    const hasta = p.periodicidad === 'mensual' ? finMes(p.desde) : dia === '01' ? `${p.desde.slice(0, 8)}15` : finMes(p.desde)
    if (d.periodos.some((x) => x.desde <= hasta && x.hasta >= p.desde)) return error(409, 'conflicto', 'Ya hay un periodo que se cruza con esas fechas.')
    const nuevo: PeriodoNomina = { id: nuevoId(), periodicidad: p.periodicidad, desde: p.desde, hasta, estado: 'abierto', liquidado_por: null, liquidado_en: null, aprobado_por: null, aprobado_en: null, fecha_pago: null }
    d.periodos.push(nuevo)
    d.periodos.sort((a, b) => b.desde.localeCompare(a.desde))
    return json(nuevo, 201)
  }
  const per = sub.match(/^\/periodos\/([^/]+)(\/[a-z]+)?$/)
  if (per) {
    const p = d.periodos.find((x) => x.id === per[1])
    if (!p) return error(404, 'no_encontrado', 'El periodo no existe.')
    const accion = per[2] ?? ''
    if (m === 'GET' && accion === '') return json({ periodo: p, liquidaciones: d.liquidaciones.get(p.id) ?? [] })
    if (m !== 'POST') return null
    if (accion === '/liquidacion') {
      if (p.estado === 'aprobado' || p.estado === 'pagado') return error(409, 'conflicto_estado', 'El periodo ya está aprobado: no se vuelve a liquidar.')
      const liquidaciones = liquidarEn(d, p, cuentaActual)
      return json({ periodo: p, liquidaciones })
    }
    if (accion === '/aprobacion') {
      if (p.estado !== 'liquidado') return error(409, 'conflicto_estado', 'Solo se aprueba un periodo liquidado.')
      if (p.liquidado_por === cuentaActual) return error(409, 'conflicto', 'La liquidación la aprueba una cuenta distinta de la que la liquidó.')
      if (d.novedades.some((n) => n.creado_en > (p.liquidado_en ?? '') && n.desde <= p.hasta && n.hasta >= p.desde)) {
        return error(409, 'conflicto_estado', 'Hubo novedades después de liquidar: liquide el periodo de nuevo antes de aprobarlo.')
      }
      Object.assign(p, { estado: 'aprobado', aprobado_por: cuentaActual, aprobado_en: ahora() })
      return json(p)
    }
    if (accion === '/pago') {
      if (p.estado !== 'aprobado') return error(409, 'conflicto_estado', 'Solo se paga un periodo aprobado.')
      Object.assign(p, { estado: 'pagado', fecha_pago: (await cuerpo<{ fecha_pago: string }>(req)).fecha_pago })
      return json(p)
    }
    if (accion === '/desprendibles') {
      if (p.estado !== 'aprobado' && p.estado !== 'pagado') return error(409, 'conflicto_estado', 'Los desprendibles se envían cuando el periodo está aprobado.')
      const lista = d.liquidaciones.get(p.id) ?? []
      const sinCorreo = lista.filter((l) => !d.empleados.find((e) => e.id === l.empleado_id)?.correo).length
      return json({ enviados: lista.length - sinCorreo, sin_correo: sinCorreo })
    }
  }
  const des = sub.match(/^\/liquidaciones\/([^/]+)\/desprendible$/)
  if (m === 'GET' && des) {
    const p = d.periodos.find((x) => (d.liquidaciones.get(x.id) ?? []).some((l) => l.id === des[1]))
    if (!p) return error(404, 'no_encontrado', 'La liquidación no existe.')
    if (p.estado !== 'aprobado' && p.estado !== 'pagado') return error(409, 'conflicto_estado', 'El desprendible existe cuando el periodo está aprobado.')
    return pdf('desprendible.pdf')
  }

  // Reportes
  const anio = Number(q.get('anio') ?? 0)
  if (m === 'GET' && sub === '/cesantias') {
    if (!anio) return error(422, 'validacion', 'Indique el año.')
    return json(
      d.empleados.flatMap((e) =>
        e.contratos
          .filter((c) => !c.contrato.fecha_terminacion && versionEn(c, `${anio}-12-31`).tipo_salario === 'ordinario')
          .map((c) => {
            const inicio = c.contrato.fecha_inicio > `${anio}-01-01` ? c.contrato.fecha_inicio : `${anio}-01-01`
            const diasAnio = Math.min(360, Math.round((Date.parse(`${anio}-12-31`) - Date.parse(inicio)) / 86_400_000) + 1)
            const base = versionEn(c, `${anio}-12-31`).salario ?? '0'
            const ces = redondear(multiplicar(base, String(diasAnio / 360)))
            return { empleado_id: e.id, contrato_id: c.contrato.id, dias: diasAnio, base, cesantias: ces, intereses: redondear(multiplicar(ces, String((0.12 * diasAnio) / 360))), fondo_id: versionEn(c, `${anio}-12-31`).cesantias_id ?? null }
          }),
      ),
    )
  }
  const cerrados = (desde: string, hasta: string) =>
    d.periodos.filter((p) => (p.estado === 'aprobado' || p.estado === 'pagado') && p.desde >= desde && p.hasta <= hasta).flatMap((p) => d.liquidaciones.get(p.id) ?? [])
  if (m === 'GET' && sub === '/aportes') {
    const mes = Number(q.get('mes') ?? 0)
    if (!anio || mes < 1 || mes > 12) return error(422, 'validacion', 'Indique el año y el mes.')
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const hasta = finMes(desde)
    const liq = cerrados(desde, hasta)
    const valor = (l: LiquidacionNomina, ...cs: ConceptoNomina[]) => sumar('0', ...l.lineas.filter((x) => cs.includes(x.concepto)).map((x) => x.valor))
    const empleados = liq.map((l) => {
      const e = d.empleados.find((x) => x.id === l.empleado_id)!
      const c = e.contratos.find((x) => x.contrato.id === l.contrato_id)!
      const v = versionEn(c, hasta)
      return {
        empleado_id: e.id,
        contrato_id: c.contrato.id,
        codigo: e.codigo,
        documento: e.documento,
        tipo_cotizante: v.tipo_salario === 'apoyo_sostenimiento' ? '19' : '01',
        dias: l.dias,
        ibc: l.ibc,
        salud: valor(l, 'salud', 'salud_empleador'),
        pension: valor(l, 'pension', 'pension_empleador'),
        fondo_solidaridad: valor(l, 'fondo_solidaridad'),
        arl: valor(l, 'arl'),
        caja: valor(l, 'caja_compensacion'),
        icbf: valor(l, 'icbf'),
        sena: valor(l, 'sena'),
        eps_id: v.eps_id,
        afp_id: v.afp_id ?? null,
        arl_id: v.arl_id ?? null,
        ccf_id: v.ccf_id ?? null,
        clase_riesgo: v.clase_riesgo ?? null,
      }
    })
    const porAdm = new Map<string, string>()
    const sumarA = (a: string | null | undefined, v: string) => a && porAdm.set(a, sumar(porAdm.get(a) ?? '0', v))
    for (const x of empleados) {
      sumarA(x.eps_id, x.salud)
      sumarA(x.afp_id, sumar(x.pension, x.fondo_solidaridad))
      sumarA(x.arl_id, x.arl)
      sumarA(x.ccf_id, x.caja)
    }
    return json({
      desde,
      hasta,
      empleados,
      administradoras: [...porAdm.entries()].map(([administradora_id, valor]) => ({ administradora_id, valor })),
      icbf: sumar('0', ...empleados.map((x) => x.icbf)),
      sena: sumar('0', ...empleados.map((x) => x.sena)),
    })
  }
  if (m === 'GET' && sub === '/ingresos-retenciones') {
    if (!anio) return error(422, 'validacion', 'Indique el año.')
    const liq = cerrados(`${anio}-01-01`, `${anio}-12-31`)
    return json(
      d.empleados
        .filter((e) => liq.some((l) => l.empleado_id === e.id))
        .map((e) => {
          const propias = liq.filter((l) => l.empleado_id === e.id).flatMap((l) => l.lineas)
          const suma = (...cs: ConceptoNomina[]) => sumar('0', ...propias.filter((x) => cs.includes(x.concepto)).map((x) => x.valor))
          return {
            empleado_id: e.id,
            codigo: e.codigo,
            nombre: e.nombre,
            documento: e.documento,
            totales: [
              { grupo: 'salarios' as const, valor: suma('basico', 'apoyo_sostenimiento', 'hora_extra_diurna', 'auxilio_transporte', 'incapacidad_comun') },
              { grupo: 'otros_pagos' as const, valor: suma('bonificacion_no_salarial', 'auxilio_no_salarial') },
              { grupo: 'aportes_salud' as const, valor: suma('salud') },
              { grupo: 'aportes_pension' as const, valor: suma('pension') },
              { grupo: 'retencion_fuente' as const, valor: suma('retencion_fuente') },
            ],
          }
        }),
    )
  }

  // Importaciones
  if (m === 'GET' && sub === '/importaciones/plantilla') {
    return csv('codigo;nombre;tipo_documento;documento;tipo_contrato;fecha_inicio;fecha_fin;cargo;salario;eps\nE-010;Ana Pérez;CC;52123123;termino_indefinido;2026-01-01;;Recepcionista;1600000;EPS010\n', 'plantilla-empleados.csv')
  }
  if (m === 'GET' && sub === '/novedades/importaciones/plantilla') {
    return csv('codigo;tipo;desde;hasta;cantidad;descripcion\nE-001;hora_extra_diurna;2026-11-03;;2;Inventario\n', 'plantilla-novedades.csv')
  }
  if (m === 'POST' && sub === '/importaciones') {
    const filas = filasCsv(await req.text())
    const errores: { fila: number; columna: string | null; mensaje: string }[] = []
    const vistas = filas.map((f, i) => {
      const [codigo = '', , , , tipo = ''] = f
      if (!codigo) errores.push({ fila: i + 2, columna: 'codigo', mensaje: 'Falta el código del empleado.' })
      else if (d.empleados.some((e) => e.codigo === codigo)) errores.push({ fila: i + 2, columna: 'codigo', mensaje: `Ya hay un empleado con el código ${codigo}.` })
      if (!TIPOS_CONTRATO.includes(tipo as TipoContratoLaboral)) errores.push({ fila: i + 2, columna: 'tipo_contrato', mensaje: `«${tipo}» no es un tipo de contrato.` })
      return { fila: i + 2, codigo, tipo_contrato: (TIPOS_CONTRATO.includes(tipo as TipoContratoLaboral) ? tipo : 'termino_indefinido') as TipoContratoLaboral }
    })
    const importacion = importacionDe(errores, filas.length, filas.length, 0)
    d.importaciones.set(importacion.id, {
      importacion,
      aplicar: () => {
        for (const f of filas) {
          const [codigo = '', nombre = '', , documento = '', tipo = 'termino_indefinido', inicio = fechaDemo(), fin = '', cargo = '', salario = SALARIO_MINIMO] = f
          d.empleados.push(empleadoDe(codigo, nombre, documento, { tipo: tipo as TipoContratoLaboral, fecha_inicio: inicio, fecha_fin: fin || null, condiciones: condiciones(cargo, n2(salario)) }))
        }
      },
    })
    return json({ importacion, filas: vistas }, 201)
  }
  if (m === 'POST' && sub === '/novedades/importaciones') {
    const filas = filasCsv(await req.text())
    const errores: { fila: number; columna: string | null; mensaje: string }[] = []
    const vistas = filas.map((f, i) => {
      const [codigo = '', tipo = ''] = f
      if (!d.empleados.some((e) => e.codigo === codigo)) errores.push({ fila: i + 2, columna: 'codigo', mensaje: `No hay un empleado con el código ${codigo}.` })
      return { fila: i + 2, codigo, tipo: tipo as TipoNovedad }
    })
    const importacion = importacionDe(errores, filas.length, 0, filas.length)
    d.importaciones.set(importacion.id, {
      importacion,
      aplicar: () => {
        for (const [codigo = '', tipo = '', desde = fechaDemo(), hasta = '', cantidad = '', descripcion = ''] of filas) {
          const c = d.empleados.find((e) => e.codigo === codigo)?.contratos.find((x) => !x.contrato.fecha_terminacion)
          if (c) d.novedades.push(novedad(c.contrato.id, tipo as TipoNovedad, desde, hasta || null, cantidad || null, descripcion || null))
        }
      },
    })
    return json({ importacion, filas: vistas }, 201)
  }
  const conf = sub.match(/^(\/novedades)?\/importaciones\/([^/]+)\/confirmar$/)
  if (m === 'POST' && conf) {
    const i = d.importaciones.get(conf[2] ?? '')
    if (!i) return error(404, 'no_encontrado', 'La importación no existe.')
    if (i.importacion.estado !== 'validada') return error(409, 'conflicto_estado', 'La importación tiene errores o ya se aplicó.')
    i.aplicar()
    i.importacion = { ...i.importacion, estado: 'aplicada', aplicada_en: ahora() }
    return json(i.importacion)
  }
  return null
}

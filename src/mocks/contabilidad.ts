/**
 * Demo de la contabilidad (cualquier entidad con el módulo): PUC reducido con las cuentas
 * propias, centros de costo, tipos de comprobante, periodos del año (los meses pasados
 * cerrados, el anterior en revisión, el actual abierto y una reapertura pendiente que pidió
 * otra cuenta), comprobantes en borrador y contabilizados y terceros. Valida lo que valida el
 * backend: partida doble y cuentas que admiten movimiento (`regla_contable`), periodo abierto
 * al contabilizar, reversos y cuatro ojos en la reapertura. También configuración, reglas,
 * rubros, notas y plantillas, saldos iniciales, cierre anual y los reportes (balance de prueba,
 * libros y estados financieros) calculados con los comprobantes contabilizados; los CSV llevan
 * `X-Contenido-Sha256`. Se reinicia en cada inicio de sesión.
 */
import type {
  BorradorComprobante,
  CentroCosto,
  Comprobante,
  ConfiguracionContable,
  CuentaContable,
  LineaAsiento,
  Naturaleza,
  NotaEstados,
  PeriodoContable,
  PlantillaContableResumen,
  Reapertura,
  ReglaContable,
  Rubro,
  Tercero,
  TipoComprobante,
} from '@/api/tipos'
import { cuentaDemoId } from './cuenta'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const hoy = () => new Date().toISOString().slice(0, 10)
const ahora = () => new Date().toISOString()

/** [código, nombre] del PUC reducido; la naturaleza sale de la clase (1, 5, 6 débito). */
const PUC: [string, string][] = [
  ['1', 'Activo'], ['11', 'Disponible'], ['1105', 'Caja'], ['110505', 'Caja general'], ['110510', 'Cajas menores'],
  ['1110', 'Bancos'], ['111005', 'Moneda nacional'], ['11100501', 'Banco de Bogotá cuenta corriente'], ['11100502', 'Bancolombia ahorros'],
  ['13', 'Deudores'], ['1305', 'Clientes'], ['130505', 'Nacionales'], ['1330', 'Anticipos y avances'], ['133005', 'A proveedores'],
  ['1355', 'Anticipo de impuestos'], ['135515', 'Retención en la fuente'], ['15', 'Propiedades, planta y equipo'], ['1524', 'Equipo de oficina'],
  ['152405', 'Muebles y enseres'], ['1528', 'Equipo de cómputo'], ['152805', 'Equipos de procesamiento de datos'],
  ['2', 'Pasivo'], ['22', 'Proveedores'], ['2205', 'Nacionales'], ['220505', 'Proveedores nacionales'],
  ['23', 'Cuentas por pagar'], ['2335', 'Costos y gastos por pagar'], ['233525', 'Honorarios'], ['233550', 'Servicios públicos'],
  ['2365', 'Retención en la fuente'], ['236515', 'Honorarios'], ['236525', 'Servicios'], ['24', 'Impuestos, gravámenes y tasas'],
  ['2408', 'IVA por pagar'], ['240805', 'IVA generado'], ['240810', 'IVA descontable'],
  ['3', 'Patrimonio'], ['31', 'Capital social'], ['3105', 'Capital suscrito y pagado'], ['310505', 'Capital autorizado'],
  ['36', 'Resultados del ejercicio'], ['3605', 'Utilidad del ejercicio'], ['360505', 'Utilidad del ejercicio'],
  ['4', 'Ingresos'], ['41', 'Operacionales'], ['4170', 'Otras actividades de servicios'], ['417005', 'Cuotas de administración'],
  ['42', 'No operacionales'], ['4210', 'Financieros'], ['421005', 'Intereses'], ['421040', 'Intereses de mora'],
  ['5', 'Gastos'], ['51', 'Operacionales de administración'], ['5105', 'Gastos de personal'], ['510506', 'Sueldos'],
  ['5110', 'Honorarios'], ['511025', 'Asesoría contable'], ['511030', 'Revisoría fiscal'], ['5135', 'Servicios'],
  ['513505', 'Aseo y vigilancia'], ['513525', 'Acueducto y alcantarillado'], ['513530', 'Energía eléctrica'],
  ['5145', 'Mantenimiento y reparaciones'], ['514510', 'Construcciones y edificaciones'], ['514525', 'Equipo de oficina'],
  ['53', 'No operacionales'], ['5305', 'Financieros'], ['530505', 'Gastos bancarios'],
]

const naturaleza = (codigo: string): Naturaleza => (['1', '5', '6', '7'].includes(codigo[0] ?? '') ? 'debito' : 'credito')
const nivel = (codigo: string): CuentaContable['nivel'] => {
  const n = codigo.length
  return n <= 1 ? 'clase' : n === 2 ? 'grupo' : n <= 4 ? 'cuenta' : n <= 6 ? 'subcuenta' : 'auxiliar'
}
const tieneHijas = (codigo: string) => PUC.some(([c]) => c !== codigo && c.startsWith(codigo))

let cuentas: CuentaContable[] = []
let centros: CentroCosto[] = []
let tipos: TipoComprobante[] = []
let periodos: PeriodoContable[] = []
let reaperturas: Reapertura[] = []
let comprobantes: Comprobante[] = []
let configuracion: ConfiguracionContable | null = null
let reglas: ReglaContable[] = []
let rubros: Rubro[] = []
let notas: NotaEstados[] = []
let consecutivo = 20000
let numeros: Record<string, number> = {}
/** Cuenta con la que se inició la sesión demo (cuatro ojos en la reapertura). */
let cuentaActual = ''

export const TERCEROS: Tercero[] = [
  { persona_id: id(5002), tipo: 'natural', nombre: 'Pedro Pérez', tipo_documento: 'CC', documento: '79876543', fiscal: { responsabilidades: [] } },
  { persona_id: id(5003), tipo: 'natural', nombre: 'Lucía Gómez', tipo_documento: 'CC', documento: '1020304050', fiscal: { responsabilidades: [] } },
  { persona_id: id(5501), tipo: 'juridica', nombre: 'Vigilancia Andina S.A.S.', tipo_documento: 'NIT', documento: '900111222', fiscal: { responsabilidades: [] } },
  { persona_id: id(5502), tipo: 'juridica', nombre: 'Aseo Total Ltda.', tipo_documento: 'NIT', documento: '800333444', fiscal: { responsabilidades: [] } },
  { persona_id: id(5503), tipo: 'juridica', nombre: 'Empresa de Energía S.A. E.S.P.', tipo_documento: 'NIT', documento: '899999001', fiscal: { responsabilidades: [] } },
] as Tercero[]

const cuentaPorCodigo = (c: string) => cuentas.find((x) => x.codigo === c)

function linea(codigo: string, debito: string, credito: string, extra: Partial<LineaAsiento> = {}): LineaAsiento {
  return { cuenta_id: cuentaPorCodigo(codigo)?.id ?? '', debito, credito, ...extra }
}

function nuevoComprobante(n: number, tipo: string, fecha: string, descripcion: string, lineas: LineaAsiento[], extra: Partial<Comprobante> = {}): Comprobante {
  return {
    id: id(n), tipo, fecha, anio: Number(fecha.slice(0, 4)), mes: Number(fecha.slice(5, 7)), descripcion, estado: 'borrador',
    lineas, creado_en: `${fecha}T15:00:00Z`, ...extra,
  }
}

export function iniciarContabilidad(usuario: string): void {
  cuentaActual = cuentaDemoId(usuario)
  consecutivo = 20000
  numeros = {}
  cuentas = PUC.map(([codigo, nombre], i) => ({
    id: id(21000 + i), codigo, nombre, naturaleza: naturaleza(codigo), nivel: nivel(codigo), acepta_movimiento: codigo.length >= 6 && !tieneHijas(codigo),
    exige_tercero: ['13', '22', '23'].some((p) => codigo.startsWith(p)), exige_centro_costo: codigo.startsWith('51'), activa: true,
  }))
  const inactiva = cuentaPorCodigo('110510')
  if (inactiva) inactiva.activa = false
  centros = [
    { id: id(22001), codigo: 'ADM', nombre: 'Administración', activo: true },
    { id: id(22002), codigo: 'MTO', nombre: 'Mantenimiento', activo: true },
    { id: id(22003), codigo: 'ZC', nombre: 'Zonas comunes', activo: false },
  ]
  tipos = [
    { id: id(22101), codigo: 'CC', nombre: 'Comprobante de contabilidad', manual: true, activo: true },
    { id: id(22102), codigo: 'NC', nombre: 'Nota contable', manual: true, activo: true },
    { id: id(22103), codigo: 'RC', nombre: 'Recibo de caja', manual: false, activo: true },
    { id: id(22104), codigo: 'CE', nombre: 'Comprobante de egreso', manual: false, activo: true },
    { id: id(22105), codigo: 'AP', nombre: 'Apertura', manual: false, activo: true },
    { id: id(22106), codigo: 'CI', nombre: 'Cierre anual', manual: false, activo: true },
  ]
  const f = new Date()
  const anio = f.getFullYear()
  const mes = f.getMonth() + 1
  periodos = Array.from({ length: mes }, (_, k) => ({
    id: id(22200 + k + 1), anio, mes: k + 1,
    estado: k + 1 === mes ? 'abierto' : k + 2 === mes ? 'en_revision' : 'cerrado',
    cerrado_en: k + 2 < mes ? new Date(anio, k + 1, 3).toISOString() : null,
  }))
  const cerrado = periodos.find((p) => p.estado === 'cerrado' && p.mes === mes - 2)
  reaperturas = cerrado
    ? [{ id: id(22301), periodo_id: cerrado.id, motivo: 'Falta registrar la factura de energía del mes.', alcance: 'Solo la causación de servicios públicos', solicitada_por: cuentaDemoId(usuario.includes('revisor') ? 'uno' : 'revisor'), solicitada_en: ahora(), estado: 'pendiente' }]
    : []
  const dia = hoy()
  const vigilancia = id(5501)
  comprobantes = [
    nuevoComprobante(23001, 'CC', dia, 'Causación de la vigilancia del mes', [
      linea('513505', '4200000.00', '0', { centro_costo_id: id(22001), persona_id: vigilancia }),
      linea('233550', '0', '4200000.00', { persona_id: vigilancia }),
    ], { estado: 'contabilizado', numero: 3, contabilizado_en: ahora() }),
    nuevoComprobante(23002, 'NC', dia, 'Reclasificación de gastos bancarios', [
      linea('530505', '85000.00', '0'),
      linea('11100501', '0', '85000.00'),
    ]),
    nuevoComprobante(23003, 'CC', dia, 'Pago de energía (por completar)', [
      linea('513530', '1250000.00', '0', { centro_costo_id: id(22001) }),
      linea('11100502', '0', '1200000.00'),
    ]),
  ]
  const enero = `${anio}-01-02`
  const marzo = `${anio}-03-15`
  comprobantes.push(
    nuevoComprobante(23010, 'AP', enero, 'Saldos iniciales', [
      linea('110505', '2000000.00', '0'), linea('11100501', '58000000.00', '0'),
      linea('310505', '0', '60000000.00'),
    ], { estado: 'contabilizado', numero: 1, contabilizado_en: `${enero}T15:00:00Z` }),
    nuevoComprobante(23011, 'CC', marzo, 'Cuotas de administración de marzo', [
      linea('130505', '18000000.00', '0', { persona_id: id(5002) }), linea('417005', '0', '18000000.00'),
    ], { estado: 'contabilizado', numero: 1, contabilizado_en: `${marzo}T15:00:00Z` }),
    nuevoComprobante(23012, 'CC', marzo, 'Energía de marzo', [
      linea('513530', '1100000.00', '0', { centro_costo_id: id(22001) }), linea('233550', '0', '1100000.00', { persona_id: id(5503) }),
    ], { estado: 'contabilizado', numero: 2, contabilizado_en: `${marzo}T16:00:00Z` }),
  )
  numeros = { CC: 3, AP: 1 }
  configuracion = {
    version: 1, marco_tecnico: 'grupo_2', cuenta_resultado_id: cuentaPorCodigo('360505')?.id ?? null, plantilla_origen: 'Propiedad horizontal v3',
    vigente_desde: `${anio}-01-01`, creada_en: `${anio}-01-01T12:00:00Z`,
  }
  reglas = [
    { id: id(22401), evento: 'cartera.cuota', version: 1, tipo_comprobante_id: id(22101), descripcion: 'Causación de cuotas', vigente_desde: `${anio}-01-01`, creada_en: ahora(),
      lineas: [{ concepto: 'cuota', cara: 'debito', cuenta_id: cuentaPorCodigo('130505')?.id ?? '', tercero: 'documento', centro: 'ninguno' }, { concepto: 'cuota', cara: 'credito', cuenta_id: cuentaPorCodigo('417005')?.id ?? '', tercero: 'ninguno', centro: 'ninguno' }] },
    { id: id(22402), evento: 'tesoreria.recibo', version: 1, tipo_comprobante_id: id(22103), descripcion: 'Recibo de caja', vigente_desde: `${anio}-01-01`, creada_en: ahora(),
      lineas: [{ concepto: 'recaudo', cara: 'debito', cuenta_id: cuentaPorCodigo('11100501')?.id ?? '', tercero: 'ninguno', centro: 'ninguno' }, { concepto: 'recaudo', cara: 'credito', cuenta_id: cuentaPorCodigo('130505')?.id ?? '', tercero: 'documento', centro: 'ninguno' }] },
  ]
  rubros = [
    { estado: 'situacion_financiera', codigo: 'efectivo', nombre: 'Efectivo y equivalentes', orden: 1, prefijos: ['11'] },
    { estado: 'situacion_financiera', codigo: 'deudores', nombre: 'Deudores', orden: 2, prefijos: ['13'] },
    { estado: 'situacion_financiera', codigo: 'cuentas_pagar', nombre: 'Cuentas por pagar', orden: 3, prefijos: ['22', '23', '24'] },
    { estado: 'situacion_financiera', codigo: 'patrimonio', nombre: 'Patrimonio', orden: 4, prefijos: ['3'] },
    { estado: 'resultados', codigo: 'ingresos', nombre: 'Ingresos operacionales', orden: 1, prefijos: ['41'] },
    { estado: 'resultados', codigo: 'gastos', nombre: 'Gastos de administración', orden: 2, prefijos: ['51', '53'] },
  ]
  notas = [{ id: id(22501), anio, numero: 1, version: 1, titulo: 'Entidad y marco', texto: 'La copropiedad aplica el marco técnico del grupo 2.', rubro_id: null, creada_en: ahora() }]
}

const PLANTILLAS: PlantillaContableResumen[] = [
  { id: id(22601), ambito: 'plataforma', organizacion: null, nombre: 'Propiedad horizontal', tipo_empresa: 'propiedad_horizontal', version: 3, estado: 'publicada', publicada_en: '2026-06-01T12:00:00Z' },
  { id: id(22602), ambito: 'organizacion', organizacion: 'DAD Servicios Contables S.A.S.', nombre: 'PH con fondo de imprevistos', tipo_empresa: 'propiedad_horizontal', version: 1, estado: 'publicada', publicada_en: '2026-09-15T12:00:00Z' },
]

const contabilizados = () => comprobantes.filter((c) => c.estado === 'contabilizado')
const codigoDe = (cuentaId: string) => cuentas.find((x) => x.id === cuentaId)?.codigo ?? ''
const n2 = (x: number) => x.toFixed(2)

/** Débitos − créditos por cuenta (y tercero o centro) en un rango. */
function saldos(desde: string, hasta: string, porTercero: boolean, porCentro: boolean) {
  const filas = new Map<string, { cuenta: CuentaContable; persona: string | null; centro: string | null; inicial: number; d: number; c: number }>()
  for (const comp of contabilizados()) {
    if (comp.fecha > hasta) continue
    for (const l of comp.lineas) {
      const cuenta = cuentas.find((x) => x.id === l.cuenta_id)
      if (!cuenta) continue
      const persona = porTercero ? (l.persona_id ?? null) : null
      const centro = porCentro ? (l.centro_costo_id ?? null) : null
      const clave = `${cuenta.id}|${persona}|${centro}`
      const f = filas.get(clave) ?? { cuenta, persona, centro, inicial: 0, d: 0, c: 0 }
      if (comp.fecha < desde) f.inicial += Number(l.debito) - Number(l.credito)
      else {
        f.d += Number(l.debito)
        f.c += Number(l.credito)
      }
      filas.set(clave, f)
    }
  }
  return [...filas.values()].sort((a, b) => a.cuenta.codigo.localeCompare(b.cuenta.codigo)).map((f) => ({
    cuenta_id: f.cuenta.id, codigo: f.cuenta.codigo, nombre: f.cuenta.nombre, naturaleza: f.cuenta.naturaleza, persona_id: f.persona, centro_costo_id: f.centro,
    saldo_inicial: n2(f.inicial), debitos: n2(f.d), creditos: n2(f.c), saldo_final: n2(f.inicial + f.d - f.c),
  }))
}

const csv = (filas: (string | number)[][], nombre: string) =>
  new Response(filas.map((f) => f.join(';')).join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nombre}"`, 'X-Contenido-Sha256': 'a3f1c2e4'.repeat(8), 'X-Request-Id': 'demo' },
  })

/** Valor de un rubro a la fecha (situación: acumulado; resultados: del año del corte). */
function valorRubro(r: Rubro, corte: string) {
  const anio = corte.slice(0, 4)
  let total = 0
  for (const comp of contabilizados()) {
    if (comp.fecha > corte || (r.estado === 'resultados' && (!comp.fecha.startsWith(anio) || comp.mes === 13))) continue
    for (const l of comp.lineas) {
      const cod = codigoDe(l.cuenta_id)
      if (!r.prefijos.some((p) => cod.startsWith(p))) continue
      total += naturaleza(cod) === 'debito' ? Number(l.debito) - Number(l.credito) : Number(l.credito) - Number(l.debito)
    }
  }
  return n2(total)
}

function resultadoDelAnio(anio: string) {
  let r = 0
  for (const comp of contabilizados()) {
    if (!comp.fecha.startsWith(anio) || comp.mes === 13) continue
    for (const l of comp.lineas) {
      const clase = codigoDe(l.cuenta_id)[0]
      if (clase === '4') r += Number(l.credito) - Number(l.debito)
      if (clase === '5' || clase === '6' || clase === '7') r -= Number(l.debito) - Number(l.credito)
    }
  }
  return r
}

/** Valida como `domain::contabilidad::Asiento`; devuelve el error o las líneas por id. */
function validar(d: BorradorComprobante): { error: Response } | { lineas: LineaAsiento[]; total: string } {
  const tipo = tipos.find((t) => t.codigo === d.tipo)
  if (!tipo || !tipo.manual) return { error: error(422, 'validacion', `El tipo ${d.tipo} no es un comprobante manual.`) }
  if (!d.descripcion?.trim()) return { error: error(422, 'validacion', 'Escriba la descripción.') }
  if (d.lineas.length < 2) return { error: error(422, 'regla_contable', 'Un asiento lleva al menos dos líneas.') }
  const lineas: LineaAsiento[] = []
  let debitos = 0
  let creditos = 0
  for (const [i, l] of d.lineas.entries()) {
    const c = cuentaPorCodigo(l.cuenta)
    if (!c) return { error: error(422, 'validacion', `Línea ${i + 1}: la cuenta ${l.cuenta} no existe.`) }
    if (!c.acepta_movimiento || !c.activa) return { error: error(422, 'regla_contable', `Línea ${i + 1}: la cuenta ${l.cuenta} no admite movimientos.`) }
    if (c.exige_tercero && !l.persona_id) return { error: error(422, 'regla_contable', `Línea ${i + 1}: la cuenta ${l.cuenta} exige tercero.`) }
    const centro = l.centro_costo ? centros.find((x) => x.codigo === l.centro_costo) : undefined
    if (l.centro_costo && !centro) return { error: error(422, 'validacion', `Línea ${i + 1}: el centro de costo ${l.centro_costo} no existe.`) }
    if (c.exige_centro_costo && !centro) return { error: error(422, 'regla_contable', `Línea ${i + 1}: la cuenta ${l.cuenta} exige centro de costo.`) }
    const de = Number(l.debito ?? '0')
    const cr = Number(l.credito ?? '0')
    if ((de > 0) === (cr > 0)) return { error: error(422, 'regla_contable', `Línea ${i + 1}: lleve un valor al débito o al crédito.`) }
    debitos += de
    creditos += cr
    lineas.push({ cuenta_id: c.id, persona_id: l.persona_id ?? null, centro_costo_id: centro?.id ?? null, debito: de.toFixed(2), credito: cr.toFixed(2), descripcion: l.descripcion ?? null })
  }
  if (Math.abs(debitos - creditos) > 0.001) {
    return { error: error(422, 'regla_contable', `El comprobante no cuadra: débitos ${debitos.toFixed(2)} y créditos ${creditos.toFixed(2)}.`) }
  }
  return { lineas, total: debitos.toFixed(2) }
}

const periodoDe = (fecha: string) => periodos.find((p) => p.anio === Number(fecha.slice(0, 4)) && p.mes === Number(fecha.slice(5, 7)))

export const contabilidad: Manejador = async (req, ruta) => {
  const m = req.method
  const q = new URL(req.url).searchParams
  const ter = ruta.match(/^\/entidades\/[^/]+\/terceros$/)
  if (ter && m === 'GET') {
    const t = (q.get('texto') ?? '').toLowerCase()
    return json({ datos: TERCEROS.filter((x) => !t || x.nombre.toLowerCase().includes(t) || (x.documento ?? '').includes(t)).slice(0, Number(q.get('limite') ?? 10)), siguiente: null })
  }
  const b = ruta.match(/^\/entidades\/[^/]+\/contabilidad(\/.*)$/)
  if (!b) return null
  const r = b[1] ?? ''

  if (m === 'GET' && r === '/puc') {
    const pre = q.get('prefijo') ?? ''
    return json(PUC.filter(([c]) => c.startsWith(pre)).map(([codigo, nombre]) => ({ codigo, nombre, naturaleza: naturaleza(codigo) })))
  }
  if (r === '/cuentas') {
    if (m === 'GET') return json(cuentas)
    if (m === 'POST') {
      const d = await cuerpo<{ codigo: string; nombre: string; naturaleza?: Naturaleza | null; acepta_movimiento: boolean; exige_tercero?: boolean; exige_centro_costo?: boolean }>(req)
      if (!/^\d{1,10}$/.test(d.codigo ?? '')) return error(422, 'validacion', 'El código va solo con dígitos.')
      if (cuentaPorCodigo(d.codigo)) return error(409, 'conflicto', `La cuenta ${d.codigo} ya existe.`)
      if (!d.nombre?.trim()) return error(422, 'validacion', 'Escriba el nombre de la cuenta.')
      const largo = d.codigo.length
      const padre = largo <= 1 ? null : d.codigo.slice(0, largo === 2 ? 1 : largo <= 4 ? 2 : largo <= 6 ? 4 : 6)
      if (padre && !cuentaPorCodigo(padre)) return error(422, 'validacion', `Primero cree la cuenta padre ${padre}.`)
      const nueva: CuentaContable = {
        id: id(++consecutivo), codigo: d.codigo, nombre: d.nombre.trim(), naturaleza: d.naturaleza ?? naturaleza(d.codigo), nivel: nivel(d.codigo),
        acepta_movimiento: d.acepta_movimiento, exige_tercero: d.exige_tercero ?? false, exige_centro_costo: d.exige_centro_costo ?? false, activa: true,
      }
      const p = padre ? cuentaPorCodigo(padre) : undefined
      if (p) p.acepta_movimiento = false
      cuentas.push(nueva)
      return json(nueva, 201)
    }
  }
  const cta = r.match(/^\/cuentas\/([^/]+)$/)
  if (cta && m === 'PUT') {
    const c = cuentas.find((x) => x.id === cta[1])
    if (!c) return error(404, 'no_encontrado', 'La cuenta no existe.')
    const d = await cuerpo<Partial<CuentaContable>>(req)
    if (!d.nombre?.trim()) return error(422, 'validacion', 'Escriba el nombre de la cuenta.')
    Object.assign(c, { nombre: d.nombre.trim(), acepta_movimiento: d.acepta_movimiento, exige_tercero: d.exige_tercero, exige_centro_costo: d.exige_centro_costo, activa: d.activa })
    return json(c)
  }
  if (r === '/centros-costo') {
    if (m === 'GET') return json(centros)
    if (m === 'POST') {
      const d = await cuerpo<{ codigo: string; nombre: string }>(req)
      if (!d.codigo?.trim() || !d.nombre?.trim()) return error(422, 'validacion', 'Escriba el código y el nombre.')
      if (centros.some((x) => x.codigo === d.codigo.trim())) return error(409, 'conflicto', `El centro ${d.codigo} ya existe.`)
      const nuevo = { id: id(++consecutivo), codigo: d.codigo.trim().toUpperCase(), nombre: d.nombre.trim(), activo: true }
      centros.push(nuevo)
      return json(nuevo, 201)
    }
  }
  const cen = r.match(/^\/centros-costo\/([^/]+)$/)
  if (cen && m === 'PUT') {
    const c = centros.find((x) => x.id === cen[1])
    if (!c) return error(404, 'no_encontrado', 'El centro no existe.')
    const d = await cuerpo<{ nombre: string; activo?: boolean }>(req)
    Object.assign(c, { nombre: d.nombre?.trim() || c.nombre, activo: d.activo ?? c.activo })
    return json(c)
  }
  if (m === 'GET' && r === '/tipos-comprobante') return json(tipos)

  // Comprobantes
  if (r === '/comprobantes') {
    if (m === 'GET') {
      const lista = comprobantes
        .filter((c) => (!q.get('desde') || c.fecha >= (q.get('desde') ?? '')) && (!q.get('hasta') || c.fecha <= (q.get('hasta') ?? '')))
        .filter((c) => !q.get('estado') || c.estado === q.get('estado'))
        .filter((c) => !q.get('tipo_comprobante_id') || tipos.find((t) => t.id === q.get('tipo_comprobante_id'))?.codigo === c.tipo)
      return json(lista.map((c) => ({ ...c, lineas: [] })))
    }
    if (m === 'POST') {
      const d = await cuerpo<BorradorComprobante>(req)
      const v = validarBorrador(d)
      if ('error' in v) return v.error
      const c = nuevoComprobante(++consecutivo, d.tipo, d.fecha, d.descripcion.trim(), v.lineas, { creado_en: ahora() })
      comprobantes = [c, ...comprobantes]
      return json(c, 201)
    }
  }
  if (m === 'POST' && r === '/comprobantes/previsualizar') {
    const v = validar(await cuerpo<BorradorComprobante>(req))
    return 'error' in v ? v.error : json({ total: v.total, lineas: v.lineas })
  }
  const cp = r.match(/^\/comprobantes\/([^/]+)(\/contabilizar|\/revertir)?$/)
  if (cp) {
    const c = comprobantes.find((x) => x.id === cp[1])
    if (!c) return error(404, 'no_encontrado', 'El comprobante no existe.')
    const accion = cp[2] ?? ''
    if (accion === '' && m === 'GET') return json(c)
    if (accion === '' && m === 'PUT') {
      if (c.estado !== 'borrador') return error(409, 'conflicto', 'El comprobante ya está contabilizado: revírtalo con un reverso.')
      const d = await cuerpo<BorradorComprobante>(req)
      const v = validarBorrador(d)
      if ('error' in v) return v.error
      Object.assign(c, { tipo: d.tipo, fecha: d.fecha, anio: Number(d.fecha.slice(0, 4)), mes: Number(d.fecha.slice(5, 7)), descripcion: d.descripcion.trim(), lineas: v.lineas })
      return json(c)
    }
    if (accion === '' && m === 'DELETE') {
      if (c.estado !== 'borrador') return error(409, 'conflicto', 'Un comprobante contabilizado no se borra: se revierte.')
      comprobantes = comprobantes.filter((x) => x !== c)
      return sinContenido()
    }
    if (accion === '/contabilizar' && m === 'POST') {
      if (c.estado !== 'borrador') return error(409, 'conflicto', 'El comprobante ya está contabilizado.')
      const v = validar({ tipo: c.tipo, fecha: c.fecha, descripcion: c.descripcion, lineas: c.lineas.map((l) => ({
        cuenta: cuentas.find((x) => x.id === l.cuenta_id)?.codigo ?? '', persona_id: l.persona_id, centro_costo: centros.find((x) => x.id === l.centro_costo_id)?.codigo ?? null, debito: l.debito, credito: l.credito,
      })) })
      if ('error' in v) return v.error
      if (periodoDe(c.fecha)?.estado !== 'abierto') return error(422, 'regla_contable', 'El periodo de la fecha del comprobante no está abierto.')
      numeros[c.tipo] = (numeros[c.tipo] ?? 0) + 1
      Object.assign(c, { estado: 'contabilizado', numero: numeros[c.tipo], contabilizado_en: ahora(), lineas: v.lineas })
      return json(c)
    }
    if (accion === '/revertir' && m === 'POST') {
      const d = await cuerpo<{ motivo: string; fecha?: string | null }>(req)
      if (c.estado !== 'contabilizado' || c.revertido_por || c.revierte_a) return error(409, 'conflicto', 'Solo se revierte un comprobante contabilizado que no sea un reverso ni se haya revertido.')
      if (!d.motivo?.trim()) return error(422, 'validacion', 'Indique el motivo del reverso.')
      const fecha = d.fecha ?? hoy()
      if (periodoDe(fecha)?.estado !== 'abierto') return error(422, 'regla_contable', 'El periodo de la fecha del reverso no está abierto.')
      numeros[c.tipo] = (numeros[c.tipo] ?? 0) + 1
      const reverso = nuevoComprobante(++consecutivo, c.tipo, fecha, `Reverso: ${c.descripcion}`, c.lineas.map((l) => ({ ...l, debito: l.credito, credito: l.debito })), {
        estado: 'contabilizado', numero: numeros[c.tipo], revierte_a: c.id, motivo_reverso: d.motivo.trim(), contabilizado_en: ahora(), creado_en: ahora(),
      })
      c.revertido_por = reverso.id
      comprobantes = [reverso, ...comprobantes]
      return json(reverso, 201)
    }
  }

  // Configuración, reglas, rubros, notas y plantillas
  if (r === '/configuracion') {
    if (m === 'GET') return json(configuracion)
    if (m === 'PUT') {
      const d = await cuerpo<{ marco_tecnico: ConfiguracionContable['marco_tecnico']; cuenta_resultado?: string | null; vigente_desde: string }>(req)
      const resultado = d.cuenta_resultado ? cuentaPorCodigo(d.cuenta_resultado) : undefined
      if (d.cuenta_resultado && (!resultado || !resultado.codigo.startsWith('3') || !resultado.acepta_movimiento)) {
        return error(422, 'validacion', 'La cuenta de resultado debe ser de la clase 3 y aceptar movimientos.')
      }
      if (!d.vigente_desde) return error(422, 'validacion', 'Indique desde cuándo rige.')
      configuracion = {
        version: (configuracion?.version ?? 0) + 1, marco_tecnico: d.marco_tecnico, cuenta_resultado_id: resultado?.id ?? null,
        plantilla_origen: configuracion?.plantilla_origen ?? null, vigente_desde: d.vigente_desde, creada_en: ahora(),
      }
      return json(configuracion)
    }
  }
  if (r === '/tipos-comprobante' && m === 'POST') {
    const d = await cuerpo<{ codigo: string; nombre: string; manual?: boolean; activo?: boolean }>(req)
    if (!/^[A-Z0-9]{1,6}$/i.test(d.codigo ?? '') || !d.nombre?.trim()) return error(422, 'validacion', 'Escriba un código corto (letras o dígitos) y el nombre.')
    if (tipos.some((t) => t.codigo === d.codigo.toUpperCase())) return error(409, 'conflicto', `El tipo ${d.codigo} ya existe.`)
    const nuevo = { id: id(++consecutivo), codigo: d.codigo.toUpperCase(), nombre: d.nombre.trim(), manual: d.manual ?? true, activo: d.activo ?? true }
    tipos.push(nuevo)
    return json(nuevo, 201)
  }
  const tip = r.match(/^\/tipos-comprobante\/([^/]+)$/)
  if (tip && m === 'PUT') {
    const t = tipos.find((x) => x.id === tip[1])
    if (!t) return error(404, 'no_encontrado', 'El tipo no existe.')
    const d = await cuerpo<{ nombre: string; manual?: boolean; activo?: boolean }>(req)
    Object.assign(t, { nombre: d.nombre?.trim() || t.nombre, manual: d.manual ?? t.manual, activo: d.activo ?? t.activo })
    return json(t)
  }
  if (r === '/reglas') {
    if (m === 'GET') return json(reglas)
    if (m === 'POST') {
      const d = await cuerpo<{ evento: string; tipo_comprobante: string; descripcion?: string | null; vigente_desde: string; lineas: { concepto: string; cara: 'debito' | 'credito'; cuenta: string; tercero: 'documento' | 'ninguno'; centro: 'documento' | 'fijo' | 'ninguno'; centro_costo?: string | null }[] }>(req)
      const tipo = tipos.find((t) => t.codigo === d.tipo_comprobante)
      if (!d.evento?.trim() || !tipo) return error(422, 'validacion', 'Indique el evento y un tipo de comprobante existente.')
      if (!d.lineas?.some((l) => l.cara === 'debito') || !d.lineas.some((l) => l.cara === 'credito')) return error(422, 'regla_contable', 'La regla necesita al menos una línea débito y una crédito.')
      const malas = d.lineas.filter((l) => !cuentaPorCodigo(l.cuenta)?.acepta_movimiento)
      if (malas.length) return error(422, 'regla_contable', `La cuenta ${malas[0]?.cuenta} no admite movimientos.`)
      const version = Math.max(0, ...reglas.filter((x) => x.evento === d.evento).map((x) => x.version)) + 1
      const nueva: ReglaContable = {
        id: id(++consecutivo), evento: d.evento.trim(), version, tipo_comprobante_id: tipo.id, descripcion: d.descripcion ?? null, vigente_desde: d.vigente_desde, creada_en: ahora(),
        lineas: d.lineas.map((l) => ({ concepto: l.concepto, cara: l.cara, cuenta_id: cuentaPorCodigo(l.cuenta)?.id ?? '', tercero: l.tercero, centro: l.centro, centro_costo_id: centros.find((c) => c.codigo === l.centro_costo)?.id ?? null })),
      }
      reglas.push(nueva)
      return json(nueva, 201)
    }
  }
  if (r === '/rubros') {
    if (m === 'GET') return json(rubros)
    if (m === 'PUT') {
      const lista = await cuerpo<Rubro[]>(req)
      if (lista.some((x) => !x.codigo?.trim() || !x.nombre?.trim() || !x.prefijos.length)) return error(422, 'validacion', 'Cada rubro lleva código, nombre y al menos un prefijo.')
      rubros = lista
      return json(rubros)
    }
  }
  if (r === '/notas') {
    if (m === 'GET') return json(notas.filter((n) => n.anio === Number(q.get('anio'))))
    if (m === 'POST') {
      const d = await cuerpo<{ anio: number; numero: number; titulo: string; texto: string }>(req)
      if (!d.titulo?.trim() || !d.texto?.trim()) return error(422, 'validacion', 'Escriba el título y el texto de la nota.')
      const previa = notas.find((n) => n.anio === d.anio && n.numero === d.numero)
      const nueva: NotaEstados = { id: previa?.id ?? id(++consecutivo), anio: d.anio, numero: d.numero, version: (previa?.version ?? 0) + 1, titulo: d.titulo.trim(), texto: d.texto.trim(), rubro_id: null, creada_en: ahora() }
      notas = [...notas.filter((n) => n !== previa), nueva]
      return json(nueva, 201)
    }
  }
  if (m === 'GET' && r === '/plantillas') return json(PLANTILLAS)
  if (m === 'POST' && r === '/plantillas/aplicar') {
    const d = await cuerpo<{ plantilla_id: string; previsualizar?: boolean }>(req)
    if (!PLANTILLAS.some((p) => p.id === d.plantilla_id)) return error(404, 'no_encontrado', 'La plantilla no existe.')
    const resumen = { cuentas_creadas: 12, cuentas_existentes: cuentas.length, tipos_creados: 1, tipos_existentes: tipos.length, reglas_creadas: 3, rubros: 6, configuracion: !configuracion, previsualizacion: !!d.previsualizar }
    if (!d.previsualizar && configuracion) configuracion = { ...configuracion, plantilla_origen: PLANTILLAS.find((p) => p.id === d.plantilla_id)?.nombre ?? null }
    return json(resumen)
  }
  if (m === 'POST' && r === '/plantillas/guardar') {
    const d = await cuerpo<{ nombre: string; tipo_empresa: string }>(req)
    if (!d.nombre?.trim()) return error(422, 'validacion', 'Escriba el nombre de la plantilla.')
    return json({ id: id(++consecutivo), nombre: d.nombre.trim(), tipo_empresa: d.tipo_empresa, version: 1, estado: 'borrador', contenido: {}, creada_en: ahora() }, 201)
  }

  // Apertura y cierre
  if (m === 'POST' && r === '/saldos-iniciales') {
    const d = await cuerpo<{ fecha: string; descripcion?: string | null; lineas: BorradorComprobante['lineas'] }>(req)
    const v = validar({ tipo: 'CC', fecha: d.fecha, descripcion: d.descripcion || 'Saldos iniciales', lineas: d.lineas })
    if ('error' in v) return v.error
    if (periodoDe(d.fecha)?.estado === 'cerrado') return error(422, 'regla_contable', 'El periodo de la fecha está cerrado.')
    numeros.AP = (numeros.AP ?? 0) + 1
    const c = nuevoComprobante(++consecutivo, 'AP', d.fecha, d.descripcion || 'Saldos iniciales', v.lineas, { estado: 'contabilizado', numero: numeros.AP, contabilizado_en: ahora(), creado_en: ahora() })
    comprobantes = [c, ...comprobantes]
    return json(c, 201)
  }
  if (m === 'POST' && r === '/cierre-anual') {
    const { anio } = await cuerpo<{ anio: number }>(req)
    if (comprobantes.some((c) => c.tipo === 'CI' && c.anio === anio)) return error(409, 'conflicto', `El cierre de ${anio} ya está contabilizado.`)
    const resultado = configuracion?.cuenta_resultado_id ? cuentas.find((c) => c.id === configuracion?.cuenta_resultado_id) : undefined
    if (!resultado) return error(422, 'regla_contable', 'Configure la cuenta de resultado del ejercicio antes del cierre.')
    const lineas: LineaAsiento[] = []
    for (const f of saldos(`${anio}-01-01`, `${anio}-12-31`, false, false)) {
      if (!['4', '5', '6', '7'].includes(f.codigo[0] ?? '')) continue
      const neto = Number(f.saldo_inicial) + Number(f.debitos) - Number(f.creditos)
      if (Math.abs(neto) < 0.005) continue
      lineas.push({ cuenta_id: f.cuenta_id, debito: n2(neto < 0 ? -neto : 0), credito: n2(neto > 0 ? neto : 0) })
    }
    const total = resultadoDelAnio(String(anio))
    lineas.push({ cuenta_id: resultado.id, debito: n2(total < 0 ? -total : 0), credito: n2(total > 0 ? total : 0) })
    numeros.CI = (numeros.CI ?? 0) + 1
    const c = nuevoComprobante(++consecutivo, 'CI', `${anio}-12-31`, `Cierre del ejercicio ${anio}`, lineas, { mes: 13, estado: 'contabilizado', numero: numeros.CI, contabilizado_en: ahora(), creado_en: ahora() })
    comprobantes = [c, ...comprobantes]
    return json(c, 201)
  }

  // Reportes
  const desde = q.get('desde') ?? '0000-01-01'
  const hasta = q.get('hasta') ?? '9999-12-31'
  const enCsv = q.get('formato') === 'csv'
  if (m === 'GET' && r === '/reportes/balance-prueba') {
    const filas = saldos(desde, hasta, q.get('por_tercero') === 'true', q.get('por_centro_costo') === 'true')
    if (enCsv) return csv([['cuenta', 'nombre', 'saldo_inicial', 'debitos', 'creditos', 'saldo_final'], ...filas.map((f) => [f.codigo, f.nombre, f.saldo_inicial, f.debitos, f.creditos, f.saldo_final])], 'balance-prueba.csv')
    return json(filas)
  }
  if (m === 'GET' && r === '/reportes/libro-diario') {
    const lista = contabilizados().filter((c) => c.fecha >= desde && c.fecha <= hasta).sort((a, b) => a.fecha.localeCompare(b.fecha))
    if (enCsv) return csv([['fecha', 'comprobante', 'cuenta', 'debito', 'credito'], ...lista.flatMap((c) => c.lineas.map((l) => [c.fecha, `${c.tipo}-${c.numero}`, codigoDe(l.cuenta_id), l.debito, l.credito]))], 'libro-diario.csv')
    return json(lista)
  }
  if (m === 'GET' && r === '/reportes/libro-mayor') {
    const cuenta = cuentaPorCodigo(q.get('cuenta') ?? '')
    if (!cuenta) return error(422, 'validacion', 'La cuenta no existe.')
    const persona = q.get('persona_id')
    let inicial = 0
    const movimientos = []
    for (const c of contabilizados().sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (c.fecha > hasta) continue
      for (const l of c.lineas) {
        if (!codigoDe(l.cuenta_id).startsWith(cuenta.codigo) || (persona && l.persona_id !== persona)) continue
        if (c.fecha < desde) inicial += Number(l.debito) - Number(l.credito)
        else movimientos.push({ comprobante_id: c.id, tipo: c.tipo, numero: c.numero ?? 0, fecha: c.fecha, descripcion: c.descripcion, persona_id: l.persona_id ?? null, centro_costo_id: l.centro_costo_id ?? null, debito: l.debito, credito: l.credito })
      }
    }
    const final = movimientos.reduce((t, x) => t + Number(x.debito) - Number(x.credito), inicial)
    if (enCsv) return csv([['fecha', 'comprobante', 'descripcion', 'debito', 'credito'], ...movimientos.map((x) => [x.fecha, `${x.tipo}-${x.numero}`, x.descripcion, x.debito, x.credito])], 'libro-mayor.csv')
    return json({ cuenta, persona_id: persona, saldo_inicial: n2(inicial), movimientos, saldo_final: n2(final) })
  }
  if (m === 'GET' && r === '/reportes/estados-financieros') {
    const corte = q.get('corte') ?? hoy()
    const de = (estado: string) => rubros.filter((x) => x.estado === estado).sort((a, b) => a.orden - b.orden).map((x) => ({ codigo: x.codigo, nombre: x.nombre, valor: valorRubro(x, corte) }))
    return json({
      corte, situacion_financiera: de('situacion_financiera'), resultados: de('resultados'), resultado_ejercicio: n2(resultadoDelAnio(corte.slice(0, 4))),
      cierre_contabilizado: comprobantes.some((c) => c.tipo === 'CI' && String(c.anio) === corte.slice(0, 4)), notas: notas.filter((n) => String(n.anio) === corte.slice(0, 4)),
    })
  }

  // Periodos y reaperturas
  if (r === '/periodos') {
    if (m === 'GET') return json(periodos.filter((p) => !q.get('anio') || p.anio === Number(q.get('anio'))))
    if (m === 'POST') {
      const d = await cuerpo<{ anio: number; mes: number }>(req)
      if (!(d.mes >= 1 && d.mes <= 13)) return error(422, 'validacion', 'El mes va de 1 a 13.')
      const ya = periodos.find((p) => p.anio === d.anio && p.mes === d.mes)
      if (ya) return json(ya)
      const nuevo: PeriodoContable = { id: id(++consecutivo), anio: d.anio, mes: d.mes, estado: 'abierto' }
      periodos.push(nuevo)
      return json(nuevo, 201)
    }
  }
  const per = r.match(/^\/periodos\/([^/]+)\/(estado|reaperturas)$/)
  if (per) {
    const p = periodos.find((x) => x.id === per[1])
    if (!p) return error(404, 'no_encontrado', 'El periodo no existe.')
    if (per[2] === 'estado' && m === 'PUT') {
      const { estado } = await cuerpo<{ estado: PeriodoContable['estado'] }>(req)
      if (p.estado === 'cerrado') return error(409, 'conflicto', 'Un periodo cerrado se reabre con una solicitud de reapertura aprobada.')
      if (p.estado === estado) return error(409, 'conflicto_estado', 'El periodo ya está en ese estado.')
      Object.assign(p, { estado, cerrado_en: estado === 'cerrado' ? ahora() : null })
      return json(p)
    }
    if (per[2] === 'reaperturas') {
      if (m === 'GET') return json(reaperturas.filter((x) => x.periodo_id === p.id))
      if (m === 'POST') {
        const d = await cuerpo<{ motivo: string; alcance?: string | null }>(req)
        if ((d.motivo ?? '').trim().length < 5) return error(422, 'validacion', 'Explique el motivo de la reapertura.')
        if (p.estado !== 'cerrado') return error(409, 'conflicto', 'Solo se reabre un periodo cerrado.')
        const nueva: Reapertura = {
          id: id(++consecutivo), periodo_id: p.id, motivo: d.motivo.trim(), alcance: d.alcance ?? null,
          solicitada_por: cuentaActual, solicitada_en: ahora(), estado: 'pendiente',
        }
        reaperturas.push(nueva)
        return json(nueva, 201)
      }
    }
  }
  const rea = r.match(/^\/reaperturas\/([^/]+)$/)
  if (rea && m === 'PUT') {
    const x = reaperturas.find((y) => y.id === rea[1])
    if (!x) return error(404, 'no_encontrado', 'La solicitud no existe.')
    if (x.estado !== 'pendiente') return error(409, 'conflicto', 'La reapertura ya se decidió.')
    if (x.solicitada_por === cuentaActual) {
      return error(409, 'conflicto', 'Quien solicita la reapertura no puede aprobarla (segregación de funciones).')
    }
    const { aprobar } = await cuerpo<{ aprobar: boolean }>(req)
    Object.assign(x, { estado: aprobar ? 'aprobada' : 'rechazada', decidida_en: ahora() })
    const p = periodos.find((y) => y.id === x.periodo_id)
    if (aprobar && p) Object.assign(p, { estado: 'abierto', cerrado_en: null })
    return json(x)
  }
  return null
}

/** Un borrador se guarda aunque no cuadre (solo exige tipo manual y cuentas existentes). */
function validarBorrador(d: BorradorComprobante): { error: Response } | { lineas: LineaAsiento[] } {
  const tipo = tipos.find((t) => t.codigo === d.tipo)
  if (!tipo || !tipo.manual) return { error: error(422, 'validacion', `El tipo ${d.tipo} no es un comprobante manual.`) }
  if (!d.fecha) return { error: error(422, 'validacion', 'Indique la fecha.') }
  const lineas: LineaAsiento[] = []
  for (const [i, l] of d.lineas.entries()) {
    const c = cuentaPorCodigo(l.cuenta)
    if (!c) return { error: error(422, 'validacion', `Línea ${i + 1}: la cuenta ${l.cuenta} no existe.`) }
    const centro = l.centro_costo ? centros.find((x) => x.codigo === l.centro_costo) : undefined
    if (l.centro_costo && !centro) return { error: error(422, 'validacion', `Línea ${i + 1}: el centro de costo ${l.centro_costo} no existe.`) }
    lineas.push({ cuenta_id: c.id, persona_id: l.persona_id ?? null, centro_costo_id: centro?.id ?? null, debito: l.debito ?? '0', credito: l.credito ?? '0', descripcion: l.descripcion ?? null })
  }
  return { lineas }
}

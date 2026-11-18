/**
 * Demo de la contabilidad (cualquier entidad con el módulo): PUC reducido con las cuentas
 * propias, centros de costo, tipos de comprobante, periodos del año (los meses pasados
 * cerrados, el anterior en revisión, el actual abierto y una reapertura pendiente que pidió
 * otra cuenta), comprobantes en borrador y contabilizados y terceros. Valida lo que valida el
 * backend: partida doble y cuentas que admiten movimiento (`regla_contable`), periodo abierto
 * al contabilizar, reversos y cuatro ojos en la reapertura. Se reinicia en cada inicio de sesión.
 */
import type {
  BorradorComprobante,
  CentroCosto,
  Comprobante,
  CuentaContable,
  LineaAsiento,
  Naturaleza,
  PeriodoContable,
  Reapertura,
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
    ], { estado: 'contabilizado', numero: 1, contabilizado_en: ahora() }),
    nuevoComprobante(23002, 'NC', dia, 'Reclasificación de gastos bancarios', [
      linea('530505', '85000.00', '0'),
      linea('11100501', '0', '85000.00'),
    ]),
    nuevoComprobante(23003, 'CC', dia, 'Pago de energía (por completar)', [
      linea('513530', '1250000.00', '0', { centro_costo_id: id(22001) }),
      linea('11100502', '0', '1200000.00'),
    ]),
  ]
  numeros = { CC: 1 }
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

/**
 * Demo de la tesorería: dos bancos y una caja; recibos (uno aplicado a una factura de venta y
 * uno sin identificar); egresos en cada estado (uno por autorizar registrado por la cuenta de
 * la sesión —no puede autorizarlo— y otro registrado por otra cuenta); facturas de proveedor
 * con retenciones; cartera por edades; libros del banco y un extracto de ejemplo para
 * conciliar. Valida lo que valida el backend: cuatro ojos al autorizar, estados, factura
 * repetida, sumas iguales al conciliar y extracto repetido. Se reinicia en cada inicio de sesión.
 */
import type {
  ConceptoRetencion,
  Conciliacion,
  CuentaTesoreria,
  Egreso,
  Extracto,
  FacturaProveedor,
  LineaLibros,
  MapeoColumnas,
  MovimientoExtracto,
  NuevaFacturaProveedor,
  NuevoEgreso,
  NuevoRecibo,
  Recibo,
} from '@/api/tipos'
import { idDeCuenta, TERCEROS } from './contabilidad'
import { cuentaDemoId } from './cuenta'
import { cuerpo, error, fechaDemo, json, type Manejador } from './http'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const hoy = () => fechaDemo()
const ahora = () => new Date().toISOString()
const dias = (d: number) => fechaDemo(d)
const n2 = (x: number) => x.toFixed(2)

let cuentas: CuentaTesoreria[] = []
let recibos: Recibo[] = []
let egresos: Egreso[] = []
let facturas: FacturaProveedor[] = []
let libros: (LineaLibros & { cuenta: string })[] = []
let extractos: (Extracto & { nombre: string })[] = []
let movimientos: (MovimientoExtracto & { cuenta: string })[] = []
let conciliaciones: Conciliacion[] = []
let mapeos: Record<string, MapeoColumnas> = {}
let consecutivo = 30000
let cuentaActual = ''

const VIGILANCIA = id(5501)
const ASEO = id(5502)
const ENERGIA = id(5503)
const PEDRO = id(5002)
const LUCIA = id(5003)

const CONCEPTOS: ConceptoRetencion[] = [
  { id: id(31001), codigo: 'servicios_generales', impuesto: 'renta', nombre: 'Servicios generales (declarantes)', base_minima_uvt: '4', tarifa: '4', cuenta_sugerida: '236525', fuente: 'Decreto 1625 de 2016', vigente_desde: '2026-01-01' },
  { id: id(31002), codigo: 'honorarios', impuesto: 'renta', nombre: 'Honorarios', base_minima_uvt: '0', tarifa: '11', cuenta_sugerida: '236515', fuente: 'Decreto 1625 de 2016', vigente_desde: '2026-01-01' },
  { id: id(31003), codigo: 'reteiva', impuesto: 'iva', nombre: 'Retención de IVA (15 %)', base_minima_uvt: '4', tarifa: '15', cuenta_sugerida: null, fuente: 'Estatuto Tributario art. 437-1', vigente_desde: '2026-01-01' },
  { id: id(31004), codigo: 'ica_servicios', impuesto: 'ica', nombre: 'ICA servicios (Bogotá)', base_minima_uvt: '4', tarifa: '0.966', cuenta_sugerida: null, municipio_dane: '11001', fuente: 'Acuerdo 65 de 2002', vigente_desde: '2026-01-01' },
]
const UVT = fechaDemo().slice(0, 4)

/** Factura de venta mínima para aplicar recibos (lo que usa la interfaz). */
const FACTURAS_VENTA = [
  { id: id(32001), persona_id: PEDRO, numero: 'FV-120', fecha: dias(-40), vencimiento: dias(-10), descripcion: 'Alquiler del salón social', subtotal: '420168.07', iva: '79831.93', total: '500000.00', pagado: '200000.00', estado: 'emitida', creada_en: ahora(), lineas: [] },
  { id: id(32002), persona_id: PEDRO, numero: 'FV-131', fecha: dias(-5), vencimiento: dias(25), descripcion: 'Parqueadero de visitantes', subtotal: '84033.61', iva: '15966.39', total: '100000.00', pagado: '0', estado: 'emitida', creada_en: ahora(), lineas: [] },
]

function cuenta(n: number, tipo: CuentaTesoreria['tipo'], nombre: string, codigo: string, extra: Partial<CuentaTesoreria> = {}): CuentaTesoreria {
  return { id: id(n), tipo, nombre, cuenta_contable_id: idDeCuenta(codigo), activa: true, creada_en: '2026-01-02T12:00:00Z', ...extra }
}

function linea(cuentaId: string, n: number, fecha: string, descripcion: string, valor: string, tipo = 'CC'): LineaLibros & { cuenta: string } {
  return { cuenta: cuentaId, comprobante_id: id(n), orden: 1, tipo, numero: n - 33000, fecha, descripcion, valor, conciliacion_id: null }
}

function egreso(n: number, estado: Egreso['estado'], persona: string, valor: string, descripcion: string, registradoPor: string, extra: Partial<Egreso> = {}): Egreso {
  return {
    id: id(n), cuenta_tesoreria_id: id(30001), persona_id: persona, fecha: dias(-3), valor, medio: 'transferencia', descripcion, estado,
    registrado_por: registradoPor, registrado_en: `${dias(-3)}T14:00:00Z`, facturas: [], gastos: [{ cuenta_id: idDeCuenta('513505'), valor, descripcion }], ...extra,
  }
}

export function iniciarTesoreria(usuario: string): void {
  cuentaActual = cuentaDemoId(usuario)
  const otra = cuentaDemoId(usuario.includes('revisor') ? 'uno' : 'revisor')
  consecutivo = 30000
  cuentas = [
    cuenta(30001, 'banco', 'Cuenta corriente principal', '11100501', { banco: 'Banco de Bogotá', numero_enmascarado: '****8901', tipo_cuenta: 'corriente' }),
    cuenta(30002, 'banco', 'Ahorros fondo de imprevistos', '11100502', { banco: 'Bancolombia', numero_enmascarado: '****4410', tipo_cuenta: 'ahorros', destinacion: 'Fondo de imprevistos (Ley 675, art. 35)' }),
    cuenta(30003, 'caja_general', 'Caja de la administración', '110505'),
  ]
  mapeos = { [id(30001)]: { fila_encabezado: 1, fecha: 'Fecha', formato_fecha: '%d/%m/%Y', descripcion: 'Descripción', referencia: 'Referencia', valor: 'Valor', separador_decimal: 'coma' } }
  recibos = [
    {
      id: id(30101), cuenta_tesoreria_id: id(30001), persona_id: PEDRO, fecha: dias(-20), valor: '200000.00', sin_aplicar: '0', medio: 'transferencia', referencia: 'TRF-88213',
      descripcion: 'Abono alquiler del salón', estado: 'registrado', comprobante_id: id(33101), registrado_en: `${dias(-20)}T15:00:00Z`,
      aplicaciones: [{ id: id(30111), factura_venta_id: id(32001), valor: '200000.00', aplicada_en: `${dias(-20)}T15:00:00Z` }],
    },
    {
      id: id(30102), cuenta_tesoreria_id: id(30001), persona_id: null, fecha: dias(-6), valor: '350000.00', sin_aplicar: '350000.00', medio: 'consignacion',
      descripcion: 'Consignación por identificar', estado: 'registrado', comprobante_id: id(33102), registrado_en: `${dias(-6)}T15:00:00Z`, aplicaciones: [],
    },
  ]
  egresos = [
    egreso(30201, 'por_autorizar', VIGILANCIA, '4032000.00', 'Pago vigilancia (registrado por usted)', cuentaActual),
    egreso(30202, 'por_autorizar', ASEO, '1850000.00', 'Pago aseo de octubre', otra),
    egreso(30203, 'autorizado', ENERGIA, '1100000.00', 'Pago energía', otra, { autorizado_por: cuentaActual, autorizado_en: `${dias(-1)}T10:00:00Z` }),
    egreso(30204, 'pagado', LUCIA, '90000.00', 'Reembolso caja menor', otra, { autorizado_por: cuentaActual, autorizado_en: `${dias(-9)}T10:00:00Z`, pagado_en: `${dias(-8)}T10:00:00Z`, comprobante_id: id(33204) }),
  ]
  facturas = [
    nuevaFactura(30301, { persona_id: VIGILANCIA, prefijo: 'FE', numero: '1024', fecha: dias(-12), vencimiento: dias(18), descripcion: 'Vigilancia de noviembre', lineas: [{ descripcion: 'Servicio de vigilancia', cuenta: '513505', centro_costo: 'ADM', base: '4200000', iva: '798000', retenciones: ['servicios_generales', 'reteiva'] }] }),
    { ...nuevaFactura(30302, { persona_id: ASEO, prefijo: 'AT', numero: '577', fecha: dias(-30), vencimiento: dias(0), descripcion: 'Aseo de octubre', lineas: [{ descripcion: 'Aseo', cuenta: '513505', base: '1850000', iva: '0', retenciones: ['servicios_generales'] }] }), estado: 'causada', comprobante_id: id(33302) },
  ]
  libros = [
    linea(id(30001), 33001, dias(-25), 'Saldo de apertura', '58000000.00', 'AP'),
    linea(id(30001), 33101, dias(-20), 'Recibo TRF-88213', '200000.00', 'RC'),
    linea(id(30001), 33102, dias(-6), 'Consignación por identificar', '350000.00', 'RC'),
    linea(id(30001), 33204, dias(-8), 'Reembolso caja menor', '-90000.00', 'CE'),
    linea(id(30001), 33205, dias(-2), 'Cheque 0045 proveedor', '-640000.00', 'CE'),
  ]
  extractos = []
  movimientos = []
  conciliaciones = []
}

function nuevaFactura(n: number, d: NuevaFacturaProveedor): FacturaProveedor {
  const lineas = d.lineas.map((l) => {
    const base = Number(l.base)
    const iva = Number(l.iva)
    const rets = (l.retenciones ?? []).map((codigo) => {
      const c = CONCEPTOS.find((x) => x.codigo === codigo)
      const sobre = c?.impuesto === 'iva' ? iva : base
      const aplica = c ? base >= Number(c.base_minima_uvt) * Number(valorUvt()) : false
      return { concepto_id: c?.id ?? '', impuesto: c?.impuesto ?? 'renta', base: n2(sobre), tarifa: c?.tarifa ?? '0', valor: n2(aplica && c ? (sobre * Number(c.tarifa)) / 100 : 0) }
    })
    return { descripcion: l.descripcion, cuenta_id: l.cuenta ? idDeCuenta(l.cuenta) : null, centro_costo_id: null, base: n2(base), iva: n2(iva), iva_descontable: l.iva_descontable ?? true, retenciones: rets }
  })
  const subtotal = lineas.reduce((t, l) => t + Number(l.base), 0)
  const iva = lineas.reduce((t, l) => t + Number(l.iva), 0)
  const ret = lineas.reduce((t, l) => t + l.retenciones.reduce((s, r) => s + Number(r.valor), 0), 0)
  return {
    id: id(n), persona_id: d.persona_id, prefijo: d.prefijo ?? '', numero: d.numero, fecha: d.fecha, vencimiento: d.vencimiento, descripcion: d.descripcion,
    cufe: d.cufe ?? null, archivo_id: d.archivo_id ?? null, subtotal: n2(subtotal), iva: n2(iva), retenciones: n2(ret), neto_pagar: n2(subtotal + iva - ret), pagado: '0',
    estado: 'registrada', excepcion_duplicado: d.excepcion_duplicado ?? null, registrada_en: ahora(), lineas,
  }
}

const valorUvt = () => '52374'

/** Lee una planilla CSV con el mapeo (fecha, descripción, referencia, valor o débito/crédito). */
function leerPlanilla(texto: string, m: MapeoColumnas) {
  const filas = texto.split(/\r?\n/).filter((f) => f.trim())
  const inicio = Math.max(1, m.fila_encabezado ?? 1)
  const sep = (filas[inicio - 1] ?? '').includes(';') ? ';' : ','
  const cabeza = (filas[inicio - 1] ?? '').split(sep).map((c) => c.trim())
  const col = (nombre?: string | null) => (nombre ? cabeza.indexOf(nombre) : -1)
  const leidos: { fecha: string; descripcion: string; referencia: string | null; valor: string }[] = []
  const errores: { fila: number; mensaje: string }[] = []
  const numero = (t: string) => {
    const limpio = m.separador_decimal === 'coma' ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
    return /^-?\d+(\.\d+)?$/.test(limpio.trim()) ? Number(limpio) : null
  }
  if (col(m.fecha) < 0 || col(m.descripcion) < 0 || (col(m.valor) < 0 && (col(m.debito) < 0 || col(m.credito) < 0))) {
    return { movimientos: [], errores: [{ fila: inicio, mensaje: 'El encabezado no tiene las columnas del mapeo.' }] }
  }
  filas.slice(inicio).forEach((f, k) => {
    const c = f.split(sep).map((x) => x.trim())
    const fila = inicio + k + 1
    const crudo = c[col(m.fecha)] ?? ''
    const p = m.formato_fecha === '%Y-%m-%d' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(crudo) : /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(crudo)
    const fecha = p ? (m.formato_fecha === '%Y-%m-%d' ? crudo : `${p[3]}-${p[2]}-${p[1]}`) : null
    let valor: number | null
    if (col(m.valor) >= 0) valor = numero(c[col(m.valor)] ?? '')
    else {
      const d = numero(c[col(m.debito)] || '0')
      const cr = numero(c[col(m.credito)] || '0')
      valor = d === null || cr === null ? null : cr - d
    }
    if (!fecha) errores.push({ fila, mensaje: `La fecha «${crudo}» no tiene el formato ${m.formato_fecha}.` })
    else if (valor === null) errores.push({ fila, mensaje: 'El valor no es un número.' })
    else leidos.push({ fecha, descripcion: c[col(m.descripcion)] ?? '', referencia: col(m.referencia) >= 0 ? (c[col(m.referencia)] ?? null) : null, valor: n2(valor) })
  })
  return { movimientos: leidos, errores }
}

function decodificar(b64: string): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  } catch {
    return ''
  }
}

const pendientesLibros = (cuentaId: string) => libros.filter((l) => l.cuenta === cuentaId && !l.conciliacion_id)

export const tesoreria: Manejador = async (req, ruta) => {
  const m = req.method
  const q = new URL(req.url).searchParams
  const fv = ruta.match(/^\/entidades\/[^/]+\/facturacion\/facturas$/)
  if (fv && m === 'GET') return json(FACTURAS_VENTA.filter((f) => !q.get('persona_id') || f.persona_id === q.get('persona_id')))
  const b = ruta.match(/^\/entidades\/[^/]+\/contabilidad\/(tesoreria|cuentas-por-pagar|cuentas-por-cobrar)(\/.*)?$/)
  if (!b) return null
  const r = `/${b[1]}${b[2] ?? ''}`

  // Cuentas
  if (r === '/tesoreria/cuentas') {
    if (m === 'GET') return json(cuentas)
    if (m === 'POST') {
      const d = await cuerpo<{ tipo: CuentaTesoreria['tipo']; nombre: string; banco?: string | null; numero_cuenta?: string | null; tipo_cuenta?: CuentaTesoreria['tipo_cuenta']; cuenta_contable: string; destinacion?: string | null }>(req)
      if (!d.nombre?.trim() || !/^\d{6,}$/.test(d.cuenta_contable ?? '')) return error(422, 'validacion', 'Escriba el nombre y la cuenta contable de movimiento que la respalda.')
      if (d.tipo === 'banco' && !d.banco?.trim()) return error(422, 'validacion', 'Indique el banco.')
      const nueva = cuenta(++consecutivo, d.tipo, d.nombre.trim(), d.cuenta_contable, {
        banco: d.banco ?? null, numero_enmascarado: d.numero_cuenta ? `****${d.numero_cuenta.slice(-4)}` : null, tipo_cuenta: d.tipo_cuenta ?? null, destinacion: d.destinacion ?? null, creada_en: ahora(),
      })
      cuentas.push(nueva)
      return json(nueva, 201)
    }
  }
  const ct = r.match(/^\/tesoreria\/cuentas\/([^/]+)(\/.*)?$/)
  if (ct) {
    const c = cuentas.find((x) => x.id === ct[1])
    if (!c) return error(404, 'no_encontrado', 'La cuenta no existe.')
    const sub = ct[2] ?? ''
    if (sub === '' && m === 'PUT') {
      const d = await cuerpo<{ nombre: string; destinacion?: string | null; activa: boolean }>(req)
      Object.assign(c, { nombre: d.nombre?.trim() || c.nombre, destinacion: d.destinacion ?? null, activa: d.activa })
      return json(c)
    }
    if (sub === '/mapeo-extracto') {
      if (m === 'GET') return json({ mapeo: mapeos[c.id] ?? null })
      if (m === 'PUT') {
        mapeos[c.id] = await cuerpo<MapeoColumnas>(req)
        return json({ mapeo: mapeos[c.id] })
      }
    }
    if (sub === '/extractos/vista-previa' && m === 'POST') {
      const d = await cuerpo<{ archivo_base64: string; mapeo?: MapeoColumnas | null }>(req)
      if (!d.mapeo) return error(422, 'validacion', 'Indique cómo leer las columnas del archivo.')
      return json(leerPlanilla(decodificar(d.archivo_base64), d.mapeo))
    }
    if (sub === '/extractos') {
      if (m === 'GET') return json(extractos.filter((x) => x.cuenta_tesoreria_id === c.id))
      if (m === 'POST') {
        const d = await cuerpo<{ nombre_archivo: string; archivo_base64: string; formato: Extracto['formato']; mapeo?: MapeoColumnas | null; saldo_inicial?: string | null; saldo_final?: string | null }>(req)
        if (!d.mapeo) return error(422, 'validacion', 'Indique cómo leer las columnas del archivo.')
        if (extractos.some((x) => x.cuenta_tesoreria_id === c.id && x.nombre === d.nombre_archivo)) return error(409, 'conflicto', 'Ese extracto ya se importó en la cuenta.')
        const leido = leerPlanilla(decodificar(d.archivo_base64), d.mapeo)
        if (leido.errores.length || !leido.movimientos.length) return error(422, 'validacion', 'El archivo tiene filas inválidas o no tiene movimientos.')
        const fechas = leido.movimientos.map((x) => x.fecha).sort()
        const ext = {
          id: id(++consecutivo), nombre: d.nombre_archivo, cuenta_tesoreria_id: c.id, desde: fechas[0] ?? hoy(), hasta: fechas.at(-1) ?? hoy(), formato: d.formato, version_lector: 'planilla-1',
          archivo_id: id(++consecutivo), saldo_inicial: d.saldo_inicial ?? null, saldo_final: d.saldo_final ?? null, cargado_en: ahora(), movimientos: leido.movimientos.length,
        }
        extractos.push(ext)
        leido.movimientos.forEach((x, k) => movimientos.push({ ...x, id: id(++consecutivo), cuenta: c.id, extracto_id: ext.id, orden: k + 1, estado: 'pendiente' }))
        mapeos[c.id] = d.mapeo
        return json(ext, 201)
      }
    }
    if (sub === '/movimientos' && m === 'GET') {
      return json(movimientos.filter((x) => x.cuenta === c.id && (!q.get('estado') || x.estado === q.get('estado')) && x.fecha >= (q.get('desde') ?? '') && x.fecha <= (q.get('hasta') ?? '9999')))
    }
    if (sub === '/libros' && m === 'GET') {
      return json(libros.filter((x) => x.cuenta === c.id && (q.get('solo_pendientes') !== 'true' || !x.conciliacion_id) && x.fecha >= (q.get('desde') ?? '') && x.fecha <= (q.get('hasta') ?? '9999')))
    }
    if (sub === '/conciliacion-automatica' && m === 'POST') {
      const d = await cuerpo<{ desde: string; hasta: string; tolerancia_dias?: number }>(req)
      const tol = Math.min(10, d.tolerancia_dias ?? 3)
      const hechas: Conciliacion[] = []
      for (const mv of movimientos.filter((x) => x.cuenta === c.id && x.estado === 'pendiente' && x.fecha >= d.desde && x.fecha <= d.hasta)) {
        const l = pendientesLibros(c.id).find((y) => y.valor === mv.valor && Math.abs(Date.parse(y.fecha) - Date.parse(mv.fecha)) <= tol * 86_400_000)
        if (!l) continue
        const con: Conciliacion = { id: id(++consecutivo), cuenta_tesoreria_id: c.id, accion: 'conciliar', modo: 'automatica', por: cuentaActual, en: ahora(), movimientos: [mv.id], lineas: [{ comprobante_id: l.comprobante_id, orden: l.orden }], deshecha: false }
        mv.estado = 'conciliado'
        l.conciliacion_id = con.id
        conciliaciones.push(con)
        hechas.push(con)
      }
      return json(hechas)
    }
    if (sub === '/conciliaciones') {
      if (m === 'GET') return json(conciliaciones.filter((x) => x.cuenta_tesoreria_id === c.id))
      if (m === 'POST') {
        const d = await cuerpo<{ movimientos: string[]; lineas: { comprobante_id: string; orden: number }[] }>(req)
        const movs = movimientos.filter((x) => d.movimientos.includes(x.id))
        const lins = libros.filter((x) => d.lineas.some((y) => y.comprobante_id === x.comprobante_id && y.orden === x.orden))
        if (movs.length !== d.movimientos.length || movs.some((x) => x.estado !== 'pendiente' || x.cuenta !== c.id) || lins.length !== d.lineas.length || lins.some((x) => x.conciliacion_id || x.cuenta !== c.id)) {
          return error(422, 'validacion', 'Una partida no es de la cuenta o ya está conciliada.')
        }
        const suma = (xs: { valor: string }[]) => xs.reduce((t, x) => t + Number(x.valor), 0)
        if (Math.abs(suma(movs) - suma(lins)) > 0.004) return error(422, 'regla_contable', 'Lo seleccionado del extracto y de los libros no suma lo mismo.')
        const con: Conciliacion = { id: id(++consecutivo), cuenta_tesoreria_id: c.id, accion: 'conciliar', modo: 'manual', por: cuentaActual, en: ahora(), movimientos: d.movimientos, lineas: d.lineas, deshecha: false }
        movs.forEach((x) => (x.estado = 'conciliado'))
        lins.forEach((x) => (x.conciliacion_id = con.id))
        conciliaciones.push(con)
        return json(con, 201)
      }
    }
    if (sub === '/informe-conciliacion' && m === 'GET') {
      const corte = q.get('corte') ?? hoy()
      const saldoLibros = libros.filter((x) => x.cuenta === c.id && x.fecha <= corte).reduce((t, x) => t + Number(x.valor), 0)
      const libP = libros.filter((x) => x.cuenta === c.id && x.fecha <= corte && !x.conciliacion_id)
      const extP = movimientos.filter((x) => x.cuenta === c.id && x.fecha <= corte && x.estado === 'pendiente')
      const ultimo = extractos.filter((x) => x.cuenta_tesoreria_id === c.id).at(-1)
      const conciliado = saldoLibros - libP.reduce((t, x) => t + Number(x.valor), 0) + extP.reduce((t, x) => t + Number(x.valor), 0)
      const saldoExtracto = ultimo?.saldo_final ?? null
      return json({
        corte, saldo_extracto: saldoExtracto, saldo_libros: n2(saldoLibros), libros_pendientes: libP, extracto_pendientes: extP, saldo_conciliado: n2(conciliado),
        diferencia: saldoExtracto === null ? null : n2(Number(saldoExtracto) - conciliado),
      })
    }
  }
  const des = r.match(/^\/tesoreria\/conciliaciones\/([^/]+)\/deshacer$/)
  if (des && m === 'POST') {
    const con = conciliaciones.find((x) => x.id === des[1])
    if (!con) return error(404, 'no_encontrado', 'La conciliación no existe.')
    if (con.deshecha || con.accion === 'deshacer') return error(409, 'conflicto', 'Esa conciliación ya se deshizo.')
    con.deshecha = true
    movimientos.filter((x) => con.movimientos.includes(x.id)).forEach((x) => (x.estado = 'pendiente'))
    libros.filter((x) => x.conciliacion_id === con.id).forEach((x) => (x.conciliacion_id = null))
    const deshacer: Conciliacion = { ...con, id: id(++consecutivo), accion: 'deshacer', deshace_a: con.id, modo: 'manual', en: ahora(), deshecha: false }
    conciliaciones.push(deshacer)
    return json(deshacer, 201)
  }
  const mov = r.match(/^\/tesoreria\/movimientos\/([^/]+)\/(partida-conciliatoria|recibo)$/)
  if (mov) {
    const x = movimientos.find((y) => y.id === mov[1])
    if (!x) return error(404, 'no_encontrado', 'El movimiento no existe.')
    if (mov[2] === 'partida-conciliatoria' && m === 'PUT') {
      const { partida } = await cuerpo<{ partida: boolean }>(req)
      if (x.estado === 'conciliado') return error(409, 'conflicto', 'El movimiento ya está conciliado.')
      x.estado = partida ? 'partida_conciliatoria' : 'pendiente'
      return json(x)
    }
    if (mov[2] === 'recibo' && m === 'POST') {
      const { descripcion } = await cuerpo<{ descripcion: string }>(req)
      if (x.estado !== 'pendiente' || Number(x.valor) <= 0) return error(409, 'conflicto', 'Solo un crédito pendiente del extracto genera un recibo.')
      const n = ++consecutivo
      const nuevo: Recibo = {
        id: id(n), cuenta_tesoreria_id: x.cuenta, persona_id: null, fecha: x.fecha, valor: x.valor, sin_aplicar: x.valor, medio: 'consignacion', referencia: x.referencia ?? null,
        descripcion: descripcion?.trim() || 'Consignación por identificar', estado: 'registrado', comprobante_id: id(n + 1), registrado_en: ahora(), aplicaciones: [],
      }
      recibos.unshift(nuevo)
      const l = { ...linea(x.cuenta, n + 1, x.fecha, nuevo.descripcion, x.valor, 'RC') }
      const con: Conciliacion = { id: id(++consecutivo), cuenta_tesoreria_id: x.cuenta, accion: 'conciliar', modo: 'manual', por: cuentaActual, en: ahora(), movimientos: [x.id], lineas: [{ comprobante_id: l.comprobante_id, orden: 1 }], deshecha: false }
      l.conciliacion_id = con.id
      libros.push(l)
      conciliaciones.push(con)
      x.estado = 'conciliado'
      return json(nuevo, 201)
    }
  }

  // Recibos
  if (r === '/tesoreria/recibos') {
    if (m === 'GET') {
      return json(recibos.filter((x) => (!q.get('persona_id') || x.persona_id === q.get('persona_id')) && (!q.get('cuenta_tesoreria_id') || x.cuenta_tesoreria_id === q.get('cuenta_tesoreria_id')) && (q.get('sin_identificar') !== 'true' || !x.persona_id)))
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevoRecibo>(req)
      const c = cuentas.find((x) => x.id === d.cuenta_tesoreria_id)
      if (!c?.activa) return error(409, 'conflicto', 'La cuenta de tesorería está inactiva.')
      if (!(Number(d.valor) > 0) || !d.descripcion?.trim()) return error(422, 'validacion', 'Indique el valor y la descripción.')
      const aplicado = (d.aplicaciones ?? []).reduce((t, a) => t + Number(a.valor), 0)
      if (aplicado > Number(d.valor) + 0.004) return error(422, 'validacion', 'Lo aplicado supera el valor del recibo.')
      for (const a of d.aplicaciones ?? []) {
        const f = FACTURAS_VENTA.find((x) => x.id === a.factura_venta_id)
        if (!f || Number(a.valor) > Number(f.total) - Number(f.pagado) + 0.004) return error(422, 'validacion', 'Una aplicación supera el saldo de su factura.')
        f.pagado = n2(Number(f.pagado) + Number(a.valor))
      }
      const n = ++consecutivo
      const nuevo: Recibo = {
        ...d, id: id(n), persona_id: d.persona_id ?? null, valor: n2(Number(d.valor)), sin_aplicar: n2(Number(d.valor) - aplicado), estado: 'registrado', comprobante_id: id(n + 1), registrado_en: ahora(),
        aplicaciones: (d.aplicaciones ?? []).map((a) => ({ id: id(++consecutivo), factura_venta_id: a.factura_venta_id, valor: n2(Number(a.valor)), aplicada_en: ahora() })),
      }
      recibos.unshift(nuevo)
      if (c.tipo === 'banco') libros.push(linea(c.id, n + 1, d.fecha, d.descripcion, nuevo.valor, 'RC'))
      return json(nuevo, 201)
    }
  }
  const rc = r.match(/^\/tesoreria\/recibos\/([^/]+)(\/aplicaciones|\/anulacion)?$/)
  if (rc) {
    const x = recibos.find((y) => y.id === rc[1])
    if (!x) return error(404, 'no_encontrado', 'El recibo no existe.')
    if (!rc[2] && m === 'GET') return json(x)
    if (rc[2] === '/aplicaciones' && m === 'POST') {
      const d = await cuerpo<{ factura_venta_id: string; valor: string }>(req)
      if (x.estado === 'anulado') return error(409, 'conflicto', 'El recibo está anulado.')
      const f = FACTURAS_VENTA.find((y) => y.id === d.factura_venta_id)
      if (!f) return error(404, 'no_encontrado', 'La factura no existe.')
      if (Number(d.valor) > Number(x.sin_aplicar) + 0.004 || Number(d.valor) > Number(f.total) - Number(f.pagado) + 0.004) return error(422, 'validacion', 'El valor supera lo que falta por aplicar o el saldo de la factura.')
      f.pagado = n2(Number(f.pagado) + Number(d.valor))
      x.sin_aplicar = n2(Number(x.sin_aplicar) - Number(d.valor))
      x.aplicaciones.push({ id: id(++consecutivo), factura_venta_id: f.id, valor: n2(Number(d.valor)), aplicada_en: ahora() })
      return json(x)
    }
    if (rc[2] === '/anulacion' && m === 'POST') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (x.estado === 'anulado') return error(409, 'conflicto', 'El recibo ya está anulado.')
      if (!motivo?.trim()) return error(422, 'validacion', 'Indique el motivo de la anulación.')
      Object.assign(x, { estado: 'anulado', motivo_anulacion: motivo.trim() })
      return json(x)
    }
  }

  // Egresos
  if (r === '/tesoreria/egresos') {
    if (m === 'GET') return json(egresos.filter((x) => !q.get('estado') || x.estado === q.get('estado')))
    if (m === 'POST') {
      const d = await cuerpo<NuevoEgreso>(req)
      if (!d.descripcion?.trim()) return error(422, 'validacion', 'Escriba la descripción del egreso.')
      if (d.medio === 'cheque' && !d.referencia?.trim()) return error(422, 'validacion', 'Con cheque, escriba su número en la referencia.')
      const total = [...(d.facturas ?? []), ...(d.gastos ?? [])].reduce((t, x) => t + Number(x.valor), 0)
      if (!(total > 0)) return error(422, 'validacion', 'Agregue al menos una factura o un gasto con valor.')
      const nuevo: Egreso = {
        ...d, id: id(++consecutivo), valor: n2(total), estado: 'por_autorizar', registrado_por: cuentaActual, registrado_en: ahora(), facturas: d.facturas ?? [],
        gastos: (d.gastos ?? []).map((g) => ({ cuenta_id: idDeCuenta(g.cuenta), persona_id: g.persona_id ?? null, centro_costo_id: null, valor: n2(Number(g.valor)), descripcion: g.descripcion })),
      }
      egresos.unshift(nuevo)
      return json(nuevo, 201)
    }
  }
  const eg = r.match(/^\/tesoreria\/egresos\/([^/]+)(\/autorizacion|\/pago|\/anulacion)?$/)
  if (eg) {
    const x = egresos.find((y) => y.id === eg[1])
    if (!x) return error(404, 'no_encontrado', 'El egreso no existe.')
    if (!eg[2] && m === 'GET') return json(x)
    if (eg[2] === '/autorizacion' && m === 'POST') {
      if (x.estado !== 'por_autorizar') return error(409, 'conflicto_estado', 'El egreso no está por autorizar.')
      if (x.registrado_por === cuentaActual) return error(409, 'conflicto', 'Quien registra el egreso no puede autorizarlo: debe hacerlo otra persona.')
      Object.assign(x, { estado: 'autorizado', autorizado_por: cuentaActual, autorizado_en: ahora() })
      return json(x)
    }
    if (eg[2] === '/pago' && m === 'POST') {
      if (x.estado !== 'autorizado') return error(409, 'conflicto_estado', 'Solo se paga un egreso autorizado.')
      const d = await cuerpo<{ fecha?: string | null }>(req)
      const n = ++consecutivo
      Object.assign(x, { estado: 'pagado', pagado_en: ahora(), comprobante_id: id(n) })
      x.facturas.forEach((p) => {
        const f = facturas.find((y) => y.id === p.factura_proveedor_id)
        if (!f) return
        f.pagado = n2(Number(f.pagado) + Number(p.valor))
        f.estado = Number(f.pagado) + 0.004 >= Number(f.neto_pagar) ? 'pagada' : 'pagada_parcial'
      })
      const c = cuentas.find((y) => y.id === x.cuenta_tesoreria_id)
      if (c?.tipo === 'banco') libros.push(linea(c.id, n, d.fecha ?? x.fecha, x.descripcion, n2(-Number(x.valor)), 'CE'))
      return json(x)
    }
    if (eg[2] === '/anulacion' && m === 'POST') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (x.estado === 'anulado' || x.estado === 'pagado') return error(409, 'conflicto_estado', 'Ese egreso ya no se puede anular.')
      if (!motivo?.trim()) return error(422, 'validacion', 'Indique el motivo de la anulación.')
      Object.assign(x, { estado: 'anulado', motivo_anulacion: motivo.trim() })
      return json(x)
    }
  }
  if (m === 'GET' && r === '/tesoreria/retenciones') return json(CONCEPTOS)
  if (m === 'GET' && r === '/tesoreria/uvt') return json([{ anio: Number(UVT), valor: valorUvt(), fuente: 'Resolución DIAN' }])

  // Cuentas por pagar
  if (r === '/cuentas-por-pagar/facturas') {
    if (m === 'GET') return json(facturas.filter((f) => (!q.get('persona_id') || f.persona_id === q.get('persona_id')) && (!q.get('estado') || f.estado === q.get('estado'))).map((f) => ({ ...f, lineas: [] })))
    if (m === 'POST') {
      const d = await cuerpo<NuevaFacturaProveedor>(req)
      if (!d.numero?.trim() || !d.lineas?.length || d.lineas.some((l) => !(Number(l.base) > 0))) return error(422, 'validacion', 'Indique el número y al menos una línea con base.')
      if (d.lineas.some((l) => (l.retenciones ?? []).some((c) => !CONCEPTOS.some((x) => x.codigo === c)))) return error(422, 'validacion', 'Un concepto de retención no está vigente.')
      const repetida = facturas.some((f) => f.persona_id === d.persona_id && f.prefijo === (d.prefijo ?? '') && f.numero === d.numero && f.estado !== 'anulada')
      if (repetida && !d.excepcion_duplicado?.trim()) return error(409, 'conflicto', `El proveedor ya registró la factura ${d.prefijo ?? ''}${d.numero}.`)
      const nueva = nuevaFactura(++consecutivo, d)
      facturas.unshift(nueva)
      return json(nueva, 201)
    }
  }
  const fp = r.match(/^\/cuentas-por-pagar\/facturas\/([^/]+)(\/causacion|\/anulacion)?$/)
  if (fp) {
    const f = facturas.find((y) => y.id === fp[1])
    if (!f) return error(404, 'no_encontrado', 'La factura no existe.')
    if (!fp[2] && m === 'GET') return json(f)
    if (fp[2] === '/causacion' && m === 'POST') {
      if (f.estado !== 'registrada') return error(409, 'conflicto_estado', 'La factura ya se causó o se anuló.')
      Object.assign(f, { estado: 'causada', comprobante_id: id(++consecutivo) })
      return json(f)
    }
    if (fp[2] === '/anulacion' && m === 'POST') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!['registrada', 'causada'].includes(f.estado)) return error(409, 'conflicto_estado', 'Una factura pagada no se anula.')
      if (!motivo?.trim()) return error(422, 'validacion', 'Indique el motivo de la anulación.')
      Object.assign(f, { estado: 'anulada', motivo_anulacion: motivo.trim() })
      return json(f)
    }
  }
  const cert = r.match(/^\/cuentas-por-pagar\/certificados\/([^/]+)(\/pdf|\/envio)?$/)
  if (cert) {
    const t = TERCEROS.find((x) => x.persona_id === cert[1])
    if (!t) return error(404, 'no_encontrado', 'El tercero no existe.')
    if (cert[2] === '/pdf') return new Response('%PDF-1.4 certificado demo', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="certificado-retenciones.pdf"' } })
    if (cert[2] === '/envio' && m === 'POST') return json({ para: 'pr***@correo.co' })
    const filas = facturas
      .filter((f) => f.persona_id === t.persona_id && f.estado !== 'anulada')
      .flatMap((f) => f.lineas.flatMap((l) => l.retenciones))
      .filter((x) => Number(x.valor) > 0)
      .map((x) => ({ impuesto: x.impuesto, concepto: CONCEPTOS.find((c) => c.id === x.concepto_id)?.nombre ?? '', tarifa: x.tarifa, base: x.base, valor: x.valor }))
    return json({
      entidad: 'Conjunto Residencial Los Robles', entidad_nit: '900123456-7', tercero: t.nombre, tercero_documento: t.documento, desde: q.get('desde') ?? '', hasta: q.get('hasta') ?? '',
      filas, total_base: n2(filas.reduce((s, x) => s + Number(x.base), 0)), total_retenido: n2(filas.reduce((s, x) => s + Number(x.valor), 0)),
    })
  }
  if (m === 'GET' && r === '/cuentas-por-cobrar/edades') {
    return json([
      { persona_id: PEDRO, nombre: 'Pedro Pérez', total: '400000.00', tramos: [{ tramo: 'corriente', saldo: '100000.00' }, { tramo: 'de_1_a_30', saldo: '300000.00' }] },
      { persona_id: LUCIA, nombre: 'Lucía Gómez', total: '1250000.00', tramos: [{ tramo: 'de_61_a_90', saldo: '250000.00' }, { tramo: 'mas_de_90', saldo: '1000000.00' }] },
    ])
  }
  return null
}

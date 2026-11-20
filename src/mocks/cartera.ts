/**
 * Demo de la cartera de la PH (`/copropiedades/{id}/cartera/…`). Los 40 bienes de
 * `./unidades` pagan una cuota ordinaria de $ 350.000 (coeficiente 2,5 % de un presupuesto
 * mensual de $ 14.000.000) más el 1 % del fondo de imprevistos. Los tres meses anteriores están
 * liquidados y el actual no (para liquidarlo). Deben los cinco primeros bienes de `bienesDemo()`
 * —T1-101 (más de 60 días), T1-102, T1-201, T2-301 y T2-302—, los demás están al día y T1-103
 * tiene un anticipo. Hay una cuota extraordinaria, una causación de intereses y tres acuerdos:
 * T1-102 vigente, T1-201 propuesto por otra cuenta (la sesión lo puede aprobar) y T2-301
 * propuesto por la cuenta de la sesión (aprobarlo da 409, cuatro ojos).
 * Se reinicia en cada sesión.
 */
import type {
  AcuerdoPago,
  BienCartera,
  CalculoMora,
  CausacionIntereses,
  CertificadoCartera,
  ConceptoCobro,
  CuentaCobro,
  CuotaExtraordinaria,
  DetalleInteres,
  FilaCarteraInicial,
  LiquidacionCartera,
  ModuloContribucion,
  NuevaCuotaExtraordinaria,
  NuevaPoliticaCartera,
  NuevoAcuerdoPago,
  NuevoCobroCartera,
  NuevoConceptoCobro,
  NuevoPresupuesto,
  NuevoRecaudo,
  NuevoRubroPresupuesto,
  Obligacion,
  PoliticaCartera,
  Presupuesto,
  Recaudo,
  Recibo,
  TipoCertificadoCartera,
} from '@/api/tipos'
import { idDeCuenta } from './contabilidad'
import { cuentaDemoId } from './cuenta'
import { cuerpo, error, fechaDemo, json, type Manejador, sinContenido } from './http'
import { reciboTesoreria } from './tesoreria'
import { bienesDemo } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const CUENTA_BANCO = id(30001)
const ADM = id(81001)
const FON = id(81002)
const EXT = id(81003)
const INT = id(81005)
const CUOTA = '350000.00'
const FONDO = '3500.00'

let conceptos: ConceptoCobro[] = []
let modulos: ModuloContribucion[] = []
let politicas: PoliticaCartera[] = []
let datosPago = new Map<string, { referencia_pago: string | null; pagador_persona_id: string | null }>()
let presupuestos: Presupuesto[] = []
let cuotas: CuotaExtraordinaria[] = []
let liquidaciones: LiquidacionCartera[] = []
let obligaciones: Obligacion[] = []
let cuentas: CuentaCobro[] = []
let recibos: (Recibo & { bien: string })[] = []
let pagos: { recibo_id: string; fecha: string; obligacion_id: string; valor: string }[] = []
let causaciones: (CausacionIntereses & { detalle: DetalleInteres[] })[] = []
let acuerdos: AcuerdoPago[] = []
let certificados: CertificadoCartera[] = []
let consecutivo = 82000
let cuentaActual = ''

const ahora = () => new Date().toISOString()
const n2 = (v: number) => v.toFixed(2)
const num = (t: string | null | undefined) => Number(t ?? 0)
const hoy = () => fechaDemo()
const periodoDe = (fecha: string) => `${fecha.slice(0, 7)}-01`
function moverPeriodo(periodo: string, meses: number): string {
  const total = Number(periodo.slice(0, 4)) * 12 + Number(periodo.slice(5, 7)) - 1 + meses
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}
const vencimientoDe = (periodo: string) => `${periodo.slice(0, 8)}${String(politicas[0]?.dia_vencimiento ?? 10).padStart(2, '0')}`
const saldoDe = (o: Obligacion) => num(o.valor) - num(o.ajustes) - num(o.aplicado)
const fijarSaldo = (o: Obligacion) => (o.saldo = n2(saldoDe(o)))
const deudor = (bienId: string) => {
  const i = bienesDemo().findIndex((b) => b.id === bienId)
  return id(5100 + Math.max(0, i))
}
const codigoBien = (bienId: string) => bienesDemo().find((b) => b.id === bienId)?.codigo ?? ''
const concepto = (cid: string) => conceptos.find((c) => c.id === cid)

function conceptoDemo(n: number, codigo: string, nombre: string, tipo: ConceptoCobro['tipo'], criterio: ConceptoCobro['criterio'], extra: Partial<ConceptoCobro> = {}): ConceptoCobro {
  return { id: id(n), codigo, nombre, tipo, criterio, tarifas: [], genera_interes: tipo === 'ordinaria' || tipo === 'extraordinaria', concepto_contable: `ph.${tipo}`, activo: true, creado_en: '2026-01-02T12:00:00Z', ...extra }
}

function nuevaObligacion(bienId: string, cid: string, periodo: string, valor: string, extra: Partial<Obligacion> = {}): Obligacion {
  const c = concepto(cid)!
  return {
    id: id(++consecutivo), bien_privado_id: bienId, concepto_cobro_id: cid, concepto_codigo: c.codigo, concepto_nombre: c.nombre, concepto_tipo: c.tipo,
    periodo, valor, vencimiento: vencimientoDe(periodo), deudor_persona_id: deudor(bienId), origen: 'liquidacion', estado: 'vigente',
    ajustes: '0.00', aplicado: '0.00', saldo: valor, ...extra,
  }
}

/** Cobros de un periodo para cada bien activo: cuota ordinaria, fondo y la extraordinaria si toca. */
function cobrosDe(periodo: string) {
  const cobros: { bien: string; codigo: string; cid: string; valor: string; cuota?: string }[] = []
  for (const b of bienesDemo().filter((x) => x.activo !== false)) {
    cobros.push({ bien: b.id, codigo: b.codigo, cid: ADM, valor: CUOTA }, { bien: b.id, codigo: b.codigo, cid: FON, valor: FONDO })
    for (const q of cuotas.filter((x) => x.estado === 'vigente')) {
      const desde = q.primer_periodo
      const hasta = moverPeriodo(desde, q.numero_cuotas - 1)
      if (periodo >= desde && periodo <= hasta) cobros.push({ bien: b.id, codigo: b.codigo, cid: q.concepto_cobro_id, valor: n2(num(q.valor_total) / q.numero_cuotas / bienesDemo().length), cuota: q.id })
    }
  }
  return cobros
}

function liquidarPeriodo(periodo: string, fecha = ahora()): LiquidacionCartera {
  const liq: LiquidacionCartera = { id: id(++consecutivo), periodo, estado: 'contabilizada', politica_id: politicas[0]!.id, presupuesto_id: presupuestos.find((p) => p.estado === 'vigente')?.id ?? null, total: '0', vencimiento: vencimientoDe(periodo), comprobante_id: id(++consecutivo), liquidada_en: fecha }
  const nuevas = cobrosDe(periodo).map((c) => nuevaObligacion(c.bien, c.cid, periodo, c.valor, { liquidacion_id: liq.id, cuota_extraordinaria_id: c.cuota ?? null }))
  liq.total = n2(nuevas.reduce((t, o) => t + num(o.valor), 0))
  obligaciones.push(...nuevas)
  for (const b of new Set(nuevas.map((o) => o.bien_privado_id))) {
    const del = nuevas.filter((o) => o.bien_privado_id === b)
    const cargos = del.reduce((t, o) => t + num(o.valor), 0)
    const anterior = obligaciones.filter((o) => o.bien_privado_id === b && o.periodo < periodo && o.estado === 'vigente').reduce((t, o) => t + saldoDe(o), 0)
    const cc: CuentaCobro = {
      id: id(++consecutivo), numero: `CB-${periodo.slice(0, 4)}-${String(consecutivo).slice(-5)}`, liquidacion_id: liq.id, bien_privado_id: b, periodo, deudor_persona_id: deudor(b),
      saldo_anterior: n2(anterior), cargos: n2(cargos), total: n2(anterior + cargos), vencimiento: liq.vencimiento, referencia_pago: datosPago.get(b)?.referencia_pago ?? null, creada_en: fecha,
    }
    cuentas.push(cc)
    del.forEach((o) => (o.cuenta_cobro_id = cc.id))
  }
  liquidaciones.unshift(liq)
  return liq
}

/** Aplica un valor a las obligaciones del bien según la política; devuelve lo aplicado y lo que sobra. */
function imputar(bienId: string, reciboId: string, valor: number, fecha: string, elegidas: string[] = []) {
  const orden = politicas[0]?.imputacion ?? 'intereses_primero'
  const pendientes = obligaciones
    .filter((o) => o.bien_privado_id === bienId && o.estado === 'vigente' && saldoDe(o) > 0.004)
    .sort((a, b) => Number(elegidas.includes(b.id)) - Number(elegidas.includes(a.id)) || (orden === 'intereses_primero' ? Number(b.origen === 'interes') - Number(a.origen === 'interes') : 0) || a.vencimiento.localeCompare(b.vencimiento))
  const aplicado: { obligacion_id: string; valor: string }[] = []
  let resto = valor
  for (const o of pendientes) {
    if (resto <= 0.004) break
    const v = Math.min(resto, saldoDe(o))
    o.aplicado = n2(num(o.aplicado) + v)
    fijarSaldo(o)
    resto -= v
    aplicado.push({ obligacion_id: o.id, valor: n2(v) })
    pagos.push({ recibo_id: reciboId, fecha, obligacion_id: o.id, valor: n2(v) })
  }
  return { aplicado, resto }
}

function recibo(bienId: string, valor: number, fecha: string, medio: Recibo['medio'], extra: Partial<Recibo> = {}): Recibo & { bien: string } {
  return {
    id: id(++consecutivo), bien: bienId, cuenta_tesoreria_id: CUENTA_BANCO, persona_id: deudor(bienId), fecha, valor: n2(valor), sin_aplicar: '0.00', medio,
    descripcion: `Pago de ${codigoBien(bienId)}`, estado: 'registrado', comprobante_id: id(++consecutivo), registrado_en: ahora(), aplicaciones: [], ...extra,
  }
}

function pagar(bienId: string, valor: number, fecha: string, medio: Recibo['medio'] = 'transferencia', elegidas: string[] = []): Recaudo {
  const r = recibo(bienId, valor, fecha, medio)
  const { aplicado, resto } = imputar(bienId, r.id, valor, fecha, elegidas)
  r.sin_aplicar = n2(resto)
  r.aplicaciones = aplicado.map((a) => ({ id: id(++consecutivo), factura_venta_id: null, valor: a.valor, aplicada_en: ahora() })) as Recibo['aplicaciones']
  recibos.unshift(r)
  return { bien_privado_id: bienId, recibo: r, aplicado, anticipo: n2(resto), descuento: null }
}

const anticiposDe = (bienId: string) => recibos.filter((r) => r.bien === bienId && r.estado !== 'anulado').reduce((t, r) => t + num(r.sin_aplicar), 0)

function estadoCuenta(bienId: string, corte = hoy()) {
  const propias = obligaciones.filter((o) => o.bien_privado_id === bienId && o.estado === 'vigente')
  const ids = new Set(propias.map((o) => o.id))
  return {
    bien: bienCartera(bienId),
    corte,
    obligaciones: propias,
    pagos: pagos.filter((p) => ids.has(p.obligacion_id)),
    saldo: n2(propias.reduce((t, o) => t + saldoDe(o), 0)),
    vencido: n2(propias.filter((o) => o.vencimiento < corte).reduce((t, o) => t + saldoDe(o), 0)),
    anticipos: n2(anticiposDe(bienId)),
  }
}

function bienCartera(bienId: string): BienCartera {
  const b = bienesDemo().find((x) => x.id === bienId)!
  const d = datosPago.get(bienId)
  return { id: b.id, codigo: b.codigo, tipo: b.tipo, area_m2: b.area_privada_m2 ?? null, activo: b.activo !== false, referencia_pago: d?.referencia_pago ?? null, pagador_persona_id: d?.pagador_persona_id ?? null, deudor_persona_id: deudor(bienId) }
}

const dias = (desde: string, hasta: string) => Math.max(0, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000))

function calcularMora(hasta: string): CalculoMora {
  const tasa = politicas[0]?.tasa_mora_mensual ? num(politicas[0].tasa_mora_mensual) * 12 : 30
  const porBien = new Map<string, DetalleInteres[]>()
  for (const o of obligaciones.filter((x) => x.estado === 'vigente' && x.origen !== 'interes' && concepto(x.concepto_cobro_id)?.genera_interes && x.vencimiento < hasta && saldoDe(x) > 0)) {
    const desde = o.vencimiento
    const d = dias(desde, hasta)
    const valor = (saldoDe(o) * (tasa / 100) * d) / 365
    if (valor < 1) continue
    porBien.set(o.bien_privado_id, [...(porBien.get(o.bien_privado_id) ?? []), { obligacion_id: o.id, obligacion_interes_id: '', desde, hasta, dias: d, base: n2(saldoDe(o)), tasa_efectiva_anual: n2(tasa), tasa_referencia_id: id(84001), valor: n2(valor) }])
  }
  const bienes = [...porBien.entries()].map(([b, detalle]) => ({ bien_privado_id: b, bien_codigo: codigoBien(b), deudor_persona_id: deudor(b), total: n2(detalle.reduce((t, x) => t + num(x.valor), 0)), detalle }))
  return { periodo: periodoDe(hasta), hasta, total: n2(bienes.reduce((t, b) => t + num(b.total), 0)), bienes }
}

function edadesDe(corte: string) {
  const vacio = () => ({ corriente: 0, de_1_a_30: 0, de_31_a_60: 0, de_61_a_90: 0, mas_de_90: 0 })
  const porBien = new Map<string, ReturnType<typeof vacio>>()
  for (const o of obligaciones.filter((x) => x.estado === 'vigente' && saldoDe(x) > 0.004)) {
    const e = porBien.get(o.bien_privado_id) ?? vacio()
    const d = dias(o.vencimiento, corte)
    const tramo = o.vencimiento >= corte ? 'corriente' : d <= 30 ? 'de_1_a_30' : d <= 60 ? 'de_31_a_60' : d <= 90 ? 'de_61_a_90' : 'mas_de_90'
    e[tramo] += saldoDe(o)
    porBien.set(o.bien_privado_id, e)
  }
  const fila = (e: ReturnType<typeof vacio>) => ({
    corriente: n2(e.corriente), de_1_a_30: n2(e.de_1_a_30), de_31_a_60: n2(e.de_31_a_60), de_61_a_90: n2(e.de_61_a_90), mas_de_90: n2(e.mas_de_90),
    total: n2(e.corriente + e.de_1_a_30 + e.de_31_a_60 + e.de_61_a_90 + e.mas_de_90),
  })
  const total = vacio()
  const bienes = [...porBien.entries()].map(([b, e]) => {
    for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += e[k]
    return { bien_privado_id: b, codigo: codigoBien(b), deudor_persona_id: deudor(b), ...fila(e) }
  }).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
  return { corte, bienes, total: { codigo: 'Total', ...fila(total) } }
}

const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
const pdf = (nombre: string) => new Response(PDF, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nombre}"`, 'X-Request-Id': 'demo' } })

/** Reinicia el demo en cada inicio de sesión (después de `iniciarUnidades`, que trae los bienes). */
export function iniciarCartera(usuario: string): void {
  consecutivo = 82000
  cuentaActual = cuentaDemoId(usuario)
  const otra = cuentaDemoId(usuario.includes('revisor') ? 'uno' : 'revisor')
  const anio = Number(hoy().slice(0, 4))
  conceptos = [
    conceptoDemo(81001, 'ADM', 'Cuota de administración', 'ordinaria', 'coeficiente'),
    conceptoDemo(81002, 'FON', 'Fondo de imprevistos', 'fondo_imprevistos', 'coeficiente'),
    conceptoDemo(81003, 'EXT', 'Cuota extraordinaria', 'extraordinaria', 'coeficiente'),
    conceptoDemo(81004, 'MUL', 'Multa por convivencia', 'multa', 'valor_fijo', { valor_fijo: '120000.00' }),
    conceptoDemo(81005, 'INT', 'Intereses de mora', 'interes_mora', 'coeficiente', { genera_interes: false }),
  ]
  modulos = [{ id: id(81101), nombre: 'Locales comerciales', descripcion: 'Bienes con acceso por la calle', activo: true, creado_en: '2026-01-02T12:00:00Z' }]
  politicas = [{
    id: id(81201), version: 1, vigente_desde: `${anio}-01-01`, dia_vencimiento: 10, redondeo: '100', pronto_pago_porcentaje: null, pronto_pago_dia: null,
    factor_mora: '1.5', tasa_mora_mensual: null, imputacion: 'intereses_primero', permite_elegir_obligacion: true, porcentaje_fondo: '1', fondo_suspendido: false, creada_en: `${anio}-01-02T12:00:00Z`,
  }]
  datosPago = new Map(bienesDemo().map((b, i) => [b.id, { referencia_pago: i === 39 ? null : String(1000 + i), pagador_persona_id: null }]))
  const rubro = (n: number, nombre: string, cuenta: string, mensual: string) => ({ id: id(n), concepto_cobro_id: ADM, cuenta_contable_id: idDeCuenta(cuenta), nombre, valores_mensuales: Array<string>(12).fill(mensual), valor_anual: n2(num(mensual) * 12) })
  const rubros = [rubro(81301, 'Vigilancia y aseo', '513505', '10500000.00'), rubro(81302, 'Acueducto', '513525', '1200000.00'), rubro(81303, 'Energía de zonas comunes', '513530', '800000.00'), rubro(81304, 'Mantenimiento de la edificación', '514510', '1500000.00')]
  presupuestos = [{ id: id(81401), anio, version: 1, estado: 'vigente', descripcion: `Presupuesto ${anio} aprobado en la asamblea ordinaria`, vigente_desde: `${anio}-01-01`, creado_en: `${anio - 1}-12-10T12:00:00Z`, total_anual: n2(rubros.reduce((t, r) => t + num(r.valor_anual), 0)), rubros }]
  const actual = periodoDe(hoy())
  cuotas = [{ id: id(81501), concepto_cobro_id: EXT, finalidad: 'Impermeabilización de la fachada', valor_total: '12000000.00', numero_cuotas: 6, primer_periodo: moverPeriodo(actual, -2), destinacion_especifica: true, estado: 'vigente', creada_en: hace(70) }]
  liquidaciones = []
  obligaciones = []
  cuentas = []
  recibos = []
  pagos = []
  for (const meses of [-3, -2, -1]) liquidarPeriodo(moverPeriodo(actual, meses), hace(-meses * 30))
  // Todos pagan todo, salvo los cinco primeros (T1-101 no paga desde hace tres meses).
  bienesDemo().forEach((b, i) => {
    if (i === 0) return
    const deuda = obligaciones.filter((o) => o.bien_privado_id === b.id).reduce((t, o) => t + saldoDe(o), 0)
    const valor = i < 5 ? deuda - (num(CUOTA) + num(FONDO)) * i * 0.5 : deuda + (i === 5 ? 200000 : 0)
    if (valor > 0) pagar(b.id, valor, fechaDemo(-5 - i))
  })
  causaciones = []
  const calculo = calcularMora(fechaDemo(-30))
  if (calculo.bienes.length) {
    const c = { id: id(++consecutivo), periodo: periodoDe(fechaDemo(-30)), hasta: fechaDemo(-30), estado: 'contabilizada' as const, total: calculo.total, comprobante_id: id(++consecutivo), causada_en: hace(30), detalle: calculo.bienes.flatMap((b) => b.detalle) }
    for (const b of calculo.bienes) obligaciones.push(nuevaObligacion(b.bien_privado_id, INT, c.periodo, b.total, { origen: 'interes', liquidacion_id: null, vencimiento: fechaDemo(-20) }))
    causaciones.push(c)
  }
  const [b1, b2, b3, b4] = bienesDemo()
  acuerdos = [
    acuerdoDemo(81601, b2!.id, 'vigente', otra, 3),
    acuerdoDemo(81602, b3!.id, 'propuesto', otra, 4),
    acuerdoDemo(81603, b4!.id, 'propuesto', cuentaActual, 2),
  ]
  void b1
  certificados = []
}

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

function acuerdoDemo(n: number, bienId: string, estado: AcuerdoPago['estado'], por: string, numero: number): AcuerdoPago {
  const deuda = estadoCuenta(bienId).saldo
  const cuota = n2(num(deuda) / numero)
  return {
    id: id(n), bien_privado_id: bienId, deudor_persona_id: deudor(bienId), fecha: fechaDemo(-10), valor: deuda, estado, observaciones: 'Acuerdo de pago con el propietario', creado_en: hace(10),
    aprobado_en: estado === 'vigente' ? hace(8) : null, cuotas: Array.from({ length: numero }, (_, i) => ({ numero: i + 1, vencimiento: fechaDemo(20 + 30 * i), valor: cuota })),
    pagado: '0.00', situacion: estado === 'vigente' ? 'al_dia' : null, propuesto_por: por,
    aprobado_por: estado === 'vigente' ? cuentaActual : null,
  }
}

/** Copia sin un campo interno del demo (lo que el contrato no devuelve). */
function sin<T extends object, K extends keyof T>(o: T, clave: K): Omit<T, K> {
  const copia: Partial<T> = { ...o }
  delete copia[clave]
  return copia as Omit<T, K>
}

export const cartera: Manejador = async (req, ruta) => {
  const b = ruta.match(/^\/copropiedades\/[^/]+\/cartera(\/.*)$/)
  if (!b) return null
  const r = b[1] ?? ''
  const m = req.method
  const q = new URL(req.url).searchParams

  // Configuración
  if (r === '/conceptos') {
    if (m === 'GET') return json([...conceptos].sort((x, y) => x.codigo.localeCompare(y.codigo)))
    if (m === 'POST') {
      const d = await cuerpo<NuevoConceptoCobro>(req)
      if (!/^[A-Z0-9_-]{1,10}$/i.test(d.codigo ?? '') || !d.nombre?.trim()) return error(422, 'validacion', 'Escriba el código (hasta 10 caracteres) y el nombre.')
      if (conceptos.some((c) => c.codigo.toUpperCase() === d.codigo.toUpperCase())) return error(409, 'conflicto', `Ya existe el concepto ${d.codigo}.`)
      if (d.criterio === 'valor_fijo' && !d.valor_fijo) return error(422, 'validacion', 'Indique el valor fijo mensual.')
      const c = conceptoDemo(++consecutivo, d.codigo.toUpperCase(), d.nombre.trim(), d.tipo, d.criterio, { valor_fijo: d.valor_fijo ?? null, tarifas: d.tarifas ?? [], genera_interes: d.genera_interes ?? false, concepto_contable: d.concepto_contable, modulo_id: d.modulo_id ?? null })
      conceptos.push(c)
      return json(c, 201)
    }
  }
  const co = r.match(/^\/conceptos\/([^/]+)$/)
  if (co && m === 'PUT') {
    const c = concepto(co[1] ?? '')
    if (!c) return error(404, 'no_encontrado', 'El concepto no existe.')
    Object.assign(c, await cuerpo<object>(req))
    return json(c)
  }
  if (r === '/modulos-contribucion') {
    if (m === 'GET') return json(modulos)
    if (m === 'POST') {
      const d = await cuerpo<{ nombre: string; descripcion?: string | null }>(req)
      if (!d.nombre?.trim()) return error(422, 'validacion', 'Escriba el nombre.')
      const mo = { id: id(++consecutivo), nombre: d.nombre.trim(), descripcion: d.descripcion ?? null, activo: true, creado_en: ahora() }
      modulos.push(mo)
      return json(mo, 201)
    }
  }
  const mo = r.match(/^\/modulos-contribucion\/([^/]+)$/)
  if (mo && m === 'PUT') {
    const x = modulos.find((y) => y.id === mo[1])
    if (!x) return error(404, 'no_encontrado', 'El módulo no existe.')
    Object.assign(x, await cuerpo<object>(req))
    return json(x)
  }
  if (r === '/politicas') {
    if (m === 'GET') return json(politicas)
    if (m === 'POST') {
      const d = await cuerpo<NuevaPoliticaCartera>(req)
      if (d.dia_vencimiento < 1 || d.dia_vencimiento > 28) return error(422, 'validacion', 'El día de vencimiento va del 1 al 28.')
      if (num(d.factor_mora) > 1.5) return error(422, 'validacion', 'La mora no puede pasar de 1,5 veces el interés bancario corriente (art. 30).')
      if (!d.fondo_suspendido && num(d.porcentaje_fondo) < 1) return error(422, 'validacion', 'El fondo de imprevistos es de al menos 1 % (art. 35).')
      if (d.pronto_pago_dia && d.pronto_pago_dia > d.dia_vencimiento) return error(422, 'validacion', 'El pronto pago no puede ir después del vencimiento.')
      const p: PoliticaCartera = { ...d, id: id(++consecutivo), version: politicas.length + 1, permite_elegir_obligacion: d.permite_elegir_obligacion ?? false, fondo_suspendido: d.fondo_suspendido ?? false, creada_en: ahora() }
      politicas.unshift(p)
      return json(p, 201)
    }
  }
  if (r === '/bienes' && m === 'GET') return json(bienesDemo().map((x) => bienCartera(x.id)))
  const dp = r.match(/^\/bienes\/([^/]+)\/(datos-pago|estado-cuenta|certificados)$/)
  if (dp) {
    const bienId = dp[1] ?? ''
    if (!bienesDemo().some((x) => x.id === bienId)) return error(404, 'no_encontrado', 'El bien no existe.')
    if (dp[2] === 'datos-pago' && m === 'PUT') {
      const d = await cuerpo<{ referencia_pago?: string | null; pagador_persona_id?: string | null }>(req)
      if (d.referencia_pago && !/^\d{1,24}$/.test(d.referencia_pago)) return error(422, 'validacion', 'La referencia de pago es numérica (1 a 24 dígitos).')
      if (d.referencia_pago && [...datosPago.entries()].some(([k, v]) => k !== bienId && v.referencia_pago === d.referencia_pago)) return error(409, 'conflicto', 'Otra unidad ya usa esa referencia de pago.')
      datosPago.set(bienId, { referencia_pago: d.referencia_pago ?? null, pagador_persona_id: d.pagador_persona_id ?? null })
      return json(bienCartera(bienId))
    }
    if (dp[2] === 'estado-cuenta' && m === 'GET') return json(estadoCuenta(bienId, q.get('corte') ?? undefined))
    if (dp[2] === 'certificados') {
      if (m === 'GET') return json(certificados.filter((c) => c.bien_privado_id === bienId))
      if (m === 'POST') {
        const { tipo } = await cuerpo<{ tipo: TipoCertificadoCartera }>(req)
        const e = estadoCuenta(bienId)
        if (tipo === 'paz_y_salvo' && num(e.saldo) > 0) return error(409, 'conflicto', `La unidad debe ${e.saldo}: no se puede emitir el paz y salvo.`)
        const c: CertificadoCartera = { id: id(++consecutivo), tipo, bien_privado_id: bienId, corte: e.corte, saldo: e.saldo, vencido: e.vencido, pdf_sha256: 'c4f1'.repeat(16), emitido_en: ahora() }
        certificados.unshift(c)
        return json({ certificado: c, codigo: `PYS-${String(consecutivo).slice(-6)}-DEMO`, pdf_base64: btoa(PDF) }, 201)
      }
    }
  }

  // Presupuesto
  if (r === '/presupuestos') {
    if (m === 'GET') return json(presupuestos.filter((p) => !q.get('anio') || String(p.anio) === q.get('anio')))
    if (m === 'POST') {
      const d = await cuerpo<NuevoPresupuesto>(req)
      return json(nuevoPresupuesto(d.anio, d.descripcion ?? null, d.rubros), 201)
    }
  }
  if (r === '/presupuestos/proyecto' && m === 'POST') {
    const d = await cuerpo<{ anio_base: number; ajuste_porcentual: string }>(req)
    const base = presupuestos.find((p) => p.anio === d.anio_base && p.estado === 'vigente')
    if (!base) return error(422, 'validacion', `No hay un presupuesto vigente de ${d.anio_base}.`)
    if (num(d.ajuste_porcentual) < -50 || num(d.ajuste_porcentual) > 100) return error(422, 'validacion', 'El ajuste va de -50 % a 100 %.')
    const f = 1 + num(d.ajuste_porcentual) / 100
    return json(nuevoPresupuesto(d.anio_base + 1, `Proyecto ${d.anio_base + 1} (+${d.ajuste_porcentual} %)`, base.rubros.map((x) => ({ ...x, valores_mensuales: x.valores_mensuales.map((v) => n2(num(v) * f)) }))), 201)
  }
  const pr = r.match(/^\/presupuestos\/([^/]+)(\/[a-z]+)?$/)
  if (pr) {
    const p = presupuestos.find((x) => x.id === pr[1])
    if (!p) return error(404, 'no_encontrado', 'El presupuesto no existe.')
    const accion = pr[2] ?? ''
    if (!accion && m === 'GET') return json(p)
    if (accion === '/rubros' && m === 'PUT') {
      if (p.estado !== 'borrador') return error(409, 'conflicto_estado', 'Solo se editan los rubros de un borrador.')
      const { rubros } = await cuerpo<{ rubros: NuevoRubroPresupuesto[] }>(req)
      const v = validarRubros(rubros)
      if (v) return v
      Object.assign(p, armarRubros(rubros))
      return json(p)
    }
    if (accion === '/aprobacion' && m === 'POST') {
      if (p.estado !== 'borrador') return error(409, 'conflicto_estado', 'El presupuesto ya está aprobado.')
      const { vigente_desde } = await cuerpo<{ vigente_desde: string }>(req)
      presupuestos.filter((x) => x.anio === p.anio && x.estado === 'vigente').forEach((x) => (x.estado = 'reemplazado'))
      Object.assign(p, { estado: 'vigente', vigente_desde })
      return json(p)
    }
    if (accion === '/ejecucion' && m === 'GET') {
      const hasta = Number(q.get('hasta_mes') ?? 12)
      return json({
        presupuesto_id: p.id, anio: p.anio, hasta_mes: hasta,
        rubros: p.rubros.map((x, i) => {
          const presupuestado = x.valores_mensuales.slice(0, hasta).reduce((t, v) => t + num(v), 0)
          const ejecutado = presupuestado * [0.97, 1.08, 0.82, 1.0][i % 4]!
          return { rubro_id: x.id, nombre: x.nombre, cuenta_contable_id: x.cuenta_contable_id, cuenta_codigo: ['513505', '513525', '513530', '514510'][i % 4] ?? '', presupuestado: n2(presupuestado), ejecutado: n2(ejecutado), diferencia: n2(presupuestado - ejecutado), presupuesto_anual: x.valor_anual }
        }),
      })
    }
  }

  // Cuotas extraordinarias
  if (r === '/cuotas-extraordinarias') {
    if (m === 'GET') return json(cuotas)
    if (m === 'POST') {
      const d = await cuerpo<NuevaCuotaExtraordinaria>(req)
      if (concepto(d.concepto_cobro_id)?.tipo !== 'extraordinaria') return error(422, 'validacion', 'Elija un concepto de tipo «cuota extraordinaria».')
      if (!d.finalidad?.trim() || num(d.valor_total) <= 0 || d.numero_cuotas < 1) return error(422, 'validacion', 'Escriba la finalidad, el valor total y el número de cuotas.')
      const c: CuotaExtraordinaria = { ...d, id: id(++consecutivo), destinacion_especifica: d.destinacion_especifica ?? false, estado: 'vigente', creada_en: ahora() }
      cuotas.unshift(c)
      return json(c, 201)
    }
  }
  const cu = r.match(/^\/cuotas-extraordinarias\/([^/]+)\/anulacion$/)
  if (cu && m === 'POST') {
    const c = cuotas.find((x) => x.id === cu[1])
    if (!c) return error(404, 'no_encontrado', 'La cuota no existe.')
    c.estado = 'anulada'
    return sinContenido()
  }

  // Liquidación
  if (r === '/liquidaciones/vista-previa' && m === 'POST') {
    const { periodo } = await cuerpo<{ periodo: string }>(req)
    const cobros = cobrosDe(periodo)
    const totales = new Map<string, number>()
    cobros.forEach((c) => totales.set(c.cid, (totales.get(c.cid) ?? 0) + num(c.valor)))
    const avisos = liquidaciones.some((l) => l.periodo === periodo && l.estado === 'contabilizada') ? [`${periodo.slice(0, 7)} ya está liquidado: liquidarlo de nuevo responde con la liquidación existente.`] : []
    if (!datosPago.get(bienesDemo()[39]?.id ?? '')?.referencia_pago) avisos.push('1 unidad no tiene referencia de pago: su cuenta de cobro sale sin ella.')
    return json({
      periodo, vencimiento: vencimientoDe(periodo), politica_id: politicas[0]!.id, presupuesto_id: presupuestos.find((p) => p.estado === 'vigente')?.id ?? null,
      total: n2(cobros.reduce((t, c) => t + num(c.valor), 0)),
      por_concepto: [...totales.entries()].map(([cid, total]) => ({ concepto_cobro_id: cid, codigo: concepto(cid)?.codigo ?? '', nombre: concepto(cid)?.nombre ?? '', total: n2(total) })),
      cobros: cobros.map((c) => ({ bien_privado_id: c.bien, bien_codigo: c.codigo, concepto_cobro_id: c.cid, concepto_codigo: concepto(c.cid)?.codigo ?? '', cuota_extraordinaria_id: c.cuota ?? null, origen: 'liquidacion', valor: c.valor, deudor_persona_id: deudor(c.bien) })),
      avisos,
    })
  }
  if (r === '/liquidaciones') {
    if (m === 'GET') return json(liquidaciones)
    if (m === 'POST') {
      const { periodo } = await cuerpo<{ periodo: string }>(req)
      if (liquidaciones.some((l) => l.periodo === periodo && l.estado === 'contabilizada')) return error(409, 'conflicto', `El periodo ${periodo.slice(0, 7)} ya está liquidado.`)
      if (periodo > periodoDe(fechaDemo(31))) return error(422, 'validacion', 'No se liquida un periodo futuro.')
      const antes = anticiposAplicables()
      const liq = liquidarPeriodo(periodo)
      const aplicados = aplicarAnticipos(antes)
      return json({ liquidacion: liq, cuentas_cobro: cuentas.filter((c) => c.liquidacion_id === liq.id), anticipos_aplicados: aplicados, aviso_fondo: false, avisos: [] }, 201)
    }
  }
  const li = r.match(/^\/liquidaciones\/([^/]+)(\/[a-z]+)?$/)
  if (li) {
    const l = liquidaciones.find((x) => x.id === li[1])
    if (!l) return error(404, 'no_encontrado', 'La liquidación no existe.')
    const accion = li[2] ?? ''
    const suyas = obligaciones.filter((o) => o.liquidacion_id === l.id)
    if (!accion && m === 'GET') return json({ liquidacion: l, obligaciones: suyas })
    if (accion === '/anulacion' && m === 'POST') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      if (l.estado === 'anulada') return error(409, 'conflicto_estado', 'La liquidación ya está anulada.')
      if (suyas.some((o) => num(o.aplicado) > 0 || num(o.ajustes) > 0)) return error(409, 'conflicto_estado', 'La liquidación tiene pagos o ajustes: corríjala con notas crédito.')
      suyas.forEach((o) => (o.estado = 'anulada'))
      Object.assign(l, { estado: 'anulada', motivo_anulacion: motivo.trim(), anulada_en: ahora() })
      return json(l)
    }
    if (accion === '/envio' && m === 'POST') {
      const total = cuentas.filter((c) => c.liquidacion_id === l.id).length
      return json({ enviadas: Math.max(0, total - 2), sin_correo: Math.min(2, total) })
    }
  }
  if (r === '/cuentas-cobro' && m === 'GET') {
    return json(cuentas.filter((c) => (!q.get('liquidacion_id') || c.liquidacion_id === q.get('liquidacion_id')) && (!q.get('bien_privado_id') || c.bien_privado_id === q.get('bien_privado_id'))).sort((a, b) => b.numero.localeCompare(a.numero)))
  }
  const ccp = r.match(/^\/cuentas-cobro\/([^/]+)\/pdf$/)
  if (ccp && m === 'GET') {
    const c = cuentas.find((x) => x.id === ccp[1])
    return c ? pdf(`${c.numero}.pdf`) : error(404, 'no_encontrado', 'La cuenta de cobro no existe.')
  }

  // Recaudos
  if (r === '/recaudos' && m === 'POST') {
    const d = await cuerpo<NuevoRecaudo>(req)
    if (!bienesDemo().some((x) => x.id === d.bien_privado_id)) return error(422, 'validacion', 'Elija la unidad.')
    if (num(d.valor) <= 0) return error(422, 'validacion', 'El valor debe ser mayor que cero.')
    if (d.obligaciones_elegidas?.length && !politicas[0]?.permite_elegir_obligacion) return error(422, 'validacion', 'La política no permite elegir qué obligaciones se pagan.')
    return json(pagar(d.bien_privado_id, num(d.valor), d.fecha, d.medio, d.obligaciones_elegidas ?? []), 201)
  }
  if (r === '/recaudos/por-referencia' && m === 'POST') {
    const deudores = bienesDemo().slice(1, 3).filter((x) => num(estadoCuenta(x.id).saldo) > 0)
    return json({ recaudos: deudores.map((x) => pagar(x.id, num(CUOTA) + num(FONDO), hoy(), 'consignacion')), sin_identificar: 1 })
  }
  const ra = r.match(/^\/recaudos\/([^/]+)\/anulacion$/)
  if (ra && m === 'POST') {
    const rec = recibos.find((x) => x.id === ra[1])
    if (!rec) return error(404, 'no_encontrado', 'El recaudo no existe.')
    const { motivo } = await cuerpo<{ motivo: string }>(req)
    if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
    if (rec.estado === 'anulado') return error(409, 'conflicto_estado', 'El recaudo ya está anulado.')
    for (const p of pagos.filter((x) => x.recibo_id === rec.id)) {
      const o = obligaciones.find((x) => x.id === p.obligacion_id)
      if (o) {
        o.aplicado = n2(num(o.aplicado) - num(p.valor))
        fijarSaldo(o)
      }
    }
    pagos = pagos.filter((x) => x.recibo_id !== rec.id)
    Object.assign(rec, { estado: 'anulado', motivo_anulacion: motivo.trim(), sin_aplicar: '0.00' })
    return json(sin(rec, 'bien'))
  }
  const ap = r.match(/^\/recibos\/([^/]+)\/aplicacion$/)
  if (ap && m === 'POST') {
    // Un anticipo de la cartera o un recibo «por identificar» de la tesorería.
    const rec = recibos.find((x) => x.id === ap[1]) ?? reciboTesoreria(ap[1] ?? '')
    if (!rec) return error(404, 'no_encontrado', 'El recibo no existe.')
    const { bien_privado_id } = await cuerpo<{ bien_privado_id: string }>(req)
    if (num(rec.sin_aplicar) <= 0) return error(409, 'conflicto_estado', 'El recibo no tiene saldo por aplicar.')
    const { aplicado, resto } = imputar(bien_privado_id, rec.id, num(rec.sin_aplicar), hoy())
    rec.sin_aplicar = n2(resto)
    rec.persona_id ??= deudor(bien_privado_id)
    return json(aplicado)
  }

  // Ajustes
  if (r === '/cobros' && m === 'POST') {
    const d = await cuerpo<NuevoCobroCartera>(req)
    if (!concepto(d.concepto_cobro_id) || num(d.valor) <= 0 || !d.descripcion?.trim()) return error(422, 'validacion', 'Elija el concepto y escriba el valor y la descripción.')
    if (concepto(d.concepto_cobro_id)?.tipo === 'ordinaria') return error(422, 'validacion', 'La cuota ordinaria se cobra en la liquidación, no a mano.')
    const o = nuevaObligacion(d.bien_privado_id, d.concepto_cobro_id, periodoDe(d.fecha), n2(num(d.valor)), { origen: 'manual', liquidacion_id: null, vencimiento: d.vencimiento, descripcion: d.descripcion.trim(), comprobante_id: id(++consecutivo) })
    obligaciones.push(o)
    return json(o, 201)
  }
  const ob = r.match(/^\/obligaciones\/([^/]+)\/(anulacion|notas-credito)$/)
  if (ob && m === 'POST') {
    const o = obligaciones.find((x) => x.id === ob[1])
    if (!o) return error(404, 'no_encontrado', 'La obligación no existe.')
    if (ob[2] === 'anulacion') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      if (o.origen !== 'manual') return error(409, 'conflicto_estado', 'Solo se anula un cobro manual; lo liquidado se corrige con una nota crédito.')
      if (num(o.aplicado) > 0 || num(o.ajustes) > 0) return error(409, 'conflicto_estado', 'El cobro tiene pagos o ajustes.')
      o.estado = 'anulada'
      return sinContenido()
    }
    const d = await cuerpo<{ valor: string; motivo: string }>(req)
    if (!d.motivo?.trim() || num(d.valor) <= 0) return error(422, 'validacion', 'Escriba el valor y el motivo.')
    if (num(d.valor) > saldoDe(o) + 0.004) return error(422, 'validacion', `La nota no puede superar el saldo (${o.saldo}).`)
    o.ajustes = n2(num(o.ajustes) + num(d.valor))
    fijarSaldo(o)
    return json({ id: id(++consecutivo), obligacion_id: o.id, tipo: 'nota_credito', valor: n2(num(d.valor)), motivo: d.motivo.trim(), comprobante_id: id(++consecutivo), creado_en: ahora() }, 201)
  }
  if (r === '/inicial' && m === 'POST') {
    const d = await cuerpo<{ filas: FilaCarteraInicial[]; solo_validar?: boolean }>(req)
    const errores: { fila: number; mensaje: string }[] = []
    d.filas.forEach((f, i) => {
      if (!bienesDemo().some((x) => x.codigo === f.bien)) errores.push({ fila: i + 1, mensaje: `No existe la unidad ${f.bien}.` })
      else if (!conceptos.some((c) => c.codigo === f.concepto)) errores.push({ fila: i + 1, mensaje: `No existe el concepto ${f.concepto}.` })
    })
    const total = n2(d.filas.reduce((t, f) => t + num(f.valor), 0))
    const cargar = !errores.length && !d.solo_validar && d.filas.length > 0
    if (cargar) {
      for (const f of d.filas) {
        const bien = bienesDemo().find((x) => x.codigo === f.bien)!
        const c = conceptos.find((x) => x.codigo === f.concepto)!
        obligaciones.push(nuevaObligacion(bien.id, c.id, f.periodo, n2(num(f.valor)), { origen: 'saldo_inicial', liquidacion_id: null, vencimiento: f.vencimiento }))
      }
    }
    return json({ filas: d.filas.length, total, errores, cargada: cargar })
  }

  // Saldos
  if (r === '/saldos' && m === 'GET') {
    const corte = q.get('corte') ?? hoy()
    return json(bienesDemo().map((x) => ({ x, e: estadoCuenta(x.id, corte) })).filter(({ e }) => num(e.saldo) > 0).map(({ x, e }) => ({ bien_privado_id: x.id, codigo: x.codigo, deudor_persona_id: deudor(x.id), saldo: e.saldo, vencido: e.vencido })))
  }
  if (r === '/edades' && m === 'GET') return json(edadesDe(q.get('corte') ?? hoy()))
  if (r === '/cuadre' && m === 'GET') {
    const total = obligaciones.filter((o) => o.estado === 'vigente').reduce((t, o) => t + saldoDe(o), 0)
    const intereses = obligaciones.filter((o) => o.estado === 'vigente' && o.origen === 'interes').reduce((t, o) => t + saldoDe(o), 0)
    return json([
      { cuenta_contable_id: id(85001), codigo: '13050501', nombre: 'Cuotas de administración por cobrar', saldo_mayor: n2(total - intereses), saldo_cartera: n2(total - intereses), diferencia: '0.00' },
      { cuenta_contable_id: id(85002), codigo: '13050502', nombre: 'Intereses de mora por cobrar', saldo_mayor: n2(intereses + 1500), saldo_cartera: n2(intereses), diferencia: '1500.00' },
    ])
  }

  // Intereses
  if (r === '/tasas-referencia' && m === 'GET') {
    return json([{ id: id(84001), modalidad: 'consumo_ordinario', vigente_desde: `${hoy().slice(0, 7)}-01`, vigente_hasta: `${hoy().slice(0, 7)}-28`, tasa_efectiva_anual: '18.76', resolucion: 'Resolución 1234 de la Superfinanciera', fuente: 'Superintendencia Financiera', creada_en: hace(15) }])
  }
  if (r === '/intereses/vista-previa' && m === 'POST') return json(calcularMora((await cuerpo<{ hasta: string }>(req)).hasta))
  if (r === '/intereses') {
    if (m === 'GET') return json(causaciones.map((c) => sin(c, 'detalle')))
    if (m === 'POST') {
      const { hasta } = await cuerpo<{ hasta: string }>(req)
      if (causaciones.some((c) => c.periodo === periodoDe(hasta) && c.estado === 'contabilizada')) return error(409, 'conflicto', `Los intereses de ${hasta.slice(0, 7)} ya se causaron.`)
      const calculo = calcularMora(hasta)
      const c = { id: id(++consecutivo), periodo: calculo.periodo, hasta, estado: 'contabilizada' as const, total: calculo.total, comprobante_id: id(++consecutivo), causada_en: ahora(), detalle: calculo.bienes.flatMap((x) => x.detalle) }
      for (const x of calculo.bienes) obligaciones.push(nuevaObligacion(x.bien_privado_id, INT, calculo.periodo, x.total, { origen: 'interes', liquidacion_id: null, vencimiento: hasta }))
      causaciones.unshift(c)
      return json({ causacion: sin(c, 'detalle'), calculo, acuerdos_revisados: 0 }, 201)
    }
  }
  const ca = r.match(/^\/intereses\/([^/]+)(\/anulacion)?$/)
  if (ca) {
    const c = causaciones.find((x) => x.id === ca[1])
    if (!c) return error(404, 'no_encontrado', 'La causación no existe.')
    const { detalle, ...causacion } = c
    if (!ca[2] && m === 'GET') return json({ causacion, detalle })
    if (ca[2] && m === 'POST') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      if (c.estado === 'anulada') return error(409, 'conflicto_estado', 'La causación ya está anulada.')
      const suyas = obligaciones.filter((o) => o.origen === 'interes' && o.periodo === c.periodo && o.estado === 'vigente')
      if (suyas.some((o) => num(o.aplicado) > 0 || num(o.ajustes) > 0)) return error(409, 'conflicto_estado', 'Hay pagos o ajustes sobre esos intereses.')
      suyas.forEach((o) => (o.estado = 'anulada'))
      Object.assign(c, { estado: 'anulada', motivo_anulacion: motivo.trim(), anulada_en: ahora() })
      return json(sin(c, 'detalle'))
    }
  }

  // Acuerdos
  if (r === '/acuerdos') {
    if (m === 'GET') return json(acuerdos.filter((a) => !q.get('bien_privado_id') || a.bien_privado_id === q.get('bien_privado_id')))
    if (m === 'POST') {
      const d = await cuerpo<NuevoAcuerdoPago>(req)
      const e = estadoCuenta(d.bien_privado_id)
      if (num(e.saldo) <= 0) return error(422, 'validacion', 'La unidad no debe nada: no hay qué acordar.')
      if (acuerdos.some((a) => a.bien_privado_id === d.bien_privado_id && (a.estado === 'propuesto' || a.estado === 'vigente'))) return error(409, 'conflicto', 'La unidad ya tiene un acuerdo propuesto o vigente.')
      if (d.numero_cuotas < 1 || d.numero_cuotas > 36) return error(422, 'validacion', 'Entre 1 y 36 cuotas.')
      const cuota = n2(num(e.saldo) / d.numero_cuotas)
      const nuevo = {
        id: id(++consecutivo), bien_privado_id: d.bien_privado_id, deudor_persona_id: deudor(d.bien_privado_id), fecha: d.fecha ?? hoy(), valor: e.saldo, estado: 'propuesto' as const,
        observaciones: d.observaciones ?? null, creado_en: ahora(), cuotas: Array.from({ length: d.numero_cuotas }, (_, i) => ({ numero: i + 1, vencimiento: moverPeriodo(d.primer_vencimiento, i).slice(0, 8) + d.primer_vencimiento.slice(8), valor: cuota })),
        pagado: '0.00', situacion: null, propuesto_por: cuentaActual, aprobado_por: null,
      }
      acuerdos.unshift(nuevo)
      return json(nuevo, 201)
    }
  }
  const ac = r.match(/^\/acuerdos\/([^/]+)\/(aprobacion|anulacion)$/)
  if (ac && m === 'POST') {
    const a = acuerdos.find((x) => x.id === ac[1])
    if (!a) return error(404, 'no_encontrado', 'El acuerdo no existe.')
    if (ac[2] === 'aprobacion') {
      if (a.estado !== 'propuesto') return error(409, 'conflicto_estado', 'El acuerdo ya no está propuesto.')
      if (a.propuesto_por === cuentaActual) return error(409, 'conflicto', 'Usted propuso este acuerdo: lo debe aprobar otra cuenta.')
      Object.assign(a, { estado: 'vigente', aprobado_en: ahora(), aprobado_por: cuentaActual, situacion: 'al_dia' })
      return json(a)
    }
    if (a.estado !== 'propuesto' && a.estado !== 'vigente') return error(409, 'conflicto_estado', 'Solo se anula un acuerdo propuesto o vigente.')
    Object.assign(a, { estado: 'anulado', cerrado_en: ahora(), situacion: null })
    return json(a)
  }

  // Integraciones
  const mor = r.match(/^\/asambleas\/([^/]+)\/morosos$/)
  if (mor && m === 'POST') {
    const morosos = bienesDemo().filter((x) => num(estadoCuenta(x.id).vencido) > 0)
    return json({ marcados: morosos.length, no_encontrados: [] })
  }
  if (r === '/reservas/restricciones-mora' && m === 'POST') {
    const { umbral } = await cuerpo<{ umbral: string }>(req)
    if (num(umbral) <= 0) return error(422, 'validacion', 'El umbral debe ser mayor que cero.')
    return json({ restringidos: bienesDemo().filter((x) => num(estadoCuenta(x.id).vencido) >= num(umbral)).length, levantadas: 0 })
  }

  // Informes
  if (r === '/informes/fondo' && m === 'GET') {
    const anio = Number(q.get('anio') ?? hoy().slice(0, 4))
    const liquidado = obligaciones.filter((o) => o.concepto_cobro_id === FON && o.estado === 'vigente' && o.periodo.startsWith(String(anio))).reduce((t, o) => t + num(o.valor), 0)
    const recaudado = obligaciones.filter((o) => o.concepto_cobro_id === FON && o.periodo.startsWith(String(anio))).reduce((t, o) => t + num(o.aplicado), 0)
    const anual = num(presupuestos.find((p) => p.anio === anio && p.estado === 'vigente')?.total_anual)
    return json({ anio, liquidado: n2(liquidado), recaudado: n2(recaudado), presupuesto_anual: n2(anual), porcentaje: n2(anual ? (liquidado / anual) * 100 : 0), llego_a_la_mitad: false, porcentaje_politica: politicas[0]?.porcentaje_fondo ?? '1', suspendido: false })
  }
  if (r === '/informes/flujo-caja' && m === 'GET') {
    const desde = periodoDe(q.get('desde') ?? hoy())
    const hasta = periodoDe(q.get('hasta') ?? hoy())
    if (hasta < desde) return error(422, 'validacion', 'El periodo final es anterior al inicial.')
    const meses: { mes: string; saldo_inicial: string; entradas: string; salidas: string; saldo_final: string }[] = []
    let saldo = 25_000_000
    for (let p = desde, i = 0; p <= hasta && i < 24; p = moverPeriodo(p, 1), i++) {
      const entradas = 13_400_000 + i * 120_000
      const salidas = 13_900_000 - i * 80_000
      meses.push({ mes: p, saldo_inicial: n2(saldo), entradas: n2(entradas), salidas: n2(salidas), saldo_final: n2(saldo + entradas - salidas) })
      saldo += entradas - salidas
    }
    return json(meses)
  }
  if (r === '/informes/asamblea' && m === 'GET') return pdf(`informe-asamblea-${q.get('anio') ?? ''}.pdf`)
  return null
}

/** Anticipos por bien antes de liquidar (para aplicarlos a lo nuevo). */
function anticiposAplicables() {
  return recibos.filter((x) => x.estado !== 'anulado' && num(x.sin_aplicar) > 0)
}

function aplicarAnticipos(lista: (Recibo & { bien: string })[]): number {
  let aplicados = 0
  for (const rec of lista) {
    const { aplicado, resto } = imputar(rec.bien, rec.id, num(rec.sin_aplicar), hoy())
    if (aplicado.length) aplicados++
    rec.sin_aplicar = n2(resto)
  }
  return aplicados
}

function validarRubros(rubros: NuevoRubroPresupuesto[]): Response | null {
  if (!rubros.length) return error(422, 'validacion', 'Agregue al menos un rubro.')
  if (rubros.some((x) => !x.nombre?.trim() || x.valores_mensuales.length !== 12)) return error(422, 'validacion', 'Cada rubro lleva nombre y doce valores mensuales.')
  return null
}

function armarRubros(rubros: NuevoRubroPresupuesto[]) {
  const armados = rubros.map((x) => ({ ...x, id: id(++consecutivo), valor_anual: n2(x.valores_mensuales.reduce((t, v) => t + num(v), 0)) }))
  return { rubros: armados, total_anual: n2(armados.reduce((t, x) => t + num(x.valor_anual), 0)) }
}

function nuevoPresupuesto(anio: number, descripcion: string | null, rubros: NuevoRubroPresupuesto[]): Presupuesto {
  const p: Presupuesto = { id: id(++consecutivo), anio, version: presupuestos.filter((x) => x.anio === anio).length + 1, estado: 'borrador', descripcion, creado_en: ahora(), ...armarRubros(rubros) }
  presupuestos.unshift(p)
  return p
}

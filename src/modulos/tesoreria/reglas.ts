/**
 * Reglas y textos de la tesorería (funciones puras). El backend decide (reglas contables,
 * retenciones vigentes, cuatro ojos); aquí se anticipa, se calcula lo que se muestra y se arma
 * la petición.
 */
import type {
  ConceptoRetencion,
  Egreso,
  EstadoEgreso,
  EstadoFacturaProveedor,
  EstadoMovimientoExtracto,
  EstadoRecibo,
  ImpuestoRetencion,
  LineaLibros,
  MedioEgreso,
  MedioRecibo,
  MovimientoExtracto,
  TipoCuentaTesoreria,
  TramoEdad,
} from '@/api/tipos'
import { puedeAprobar } from '@/composables/reglas'
import { comparar, multiplicar, porcentajeDe, restar, sumar } from '@/formato/decimales'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const TIPO_CUENTA: Record<TipoCuentaTesoreria, string> = { banco: 'Banco', caja_general: 'Caja general', caja_menor: 'Caja menor', fondo: 'Fondo' }
export const MEDIO_RECIBO: Record<MedioRecibo, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', consignacion: 'Consignación', pasarela: 'Pasarela de pagos', cheque: 'Cheque' }
export const MEDIO_EGRESO: Record<MedioEgreso, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', consignacion: 'Consignación', pse: 'PSE', cheque: 'Cheque' }
export const IMPUESTO: Record<ImpuestoRetencion, string> = { renta: 'Retención en la fuente', iva: 'Reteiva', ica: 'Reteica' }

export const ESTADO_RECIBO: Record<EstadoRecibo, { texto: string; tono: Tono }> = {
  registrado: { texto: 'Registrado', tono: 'exito' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
}

export const ESTADO_EGRESO: Record<EstadoEgreso, { texto: string; tono: Tono }> = {
  por_autorizar: { texto: 'Por autorizar', tono: 'aviso' },
  autorizado: { texto: 'Autorizado', tono: 'info' },
  pagado: { texto: 'Pagado', tono: 'exito' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
}

export const ESTADO_FACTURA: Record<EstadoFacturaProveedor, { texto: string; tono: Tono }> = {
  registrada: { texto: 'Registrada', tono: 'aviso' },
  causada: { texto: 'Causada', tono: 'info' },
  pagada_parcial: { texto: 'Pagada en parte', tono: 'info' },
  pagada: { texto: 'Pagada', tono: 'exito' },
  anulada: { texto: 'Anulada', tono: 'neutro' },
}

export const ESTADO_MOVIMIENTO: Record<EstadoMovimientoExtracto, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  conciliado: { texto: 'Conciliado', tono: 'exito' },
  partida_conciliatoria: { texto: 'Partida conciliatoria', tono: 'info' },
}

export const TRAMOS: { id: TramoEdad; texto: string }[] = [
  { id: 'corriente', texto: 'Corriente' },
  { id: 'de_1_a_30', texto: '1 a 30 días' },
  { id: 'de_31_a_60', texto: '31 a 60 días' },
  { id: 'de_61_a_90', texto: '61 a 90 días' },
  { id: 'mas_de_90', texto: 'Más de 90 días' },
]

// Egresos ------------------------------------------------------------------------------------

export type AccionEgreso = 'autorizar' | 'pagar' | 'anular'

export interface PermisosEgreso {
  registrar: boolean
  autorizar: boolean
}

/**
 * Por autorizar → autorizado (por **otra** cuenta: a quien lo registró no se le ofrece) →
 * pagado; se anula antes de pagar.
 */
export function accionesEgreso(e: Pick<Egreso, 'estado' | 'registrado_por'>, q: PermisosEgreso, cuentaId: string | null | undefined): AccionEgreso[] {
  const r: AccionEgreso[] = []
  if (e.estado === 'por_autorizar' && q.autorizar && puedeAprobar([e.registrado_por], cuentaId)) r.push('autorizar')
  if (e.estado === 'autorizado' && q.registrar) r.push('pagar')
  if ((e.estado === 'por_autorizar' || e.estado === 'autorizado') && q.registrar) r.push('anular')
  return r
}

/** ¿Lo registró la misma cuenta? (para explicar por qué no puede autorizarlo). */
export const registradoPorMi = (e: Pick<Egreso, 'registrado_por'>, cuentaId: string | null | undefined) => !!cuentaId && e.registrado_por === cuentaId

/** Valor total de un egreso: facturas que paga más gastos directos. */
export function totalEgreso(facturas: { valor: string }[], gastos: { valor: string }[]): string {
  const vals = [...facturas, ...gastos].map((x) => x.valor.trim() || '0')
  return sumar('0', ...vals)
}

// Facturas de proveedor ----------------------------------------------------------------------

export type AccionFactura = 'causar' | 'anular'

export function accionesFactura(estado: EstadoFacturaProveedor, gestiona: boolean): AccionFactura[] {
  if (!gestiona) return []
  if (estado === 'registrada') return ['causar', 'anular']
  if (estado === 'causada') return ['anular']
  return []
}

export interface LineaCalculo {
  base: string
  iva: string
  /** Códigos de los conceptos de retención elegidos (uno por impuesto). */
  retenciones: string[]
}

export interface RetencionCalculada {
  codigo: string
  impuesto: ImpuestoRetencion
  base: string
  tarifa: string
  valor: string
  /** La base no llega al mínimo en UVT: no se retiene. */
  bajoMinimo: boolean
}

/**
 * Retenciones que sugiere la interfaz (el backend las recalcula): renta e ICA sobre la base,
 * reteiva sobre el IVA; solo si la base alcanza `base_minima_uvt × UVT` del año.
 */
export function calcularRetenciones(l: LineaCalculo, conceptos: ConceptoRetencion[], valorUvt: string): RetencionCalculada[] {
  return l.retenciones.flatMap((codigo) => {
    const c = conceptos.find((x) => x.codigo === codigo)
    if (!c) return []
    const base = c.impuesto === 'iva' ? l.iva || '0' : l.base || '0'
    const minimo = multiplicar(c.base_minima_uvt, valorUvt)
    const bajoMinimo = comparar(l.base || '0', minimo) < 0
    return [{ codigo, impuesto: c.impuesto, base, tarifa: c.tarifa, valor: bajoMinimo ? '0' : porcentajeDe(base, c.tarifa), bajoMinimo }]
  })
}

/** Totales de la factura: subtotal, IVA, retenciones y neto a pagar. */
export function totalesFactura(lineas: LineaCalculo[], conceptos: ConceptoRetencion[], valorUvt: string) {
  const subtotal = sumar('0', ...lineas.map((l) => l.base || '0'))
  const iva = sumar('0', ...lineas.map((l) => l.iva || '0'))
  const retenciones = sumar('0', ...lineas.flatMap((l) => calcularRetenciones(l, conceptos, valorUvt).map((r) => r.valor)))
  return { subtotal, iva, retenciones, neto: restar(sumar(subtotal, iva), retenciones) }
}

/** Saldo por pagar de una factura (neto − pagado). */
export const porPagar = (f: { neto_pagar: string; pagado: string }) => restar(f.neto_pagar, f.pagado)

// Conciliación -------------------------------------------------------------------------------

export interface Seleccion {
  extracto: string
  libros: string
  diferencia: string
  /** Hay algo de cada lado y suman lo mismo. */
  cuadra: boolean
}

/** Totales en vivo de lo seleccionado en las dos columnas (el backend exige sumas iguales). */
export function totalSeleccion(movimientos: Pick<MovimientoExtracto, 'valor'>[], lineas: Pick<LineaLibros, 'valor'>[]): Seleccion {
  const extracto = sumar('0', ...movimientos.map((m) => m.valor))
  const libros = sumar('0', ...lineas.map((l) => l.valor))
  const diferencia = restar(extracto, libros)
  return { extracto, libros, diferencia, cuadra: movimientos.length > 0 && lineas.length > 0 && comparar(diferencia, '0') === 0 }
}

/** Clave estable de una línea de libros (comprobante + orden). */
export const claveLinea = (l: Pick<LineaLibros, 'comprobante_id' | 'orden'>) => `${l.comprobante_id}#${l.orden}`

/** Primera fila del CSV (o la del encabezado): los nombres de columna para el mapeo. */
export function encabezadosCsv(texto: string, fila = 1): string[] {
  const linea = texto.split(/\r?\n/)[Math.max(0, fila - 1)] ?? ''
  const separador = linea.includes(';') ? ';' : linea.includes('\t') ? '\t' : ','
  return linea.split(separador).map((c) => c.trim().replace(/^"|"$/g, '')).filter(Boolean)
}

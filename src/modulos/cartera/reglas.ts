/**
 * Reglas y textos de la cartera de la PH (funciones puras). El backend calcula los saldos, la
 * imputación y los intereses; aquí se resumen para mostrarlos, se validan los formularios y se
 * leen las planillas de cartera inicial.
 */
import type {
  AcuerdoPago,
  CobroPrevisto,
  CriterioDistribucion,
  EdadesBien,
  EstadoAcuerdo,
  EstadoPresupuesto,
  FilaCarteraInicial,
  MedioRecibo,
  Obligacion,
  OrdenImputacion,
  OrigenObligacion,
  Recaudo,
  TipoCertificadoCartera,
  TipoConceptoCobro,
} from '@/api/tipos'
import { puedeAprobar } from '@/composables/reglas'
import { comparar, esDecimal, sumar } from '@/formato/decimales'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const TIPO_CONCEPTO: Record<TipoConceptoCobro, string> = {
  ordinaria: 'Cuota ordinaria',
  fondo_imprevistos: 'Fondo de imprevistos',
  extraordinaria: 'Cuota extraordinaria',
  uso_bien_comun: 'Uso de bien común',
  multa: 'Multa',
  interes_mora: 'Intereses de mora',
  dano: 'Daño',
  otro: 'Otro',
}

export const CRITERIO: Record<CriterioDistribucion, string> = {
  coeficiente: 'Por coeficiente',
  modulo: 'Por módulo de contribución',
  valor_fijo: 'Valor fijo por bien',
  por_tipo_bien: 'Por tipo de bien',
  area: 'Por área',
}

export const IMPUTACION: Record<OrdenImputacion, string> = {
  intereses_primero: 'Primero los intereses, luego lo más antiguo',
  por_antiguedad: 'Lo más antiguo primero',
}

export const ORIGEN: Record<OrigenObligacion, string> = {
  liquidacion: 'Liquidación',
  cargo: 'Cargo (reserva)',
  saldo_inicial: 'Saldo inicial',
  manual: 'Cobro manual',
  interes: 'Intereses',
}

export const MEDIO: Record<MedioRecibo, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  consignacion: 'Consignación',
  pasarela: 'Pasarela de pagos',
  cheque: 'Cheque',
}

export const ESTADO_PRESUPUESTO: Record<EstadoPresupuesto, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'neutro' },
  vigente: { texto: 'Vigente', tono: 'exito' },
  reemplazado: { texto: 'Reemplazado', tono: 'info' },
}

export const ESTADO_ACUERDO: Record<EstadoAcuerdo, { texto: string; tono: Tono }> = {
  propuesto: { texto: 'Propuesto', tono: 'aviso' },
  vigente: { texto: 'Vigente', tono: 'info' },
  cumplido: { texto: 'Cumplido', tono: 'exito' },
  incumplido: { texto: 'Incumplido', tono: 'peligro' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
}

/** Situación hoy de un acuerdo vigente (aún sin guardar: se guarda al causar los intereses). */
export const SITUACION_ACUERDO: Record<string, { texto: string; tono: Tono }> = {
  al_dia: { texto: 'Al día', tono: 'exito' },
  cumplido: { texto: 'Cumplido', tono: 'exito' },
  incumplido: { texto: 'Incumplido', tono: 'peligro' },
}

export const TIPO_CERTIFICADO: Record<TipoCertificadoCartera, string> = {
  paz_y_salvo: 'Paz y salvo',
  deuda: 'Certificado de deuda',
}

/** Columnas de la cartera por edades, en orden. */
export const EDADES: { clave: keyof Pick<EdadesBien, 'corriente' | 'de_1_a_30' | 'de_31_a_60' | 'de_61_a_90' | 'mas_de_90'>; texto: string }[] = [
  { clave: 'corriente', texto: 'Corriente' },
  { clave: 'de_1_a_30', texto: '1 a 30 días' },
  { clave: 'de_31_a_60', texto: '31 a 60' },
  { clave: 'de_61_a_90', texto: '61 a 90' },
  { clave: 'mas_de_90', texto: 'Más de 90' },
]

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** El periodo (primer día del mes) de una fecha `YYYY-MM-DD`. */
export const periodoDe = (fecha: string) => `${fecha.slice(0, 7)}-01`

/** `2026-11-01` → «noviembre de 2026». */
export function textoPeriodo(periodo: string): string {
  const mes = MESES[Number(periodo.slice(5, 7)) - 1]
  return mes ? `${mes} de ${periodo.slice(0, 4)}` : periodo
}

/** El periodo siguiente o anterior (`desplazamiento` en meses). */
export function moverPeriodo(periodo: string, desplazamiento: number): string {
  const total = Number(periodo.slice(0, 4)) * 12 + Number(periodo.slice(5, 7)) - 1 + desplazamiento
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

// Liquidación ----------------------------------------------------------------------------------

/** La vista previa resumida por bien (código y total de sus cobros), mayor primero. */
export function cobrosPorBien(cobros: CobroPrevisto[]): { bienId: string; codigo: string; total: string; conceptos: string[] }[] {
  const porBien = new Map<string, { bienId: string; codigo: string; total: string; conceptos: string[] }>()
  for (const c of cobros) {
    const actual = porBien.get(c.bien_privado_id) ?? { bienId: c.bien_privado_id, codigo: c.bien_codigo, total: '0', conceptos: [] }
    actual.total = sumar(actual.total, c.valor)
    if (!actual.conceptos.includes(c.concepto_codigo)) actual.conceptos.push(c.concepto_codigo)
    porBien.set(c.bien_privado_id, actual)
  }
  return [...porBien.values()].sort((a, b) => comparar(b.total, a.total) || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
}

// Recaudos -------------------------------------------------------------------------------------

/**
 * Lo que resultó de un recaudo en palabras: cuánto se aplicó, a cuántas obligaciones, el
 * descuento por pronto pago y lo que quedó como anticipo. `formato` da forma a los montos.
 */
export function resumenRecaudo(r: Pick<Recaudo, 'aplicado' | 'anticipo' | 'descuento'>, formato: (monto: string) => string = (m) => m): string {
  const aplicado = sumar('0', ...r.aplicado.map((a) => a.valor))
  const n = r.aplicado.length
  const partes = [n ? `se aplicaron ${formato(aplicado)} a ${n} ${n === 1 ? 'obligación' : 'obligaciones'}` : 'no había obligaciones por aplicar']
  if (r.descuento && comparar(r.descuento, '0') > 0) partes.push(`ganó ${formato(r.descuento)} de pronto pago`)
  if (comparar(r.anticipo, '0') > 0) partes.push(`quedan ${formato(r.anticipo)} como anticipo`)
  return partes.join('; ')
}

/** Obligaciones con saldo (las que se pueden pagar, ajustar o elegir en un recaudo). */
export const conSaldo = (lista: Obligacion[]) => lista.filter((o) => o.estado === 'vigente' && comparar(o.saldo, '0') > 0)

// Acuerdos -------------------------------------------------------------------------------------

/**
 * Qué se puede hacer con un acuerdo: aprobar (`cartera.liquidar`) uno propuesto por **otra**
 * cuenta (cuatro ojos; el 409 del backend sigue siendo la garantía); anular (`cartera.ajustar`)
 * uno propuesto o vigente.
 */
export function accionesAcuerdo(
  a: Pick<AcuerdoPago, 'estado' | 'propuesto_por'>,
  p: { aprobar: boolean; anular: boolean },
  cuentaId: string | null,
): ('aprobar' | 'anular')[] {
  const r: ('aprobar' | 'anular')[] = []
  if (a.estado === 'propuesto' && p.aprobar && puedeAprobar([a.propuesto_por], cuentaId)) r.push('aprobar')
  if ((a.estado === 'propuesto' || a.estado === 'vigente') && p.anular) r.push('anular')
  return r
}

// Presupuesto ----------------------------------------------------------------------------------

/** Doce valores mensuales iguales a partir del valor anual (el último absorbe el redondeo). */
export function repartirAnual(anual: string): string[] {
  if (!esDecimal(anual.trim())) return Array<string>(12).fill('0')
  const centavos = Math.round(Number(anual.trim()) * 100)
  const base = Math.floor(centavos / 12)
  const meses = Array<number>(12).fill(base)
  meses[11] = centavos - base * 11
  return meses.map((c) => (c / 100).toFixed(2))
}

/** Total de los valores mensuales de un rubro. */
export const totalMeses = (valores: string[]) => sumar('0', ...valores.map((v) => (esDecimal(v.trim()) ? v.trim() : '0')))

// Cartera inicial ------------------------------------------------------------------------------

export interface FilaLeida {
  fila: number
  datos: FilaCarteraInicial | null
  error: string | null
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Lee la planilla de cartera inicial pegada como texto (una fila por línea, separada por `;`,
 * coma o tabulador): bien, concepto, periodo, valor, vencimiento. Ignora una primera fila de
 * encabezados. El backend la valida de nuevo.
 */
export function leerCarteraInicial(texto: string): FilaLeida[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lineas[0] && /bien/i.test(lineas[0]) && /concepto/i.test(lineas[0])) lineas.shift()
  return lineas.map((linea, i) => {
    const [bien, concepto, periodo, valor, vencimiento] = linea.split(/[;\t]|,(?=\s*\S)/).map((c) => c.trim())
    const fila = i + 1
    if (!bien || !concepto) return { fila, datos: null, error: 'Falta el bien o el concepto.' }
    if (!periodo || !FECHA.test(periodo) || !vencimiento || !FECHA.test(vencimiento)) return { fila, datos: null, error: 'Periodo y vencimiento van como AAAA-MM-DD.' }
    if (!valor || !esDecimal(valor) || comparar(valor, '0') <= 0) return { fila, datos: null, error: 'El valor debe ser un número mayor que cero (punto decimal).' }
    return { fila, datos: { bien: bien.toUpperCase(), concepto: concepto.toUpperCase(), periodo, valor, vencimiento }, error: null }
  })
}

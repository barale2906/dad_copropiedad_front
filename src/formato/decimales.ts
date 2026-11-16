/**
 * Montos, porcentajes y coeficientes. El backend los envía como **texto decimal**
 * (`"150000.00"`); se calculan con `decimal.js-light` y nunca con `Number()`, que pierde
 * precisión.
 */
import DecimalBase from 'decimal.js-light'

/** Copia propia: 40 cifras y sin notación exponencial (coeficientes con muchos ceros). */
const Decimal = DecimalBase.clone({ precision: 40, toExpNeg: -40, toExpPos: 40 })
type Decimal = InstanceType<typeof Decimal>

const PATRON = /^-?\d+(\.\d+)?$/

/** ¿Es texto decimal con punto, como el que envía y espera el backend? */
export function esDecimal(texto: string): boolean {
  return PATRON.test(texto)
}

function dec(texto: string): Decimal {
  if (!esDecimal(texto)) throw new RangeError(`Decimal inválido: ${texto}`)
  return new Decimal(texto)
}

/** Separa miles con punto y decimales con coma (formato colombiano). */
function agrupar(fijo: string): string {
  const negativo = fijo.startsWith('-')
  const [entero = '0', fraccion] = (negativo ? fijo.slice(1) : fijo).split('.')
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negativo ? '-' : ''}${conMiles}${fraccion ? `,${fraccion}` : ''}`
}

/** `"150000.5"` → `"$ 150.000,50"`; negativos: `"-$ 1.000,00"`. */
export function moneda(texto: string, decimales = 2): string {
  const f = agrupar(dec(texto).toFixed(decimales))
  return f.startsWith('-') ? `-$ ${f.slice(1)}` : `$ ${f}`
}

/** `"19"` → `"19,00 %"` (el texto ya es el porcentaje, no la fracción). */
export function porcentaje(texto: string, decimales = 2): string {
  return `${agrupar(dec(texto).toFixed(decimales))} %`
}

/** Coeficiente de copropiedad: `"0.00523000"` → `"0,523000 %"` (seis decimales). */
export function coeficiente(texto: string): string {
  return `${agrupar(dec(texto).times(100).toFixed(6))} %`
}

/** Suma textos decimales sin perder precisión: `sumar("0.1", "0.2")` → `"0.3"`. */
export function sumar(...textos: string[]): string {
  return textos.reduce((t, x) => t.plus(dec(x)), new Decimal(0)).toString()
}

export function restar(a: string, b: string): string {
  return dec(a).minus(dec(b)).toString()
}

/** -1, 0 o 1, como `a` es menor, igual o mayor que `b`. */
export function comparar(a: string, b: string): -1 | 0 | 1 {
  const c = dec(a).comparedTo(dec(b))
  return c < 0 ? -1 : c > 0 ? 1 : 0
}

/**
 * Lo que escribe el usuario (`"1.234.567,5"`, `"1234567.5"`, `"$ 1.000"`) → texto decimal para
 * el backend (`"1234567.5"`), o `null` si no es un número válido. Con coma, la coma es el
 * separador decimal; sin coma, un punto seguido de exactamente tres cifras se toma como miles.
 */
export function leerDecimal(entrada: string, decimalesMaximos = 2): string | null {
  let t = entrada.replace(/[$\s]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!esDecimal(t)) return null
  if ((t.split('.')[1]?.length ?? 0) > decimalesMaximos) return null
  return new Decimal(t).toString()
}

/** Reglas de los cuadros de coeficientes (funciones puras, siempre en texto decimal). */
import type { EstadoCuadro } from '@/api/tipos'
import { comparar, esDecimal, restar, sumar } from '@/formato/decimales'

type Tono = 'exito' | 'aviso' | 'info' | 'neutro'

export const ESTADO_CUADRO: Record<EstadoCuadro, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'aviso' },
  vigente: { texto: 'Vigente', tono: 'exito' },
  historico: { texto: 'Histórico', tono: 'neutro' },
}

/** ¿Es un coeficiente admisible? Texto decimal entre 0 y 1 (incluidos). */
export function coeficienteValido(texto: string): boolean {
  const t = texto.trim()
  return esDecimal(t) && comparar(t, '0') >= 0 && comparar(t, '1') <= 0
}

export interface RevisionLocal {
  /** Suma de los coeficientes válidos (texto decimal). */
  suma: string
  /** Lo que falta para 1 (negativo si sobra). */
  diferencia: string
  /** El cuadro suma exactamente 1 y no tiene filas inválidas. */
  valido: boolean
  /** Índices de las filas con un valor que no es un coeficiente. */
  invalidas: number[]
}

/** Suma y diferencia frente a 1, en vivo mientras se edita (el backend vuelve a revisar). */
export function revisar(valores: string[]): RevisionLocal {
  const invalidas = valores.flatMap((v, i) => (coeficienteValido(v) ? [] : [i]))
  const suma = sumar(...valores.filter((v) => coeficienteValido(v)).map((v) => v.trim()))
  const diferencia = restar('1', suma)
  return { suma, diferencia, valido: invalidas.length === 0 && comparar(diferencia, '0') === 0, invalidas }
}

/** «Falta 0,0001» / «Sobra 0,0002» / «Suma exactamente 1». */
export function textoDiferencia(diferencia: string): string {
  const c = comparar(diferencia, '0')
  if (c === 0) return 'Suma exactamente 1'
  const valor = (c > 0 ? diferencia : restar('0', diferencia)).replace('.', ',')
  return c > 0 ? `Falta ${valor}` : `Sobra ${valor}`
}

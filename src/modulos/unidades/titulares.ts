/** Reglas de los titulares de un bien (funciones puras). */
import type { TipoTitularidad } from '@/api/tipos'
import { comparar, esDecimal, sumar } from '@/formato/decimales'

export const TIPO_TITULARIDAD: Record<TipoTitularidad, string> = {
  propietario: 'Propietario',
  nudo_propietario: 'Nudo propietario',
  usufructuario: 'Usufructuario',
  fideicomiso: 'Fideicomiso',
  leasing: 'Leasing',
}

/** Clase de derecho: cada clase debe sumar 100 % por separado. */
const CLASE: Record<TipoTitularidad, string> = {
  propietario: 'propiedad plena',
  fideicomiso: 'propiedad plena',
  leasing: 'propiedad plena',
  nudo_propietario: 'nuda propiedad',
  usufructuario: 'usufructo',
}

export interface FilaTitular {
  tipo: TipoTitularidad
  porcentaje: string
  es_representante: boolean
}

/** Suma por clase de derecho (texto decimal), solo con porcentajes válidos. */
export function sumasPorClase(filas: FilaTitular[]): Record<string, string> {
  const grupos: Record<string, string[]> = {}
  for (const f of filas) {
    const p = f.porcentaje.trim().replace(',', '.')
    if (esDecimal(p)) (grupos[CLASE[f.tipo]] ??= []).push(p)
  }
  return Object.fromEntries(Object.entries(grupos).map(([c, ps]) => [c, sumar(...ps)]))
}

/** Errores para mostrar antes de enviar (vacío = válidos). */
export function validarTitulares(filas: FilaTitular[]): string[] {
  if (filas.length === 0) return ['Agregue al menos un titular.']
  const errores: string[] = []
  filas.forEach((f, i) => {
    const p = f.porcentaje.trim().replace(',', '.')
    if (!esDecimal(p) || comparar(p, '0') <= 0 || comparar(p, '100') > 0) {
      errores.push(`Titular ${i + 1}: el porcentaje debe estar entre 0 y 100.`)
    }
  })
  for (const [clase, suma] of Object.entries(sumasPorClase(filas))) {
    if (comparar(suma, '100') !== 0) errores.push(`Los titulares de ${clase} suman ${suma.replace('.', ',')} %: deben sumar 100 %.`)
  }
  const representantes = filas.filter((f) => f.es_representante).length
  if (representantes !== 1) errores.push('Marque exactamente un representante del bien.')
  return errores
}

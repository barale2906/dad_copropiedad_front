/**
 * Textos tributarios compartidos (terceros, perfil, facturación) y el dígito de verificación del
 * NIT (funciones puras).
 */
import type { CanalFacturacion, RegimenIva, ResponsabilidadFiscal, TipoDocumento, TipoPersona } from '@/api/tipos'

export const TIPO_PERSONA: Record<TipoPersona, string> = { natural: 'Persona natural', juridica: 'Persona jurídica' }

export const TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad',
  RC: 'Registro civil',
  PA: 'Pasaporte',
  PPT: 'Permiso por protección temporal',
  NIT: 'NIT',
}

export const REGIMEN_IVA: Record<RegimenIva, string> = { responsable: 'Responsable de IVA', no_responsable: 'No responsable de IVA', simple: 'Régimen simple' }

/** Responsabilidades del RUT que usa la facturación electrónica (casilla 53). */
export const RESPONSABILIDAD: Record<ResponsabilidadFiscal, string> = {
  'O-13': 'O-13 Gran contribuyente',
  'O-15': 'O-15 Autorretenedor',
  'O-23': 'O-23 Agente de retención IVA',
  'O-47': 'O-47 Régimen simple de tributación',
  'R-99-PN': 'R-99-PN No aplica (otros)',
}

export const CANAL_FACTURACION: Record<CanalFacturacion, string> = {
  ninguno: 'No factura electrónicamente',
  proveedor: 'Con un proveedor tecnológico',
  propio: 'Con el motor propio de DAD',
}

const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

/** Dígito de verificación del NIT (algoritmo de la DIAN, módulo 11); `null` si no son dígitos. */
export function digitoVerificacion(nit: string): number | null {
  const limpio = nit.replace(/[\s.-]/g, '')
  if (!/^\d{1,15}$/.test(limpio)) return null
  const suma = [...limpio].reverse().reduce((t, d, i) => t + Number(d) * (PESOS[i] ?? 0), 0)
  const resto = suma % 11
  return resto > 1 ? 11 - resto : resto
}

/** «900123456» → «900.123.456-8» (con NIT) o el documento con miles (otros tipos). */
export function documentoLegible(documento: string | null | undefined, tipo?: TipoDocumento | null): string {
  if (!documento) return 'Sin documento'
  const conMiles = documento.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (tipo !== 'NIT') return conMiles
  const dv = digitoVerificacion(documento)
  return dv === null ? documento : `${conMiles}-${dv}`
}

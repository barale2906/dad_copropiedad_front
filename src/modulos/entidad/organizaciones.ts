/** Reglas y textos de organizaciones y contratos de servicio (funciones puras). */
import type { NaturalezaOrganizacion, TipoOrganizacion } from '@/api/tipos'

export const TIPO_ORGANIZACION: Record<TipoOrganizacion, string> = {
  administradora: 'Administradora',
  contable: 'Firma contable',
  revisoria_fiscal: 'Revisoría fiscal',
  seguridad: 'Seguridad y vigilancia',
  aseo: 'Aseo',
  mantenimiento: 'Mantenimiento',
  anunciante: 'Anunciante',
  otro: 'Otro',
}

export const NATURALEZA: Record<NaturalezaOrganizacion, string> = {
  juridica: 'Persona jurídica',
  natural_con_rut: 'Persona natural con RUT',
}

/** NIT sin puntos ni espacios (`900.123.456-8` → `900123456-8`); `null` si no parece un NIT. */
export function normalizarNit(nit: string): string | null {
  const limpio = nit.replace(/[.\s]/g, '')
  return /^\d{6,10}(-\d)?$/.test(limpio) ? limpio : null
}

/** Los tipos del contrato que el cliente conoce (la ficha los trae como texto). */
export function tiposConocidos(tipos: string[]): TipoOrganizacion[] {
  return tipos.filter((t): t is TipoOrganizacion => t in TIPO_ORGANIZACION)
}

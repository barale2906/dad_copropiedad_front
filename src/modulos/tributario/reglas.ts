/** Reglas y textos del módulo tributario (funciones puras). El backend decide; aquí se anticipa y se muestra. */
import type { CriterioBeneficiario, NuevaResolucion, ParametrosPerfil, Resolucion, TipoNumeracion } from '@/api/tipos'
import { sumarDias } from '@/formato/fechas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const TIPO_NUMERACION: Record<TipoNumeracion, string> = { factura: 'Factura electrónica', documento_soporte: 'Documento soporte', contingencia: 'Contingencia' }
export const CRITERIO: Record<CriterioBeneficiario, string> = {
  propiedad: 'Propiedad (participación de 5 % o más)',
  control: 'Control por otros medios',
  beneficio: 'Beneficio de operaciones',
}

/** Obligaciones del perfil que se marcan con casillas (en el orden del RUT). */
export const OBLIGACIONES: { clave: keyof Omit<ParametrosPerfil, 'responsabilidades' | 'municipios_ica' | 'actividades_ica' | 'canal_facturacion'>; texto: string }[] = [
  { clave: 'contribuyente_renta', texto: 'Contribuyente del impuesto de renta' },
  { clave: 'responsable_iva', texto: 'Responsable de IVA' },
  { clave: 'agente_retenedor', texto: 'Agente de retención' },
  { clave: 'autorretenedor', texto: 'Autorretenedor' },
  { clave: 'gran_contribuyente', texto: 'Gran contribuyente' },
  { clave: 'facturador_electronico', texto: 'Facturador electrónico' },
  { clave: 'obligado_rub', texto: 'Obligado al Registro Único de Beneficiarios (RUB)' },
]

export const parametrosVacios = (): ParametrosPerfil => ({
  responsabilidades: [], agente_retenedor: false, responsable_iva: false, gran_contribuyente: false, autorretenedor: false,
  contribuyente_renta: true, facturador_electronico: false, obligado_rub: false, municipios_ica: [], actividades_ica: [], canal_facturacion: 'ninguno',
})

/** «11001, 05001» → `['11001', '05001']` con `digitos` dígitos cada uno (sin repetir). */
export function leerCodigos(texto: string, digitos: number): { codigos: string[]; invalidos: string[] } {
  const partes = [...new Set(texto.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))]
  const patron = new RegExp(`^\\d{${digitos}}$`)
  return { codigos: partes.filter((x) => patron.test(x)), invalidos: partes.filter((x) => !patron.test(x)) }
}

/**
 * Avisos de coherencia del perfil con el RUT (el backend valida con `validacion`): gran
 * contribuyente lleva O-13, autorretenedor O-15, el régimen simple O-47 y facturar con el
 * motor propio exige ser facturador electrónico.
 */
export function avisosPerfil(p: ParametrosPerfil): string[] {
  const r = p.responsabilidades ?? []
  const avisos: string[] = []
  if (p.gran_contribuyente && !r.includes('O-13')) avisos.push('Gran contribuyente: marque la responsabilidad O-13.')
  if (p.autorretenedor && !r.includes('O-15')) avisos.push('Autorretenedor: marque la responsabilidad O-15.')
  if (p.canal_facturacion !== 'ninguno' && !p.facturador_electronico) avisos.push('Para facturar electrónicamente marque «Facturador electrónico».')
  if ((p.municipios_ica?.length ?? 0) > 0 && !(p.actividades_ica?.length ?? 0)) avisos.push('Indique las actividades CIIU con las que declara ICA.')
  return avisos
}

export type EstadoResolucion = 'activa' | 'por_vencer' | 'vencida' | 'futura' | 'inactiva'

export const ESTADO_RESOLUCION: Record<EstadoResolucion, { texto: string; tono: Tono }> = {
  activa: { texto: 'Activa', tono: 'exito' },
  por_vencer: { texto: 'Vence pronto', tono: 'aviso' },
  vencida: { texto: 'Vencida', tono: 'peligro' },
  futura: { texto: 'Aún no rige', tono: 'info' },
  inactiva: { texto: 'Inactiva', tono: 'neutro' },
}

/** Estado de una resolución a la fecha `hoy` (`YYYY-MM-DD`); «vence pronto» = 30 días o menos. */
export function estadoResolucion(r: Pick<Resolucion, 'activa' | 'vigente_desde' | 'vigente_hasta'>, hoy: string): EstadoResolucion {
  if (r.vigente_hasta < hoy) return 'vencida'
  if (!r.activa) return 'inactiva'
  if (r.vigente_desde > hoy) return 'futura'
  return r.vigente_hasta <= sumarDias(hoy, 30) ? 'por_vencer' : 'activa'
}

/** Validación previa de una resolución nueva (rango, prefijo y fechas). */
export function problemaResolucion(r: NuevaResolucion): string | null {
  if (!/^[A-Z0-9]{0,4}$/.test(r.prefijo)) return 'El prefijo lleva hasta cuatro letras o dígitos en mayúscula.'
  if (!r.numero_resolucion.trim()) return 'Escriba el número de la resolución.'
  if (!(r.desde >= 1) || !(r.hasta > r.desde)) return 'El rango va de un número inicial a uno mayor.'
  if (!r.fecha_resolucion || !r.vigente_desde || !r.vigente_hasta) return 'Indique las fechas de la resolución y su vigencia.'
  if (r.vigente_hasta <= r.vigente_desde) return 'La vigencia termina después de empezar.'
  return null
}

/** CSV con `;` (como la exógena) a partir de filas de texto. */
export function aCsv(filas: (string | number)[][]): string {
  return filas.map((f) => f.map((c) => (/[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(';')).join('\n')
}

/** Reglas y textos del archivo de la entidad (funciones puras). */
import type { FiltrosArchivos } from '@/api/archivos'
import type { ClasificacionArchivo, Permiso, TipoArchivo } from '@/api/tipos'
import { aUtc, sumarDias } from '@/formato/fechas'

export const CLASIFICACION: Record<ClasificacionArchivo, { texto: string; ayuda: string; tono: 'info' | 'neutro' | 'aviso' | 'peligro' }> = {
  publico: { texto: 'Público', ayuda: 'Se puede compartir con residentes y terceros.', tono: 'info' },
  interno: { texto: 'Interno', ayuda: 'Solo para quienes trabajan en la entidad.', tono: 'neutro' },
  personal: { texto: 'Personal', ayuda: 'Tiene datos de una persona (Ley 1581).', tono: 'aviso' },
  sensible: { texto: 'Sensible', ayuda: 'Datos sensibles: salud, biometría, menores…', tono: 'peligro' },
}

/** Tipos que admite el archivo (el backend los verifica por el contenido). */
export const ACEPTA = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic'

const NOMBRE_TIPO: Record<TipoArchivo, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Imagen JPEG',
  'image/png': 'Imagen PNG',
  'image/webp': 'Imagen WebP',
  'image/heic': 'Imagen HEIC',
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/xml': 'XML',
}

export const nombreTipo = (t: TipoArchivo) => NOMBRE_TIPO[t]

/** `1536` → «1,5 KB». */
export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const unidades = ['KB', 'MB', 'GB']
  let valor = bytes / 1024
  let i = 0
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024
    i++
  }
  return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ${unidades[i]}`
}

/** Los archivos personales o sensibles exigen además `archivos.personales.ver` para abrirlos. */
export function puedeAbrir(c: ClasificacionArchivo, tienePermiso: (p: Permiso) => boolean): boolean {
  if (!tienePermiso('archivos.ver')) return false
  return c === 'publico' || c === 'interno' || tienePermiso('archivos.personales.ver')
}

/** Filtros tal como se escriben en la pantalla (fechas de calendario `YYYY-MM-DD`). */
export interface FiltrosPantalla {
  clasificacion: ClasificacionArchivo | ''
  q: string
  desde: string
  hasta: string
}

/**
 * Filtros de la pantalla → consulta: los días se toman completos en la zona de la entidad
 * (`hasta` incluye todo ese día) y el texto vacío no filtra.
 */
export function aConsulta(f: FiltrosPantalla, zona: string): FiltrosArchivos {
  return {
    clasificacion: f.clasificacion || undefined,
    q: f.q.trim() || undefined,
    desde: f.desde ? aUtc(`${f.desde}T00:00`, zona) : undefined,
    hasta: f.hasta ? aUtc(`${sumarDias(f.hasta, 1)}T00:00`, zona) : undefined,
  }
}

/** Clasificaciones que la cuenta puede ver (o filtrar) en el listado. */
export function clasificacionesVisibles(tienePermiso: (p: Permiso) => boolean): ClasificacionArchivo[] {
  const todas = Object.keys(CLASIFICACION) as ClasificacionArchivo[]
  return tienePermiso('archivos.personales.ver') ? todas : todas.filter((c) => c === 'publico' || c === 'interno')
}

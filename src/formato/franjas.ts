/**
 * Franjas de tiempo para reservar (funciones puras). La disponibilidad llega del backend ya
 * descontada (horario − excepciones − reservas − alistamiento): aquí solo se parte en inicios
 * posibles y se agrupa por día en la zona de la entidad. Nunca se recalcula la disponibilidad.
 */
import { hoyEn } from './fechas'

export interface Franja {
  /** Instante UTC (ISO). */
  inicio: string
  fin: string
}

const MINUTO = 60_000

/** `ISO + minutos` → ISO UTC sin milisegundos. */
export function sumarMinutos(iso: string, minutos: number): string {
  return new Date(Date.parse(iso) + minutos * MINUTO).toISOString().replace('.000Z', 'Z')
}

/** Minutos entre dos instantes. */
export const minutosEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / MINUTO)

/**
 * Inicios posibles dentro de las franjas libres, cada `paso` minutos, en los que cabe una
 * reserva de `duracion` minutos. Sin repetir y en orden.
 */
export function iniciosPosibles(franjas: Franja[], paso: number, duracion: number): string[] {
  if (paso <= 0 || duracion <= 0) return []
  const inicios = new Set<string>()
  for (const f of franjas) {
    const fin = Date.parse(f.fin)
    for (let t = Date.parse(f.inicio); t + duracion * MINUTO <= fin; t += paso * MINUTO) {
      inicios.add(new Date(t).toISOString().replace('.000Z', 'Z'))
    }
  }
  return [...inicios].sort()
}

/** Duraciones que admite la política: de `minima` a `maxima`, en múltiplos de `paso`. */
export function duraciones(minima: number, maxima: number, paso: number): number[] {
  const p = Math.max(paso, 1)
  const desde = Math.max(Math.ceil(minima / p) * p, p)
  const lista: number[] = []
  for (let d = desde; d <= maxima; d += p) lista.push(d)
  return lista
}

/** «30 min», «1 h», «1 h 30 min». */
export function textoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Los `cantidad` días de calendario desde `desde` (`YYYY-MM-DD`). */
export function dias(desde: string, cantidad = 7): string[] {
  const base = Date.parse(`${desde}T12:00:00Z`)
  return Array.from({ length: cantidad }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10))
}

/** Agrupa instantes (o franjas, por su inicio) por día de calendario en la zona dada. */
export function porDia<T>(elementos: T[], instante: (e: T) => string, zona: string): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const e of elementos) {
    const dia = hoyEn(zona, new Date(instante(e)))
    grupos.set(dia, [...(grupos.get(dia) ?? []), e])
  }
  return grupos
}

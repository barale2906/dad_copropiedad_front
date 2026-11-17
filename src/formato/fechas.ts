/**
 * Fechas y horas para mostrar. El backend envía UTC (ISO 8601) y todo se muestra en la
 * `zona_horaria` de la entidad (`useEntidad().zonaHoraria`), **nunca** en la del navegador.
 */

const formatos = new Map<string, Intl.DateTimeFormat>()

/** Reutiliza los `Intl.DateTimeFormat` (crearlos es costoso). */
function formateador(zona: string, opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const clave = `${zona}|${JSON.stringify(opciones)}`
  let f = formatos.get(clave)
  if (!f) {
    f = new Intl.DateTimeFormat('es-CO', { timeZone: zona, ...opciones })
    formatos.set(clave, f)
  }
  return f
}

function aFecha(utc: string | Date): Date {
  const d = typeof utc === 'string' ? new Date(utc) : utc
  if (Number.isNaN(d.getTime())) throw new RangeError(`Fecha inválida: ${String(utc)}`)
  return d
}

/** `2026-11-16T15:04:05Z` → «16 nov 2026» en la zona dada. */
export function fecha(utc: string | Date, zona: string): string {
  return formateador(zona, { day: 'numeric', month: 'short', year: 'numeric' }).format(aFecha(utc))
}

/**
 * Fecha de calendario sin hora (`2026-11-01`: vencimientos, periodos, escrituras) → «1 nov 2026».
 * No convierte zonas: el día es el mismo en todas.
 */
export function fechaCalendario(yyyymmdd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) throw new RangeError(`Fecha inválida: ${yyyymmdd}`)
  return fecha(`${yyyymmdd}T12:00:00Z`, 'UTC')
}

/** El día de hoy (`YYYY-MM-DD`) en la zona de la entidad, para comparar con fechas de calendario. */
export function hoyEn(zona: string, ahora: Date = new Date()): string {
  const partes = formateador(zona, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora)
  const v = (t: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === t)?.value ?? ''
  return `${v('year')}-${v('month')}-${v('day')}`
}

/** `2026-11-16T15:04:05Z` → «16 nov 2026, 10:04 a. m.» en la zona dada. */
export function fechaHora(utc: string | Date, zona: string): string {
  return formateador(zona, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(aFecha(utc))
}

/**
 * Hora local que ya viene en la zona de la entidad (horarios, franjas): `14:30:00` → «2:30 p. m.».
 * No convierte zonas.
 */
export function hora(hhmmss: string): string {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hhmmss)
  if (!m) throw new RangeError(`Hora inválida: ${hhmmss}`)
  const d = new Date(Date.UTC(2000, 0, 1, Number(m[1]), Number(m[2])))
  return formateador('UTC', { hour: 'numeric', minute: '2-digit' }).format(d)
}

/** Diferencia (ms) entre la hora de pared de `zona` y UTC en el instante dado. */
function desfase(instante: number, zona: string): number {
  const partes = formateador(zona, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instante))
  const v = (t: Intl.DateTimeFormatPartTypes) => Number(partes.find((p) => p.type === t)?.value)
  const pared = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'))
  return pared - Math.floor(instante / 1000) * 1000
}

/**
 * Fecha y hora escritas por el usuario en la zona de la entidad (`2026-11-16T10:00`, como da
 * un `<input type="datetime-local">`) → ISO UTC para enviar al backend.
 */
export function aUtc(local: string, zona: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!m) throw new RangeError(`Fecha local inválida: ${local}`)
  const [, a, me, d, h, mi, s] = m
  const comoUtc = Date.UTC(Number(a), Number(me) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0))
  // Dos pasadas: el desfase puede cambiar justo en un cambio de horario.
  let instante = comoUtc - desfase(comoUtc, zona)
  instante = comoUtc - desfase(instante, zona)
  return new Date(instante).toISOString().replace('.000Z', 'Z')
}

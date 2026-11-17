/**
 * Horarios semanales (franjas por día ISO 1 = lunes … 7 = domingo) con excepciones por fecha.
 * Funciones puras; las horas viajan como `HH:MM:SS` en la zona de la entidad.
 */
import type { ExcepcionHorario, Franja, Horario } from '@/api/tipos'
import { hora } from '@/formato/fechas'

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

/** `08:00` (de un `<input type="time">`) → `08:00:00`; deja igual lo que ya trae segundos. */
export function aHoraCompleta(hhmm: string): string {
  return /^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm}:00` : hhmm
}

/** `08:00:00` → `08:00` para un `<input type="time">`. */
export const aHoraCorta = (hhmmss: string | null | undefined) => (hhmmss ?? '').slice(0, 5)

/** Errores del horario para mostrar (vacío = válido). Las horas se comparan como texto `HH:MM`. */
export function validarHorario(h: Horario): string[] {
  const errores: string[] = []
  ;(h.franjas ?? []).forEach((f, i) => {
    const n = `Franja ${i + 1}`
    if (f.dia < 1 || f.dia > 7) errores.push(`${n}: elija el día.`)
    if (!f.inicio || !f.fin) errores.push(`${n}: indique la hora de inicio y la de fin.`)
    else if (aHoraCorta(f.fin) <= aHoraCorta(f.inicio)) errores.push(`${n}: la hora de fin debe ser posterior a la de inicio.`)
  })
  ;(h.excepciones ?? []).forEach((x, i) => {
    const n = `Excepción ${i + 1}`
    if (!x.fecha) errores.push(`${n}: elija la fecha.`)
    if (!!x.inicio !== !!x.fin) errores.push(`${n}: indique inicio y fin, o deje ambos vacíos si no se atiende.`)
    else if (x.inicio && x.fin && aHoraCorta(x.fin) <= aHoraCorta(x.inicio)) {
      errores.push(`${n}: la hora de fin debe ser posterior a la de inicio.`)
    }
  })
  return errores
}

/** Deja el horario listo para enviar: horas con segundos y franjas ordenadas por día y hora. */
export function normalizarHorario(h: Horario): Horario {
  const franjas: Franja[] = (h.franjas ?? [])
    .map((f) => ({ ...f, inicio: aHoraCompleta(f.inicio), fin: aHoraCompleta(f.fin) }))
    .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
  const excepciones: ExcepcionHorario[] = (h.excepciones ?? []).map((x) => ({
    ...x,
    inicio: x.inicio ? aHoraCompleta(x.inicio) : null,
    fin: x.fin ? aHoraCompleta(x.fin) : null,
    motivo: x.motivo?.trim() || null,
  }))
  return { franjas, excepciones }
}

/** Días seguidos como rango («Lun–Vie») o sueltos («Lun, Mié»). */
function dias(lista: number[]): string {
  const tramos: number[][] = []
  for (const d of [...lista].sort((a, b) => a - b)) {
    const ultimo = tramos.at(-1)
    if (ultimo && ultimo.at(-1) === d - 1) ultimo.push(d)
    else tramos.push([d])
  }
  const corto = (d: number) => DIAS_CORTOS[d - 1] ?? '?'
  return tramos
    .map((t) => (t.length > 2 ? `${corto(t[0]!)}–${corto(t.at(-1)!)}` : t.map(corto).join(', ')))
    .join(', ')
}

/**
 * Resumen legible: agrupa los días con las mismas franjas
 * (`Lun–Vie 8:00 a. m.–12:00 p. m.`). Sin franjas: «Sin horario».
 */
export function resumirHorario(h: Horario): string[] {
  const porDia = new Map<number, string[]>()
  for (const f of normalizarHorario(h).franjas ?? []) {
    porDia.set(f.dia, [...(porDia.get(f.dia) ?? []), `${hora(f.inicio)}–${hora(f.fin)}`])
  }
  if (porDia.size === 0) return ['Sin horario']
  const porFranjas = new Map<string, number[]>()
  for (const [dia, franjas] of porDia) {
    const clave = franjas.join(' y ')
    porFranjas.set(clave, [...(porFranjas.get(clave) ?? []), dia])
  }
  return [...porFranjas].map(([franjas, ds]) => `${dias(ds)} ${franjas}`)
}

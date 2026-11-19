/**
 * Lectura y textos del escrutinio de una pregunta (funciones puras). El backend calcula todo;
 * aquí solo se interpreta para mostrarlo. Lo usan la conducción, la proyección y la papeleta.
 */
import type { BaseComputo, Escrutinio } from '@/api/tipos'
import { proporcion } from './decimales'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

/** Valor de un conteo en la base de cómputo (texto, para mostrar). */
export const enBase = (c: { coeficiente: string; unidades: number }, base: BaseComputo) =>
  base === 'coeficiente' ? c.coeficiente : String(c.unidades)

/** Porcentaje de los habilitados que ya votó, en la base de cómputo. */
export function participacion(e: Escrutinio): string {
  return proporcion(enBase(e.votantes, e.base_computo), enBase(e.habilitados, e.base_computo), 1)
}

/** Cupos que ganó una plancha (elecciones); `null` si no aplica. */
export function cuposDe(e: Escrutinio, opcionId: string): number | null {
  if (e.decision.decision !== 'reparto') return e.opciones.find((o) => o.opcion_id === opcionId)?.cupos ?? null
  const c = e.decision.cupos.find((x) => x.opcion_id === opcionId)
  return c ? c.por_cociente + c.por_residuo : 0
}

/** Qué decidió la pregunta, en palabras y con su tono. `abierta`: el conteo aún puede cambiar. */
export function textoDecision(e: Escrutinio, abierta = false): { texto: string; tono: Tono } {
  if (abierta) return { texto: 'Votación abierta: resultado parcial', tono: 'info' }
  const texto = (id: string) => e.opciones.find((o) => o.opcion_id === id)?.texto ?? ''
  const d = e.decision
  switch (d.decision) {
    case 'aprobada':
      return { texto: 'Aprobada', tono: 'exito' }
    case 'no_aprobada':
      return { texto: 'No aprobada', tono: 'peligro' }
    case 'ganadora':
      return { texto: `Ganó «${texto(d.opcion_id)}»`, tono: 'exito' }
    case 'sin_ganadora':
      return { texto: d.empate ? 'Empate: ninguna opción ganó' : 'Ninguna opción alcanzó la mayoría', tono: 'aviso' }
    case 'por_opcion': {
      const aprobadas = e.opciones.filter((o) => o.aprobada === true).map((o) => `«${o.texto}»`)
      return aprobadas.length
        ? { texto: `Aprobadas: ${aprobadas.join(', ')}`, tono: 'exito' }
        : { texto: 'Ninguna opción aprobada', tono: 'peligro' }
    }
    case 'reparto': {
      const extra = [d.empate ? 'empate en el último cupo' : '', d.sin_asignar ? `${d.sin_asignar} cupo(s) sin asignar` : ''].filter(Boolean)
      return { texto: `Cupos repartidos por cociente electoral${extra.length ? ` (${extra.join('; ')})` : ''}`, tono: extra.length ? 'aviso' : 'exito' }
    }
  }
}

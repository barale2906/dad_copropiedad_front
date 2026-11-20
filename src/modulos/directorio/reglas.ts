/** Reglas puras del directorio: categorías en árbol, textos y el lote de eventos de las piezas. */
import type { CategoriaDirectorio, EventoPublicidad } from '@/api/tipos'

/** Opciones del filtro: cada rama seguida de sus subcategorías (con sangría), por nombre. */
export function opcionesCategorias(lista: readonly CategoriaDirectorio[]): { valor: string; etiqueta: string }[] {
  const visibles = lista.filter((c) => c.activa && !c.restringida)
  const porNombre = (a: CategoriaDirectorio, b: CategoriaDirectorio) => a.nombre.localeCompare(b.nombre, 'es')
  const codigos = new Set(visibles.map((c) => c.codigo))
  // Una subcategoría cuya rama no llegó se muestra como rama para no perderla.
  const ramas = visibles.filter((c) => !c.padre || !codigos.has(c.padre)).sort(porNombre)
  return [
    { valor: '', etiqueta: 'Todas las categorías' },
    ...ramas.flatMap((r) => [
      { valor: r.codigo, etiqueta: r.nombre },
      ...visibles
        .filter((c) => c.padre === r.codigo)
        .sort(porNombre)
        .map((c) => ({ valor: c.codigo, etiqueta: `— ${c.nombre}` })),
    ]),
  ]
}

/** Nombre de la categoría principal de una ficha (la primera), o el código si no se conoce. */
export function categoriaPrincipal(codigos: readonly string[], lista: readonly CategoriaDirectorio[]): string | undefined {
  const codigo = codigos[0]
  if (!codigo) return undefined
  return lista.find((c) => c.codigo === codigo)?.nombre ?? codigo
}

/** Tope por contador que acepta el backend en cada envío. */
export const MAXIMO_POR_CONTADOR = 100

/** Contadores pendientes por pieza. */
export type Pendientes = Map<string, { impresiones: number; clics: number }>

/** Suma una impresión o un clic a la pieza. */
export function acumular(pendientes: Pendientes, creativoId: string, tipo: 'impresion' | 'clic'): void {
  const p = pendientes.get(creativoId) ?? { impresiones: 0, clics: 0 }
  if (tipo === 'impresion') p.impresiones++
  else p.clics++
  pendientes.set(creativoId, p)
}

/** Lote para `…/publicidad/eventos` (máximo 100 por contador) y lo vacía. */
export function tomarLote(pendientes: Pendientes): EventoPublicidad[] {
  const lote: EventoPublicidad[] = []
  for (const [creativo_id, p] of pendientes) {
    const impresiones = Math.min(p.impresiones, MAXIMO_POR_CONTADOR)
    const clics = Math.min(p.clics, MAXIMO_POR_CONTADOR)
    if (impresiones || clics) lote.push({ creativo_id, impresiones, clics })
  }
  pendientes.clear()
  return lote
}

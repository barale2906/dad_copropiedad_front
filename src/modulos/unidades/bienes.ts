/** Textos de bienes y agrupaciones, y recorrido del árbol (funciones puras). */
import type { ArbolAgrupaciones, BienPrivado, NodoAgrupacion, TipoAgrupacion, TipoBienPrivado, TipoUsoExclusivo, UsoBienPrivado } from '@/api/tipos'

export const TIPO_BIEN: Record<TipoBienPrivado, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  local: 'Local',
  oficina: 'Oficina',
  consultorio: 'Consultorio',
  parqueadero: 'Parqueadero',
  deposito: 'Depósito',
  bodega: 'Bodega',
  lote: 'Lote',
  finca: 'Finca',
  otro: 'Otro',
}

export const USO_BIEN: Record<UsoBienPrivado, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  mixto: 'Mixto',
  industrial: 'Industrial',
  institucional: 'Institucional',
  otro: 'Otro',
}

export const TIPO_AGRUPACION: Record<TipoAgrupacion, string> = {
  edificio: 'Edificio o torre',
  etapa: 'Etapa',
  bloque: 'Bloque',
  manzana: 'Manzana',
  interior: 'Interior',
  sector: 'Sector',
}

export const TIPO_USO: Record<TipoUsoExclusivo, string> = {
  parqueadero: 'Parqueadero',
  deposito: 'Depósito',
  terraza: 'Terraza',
  patio: 'Patio',
  jardin: 'Jardín',
  cubierta: 'Cubierta',
  otro: 'Otro',
}

/** Los tipos que pueden ser anexos de un bien principal (con folio propio). */
export const TIPOS_ANEXO: readonly TipoBienPrivado[] = ['parqueadero', 'deposito', 'bodega']

export interface GrupoBienes {
  id: string | null
  /** Ruta legible: «Etapa 1 › Torre 2». */
  ruta: string
  nivel: number
  bienes: BienPrivado[]
}

/** Árbol → lista plana de grupos (en orden), con los bienes sin agrupación al final. */
export function aplanarArbol(a: ArbolAgrupaciones): GrupoBienes[] {
  const grupos: GrupoBienes[] = []
  const recorrer = (n: NodoAgrupacion, ruta: string[], nivel: number) => {
    const r = [...ruta, n.agrupacion.nombre]
    grupos.push({ id: n.agrupacion.id, ruta: r.join(' › '), nivel, bienes: n.bienes_privados })
    ;[...n.hijas].sort((x, y) => x.agrupacion.orden - y.agrupacion.orden).forEach((h) => recorrer(h, r, nivel + 1))
  }
  ;[...a.agrupaciones].sort((x, y) => x.agrupacion.orden - y.agrupacion.orden).forEach((n) => recorrer(n, [], 0))
  if (a.sin_agrupacion.length) grupos.push({ id: null, ruta: 'Sin agrupación', nivel: 0, bienes: a.sin_agrupacion })
  return grupos
}

/** Opciones de agrupación para un selector, con la ruta completa (solo hasta 2 niveles: la 3.ª no admite hijas). */
export function opcionesAgrupacion(a: ArbolAgrupaciones, soloPadres = false) {
  return aplanarArbol(a)
    .filter((g) => g.id && (!soloPadres || g.nivel < 2))
    .map((g) => ({ valor: g.id ?? '', etiqueta: g.ruta }))
}

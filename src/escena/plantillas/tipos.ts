import type { Object3D } from 'three'
import type { Kit } from '../piezas'
import { type IdPlantilla, ZONAS, type ZonaInfo } from './zonas'

export type Construir = (k: Kit, detalle: boolean) => Object3D

/** Zona clicable: sus datos (`zonas.ts`) más su geometría. */
export interface ZonaPlantilla extends ZonaInfo {
  construir: Construir
}

/**
 * Maqueta genérica: una por tipo de entidad, igual para todos los clientes. No depende de los
 * datos de cada conjunto, por eso se dibuja al instante y no pide nada al backend; lo único que
 * cambia por cliente es qué zonas quedan encendidas (módulos contratados y permisos).
 * Coordenadas del mundo: x a la derecha, z hacia la cámara, y hacia arriba.
 */
export interface Plantilla {
  id: IdPlantilla
  terreno: { ancho: number; fondo: number }
  zonas: ZonaPlantilla[]
  decorado: Construir
}

/** Une los datos de las zonas con su geometría; falla al compilar si falta alguna. */
export function armar(
  id: IdPlantilla,
  terreno: Plantilla['terreno'],
  geometria: Record<string, Construir>,
  decorado: Construir,
): Plantilla {
  return {
    id,
    terreno,
    decorado,
    zonas: ZONAS[id].map((z) => {
      const construir = geometria[z.id]
      if (!construir) throw new Error(`Zona sin geometría: ${id}/${z.id}`)
      return { ...z, construir }
    }),
  }
}

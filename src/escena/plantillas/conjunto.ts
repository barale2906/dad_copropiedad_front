/** Geometría de la maqueta genérica de un conjunto residencial (`propiedad_horizontal`). */
import { Group } from 'three'
import { arbol, carro, edificio, torre } from '../piezas'
import { armar } from './tipos'

export const conjunto = armar(
  'conjunto',
  { ancho: 28, fondo: 20 },
  {
    torres: (k) => {
      const g = new Group()
      g.add(torre(k, -7, -5, 3.2, 7, 3.2))
      g.add(torre(k, -1.5, -5.6, 3.2, 8.2, 3.2))
      g.add(torre(k, 4, -5, 3.2, 7, 3.2))
      return g
    },
    administracion: (k) => edificio(k, 10, -4.5, 3.4, 2, 2.8),
    'salon-social': (k) => {
      const g = edificio(k, -9, 3.2, 4.2, 1.5, 3)
      g.add(k.caja('acento', 1.2, 0.9, 0.05, -9, 4.72, 0, false))
      return g
    },
    piscina: (k) => {
      const g = new Group()
      g.add(k.caja('piso', 5, 0.12, 3.6, -2.2, 3.4))
      g.add(k.caja('agua', 4, 0.05, 2.6, -2.2, 3.4, 0.12, false))
      return g
    },
    cancha: (k) => {
      const g = new Group()
      g.add(k.caja('verde', 5.4, 0.08, 3.4, 4.4, 3.6))
      g.add(k.caja('acento', 0.05, 0.02, 3.2, 4.4, 3.6, 0.08, false))
      g.add(k.caja('acento', 0.06, 0.9, 0.9, 1.85, 3.6, 0.08))
      g.add(k.caja('acento', 0.06, 0.9, 0.9, 6.95, 3.6, 0.08))
      return g
    },
    gimnasio: (k) => edificio(k, 10.5, 3.2, 2.8, 1.3, 2.4),
    parqueadero: (k, detalle) => {
      const g = new Group()
      g.add(k.caja('piso', 7, 0.06, 3, -8.5, 8.2))
      const n = detalle ? 6 : 3
      for (let i = 0; i < n; i++) g.add(carro(k, -11.2 + i * (detalle ? 1.05 : 2.1), 8.2))
      return g
    },
    porteria: (k) => {
      const g = edificio(k, 0, 8.4, 2.2, 1.3, 1.6)
      g.add(k.caja('acento', 3.2, 0.08, 0.08, 2.9, 8.9, 0.9, false))
      g.add(k.caja('oscuro', 0.15, 1, 0.15, 1.3, 8.9, 0, false))
      return g
    },
    pantalla: (k) => {
      const g = new Group()
      g.add(k.caja('oscuro', 0.15, 1.4, 0.15, 8, 8.6, 0, false))
      g.add(k.caja('pantalla', 2.4, 1.3, 0.1, 8, 8.6, 1.3))
      return g
    },
  },
  (k, detalle) => {
    const g = new Group()
    g.add(k.losa('piso', 28, 20, 0, 0, 0))
    // Vía interna y sendero central.
    g.add(k.losa('oscuro', 26, 1.2, 0, 6.2, 0.02))
    g.add(k.losa('oscuro', 1.2, 10, 0, 1, 0.02))
    if (detalle) {
      for (const [x, z, e] of [
        [-12.5, -8, 1.1], [-12.5, -2, 1], [12.8, -8.2, 1.2], [13, 0.5, 0.9], [-5.5, 0.4, 0.8],
        [1.2, 0, 0.7], [7.8, 0.3, 0.9], [-12.8, 3.5, 1], [12.8, 6.5, 0.9], [-4.2, 8.6, 0.8],
      ] as const) {
        g.add(arbol(k, x, z, e))
      }
    }
    return g
  },
)

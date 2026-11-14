/** Geometría de la maqueta genérica de una oficina (`empresa`): planta abierta. */
import { Group } from 'three'
import { arbol, escritorio } from '../piezas'
import { armar } from './tipos'

export const oficina = armar(
  'oficina',
  { ancho: 24, fondo: 17 },
  {
    recepcion: (k) => {
      const g = new Group()
      g.add(k.caja('cuerpo', 3.6, 1.1, 0.8, 0, 5.6))
      g.add(k.caja('acento', 3.6, 0.06, 0.08, 0, 5.98, 1.04, false))
      g.add(k.caja('pantalla', 2.2, 0.7, 0.06, 0, 7.6, 1.6))
      return g
    },
    contabilidad: (k, detalle) => {
      const g = new Group()
      g.add(escritorio(k, -7.6, -0.6))
      g.add(escritorio(k, -5.6, -0.6))
      if (detalle) g.add(escritorio(k, -7.6, 1.6))
      g.add(escritorio(k, -5.6, 1.6, detalle))
      return g
    },
    tesoreria: (k) => {
      const g = new Group()
      g.add(escritorio(k, -0.9, 0.4))
      // Caja fuerte con su perilla.
      g.add(k.caja('cuerpo', 1.3, 1.5, 1.2, 1.3, 0.2))
      g.add(k.cilindro_('acento', 0.28, 0.06, 1.3, 0.82, 0.6).rotateX(Math.PI / 2))
      return g
    },
    facturacion: (k) => {
      const g = new Group()
      g.add(escritorio(k, 5.4, 0.4))
      g.add(escritorio(k, 7.4, 0.4))
      // Impresora.
      g.add(k.caja('techo', 0.9, 0.6, 0.7, 6.4, 2.2))
      g.add(k.caja('acento', 0.6, 0.05, 0.4, 6.4, 2.2, 0.6, false))
      return g
    },
    tributario: (k) => {
      const g = new Group()
      g.add(escritorio(k, -7.2, -5.2))
      g.add(k.caja('cuerpo', 0.7, 1.3, 1.6, -9.3, -5.2))
      return g
    },
    archivo: (k) => {
      const g = new Group()
      for (const z of [-3.7, -4.8, -5.9]) g.add(k.caja('cuerpo', 2.6, 1.9, 0.6, 0, z))
      return g
    },
    'sala-juntas': (k) => {
      const g = new Group()
      g.add(k.caja('techo', 3.2, 0.08, 1.4, 6.4, -5, 0.72))
      g.add(k.caja('oscuro', 0.2, 0.72, 0.8, 6.4, -5, 0, false))
      for (const x of [5.4, 6.4, 7.4]) {
        g.add(k.caja('cuerpo', 0.45, 0.5, 0.45, x, -6.1, 0, false))
        g.add(k.caja('cuerpo', 0.45, 0.5, 0.45, x, -3.9, 0, false))
      }
      g.add(k.caja('pantalla', 2.4, 1.2, 0.06, 6.4, -7.6, 0.9))
      return g
    },
    nomina: (k) => {
      const g = new Group()
      g.add(escritorio(k, 9.4, 5.2))
      g.add(k.caja('cuerpo', 0.7, 1.2, 1.4, 10.9, 5.2))
      return g
    },
  },
  (k, detalle) => {
    const g = new Group()
    g.add(k.losa('piso', 24, 17, 0, 0, 0))
    // Muros bajos (cortados para ver adentro) y divisiones de vidrio.
    g.add(k.caja('cuerpo', 24, 0.6, 0.2, 0, -8.4))
    g.add(k.caja('cuerpo', 0.2, 0.6, 17, -11.9, 0))
    g.add(k.caja('cuerpo', 0.2, 0.6, 17, 11.9, 0))
    g.add(k.caja('vidrio', 0.06, 1.6, 6, 3.6, -5.2))
    g.add(k.caja('vidrio', 0.06, 1.6, 6, -3.6, -5.2))
    g.add(k.losa('oscuro', 6, 3.5, 0, 6.2, 0.02))
    if (detalle) {
      for (const [x, z] of [[-10.8, 7.2], [10.8, -7.4], [-10.8, -7.4], [3, 6.8]] as const) {
        g.add(arbol(k, x, z, 0.6))
      }
    }
    return g
  },
)

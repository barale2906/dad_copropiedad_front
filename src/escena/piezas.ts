/**
 * Kit de piezas low-poly de la maqueta genérica.
 *
 * Toda la escena reutiliza **cinco geometrías** (cubo, cilindro, cono, plano y los bordes del
 * cubo) escaladas por pieza, y un juego fijo de materiales por paleta. Así la maqueta pesa casi
 * nada en memoria, se crea en milisegundos y cambiar el estado de una zona (activa ↔ apagada)
 * es solo reasignar materiales, sin reconstruir nada.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  NearestFilter,
} from 'three'

/** Papel de cada malla; el material sale de la paleta según el estado de la zona. */
export type Rol =
  | 'cuerpo'
  | 'techo'
  | 'torre'
  | 'acento'
  | 'agua'
  | 'verde'
  | 'piso'
  | 'oscuro'
  | 'pantalla'
  | 'vidrio'
  | 'borde'

export type Paleta = 'activa' | 'apagada' | 'holograma'

type JuegoMateriales = Record<Exclude<Rol, 'torre'>, Material> & { torre: Material[] }

function texturaVentanas(encendidas: boolean): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#0b1220'
  g.fillRect(0, 0, 32, 64)
  // 4 columnas × 12 pisos; patrón fijo (pseudoaleatorio) para que todas las torres coincidan.
  let semilla = 7
  const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280)
  for (let piso = 0; piso < 12; piso++) {
    for (let col = 0; col < 4; col++) {
      const r = azar()
      g.fillStyle = !encendidas
        ? '#262c36'
        : r > 0.82
          ? '#ffb347'
          : r > 0.3
            ? '#38e8ff'
            : '#12304a'
      g.fillRect(2 + col * 8, 2 + piso * 5.2, 5, 2.6)
    }
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.magFilter = NearestFilter
  return t
}

export class Kit {
  readonly cubo = new BoxGeometry(1, 1, 1)
  readonly bordesCubo = new EdgesGeometry(this.cubo)
  readonly cilindro = new CylinderGeometry(0.5, 0.5, 1, 12)
  readonly cono = new ConeGeometry(0.5, 1, 6)
  readonly plano = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

  private readonly texturas = [texturaVentanas(true), texturaVentanas(false)]
  readonly paletas: Record<Paleta, JuegoMateriales>

  constructor() {
    const [encendidas, apagadas] = this.texturas as [CanvasTexture, CanvasTexture]
    const lambert = (color: string, emisivo = '#000000', intensidad = 1) =>
      new MeshLambertMaterial({ color, emissive: new Color(emisivo), emissiveIntensity: intensidad })

    const activaCuerpo = lambert('#1c2b47', '#070f1f')
    const activaTecho = lambert('#22385c', '#0a1a33')
    const activaVentanas = new MeshLambertMaterial({
      color: '#0b1220',
      map: encendidas,
      emissive: new Color('#ffffff'),
      emissiveMap: encendidas,
      emissiveIntensity: 0.85,
    })
    const activa: JuegoMateriales = {
      cuerpo: activaCuerpo,
      techo: activaTecho,
      torre: [activaVentanas, activaVentanas, activaTecho, activaCuerpo, activaVentanas, activaVentanas],
      acento: lambert('#00e5ff', '#00b8d4', 0.9),
      agua: lambert('#0a84c6', '#0090d0', 0.55),
      verde: lambert('#0f3b34', '#062520'),
      piso: lambert('#121a2a', '#050a14'),
      oscuro: lambert('#0c1322'),
      pantalla: new MeshBasicMaterial({ color: '#38e8ff' }),
      vidrio: new MeshBasicMaterial({ color: '#38e8ff', transparent: true, opacity: 0.1, depthWrite: false }),
      borde: new LineBasicMaterial({ color: '#3ee8ff', transparent: true, opacity: 0.55 }),
    }

    const gris = lambert('#2b313b')
    const grisTecho = lambert('#343b47')
    const grisVentanas = new MeshLambertMaterial({ color: '#ffffff', map: apagadas })
    const apagada: JuegoMateriales = {
      cuerpo: gris,
      techo: grisTecho,
      torre: [grisVentanas, grisVentanas, grisTecho, gris, grisVentanas, grisVentanas],
      acento: lambert('#4b525e'),
      agua: lambert('#35404d'),
      verde: lambert('#262d33'),
      piso: lambert('#1a1f27'),
      oscuro: lambert('#171b22'),
      pantalla: lambert('#3a414c'),
      vidrio: new MeshBasicMaterial({ color: '#8a93a3', transparent: true, opacity: 0.06, depthWrite: false }),
      borde: new LineBasicMaterial({ color: '#6b7484', transparent: true, opacity: 0.22 }),
    }

    const vidrio = (opacidad: number) =>
      new MeshBasicMaterial({ color: '#0d3b66', transparent: true, opacity: opacidad, depthWrite: false })
    const holoCuerpo = vidrio(0.28)
    const holoVentanas = new MeshBasicMaterial({
      map: encendidas,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const holograma: JuegoMateriales = {
      cuerpo: holoCuerpo,
      techo: holoCuerpo,
      torre: [holoVentanas, holoVentanas, holoCuerpo, holoCuerpo, holoVentanas, holoVentanas],
      acento: new MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.7 }),
      agua: vidrio(0.45),
      verde: vidrio(0.15),
      piso: vidrio(0.12),
      oscuro: vidrio(0.2),
      pantalla: new MeshBasicMaterial({ color: '#38e8ff', transparent: true, opacity: 0.8 }),
      vidrio: vidrio(0.1),
      borde: new LineBasicMaterial({ color: '#46f0ff', transparent: true, opacity: 0.85 }),
    }

    this.paletas = { activa, apagada, holograma }
  }

  /**
   * Caja apoyada en el suelo: `(x, z)` es el centro de la base y `y` la altura de apoyo.
   * Con `borde`, agrega el contorno luminoso (comparte la geometría de bordes del cubo).
   */
  caja(rol: Rol, an: number, al: number, fo: number, x: number, z: number, y = 0, borde = true): Object3D {
    const m = new Mesh(this.cubo, this.paletas.activa.cuerpo)
    m.userData.rol = rol
    m.scale.set(an, al, fo)
    m.position.set(x, y + al / 2, z)
    if (borde) {
      const b = new LineSegments(this.bordesCubo, this.paletas.activa.borde)
      b.userData.rol = 'borde'
      m.add(b)
    }
    return m
  }

  cilindro_(rol: Rol, radio: number, al: number, x: number, z: number, y = 0): Mesh {
    const m = new Mesh(this.cilindro, this.paletas.activa.cuerpo)
    m.userData.rol = rol
    m.scale.set(radio * 2, al, radio * 2)
    m.position.set(x, y + al / 2, z)
    return m
  }

  cono_(rol: Rol, radio: number, al: number, x: number, z: number, y = 0): Mesh {
    const m = new Mesh(this.cono, this.paletas.activa.cuerpo)
    m.userData.rol = rol
    m.scale.set(radio * 2, al, radio * 2)
    m.position.set(x, y + al / 2, z)
    return m
  }

  losa(rol: Rol, an: number, fo: number, x: number, z: number, y = 0.01): Mesh {
    const m = new Mesh(this.plano, this.paletas.activa.cuerpo)
    m.userData.rol = rol
    m.scale.set(an, 1, fo)
    m.position.set(x, y, z)
    return m
  }

  /** Asigna los materiales de la paleta a todas las mallas del objeto según su `rol`. */
  pintar(objeto: Object3D, paleta: Paleta): void {
    const juego = this.paletas[paleta]
    objeto.traverse((o) => {
      const rol = o.userData.rol as Rol | undefined
      if (!rol) return
      ;(o as Mesh).material = juego[rol]
    })
  }

  liberar(): void {
    for (const g of [this.cubo, this.bordesCubo, this.cilindro, this.cono, this.plano]) g.dispose()
    for (const t of this.texturas) t.dispose()
    const vistos = new Set<Material>()
    for (const juego of Object.values(this.paletas)) {
      for (const m of Object.values(juego).flat()) {
        if (!vistos.has(m)) {
          vistos.add(m)
          m.dispose()
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Piezas compuestas (reutilizables por cualquier plantilla)

export function torre(k: Kit, x: number, z: number, an = 3, al = 7, fo = 3): Group {
  const g = new Group()
  g.add(k.caja('torre', an, al, fo, x, z))
  g.add(k.caja('techo', an * 0.5, 0.5, fo * 0.4, x, z, al))
  g.add(k.caja('acento', 0.12, 0.9, 0.12, x + an * 0.18, z, al + 0.5, false))
  return g
}

export function edificio(k: Kit, x: number, z: number, an: number, al: number, fo: number): Group {
  const g = new Group()
  g.add(k.caja('cuerpo', an, al, fo, x, z))
  g.add(k.caja('techo', an + 0.2, 0.15, fo + 0.2, x, z, al))
  g.add(k.caja('acento', an * 0.9, 0.08, 0.05, x, z + fo / 2 + 0.03, al * 0.55, false))
  return g
}

export function arbol(k: Kit, x: number, z: number, escala = 1): Group {
  const g = new Group()
  g.add(k.cilindro_('oscuro', 0.08 * escala, 0.4 * escala, x, z))
  g.add(k.cono_('verde', 0.45 * escala, 1.1 * escala, x, z, 0.35 * escala))
  return g
}

export function carro(k: Kit, x: number, z: number, girado = false): Object3D {
  const g = new Group()
  g.add(k.caja('cuerpo', 0.7, 0.3, 1.3, 0, 0, 0.05, false))
  g.add(k.caja('techo', 0.6, 0.22, 0.7, 0, -0.05, 0.35, false))
  g.position.set(x, 0, z)
  if (girado) g.rotation.y = Math.PI / 2
  return g
}

export function escritorio(k: Kit, x: number, z: number, conMonitor = true): Group {
  const g = new Group()
  g.add(k.caja('techo', 1.4, 0.08, 0.7, x, z, 0.7))
  g.add(k.caja('oscuro', 0.08, 0.7, 0.6, x - 0.62, z, 0, false))
  g.add(k.caja('oscuro', 0.08, 0.7, 0.6, x + 0.62, z, 0, false))
  if (conMonitor) {
    g.add(k.caja('pantalla', 0.6, 0.38, 0.04, x, z - 0.18, 0.85, false))
    g.add(k.caja('oscuro', 0.06, 0.08, 0.06, x, z - 0.18, 0.78, false))
  }
  g.add(k.caja('cuerpo', 0.45, 0.5, 0.45, x, z + 0.6, 0, false))
  return g
}

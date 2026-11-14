/**
 * Nivel de calidad 3D según el equipo. No importa three.js: se usa antes de decidir si se
 * descarga el motor.
 *
 *  alta  → densidad de píxeles hasta 2, antialias, animaciones completas
 *  media → densidad hasta 1.5, antialias
 *  baja  → densidad 1, sin antialias, menos detalle (móviles modestos)
 *  lista → sin WebGL: menú alterno
 */
export type NivelCalidad = 'alta' | 'media' | 'baja' | 'lista'

export interface PerfilCalidad {
  nivel: NivelCalidad
  dprMax: number
  antialias: boolean
  /** Detalle de las piezas (ventanas, árboles, mobiliario). */
  detalle: boolean
}

const PERFILES: Record<NivelCalidad, PerfilCalidad> = {
  alta: { nivel: 'alta', dprMax: 2, antialias: true, detalle: true },
  media: { nivel: 'media', dprMax: 1.5, antialias: true, detalle: true },
  baja: { nivel: 'baja', dprMax: 1, antialias: false, detalle: false },
  lista: { nivel: 'lista', dprMax: 1, antialias: false, detalle: false },
}

let webgl: boolean | null = null

export function soportaWebGL(): boolean {
  if (webgl !== null) return webgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    webgl = !!gl
    ;(gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webgl = false
  }
  return webgl
}

export function detectarNivel(): NivelCalidad {
  if (!soportaWebGL()) return 'lista'
  const nav = navigator as Navigator & { deviceMemory?: number }
  const nucleos = nav.hardwareConcurrency ?? 4
  const memoria = nav.deviceMemory ?? 4
  const tactil = matchMedia('(pointer: coarse)').matches
  if (nucleos <= 4 || memoria <= 2) return 'baja'
  if (tactil || nucleos <= 6 || memoria <= 4) return 'media'
  return 'alta'
}

export function perfil(preferido: NivelCalidad | 'auto' = 'auto'): PerfilCalidad {
  const nivel = preferido === 'auto' ? detectarNivel() : preferido
  return PERFILES[nivel === 'lista' || soportaWebGL() ? nivel : 'lista']
}

export function movimientoReducido(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

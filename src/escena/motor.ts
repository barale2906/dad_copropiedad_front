/**
 * Motor 3D de la maqueta (three.js puro, sin capa de componentes).
 *
 * - Render **bajo demanda**: solo dibuja mientras la cámara se mueve, hay una transición o
 *   cambia el resaltado; con la escena quieta el consumo es 0 fps.
 * - Selección por **rayo contra la caja de cada zona** (una docena de pruebas baratas), no
 *   contra cada malla.
 * - Las etiquetas son HTML (accesibles y nítidas): el motor solo informa dónde van.
 * - Modo `holograma` para el fondo del login: rotación lenta, sin interacción, a ≤ 30 fps.
 */
import {
  Box3,
  DirectionalLight,
  EdgesGeometry,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { PerfilCalidad } from './calidad'
import type { EstadoSeccion } from './mapa-modulos'
import { Kit } from './piezas'
import type { Plantilla, ZonaPlantilla } from './plantillas/tipos'

export type EstadoZona = EstadoSeccion

export interface EtiquetaPos {
  id: string
  x: number
  y: number
  visible: boolean
  /** Distancia a la cámara, para resolver superposiciones (más cerca = prioridad). */
  profundidad: number
}

export interface OpcionesMotor {
  canvas: HTMLCanvasElement
  plantilla: Plantilla
  perfil: PerfilCalidad
  reducido: boolean
  modo: 'maqueta' | 'holograma'
  alPasar?: (id: string | null) => void
  alElegir?: (id: string | null) => void
  alDibujar?: (etiquetas: EtiquetaPos[]) => void
  alFallar?: () => void
}

/** Espacio que tapa la interfaz (panel a la derecha o abajo) para centrar la zona en lo visible. */
export interface Holgura {
  derecha: number
  abajo: number
}

interface ZonaViva {
  def: ZonaPlantilla
  objeto: Object3D
  caja: Box3
  centro: Vector3
  ancla: Vector3
  base: Mesh<never, MeshBasicMaterial>
  contorno: LineSegments<EdgesGeometry, LineBasicMaterial>
  estado: EstadoZona
}

interface Vista {
  posicion: Vector3
  objetivo: Vector3
  holgura: Holgura
}

const CIAN = 0x38e8ff
const GRIS = 0x7a8394

const suavizar = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export class Motor {
  private readonly o: OpcionesMotor
  private readonly renderer: WebGLRenderer
  private readonly escena = new Scene()
  private readonly raiz = new Group()
  private readonly camara = new PerspectiveCamera(38, 1, 0.5, 200)
  private readonly controles: OrbitControls | null
  private readonly kit = new Kit()
  private readonly zonas: ZonaViva[] = []
  private readonly rayo = new Raycaster()
  private readonly bordesBase: EdgesGeometry
  private readonly observador: ResizeObserver

  private ancho = 1
  private alto = 1
  private raf = 0
  private ultimoCuadro = 0
  private pausado = false
  private sobre: string | null = null
  private elegida: string | null = null
  private punteroPendiente: Vector2 | null = null
  private inicioToque: { x: number; y: number; t: number } | null = null
  private holgura: Holgura = { derecha: 0, abajo: 0 }
  private transicion: { desde: Vista; hasta: Vista; inicio: number; duracion: number } | null = null

  constructor(o: OpcionesMotor) {
    this.o = o
    this.renderer = new WebGLRenderer({
      canvas: o.canvas,
      antialias: o.perfil.antialias,
      alpha: true,
      powerPreference: 'low-power',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.perfil.dprMax))

    this.escena.fog = new Fog(0x050912, 40, 110)
    this.escena.add(new HemisphereLight(0x9fdcff, 0x0a0f1c, 1.6))
    const sol = new DirectionalLight(0xffffff, 1.1)
    sol.position.set(-12, 20, 10)
    this.escena.add(sol)
    this.escena.add(this.raiz)

    this.bordesBase = new EdgesGeometry(this.kit.plano)
    this.construir()

    if (o.modo === 'maqueta') {
      const c = new OrbitControls(this.camara, o.canvas)
      c.enableDamping = !o.reducido
      c.dampingFactor = 0.12
      c.minPolarAngle = 0.3
      c.maxPolarAngle = 1.22
      c.screenSpacePanning = false
      c.addEventListener('change', () => this.solicitar())
      this.controles = c
      this.escucharPuntero()
    } else {
      this.controles = null
      this.raiz.rotation.y = -0.4
    }

    o.canvas.addEventListener('webglcontextlost', this.alPerderContexto)
    this.observador = new ResizeObserver(() => this.redimensionar())
    this.observador.observe(o.canvas.parentElement ?? o.canvas)
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad)
    this.redimensionar()
  }

  // -------------------------------------------------------------------------
  // Construcción

  private construir(): void {
    const { plantilla, perfil, modo } = this.o
    const deco = plantilla.decorado(this.kit, perfil.detalle)
    this.kit.pintar(deco, modo === 'holograma' ? 'holograma' : 'activa')
    this.raiz.add(deco)

    for (const def of plantilla.zonas) {
      const objeto = def.construir(this.kit, perfil.detalle)
      this.raiz.add(objeto)
      const caja = new Box3().setFromObject(objeto)
      caja.expandByScalar(0.25)
      const centro = caja.getCenter(new Vector3())
      const ancla = new Vector3(centro.x, caja.max.y + 0.5, centro.z)

      const base = new Mesh(
        this.kit.plano,
        new MeshBasicMaterial({ color: CIAN, transparent: true, opacity: 0, depthWrite: false }),
      ) as unknown as Mesh<never, MeshBasicMaterial>
      const tam = caja.getSize(new Vector3())
      base.scale.set(tam.x + 0.4, 1, tam.z + 0.4)
      base.position.set(centro.x, 0.03, centro.z)
      const contorno = new LineSegments(
        this.bordesBase,
        new LineBasicMaterial({ color: CIAN, transparent: true, opacity: 0.35 }),
      )
      base.add(contorno)
      if (modo === 'maqueta') this.raiz.add(base)

      const zona: ZonaViva = { def, objeto, caja, centro, ancla, base, contorno, estado: 'activa' }
      this.zonas.push(zona)
      this.pintarZona(zona)
    }
  }

  private pintarZona(z: ZonaViva): void {
    if (this.o.modo === 'holograma') {
      this.kit.pintar(z.objeto, 'holograma')
      return
    }
    const encendida = z.estado === 'activa'
    this.kit.pintar(z.objeto, encendida ? 'activa' : 'apagada')
    const resaltada = z.def.id === this.elegida ? 2 : z.def.id === this.sobre ? 1 : 0
    const color = encendida ? CIAN : GRIS
    z.base.material.color.setHex(color)
    z.contorno.material.color.setHex(color)
    z.base.material.opacity = [encendida ? 0.06 : 0.02, 0.18, 0.28][resaltada]!
    z.contorno.material.opacity = [encendida ? 0.4 : 0.18, 0.85, 1][resaltada]!
  }

  // -------------------------------------------------------------------------
  // API pública

  /** Enciende o apaga zonas según módulos contratados y permisos. */
  estados(e: Record<string, EstadoZona>): void {
    for (const z of this.zonas) {
      z.estado = e[z.def.id] ?? 'activa'
      this.pintarZona(z)
    }
    this.solicitar()
  }

  /** Acerca la cámara a la zona (o vuelve a la vista general con `null`). */
  enfocar(id: string | null, holgura: Holgura = { derecha: 0, abajo: 0 }): void {
    this.elegida = id
    this.zonas.forEach((z) => this.pintarZona(z))
    const z = this.zonas.find((x) => x.def.id === id)
    this.irA(z ? this.vistaZona(z, holgura) : this.vistaGeneral(holgura))
  }

  /** Detiene el render (p. ej. mientras se usa un módulo con la escena guardada en KeepAlive). */
  pausar(p: boolean): void {
    this.pausado = p
    if (!p) this.solicitar()
  }

  destruir(): void {
    cancelAnimationFrame(this.raf)
    this.observador.disconnect()
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad)
    this.o.canvas.removeEventListener('webglcontextlost', this.alPerderContexto)
    this.controles?.dispose()
    for (const z of this.zonas) {
      z.base.material.dispose()
      z.contorno.material.dispose()
    }
    this.bordesBase.dispose()
    this.kit.liberar()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  // -------------------------------------------------------------------------
  // Cámara

  private vistaGeneral(holgura: Holgura): Vista {
    const vertical = this.ancho < this.alto
    // En pantallas verticales la maqueta se gira 90°: su eje largo queda a lo alto.
    const azimut = vertical ? Math.PI / 2 - 0.08 : 0.35
    const polar = vertical ? 0.74 : 0.88
    const objetivo = new Vector3(0, 0, vertical ? 0 : 0.8)
    const dist = this.distanciaQueEncuadra(azimut, polar, objetivo, holgura, vertical ? 0.95 : 0.92)
    if (this.controles) {
      this.controles.minDistance = 5
      this.controles.maxDistance = dist * 1.5
    }
    // La niebla acompaña a la distancia para dar profundidad sin oscurecer la maqueta.
    const niebla = this.escena.fog as Fog
    niebla.near = dist * 1.1
    niebla.far = dist * 2.8
    const posicion = new Vector3().setFromSpherical(new Spherical(dist, polar, azimut)).add(objetivo)
    return { posicion, objetivo, holgura }
  }

  /**
   * Distancia mínima a la que las esquinas del terreno (con la altura de las torres) caben en la
   * parte visible de la pantalla. Búsqueda binaria: sirve para cualquier proporción de pantalla.
   */
  private distanciaQueEncuadra(
    azimut: number,
    polar: number,
    objetivo: Vector3,
    holgura: Holgura,
    margen: number,
  ): number {
    const { ancho, fondo } = this.o.plantilla.terreno
    const esquinas: Vector3[] = []
    for (const x of [-ancho / 2, ancho / 2])
      for (const z of [-fondo / 2, fondo / 2])
        for (const y of [0, 5]) esquinas.push(new Vector3(x, y, z))
    const cam = new PerspectiveCamera(
      this.camara.fov,
      Math.max(1, this.ancho - holgura.derecha) / Math.max(1, this.alto - holgura.abajo),
      this.camara.near,
      this.camara.far,
    )
    const v = new Vector3()
    let cerca = 4
    let lejos = 160
    for (let i = 0; i < 20; i++) {
      const d = (cerca + lejos) / 2
      cam.position.setFromSpherical(new Spherical(d, polar, azimut)).add(objetivo)
      cam.lookAt(objetivo)
      cam.updateMatrixWorld()
      const cabe = esquinas.every((e) => {
        v.copy(e).project(cam)
        return Math.abs(v.x) <= margen && Math.abs(v.y) <= margen && v.z < 1
      })
      if (cabe) lejos = d
      else cerca = d
    }
    return lejos
  }

  private vistaZona(z: ZonaViva, holgura: Holgura): Vista {
    const tam = z.caja.getSize(new Vector3())
    const dist = Math.max(tam.x, tam.z, tam.y * 0.8) * 2.2 + 9
    const objetivo = new Vector3(z.centro.x, Math.min(tam.y * 0.35, 2), z.centro.z)
    const actual = new Spherical().setFromVector3(
      this.camara.position.clone().sub(this.controles?.target ?? new Vector3()),
    )
    const posicion = new Vector3()
      .setFromSpherical(new Spherical(dist, 0.92, actual.theta))
      .add(objetivo)
    return { posicion, objetivo, holgura }
  }

  private vistaActual(): Vista {
    return {
      posicion: this.camara.position.clone(),
      objetivo: this.controles?.target.clone() ?? new Vector3(),
      holgura: { ...this.holgura },
    }
  }

  private irA(v: Vista): void {
    if (this.o.reducido) {
      this.aplicarVista(v.posicion, v.objetivo, v.holgura)
      this.transicion = null
    } else {
      this.transicion = { desde: this.vistaActual(), hasta: v, inicio: performance.now(), duracion: 750 }
    }
    this.solicitar()
  }

  private aplicarVista(pos: Vector3, obj: Vector3, h: Holgura): void {
    this.camara.position.copy(pos)
    if (this.controles) this.controles.target.copy(obj)
    this.camara.lookAt(obj)
    this.holgura = h
    if (h.derecha > 0 || h.abajo > 0) {
      this.camara.setViewOffset(
        this.ancho,
        this.alto,
        h.derecha / 2,
        h.abajo / 2,
        this.ancho,
        this.alto,
      )
    } else {
      this.camara.clearViewOffset()
    }
  }

  private pasoTransicion(ahora: number): boolean {
    const tr = this.transicion
    if (!tr) return false
    const t = Math.min(1, (ahora - tr.inicio) / tr.duracion)
    const k = suavizar(t)
    const pos = tr.desde.posicion.clone().lerp(tr.hasta.posicion, k)
    const obj = tr.desde.objetivo.clone().lerp(tr.hasta.objetivo, k)
    const h: Holgura = {
      derecha: MathUtils.lerp(tr.desde.holgura.derecha, tr.hasta.holgura.derecha, k),
      abajo: MathUtils.lerp(tr.desde.holgura.abajo, tr.hasta.holgura.abajo, k),
    }
    this.aplicarVista(pos, obj, h)
    if (t >= 1) this.transicion = null
    return t < 1
  }

  private redimensionar(): void {
    const padre = this.o.canvas.parentElement ?? this.o.canvas
    const w = Math.max(1, padre.clientWidth)
    const h = Math.max(1, padre.clientHeight)
    if (w === this.ancho && h === this.alto) return
    const primera = this.ancho === 1
    this.ancho = w
    this.alto = h
    this.renderer.setSize(w, h, false)
    this.camara.aspect = w / h
    this.camara.updateProjectionMatrix()
    const z = this.zonas.find((x) => x.def.id === this.elegida)
    const v = z ? this.vistaZona(z, this.holgura) : this.vistaGeneral(this.holgura)
    if (primera || this.o.modo === 'holograma' || !this.transicion) {
      this.aplicarVista(v.posicion, v.objetivo, v.holgura)
    }
    this.controles?.update()
    this.solicitar()
  }

  // -------------------------------------------------------------------------
  // Bucle

  private solicitar = (): void => {
    if (!this.raf && !this.pausado) this.raf = requestAnimationFrame(this.cuadro)
  }

  private cuadro = (ahora: number): void => {
    this.raf = 0
    if (this.pausado) return
    let seguir = this.pasoTransicion(ahora)

    if (this.o.modo === 'holograma') {
      // ≤ 30 fps: suficiente para una rotación lenta y la mitad del consumo.
      if (ahora - this.ultimoCuadro < 33) {
        this.solicitar()
        return
      }
      const dt = this.ultimoCuadro ? Math.min(0.1, (ahora - this.ultimoCuadro) / 1000) : 0
      this.ultimoCuadro = ahora
      if (!this.o.reducido) {
        this.raiz.rotation.y += dt * 0.08
        seguir = true
      }
    } else if (this.controles && !this.transicion) {
      if (this.controles.update()) seguir = true
      this.limitarObjetivo()
    }

    if (this.punteroPendiente) {
      const id = this.elegir(this.punteroPendiente)
      this.punteroPendiente = null
      if (id !== this.sobre) {
        this.sobre = id
        this.zonas.forEach((z) => this.pintarZona(z))
        this.o.canvas.style.cursor = id ? 'pointer' : ''
        this.o.alPasar?.(id)
      }
    }

    this.renderer.render(this.escena, this.camara)
    this.informarEtiquetas()
    if (seguir) this.solicitar()
  }

  /** Que el paneo no saque la maqueta de la pantalla. */
  private limitarObjetivo(): void {
    if (!this.controles) return
    const { ancho, fondo } = this.o.plantilla.terreno
    const t = this.controles.target
    const x = MathUtils.clamp(t.x, -ancho / 2, ancho / 2)
    const z = MathUtils.clamp(t.z, -fondo / 2, fondo / 2)
    if (x !== t.x || z !== t.z) {
      const d = new Vector3(x - t.x, 0, z - t.z)
      t.add(d)
      this.camara.position.add(d)
    }
  }

  private informarEtiquetas(): void {
    if (!this.o.alDibujar) return
    const v = new Vector3()
    const res: EtiquetaPos[] = this.zonas.map((z) => {
      v.copy(z.ancla).applyMatrix4(this.raiz.matrixWorld).project(this.camara)
      return {
        id: z.def.id,
        x: ((v.x + 1) / 2) * this.ancho,
        y: ((1 - v.y) / 2) * this.alto,
        visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
        profundidad: this.camara.position.distanceTo(z.ancla),
      }
    })
    this.o.alDibujar(res)
  }

  // -------------------------------------------------------------------------
  // Puntero

  private elegir(ndc: Vector2): string | null {
    this.rayo.setFromCamera(ndc, this.camara)
    let mejor: string | null = null
    let distMejor = Infinity
    const punto = new Vector3()
    for (const z of this.zonas) {
      if (this.rayo.ray.intersectBox(z.caja, punto)) {
        const d = punto.distanceTo(this.rayo.ray.origin)
        if (d < distMejor) {
          distMejor = d
          mejor = z.def.id
        }
      }
    }
    return mejor
  }

  private ndc(e: PointerEvent): Vector2 {
    const r = this.o.canvas.getBoundingClientRect()
    return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }

  private escucharPuntero(): void {
    const c = this.o.canvas
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return
      this.punteroPendiente = this.ndc(e)
      this.solicitar()
    })
    c.addEventListener('pointerleave', () => {
      if (this.sobre) {
        this.sobre = null
        this.zonas.forEach((z) => this.pintarZona(z))
        this.o.alPasar?.(null)
        this.solicitar()
      }
    })
    c.addEventListener('pointerdown', (e) => {
      this.inicioToque = { x: e.clientX, y: e.clientY, t: performance.now() }
      this.transicion = null
    })
    c.addEventListener('pointerup', (e) => {
      const i = this.inicioToque
      this.inicioToque = null
      if (!i || Math.hypot(e.clientX - i.x, e.clientY - i.y) > 8 || performance.now() - i.t > 600) return
      this.o.alElegir?.(this.elegir(this.ndc(e)))
    })
  }

  private alPerderContexto = (e: Event): void => {
    e.preventDefault()
    this.o.alFallar?.()
  }

  private alCambiarVisibilidad = (): void => {
    if (!document.hidden) this.solicitar()
  }
}

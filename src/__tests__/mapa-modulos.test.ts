import { describe, expect, it } from 'vitest'
import type { Modulo, Permiso } from '@/api/tipos'
import {
  accionesVisibles,
  estadoAccion,
  estadoDeSecciones,
  estadoSeccion,
  SECCIONES,
  seccionContratada,
} from '@/escena/mapa-modulos'
import { seccionesDe, ZONAS } from '@/escena/plantillas/zonas'

const consulta = (modulos: Modulo[], permisos: Permiso[], esPH = true) => ({
  tieneModulo: (m: Modulo) => modulos.includes(m),
  tienePermiso: (p: Permiso) => permisos.includes(p),
  esPH,
})

const ids = (slug: string, c: ReturnType<typeof consulta>) =>
  accionesVisibles(SECCIONES[slug]!, c).map((x) => x.id)

describe('mapa de módulos', () => {
  it('toda zona apunta a secciones existentes', () => {
    for (const zonas of Object.values(ZONAS)) {
      for (const z of zonas) for (const s of z.secciones) expect(SECCIONES[s], `${z.id}→${s}`).toBeDefined()
    }
  })

  it('el slug de cada sección coincide con su clave', () => {
    for (const [clave, s] of Object.entries(SECCIONES)) expect(s.slug).toBe(clave)
  })

  it('la oficina no muestra secciones exclusivas de la PH', () => {
    for (const s of seccionesDe('oficina')) expect(SECCIONES[s]!.soloPH).toBeFalsy()
  })

  it('el directorio se abre desde el lobby en la PH y desde la recepción en la oficina', () => {
    expect(ZONAS.conjunto.find((z) => z.id === 'pantalla')!.secciones).toEqual(['directorio'])
    expect(ZONAS.oficina.find((z) => z.id === 'recepcion')!.secciones).toContain('directorio')
  })

  it('el directorio está incluido con la entidad (la publicidad no es un módulo)', () => {
    const c = consulta([], ['directorio.ver'])
    expect(estadoSeccion(SECCIONES.directorio!, c)).toBe('activa')
    expect(SECCIONES.publicidad).toBeUndefined()
  })

  it('sección sin módulo contratado queda apagada aunque haya permisos', () => {
    const c = consulta([], ['reservas.crear'])
    expect(estadoSeccion(SECCIONES['zonas-comunes']!, c)).toBe('no_contratada')
  })

  it('módulo contratado sin permisos → sin acceso', () => {
    const c = consulta(['bienes_comunes'], [])
    expect(estadoSeccion(SECCIONES['zonas-comunes']!, c)).toBe('sin_acceso')
  })

  it('basta con uno de los módulos de la sección', () => {
    const facturacion = SECCIONES.facturacion!
    expect(seccionContratada(facturacion, consulta(['facturacion_electronica'], []))).toBe(true)
    expect(seccionContratada(facturacion, consulta(['contabilidad'], []))).toBe(true)
    expect(seccionContratada(facturacion, consulta(['asambleas'], []))).toBe(false)
  })

  it('la cartera exige contabilidad_ph y contabilidad a la vez', () => {
    const cartera = SECCIONES.cartera!
    const permisos: Permiso[] = ['cartera.ver']
    expect(estadoSeccion(cartera, consulta(['contabilidad_ph'], permisos))).toBe('no_contratada')
    expect(estadoSeccion(cartera, consulta(['contabilidad'], permisos))).toBe('no_contratada')
    expect(estadoSeccion(cartera, consulta(['contabilidad_ph', 'contabilidad'], permisos))).toBe('activa')
  })

  it('una acción con módulo propio se oculta sin apagar la sección', () => {
    const permisos: Permiso[] = ['facturacion.ver', 'facturacion.emitir', 'facturacion.recibir']
    const soloContabilidad = consulta(['contabilidad'], permisos)
    expect(ids('facturacion', soloContabilidad)).toEqual(['inicio', 'facturas', 'catalogo'])
    expect(estadoSeccion(SECCIONES.facturacion!, soloContabilidad)).toBe('activa')
    expect(ids('facturacion', consulta(['facturacion_electronica'], permisos))).toEqual([
      'inicio',
      'facturas',
      'catalogo',
      'documentos',
      'recibidas',
    ])
    // Contabilizar lo facturado exige el módulo de contabilidad (además del permiso).
    const contabilizar: Permiso[] = ['contabilidad.comprobantes.contabilizar']
    expect(ids('facturacion', consulta(['facturacion_electronica'], contabilizar))).toEqual([])
    expect(ids('facturacion', consulta(['facturacion_electronica', 'contabilidad'], contabilizar))).toEqual(['contabilizacion'])
  })

  it('las declaraciones tributarias solo aparecen con contabilidad', () => {
    const permisos: Permiso[] = ['tributario.preparar', 'terceros.gestionar']
    expect(ids('tributario', consulta(['facturacion_electronica'], permisos))).toEqual(['terceros'])
    expect(ids('tributario', consulta(['contabilidad'], permisos))).toEqual(['terceros', 'impuestos', 'exogena', 'beneficiarios'])
  })

  it('las acciones solo PH se ocultan en la empresa', () => {
    const permisos: Permiso[] = ['directorio.ver', 'directorio.compartir', 'proteccion_datos.gestionar', 'roles.ver']
    expect(ids('directorio', consulta([], permisos, true))).toEqual(['inicio', 'ofertas', 'busco', 'enlace'])
    expect(ids('directorio', consulta([], permisos, false))).toEqual(['inicio', 'ofertas'])
    expect(ids('entidad', consulta([], permisos, false))).toEqual(['usuarios', 'roles'])
  })

  it('una acción no visible para el rol queda sin acceso aunque la sección esté activa', () => {
    const c = consulta([], ['censo.ver'])
    const unidades = SECCIONES.unidades!
    expect(estadoAccion(unidades, 'censo', c)).toBe('activa')
    expect(estadoAccion(unidades, 'importar', c)).toBe('sin_acceso')
    expect(estadoAccion(unidades, '', c)).toBe('activa')
    expect(estadoAccion(SECCIONES['zonas-comunes']!, 'reservar', c)).toBe('no_contratada')
  })

  it('una zona está activa si alguna de sus secciones lo está', () => {
    const c = consulta(['asambleas'], ['asambleas.ver'])
    // Salón social: zonas comunes (no contratada) + asambleas (activa).
    expect(estadoDeSecciones(['zonas-comunes', 'asambleas'], c)).toBe('activa')
    expect(estadoDeSecciones(['zonas-comunes'], c)).toBe('no_contratada')
  })

  it('una zona con todas sus secciones sin acceso queda sin acceso', () => {
    expect(estadoDeSecciones(['entidad', 'archivo'], consulta([], []))).toBe('sin_acceso')
  })

  it('las secciones próximas siempre están apagadas', () => {
    const proxima = { ...SECCIONES.nomina!, proximamente: true }
    expect(estadoSeccion(proxima, consulta(['nomina'], ['nomina.ver']))).toBe('proximamente')
  })

  it('la nómina se vende sola, en la PH y en la empresa', () => {
    expect(estadoSeccion(SECCIONES.nomina!, consulta([], ['nomina.ver']))).toBe('no_contratada')
    expect(estadoSeccion(SECCIONES.nomina!, consulta(['nomina'], ['nomina.ver'], false))).toBe('activa')
    expect(estadoSeccion(SECCIONES.nomina!, consulta(['nomina'], []))).toBe('sin_acceso')
    expect(ZONAS.conjunto.find((z) => z.id === 'administracion')!.secciones).toContain('nomina')
  })

  it('la nómina muestra cada acción por su permiso', () => {
    const c = consulta(['nomina'], ['nomina.ver', 'nomina.novedades.registrar'])
    expect(ids('nomina', c)).toEqual(['inicio', 'empleados', 'novedades', 'periodos'])
    expect(ids('nomina', consulta(['nomina'], ['nomina.ver', 'nomina.salarios.ver']))).toContain('reportes')
  })

  it('una acción que aún no existe en el backend abre «Próximamente»', () => {
    const c = consulta(['nomina'], ['nomina.ver', 'nomina.salarios.ver'])
    expect(ids('nomina', c)).toContain('pila')
    expect(estadoAccion(SECCIONES.nomina!, 'pila', c)).toBe('proximamente')
    expect(estadoAccion(SECCIONES.nomina!, 'reportes', c)).toBe('activa')
  })
})

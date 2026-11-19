import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { autorizarPublicidad } from '@/api/publicidad'
import { limpiar } from '@/api/tokens'
import * as d from '@/modulos/directorio/api'
import { useCategoriasDirectorio } from '@/modulos/directorio/store'
import { useEventosPiezas } from '@/modulos/directorio/useEventosPiezas'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { conRespuesta, prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const EMPRESA = '01930000-0000-7000-8000-000000000003'
const ROSA = '01930000-0000-7000-8000-000000014001'
const PLOMERIA = '01930000-0000-7000-8000-000000014003'
const TODO = { categoria: '', q: '' }

beforeEach(async () => {
  limpiar(false)
  prepararConDemo()
  await useSesion().iniciar('residente', 'x')
  await useEntidad().entrar(PH)
})

describe('directorio', () => {
  it('lista con las destacadas primero y filtra por rama, categoría y sinónimo', async () => {
    const p = await d.listarDirectorio(PH, undefined, TODO)
    expect(p.datos.slice(0, 2).every((f) => f.destacada)).toBe(true)
    expect(p.siguiente).toBeNull()
    expect((await d.listarDirectorio(PH, undefined, { categoria: 'hogar', q: '' })).datos.map((f) => f.nombre_comercial)).toEqual([
      'Técnico Lavadoras Ya',
      'Plomería Express',
      'Cerrajería 24 horas',
    ])
    expect((await d.listarDirectorio(PH, undefined, { categoria: '', q: 'modista' })).datos[0]?.nombre_comercial).toBe('Modistería Rosa')
    expect((await d.listarDirectorio(PH, undefined, { categoria: '', q: 'zzz' })).datos).toEqual([])
  })

  it('en la empresa solo llegan los de cobertura nacional', async () => {
    const p = await d.listarDirectorio(EMPRESA, undefined, TODO)
    expect(p.datos.map((f) => f.nombre_comercial)).toContain('Papelería Nacional')
    expect(p.datos.some((f) => f.nombre_comercial === 'Modistería Rosa')).toBe(false)
  })

  it('destacadas por categoría, categorías sin restringidas y ficha (404 si no alcanza)', async () => {
    expect((await d.destacadas(PH)).length).toBe(2)
    expect((await d.destacadas(PH, 'oficios')).map((f) => f.nombre_comercial)).toEqual(['Modistería Rosa'])
    expect((await d.categorias(PH)).some((c) => c.restringida)).toBe(false)
    expect((await d.fichaAnunciante(PH, ROSA)).nombre_comercial).toBe('Modistería Rosa')
    await expect(d.fichaAnunciante(EMPRESA, ROSA)).rejects.toMatchObject({ estado: 404 })
  })

  it('el store pide las categorías una vez por entidad y nombra la principal', async () => {
    const s = useCategoriasDirectorio()
    await Promise.all([s.asegurar(PH), s.asegurar(PH)])
    expect(s.nombre(['costura'])).toBe('Costura y modistería')
    expect(s.opciones[0]?.etiqueta).toBe('Todas las categorías')
    const antes = s.lista
    await s.asegurar(PH)
    expect(s.lista).toBe(antes)
  })
})

describe('reseñas', () => {
  it('una reseña por cuenta: la segunda reemplaza a la primera', async () => {
    const primera = await d.guardarResena(PH, ROSA, { calificacion: 4, texto: '  Buen servicio  ' })
    expect(primera).toMatchObject({ propia: true, calificacion: 4, texto: 'Buen servicio' })
    const segunda = await d.guardarResena(PH, ROSA, { calificacion: 5, texto: '' })
    expect(segunda.id).toBe(primera.id)
    const lista = (await d.resenas(PH, ROSA)).datos
    expect(lista.filter((r) => r.propia)).toHaveLength(1)
    expect(lista[0]).toMatchObject({ propia: true, calificacion: 5, texto: null })
  })

  it('valida la calificación y da 409 si la moderación ocultó la anterior', async () => {
    await expect(d.guardarResena(PH, ROSA, { calificacion: 6 })).rejects.toMatchObject({ estado: 422 })
    await expect(d.guardarResena(PH, PLOMERIA, { calificacion: 3 })).rejects.toMatchObject({ estado: 409, codigo: 'conflicto' })
  })

  it('reportar una reseña: nuevo la primera vez, repetido después', async () => {
    const r = (await d.resenas(PH, ROSA)).datos[0]!
    expect(await d.reportarResena(PH, r.id, 'Ofensiva')).toBe(true)
    expect(await d.reportarResena(PH, r.id, 'Otra vez')).toBe(false)
    await expect(d.reportarResena(PH, r.id, ' ')).rejects.toMatchObject({ estado: 422 })
  })
})

describe('Busco …', () => {
  it('sugiere por sinónimo y solo con el «Sí» comparte el contacto', async () => {
    const b = await d.buscarProveedores(PH, 'busco costurera', 'k1')
    expect(b.categoria?.codigo).toBe('costura')
    expect(b.sugerencias.map((s) => s.nombre_comercial)).toEqual(['Modistería Rosa'])
    expect(b.contactables).toBe(true)
    const c = await d.autorizarContacto(PH, b.solicitud_id, 'k2')
    expect(c).toEqual({ proveedores: ['Modistería Rosa'], seguimiento: true })
  })

  it('sin proveedores por WhatsApp no ofrece el contacto; lo incomprensible da 422', async () => {
    const b = await d.buscarProveedores(PH, 'plomero', 'k3')
    expect(b.contactables).toBe(false)
    await expect(d.autorizarContacto(PH, b.solicitud_id, 'k4')).rejects.toMatchObject({ estado: 422 })
    await expect(d.buscarProveedores(PH, 'qwerty', 'k5')).rejects.toMatchObject({ estado: 422 })
    await expect(d.autorizarContacto(PH, 'otra', 'k6')).rejects.toMatchObject({ estado: 404 })
  })
})

describe('enlace público', () => {
  it('es estable: dos GET dan el mismo token; generar lo cambia y revocar lo apaga', async () => {
    const a = await d.estadoEnlace(PH)
    const b = await d.estadoEnlace(PH)
    expect(a.activo).toBe(true)
    expect(b.token).toBe(a.token)
    const nuevo = await d.generarEnlace(PH, 'k')
    expect(nuevo.token).not.toBe(a.token)
    expect((await d.estadoEnlace(PH)).token).toBe(nuevo.token)
    await d.revocarEnlace(PH)
    expect((await d.estadoEnlace(PH)).activo).toBe(false)
    await expect(d.revocarEnlace(PH)).rejects.toMatchObject({ estado: 404 })
  })
})

describe('piezas publicitarias', () => {
  it('ocultas sin autorización; con ella, piezas, cupón y reporte', async () => {
    expect(await d.piezas(PH)).toEqual([])
    const oferta = '01930000-0000-7000-8000-000000014201'
    await expect(d.obtenerCupon(PH, oferta)).rejects.toMatchObject({ estado: 404 })
    await autorizarPublicidad(PH, 1)
    const lista = await d.piezas(PH)
    expect(lista).toHaveLength(3)
    expect((await d.obtenerCupon(PH, oferta)).codigo).toBe('ROSA10')
    expect(await d.reportarAnuncio(PH, oferta, 'Engañosa')).toBe(true)
    expect(await d.reportarAnuncio(PH, oferta, 'Engañosa')).toBe(false)
    await expect(d.reportarAnuncio(PH, 'nada', 'x')).rejects.toMatchObject({ estado: 404 })
  })

  it('registra los eventos en lote (una impresión por pieza), al salir también, y tolera fallos', async () => {
    const lotes: unknown[] = []
    let falla = false
    conRespuesta('POST', /\/publicidad\/eventos$/, (r) => {
      void r.json().then((b: { eventos: unknown }) => lotes.push(b.eventos))
      return falla ? new Response(null, { status: 500 }) : Response.json({ impresiones: 1, clics: 1 })
    })
    const scope = effectScope()
    const eventos = scope.run(() => useEventosPiezas(() => PH))!
    eventos.impresion('a')
    eventos.impresion('a')
    eventos.clic('a')
    await eventos.enviar()
    await eventos.enviar()
    await vi.waitFor(() => expect(lotes).toEqual([[{ creativo_id: 'a', impresiones: 1, clics: 1 }]]))
    falla = true
    eventos.clic('a')
    await expect(eventos.enviar()).resolves.toBeUndefined()
    eventos.clic('b')
    scope.stop()
    await vi.waitFor(() => expect(lotes).toHaveLength(3))
    expect(lotes[2]).toEqual([{ creativo_id: 'b', impresiones: 0, clics: 1 }])
  })
})

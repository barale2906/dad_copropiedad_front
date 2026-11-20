import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarCliente } from '@/api/cliente'
import { cabeceraDe, credencial, olvidarCredencial, tomarCredencial, type Navegador } from '@/api/credencial-externa'
import * as p from '@/api/publico'
import { limpiar } from '@/api/tokens'
import { fetchDemo } from '@/mocks/demo'
import { useSesion } from '@/stores/sesion'
import { API, prepararConDemo } from './ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
/** Asistente presente de la asamblea instalada que aún no vota «estados financieros». */
const PRESENTE = `demo-papeleta-${vid(4409)}`
/** Asistente ausente de la asamblea mixta (puede registrar su ingreso). */
const AUSENTE = `demo-papeleta-${vid(4303)}`

function nav(hash: string): Navegador & { replaceState: ReturnType<typeof vi.fn> } {
  const replaceState = vi.fn()
  return { ubicacion: { hash, pathname: '/papeleta/x', search: '?a=1' }, historia: { replaceState, state: { s: 1 } }, replaceState }
}

describe('credencial externa', () => {
  beforeEach(() => olvidarCredencial('papeleta'))

  it('lee el token del fragmento, lo guarda en memoria y lo borra de la barra', () => {
    const n = nav('#t=abc')
    expect(tomarCredencial('papeleta', { nav: n })).toBe('abc')
    expect(n.replaceState).toHaveBeenCalledWith({ s: 1 }, '', '/papeleta/x?a=1')
    expect(credencial('papeleta')).toBe('abc')
    expect(cabeceraDe('papeleta')).toEqual({ 'X-Papeleta': 'abc' })
    // Sin fragmento conserva el de memoria.
    expect(tomarCredencial('papeleta', { nav: nav('') })).toBe('abc')
  })

  it('acepta #token=, puede conservar el fragmento y se olvida', () => {
    const n = nav('#token=xyz')
    expect(tomarCredencial('pantalla', { conservar: true, nav: n })).toBe('xyz')
    expect(n.replaceState).not.toHaveBeenCalled()
    olvidarCredencial('pantalla')
    expect(credencial('pantalla')).toBeNull()
    expect(cabeceraDe('pantalla')).toEqual({ 'X-Pantalla': '' })
    expect(tomarCredencial('comercio', { nav: nav('#otra=1') })).toBeNull()
  })
})

describe('páginas públicas contra el demo', () => {
  beforeEach(() => {
    limpiar(false)
    prepararConDemo()
  })

  const con = (tipo: 'papeleta' | 'directorio' | 'pantalla' | 'comercio', token: string) => tomarCredencial(tipo, { nav: nav(`#t=${token}`) })

  it('la credencial va en su cabecera y nunca con la sesión de la persona', async () => {
    await useSesion().iniciar('admin', 'x')
    const vistas: Request[] = []
    iniciarCliente(API, (r) => {
      vistas.push(r.clone())
      return fetchDemo(r)
    })
    con('papeleta', PRESENTE)
    await p.papeleta(PH)
    expect(vistas.at(-1)?.headers.get('X-Papeleta')).toBe(PRESENTE)
    expect(vistas.at(-1)?.headers.get('Authorization')).toBeNull()
    await p.verificarCertificado(PH, 'pys-1')
    expect(vistas.at(-1)?.headers.get('Authorization')).toBeNull()
  })

  it('papeleta: vota una vez (el reintento no duplica) y el segundo intento da ya_voto', async () => {
    con('papeleta', PRESENTE)
    const papeleta = await p.papeleta(PH)
    const abierta = papeleta.preguntas_abiertas.find((x) => !x.ya_voto)!
    const si = abierta.pregunta.opciones[0]!.id
    const voto = await p.votarPapeleta(PH, abierta.pregunta.id, [si], 'clave-1')
    expect(voto.registrado).toBe(true)
    expect(voto.bienes).toEqual(papeleta.asistente.bienes.map((b) => b.codigo))
    expect(voto.omitidos).toEqual([])
    expect((await p.votarPapeleta(PH, abierta.pregunta.id, [si], 'clave-1')).registrado).toBe(false)
    await expect(p.votarPapeleta(PH, abierta.pregunta.id, [si], 'clave-2')).rejects.toMatchObject({ estado: 409, codigo: 'ya_voto' })
    expect((await p.papeleta(PH)).preguntas_abiertas.find((x) => x.pregunta.id === abierta.pregunta.id)?.ya_voto).toBe(true)
    await expect(p.ingresoPapeleta(PH)).rejects.toMatchObject({ estado: 409 })
  })

  it('papeleta: el ausente registra su ingreso en la asamblea mixta y sale', async () => {
    con('papeleta', AUSENTE)
    const papeleta = await p.papeleta(PH)
    expect(papeleta.reunion.modalidad).toBe('mixta')
    expect(papeleta.asistente.presente).toBe(false)
    expect((await p.ingresoPapeleta(PH)).presente).toBe(true)
    expect((await p.salidaPapeleta(PH)).presente).toBe(false)
    await expect(p.salidaPapeleta(PH)).rejects.toMatchObject({ estado: 409 })
  })

  it('un token que no corresponde es un enlace no válido', async () => {
    con('papeleta', 'inventado')
    const e = await p.papeleta(PH).catch((x: unknown) => x)
    expect(p.enlaceNoValido(e)).toBe(true)
    expect(p.enlaceNoValido(new Error('x'))).toBe(false)
    expect(p.esCodigoDeEnlaceNoValido('enlace_invalido')).toBe(true)
    expect(p.esCodigoDeEnlaceNoValido('conflicto')).toBe(false)
  })

  it('directorio público y pantalla del lobby con su token', async () => {
    con('directorio', 'demo-directorio-7Q4K')
    const d = await p.directorioPublico(PH, undefined, 'modista')
    expect(d.copropiedad).toContain('Robles')
    expect(d.fichas.datos.map((f) => f.nombre_comercial)).toEqual(['Modistería Rosa'])
    con('directorio', 'viejo')
    await expect(p.directorioPublico(PH, undefined)).rejects.toMatchObject({ estado: 401 })
    con('pantalla', 'demo-pantalla-ROBLES')
    expect((await p.cartelera(PH)).length).toBeGreaterThan(0)
    con('pantalla', 'otro')
    await expect(p.cartelera(PH)).rejects.toMatchObject({ estado: 401 })
  })

  it('el comercio redime: suma usos; desconocido 404, vencido 422, enlace revocado 401', async () => {
    con('comercio', 'demo-cupones-ROSA')
    const r = await p.redimirCupon(' rosa10 ')
    expect(r).toMatchObject({ titulo: '10 % en arreglos de ropa', usos: 8, restantes: null })
    await expect(p.redimirCupon('NOEXISTE')).rejects.toMatchObject({ estado: 404 })
    await expect(p.redimirCupon('VENCIDO1')).rejects.toMatchObject({ estado: 422 })
    con('comercio', 'revocado')
    await expect(p.redimirCupon('ROSA10')).rejects.toMatchObject({ estado: 401 })
  })

  it('verifica certificados y limita los intentos fallidos con Retry-After', async () => {
    expect(await p.verificarCertificado(PH, 'pys-7q4k-2m9d')).toMatchObject({ valido: true, tipo: 'paz_y_salvo' })
    expect(await p.verificarCertificado(PH, 'DEU-1')).toMatchObject({ valido: true, tipo: 'deuda' })
    for (let i = 0; i < 5; i++) expect((await p.verificarCertificado(PH, `malo-${i}`)).valido).toBe(false)
    await expect(p.verificarCertificado(PH, 'otro')).rejects.toMatchObject({ estado: 429, reintentarEn: 30 })
  })
})

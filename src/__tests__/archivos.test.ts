import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirArchivo, aBase64, descargar, guardarBlob, nombreDeDisposicion, subirArchivo } from '@/api/archivos'
import { ErrorApi } from '@/api/errores'
import { limpiar } from '@/api/tokens'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from './ayudantes'

const ENTIDAD = '01930000-0000-7000-8000-000000000001'

describe('archivos', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })
  afterEach(() => vi.restoreAllMocks())

  it('sube el archivo crudo con su nombre y clasificación', async () => {
    const a = await subirArchivo(ENTIDAD, new File(['hola'], 'acta.pdf'), 'publico')
    expect(a).toMatchObject({ nombre: 'acta.pdf', tamano_bytes: 4, clasificacion: 'publico', tipo: 'application/pdf' })
  })

  it('abre el enlace firmado en una pestaña abierta de antemano', async () => {
    const pestana = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
    await abrirArchivo(ENTIDAD, 'arch-1')
    expect(pestana.location.href).toBe('https://archivos.demo.dad/arch-1?firma=demo')
    expect(pestana.opener).toBeNull()
  })

  it('si el enlace falla, cierra la pestaña y propaga el error', async () => {
    const pestana = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
    limpiar(false)
    await expect(abrirArchivo(ENTIDAD, 'x')).rejects.toBeInstanceOf(ErrorApi)
    expect(pestana.close).toHaveBeenCalled()
  })
})

describe('descargas', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lee el nombre de Content-Disposition', () => {
    expect(nombreDeDisposicion('attachment; filename="libro.csv"')).toBe('libro.csv')
    expect(nombreDeDisposicion("attachment; filename*=UTF-8''libro%20de%20ventas.csv")).toBe('libro de ventas.csv')
    expect(nombreDeDisposicion(null, 'otro.zip')).toBe('otro.zip')
    expect(nombreDeDisposicion('attachment')).toBe('descarga')
  })

  it('guarda el archivo y devuelve el nombre y la huella', async () => {
    const crear = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const respuesta = new Response('a,b', {
      headers: { 'Content-Disposition': 'attachment; filename="v.csv"', 'X-Contenido-Sha256': 'abc' },
    })
    const r = await descargar(Promise.resolve({ data: new Blob(['a,b']), response: respuesta }))
    expect(r).toEqual({ nombre: 'v.csv', sha256: 'abc' })
    expect(crear).toHaveBeenCalled()
    expect(clic).toHaveBeenCalled()
  })

  it('un error de la API o de red se informa como ErrorApi', async () => {
    const fallo = new Response(null, { status: 403 })
    await expect(descargar(Promise.resolve({ error: { error: { codigo: 'sin_permiso', mensaje: 'No.' } }, response: fallo }))).rejects.toMatchObject({ codigo: 'sin_permiso' })
    await expect(descargar(Promise.reject(new TypeError('red')))).rejects.toMatchObject({ codigo: 'red' })
  })

  it('guardarBlob usa un enlace temporal', () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:y'), revokeObjectURL: vi.fn() })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    guardarBlob(new Blob(['x']), 'x.txt')
    expect(clic).toHaveBeenCalled()
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('convierte a Base64', async () => {
    expect(await aBase64(new Blob(['hola']))).toBe('aG9sYQ==')
  })
})

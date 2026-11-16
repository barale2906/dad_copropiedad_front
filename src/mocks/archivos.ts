/** Demo del archivo de la entidad: subir y pedir el enlace firmado. */
import type { Archivo, ClasificacionArchivo } from '@/api/tipos'
import { error, json, type Manejador } from './http'

let consecutivo = 0

export const archivos: Manejador = async (req, ruta) => {
  const subir = ruta.match(/^\/entidades\/([^/]+)\/archivos$/)
  if (req.method === 'POST' && subir) {
    const url = new URL(req.url)
    const nombre = url.searchParams.get('nombre')
    if (!nombre) return error(422, 'validacion', 'Falta el nombre del archivo.')
    const bytes = (await req.arrayBuffer()).byteLength
    consecutivo++
    const archivo: Archivo = {
      id: `01930000-0000-7000-8000-${String(consecutivo).padStart(12, '0')}`,
      nombre,
      tipo: nombre.endsWith('.pdf') ? 'application/pdf' : 'image/png',
      tamano_bytes: bytes,
      sha256: '0'.repeat(64),
      clasificacion: (url.searchParams.get('clasificacion') ?? 'interno') as ClasificacionArchivo,
      creado_en: new Date().toISOString(),
    }
    return json(archivo, 201)
  }
  const enlace = ruta.match(/^\/entidades\/[^/]+\/archivos\/([^/]+)\/enlace$/)
  if (req.method === 'GET' && enlace) {
    return json({ url: `https://archivos.demo.dad/${enlace[1]}?firma=demo` })
  }
  return null
}

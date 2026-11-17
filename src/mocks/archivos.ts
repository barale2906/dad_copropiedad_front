/** Demo del archivo de la entidad: subir y pedir el enlace firmado. */
import type { Archivo, ClasificacionArchivo, TipoArchivo } from '@/api/tipos'
import { error, json, type Manejador } from './http'

let consecutivo = 0

const POR_EXTENSION: Record<string, TipoArchivo> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** El backend detecta el tipo por el contenido; el demo, por la extensión. */
const tipoPorNombre = (nombre: string) => POR_EXTENSION[nombre.split('.').pop()?.toLowerCase() ?? '']

export const archivos: Manejador = async (req, ruta) => {
  const subir = ruta.match(/^\/entidades\/([^/]+)\/archivos$/)
  if (req.method === 'POST' && subir) {
    const url = new URL(req.url)
    const nombre = url.searchParams.get('nombre')
    if (!nombre) return error(422, 'validacion', 'Falta el nombre del archivo.')
    const tipo = tipoPorNombre(nombre)
    if (!tipo) return error(422, 'validacion', 'Tipo de archivo no admitido: suba un PDF o una imagen.')
    const bytes = (await req.arrayBuffer()).byteLength
    consecutivo++
    const archivo: Archivo = {
      id: `01930000-0000-7000-8000-${String(consecutivo).padStart(12, '0')}`,
      nombre,
      tipo,
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

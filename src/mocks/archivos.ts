/**
 * Demo del archivo de la entidad: listar (filtros y cursor), subir y pedir el enlace firmado.
 * Trae cuatro archivos guardados, uno de cada clasificación. No recorta los personales: los
 * usuarios demo que entran al archivo tienen `archivos.personales.ver`.
 */
import type { Archivo, ClasificacionArchivo, TipoArchivo } from '@/api/tipos'
import { error, json, type Manejador } from './http'

let consecutivo = 0
let guardados: Archivo[] = []

const haceDias = (dias: number, hora = 15) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 11) + `${hora}:00:00Z`

function guardado(n: number, nombre: string, tipo: TipoArchivo, clasificacion: ClasificacionArchivo, dias: number): Archivo {
  return {
    id: `01930000-0000-7000-8000-a${String(n).padStart(11, '0')}`,
    nombre, tipo, clasificacion,
    tamano_bytes: 180_000 + n * 52_431,
    sha256: String(n).repeat(64).slice(0, 64),
    creado_en: haceDias(dias),
  }
}

/** Deja el archivo como al entrar al demo (más recientes primero). */
export function iniciarArchivos(): void {
  consecutivo = 0
  guardados = [
    guardado(4, 'Póliza de áreas comunes 2026.pdf', 'application/pdf', 'publico', 2),
    guardado(3, 'Contrato de vigilancia.pdf', 'application/pdf', 'interno', 9),
    guardado(2, 'Autorización de tratamiento T1-101.pdf', 'application/pdf', 'personal', 20),
    guardado(1, 'Incapacidad del jardinero.jpg', 'image/jpeg', 'sensible', 40),
  ]
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function listar(url: URL): Response {
  const p = url.searchParams
  const q = sinTildes(p.get('q') ?? '')
  const filtrados = guardados.filter(
    (a) =>
      (!p.get('clasificacion') || a.clasificacion === p.get('clasificacion')) &&
      (!q || sinTildes(a.nombre).includes(q)) &&
      (!p.get('desde') || a.creado_en >= (p.get('desde') ?? '')) &&
      (!p.get('hasta') || a.creado_en < (p.get('hasta') ?? '')),
  )
  const limite = Number(p.get('limite') ?? 50)
  const inicio = Number(p.get('despues') ?? 0)
  const fin = inicio + limite
  return json({ datos: filtrados.slice(inicio, fin), siguiente: fin < filtrados.length ? String(fin) : null })
}

const POR_EXTENSION: Record<string, TipoArchivo> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** El backend detecta el tipo por el contenido; el demo, por la extensión. */
const tipoPorNombre = (nombre: string) => POR_EXTENSION[nombre.split('.').pop()?.toLowerCase() ?? '']

export const archivos: Manejador = async (req, ruta) => {
  const subir = ruta.match(/^\/entidades\/([^/]+)\/archivos$/)
  if (req.method === 'GET' && subir) return listar(new URL(req.url))
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
    guardados = [archivo, ...guardados]
    return json(archivo, 201)
  }
  const enlace = ruta.match(/^\/entidades\/[^/]+\/archivos\/([^/]+)\/enlace$/)
  if (req.method === 'GET' && enlace) {
    return json({ url: `https://archivos.demo.dad/${enlace[1]}?firma=demo` })
  }
  return null
}

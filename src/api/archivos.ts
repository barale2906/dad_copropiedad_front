/**
 * Archivos y descargas (guía §3): subir al archivo de la entidad, abrir con enlace firmado
 * (se pide justo antes y nunca se guarda) y descargar exportaciones con su huella.
 */
import { api, exigir } from './cliente'
import { ErrorApi } from './errores'
import type { Archivo, ClasificacionArchivo } from './tipos'

/** Filtros del archivo de la entidad (fechas ya en UTC: `desde` incluido, `hasta` excluido). */
export interface FiltrosArchivos {
  clasificacion?: ClasificacionArchivo
  q?: string
  desde?: string
  hasta?: string
}

/**
 * Archivo de la entidad por cursor, más recientes primero. Sin `archivos.personales.ver` el
 * backend omite los personales y sensibles (y pedir esa clasificación da 403).
 */
export function listarArchivos(entidadId: string, despues: string | undefined, filtros: FiltrosArchivos = {}) {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/archivos', {
      params: { path: { entidad_id: entidadId }, query: { ...filtros, despues, limite: 50 } },
    }),
  )
}

/** Sube un archivo y devuelve su ficha (el `id` se adjunta en otros endpoints). */
export async function subirArchivo(
  entidadId: string,
  archivo: File,
  clasificacion: ClasificacionArchivo = 'interno',
): Promise<Archivo> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/archivos', {
      params: { path: { entidad_id: entidadId }, query: { nombre: archivo.name, clasificacion } },
      // El contrato describe el cuerpo como bytes; se envía el archivo tal cual.
      body: [],
      bodySerializer: () => archivo,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  )
}

/**
 * Abre un archivo en otra pestaña con su enlace firmado (vigente 5 minutos). La pestaña se abre
 * antes de pedir el enlace para que el navegador no la bloquee como ventana emergente.
 */
export async function abrirArchivo(entidadId: string, archivoId: string): Promise<void> {
  const pestana = window.open('', '_blank')
  try {
    const { url } = await exigir(
      api().GET('/api/v1/entidades/{entidad_id}/archivos/{archivo_id}/enlace', {
        params: { path: { entidad_id: entidadId, archivo_id: archivoId } },
      }),
    )
    if (pestana) {
      pestana.opener = null
      pestana.location.href = url
    } else {
      window.location.assign(url)
    }
  } catch (e) {
    pestana?.close()
    throw e
  }
}

/** Nombre del archivo según `Content-Disposition` (`filename*` UTF-8 o `filename`). */
export function nombreDeDisposicion(cabecera: string | null, predeterminado = 'descarga'): string {
  if (!cabecera) return predeterminado
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecera)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      /* cae al nombre simple */
    }
  }
  const simple = /filename\s*=\s*"?([^";]+)"?/i.exec(cabecera)
  return simple?.[1]?.trim() || predeterminado
}

/** Guarda un `Blob` como archivo en el equipo. */
export function guardarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface Descarga {
  nombre: string
  /** `X-Contenido-Sha256` (exportaciones del contador): se muestra para que lo verifiquen. */
  sha256: string | null
}

/** Un archivo recibido de un endpoint, sin guardarlo todavía (p. ej. para mostrar un PDF). */
export interface ArchivoRecibido extends Descarga {
  blob: Blob
}

/**
 * Recibe la respuesta de un endpoint que devuelve un archivo (CSV, ZIP, PDF) con su nombre y
 * huella, sin guardarlo: lo usa `descargar` y los visores (el PDF de una factura).
 */
export async function recibirArchivo(
  peticion: Promise<{ data?: Blob; error?: unknown; response: Response }>,
  predeterminado = 'descarga',
): Promise<ArchivoRecibido> {
  let r: Awaited<typeof peticion>
  try {
    r = await peticion
  } catch {
    throw ErrorApi.red()
  }
  if (!r.response.ok || !r.data) throw ErrorApi.desde(r.response, r.error)
  return {
    blob: r.data,
    nombre: nombreDeDisposicion(r.response.headers.get('Content-Disposition'), predeterminado),
    sha256: r.response.headers.get('X-Contenido-Sha256'),
  }
}

/**
 * Descarga la respuesta de un endpoint que devuelve un archivo (CSV, ZIP, PDF):
 *
 * ```ts
 * await descargar(api().GET('…/libro-ventas', { params, parseAs: 'blob' }), 'libro-ventas.csv')
 * ```
 */
export async function descargar(
  peticion: Promise<{ data?: Blob; error?: unknown; response: Response }>,
  predeterminado = 'descarga',
): Promise<Descarga> {
  const { blob, nombre, sha256 } = await recibirArchivo(peticion, predeterminado)
  guardarBlob(blob, nombre)
  return { nombre, sha256 }
}

/** Contenido de un archivo en Base64 (extractos, XML de recibidas, `.p12`, firmas, fotos). */
export async function aBase64(archivo: Blob): Promise<string> {
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  let binario = ''
  const TROZO = 0x8000
  for (let i = 0; i < bytes.length; i += TROZO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TROZO))
  }
  return btoa(binario)
}

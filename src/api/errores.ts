import type { CodigoError, ErrorRespuesta } from './tipos'

/** Error de la API. Decida siempre por `codigo`, nunca por el texto. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: CodigoError | 'red',
    mensaje: string,
    readonly requestId: string | null = null,
    readonly reintentarEn: number | null = null,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
  }

  static desde(respuesta: Response, cuerpo: unknown): ErrorApi {
    const e = (cuerpo as ErrorRespuesta | undefined)?.error
    const retry = Number(respuesta.headers.get('Retry-After'))
    return new ErrorApi(
      respuesta.status,
      e?.codigo ?? 'interno',
      e?.mensaje ?? 'Ocurrió un error inesperado.',
      respuesta.headers.get('X-Request-Id'),
      Number.isFinite(retry) && retry > 0 ? retry : null,
    )
  }

  static red(): ErrorApi {
    return new ErrorApi(0, 'red', 'No hay conexión con el servidor. Revise su red e intente de nuevo.')
  }
}

/** Mensaje para el usuario; agrega el id de la petición en errores inesperados. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (e.codigo === 'demasiadas_peticiones' || e.codigo === 'demasiados_intentos') {
      return e.reintentarEn
        ? `${e.message} Intente de nuevo en ${Math.ceil(e.reintentarEn / 60)} min.`
        : e.message
    }
    if (e.codigo === 'interno' && e.requestId) return `${e.message} (ref. ${e.requestId})`
    return e.message
  }
  return 'Ocurrió un error inesperado.'
}

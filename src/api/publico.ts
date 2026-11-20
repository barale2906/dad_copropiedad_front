/**
 * Llamadas de las páginas públicas (sin sesión de persona): papeleta de la asamblea, directorio
 * público, pantalla del lobby, redención de cupones y verificación de certificados. La credencial
 * va en su cabecera (`credencial-externa.ts`).
 */
import { api, exigir, idempotencia } from './cliente'
import { cabeceraDe } from './credencial-externa'
import { ErrorApi } from './errores'
import type {
  Asistente,
  DirectorioPublico,
  Papeleta,
  PiezaPublicidad,
  RedencionCupon,
  VerificacionCertificado,
  Voto,
} from './tipos'

const ph = (id: string) => ({ copropiedad_id: id })

// Papeleta ---------------------------------------------------------------------------------

/** Reunión, asistente con sus bienes y preguntas abiertas (con `ya_voto`). */
export function papeleta(id: string): Promise<Papeleta> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/papeleta', { params: { path: ph(id), header: cabeceraDe('papeleta') } }))
}

/** Ingreso virtual (reuniones virtuales o mixtas): cuenta para el quórum desde ahora. */
export function ingresoPapeleta(id: string): Promise<Asistente> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/papeleta/ingreso', { params: { path: ph(id), header: cabeceraDe('papeleta') } }))
}

/** «Salir de la asamblea»: los votos se conservan. */
export function salidaPapeleta(id: string): Promise<Asistente> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/papeleta/salida', { params: { path: ph(id), header: cabeceraDe('papeleta') } }))
}

/** Vota por todos sus bienes habilitados. La `Idempotency-Key` es obligatoria (un reintento no duplica). */
export function votarPapeleta(id: string, preguntaId: string, opciones: string[], clave: string): Promise<Voto> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/papeleta/votos', {
      params: { path: ph(id), header: { ...cabeceraDe('papeleta'), ...idempotencia(clave) } },
      body: { pregunta_id: preguntaId, opciones },
    }),
  )
}

// Directorio y publicidad ------------------------------------------------------------------

export function directorioPublico(id: string, despues: string | undefined, q = ''): Promise<DirectorioPublico> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/directorio/publico', {
      params: { path: ph(id), header: cabeceraDe('directorio'), query: { despues, limite: 30, q: q.trim() || undefined } },
    }),
  )
}

/** Cartelera de la pantalla del lobby. */
export function cartelera(id: string): Promise<PiezaPublicidad[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/publicidad/pantalla', { params: { path: ph(id), header: cabeceraDe('pantalla') } }))
}

/** El comercio redime un cupón en su mostrador. */
export function redimirCupon(codigo: string): Promise<RedencionCupon> {
  return exigir(api().POST('/api/v1/publicidad/cupones/redimir', { params: { header: cabeceraDe('comercio') }, body: { codigo: codigo.trim().toUpperCase() } }))
}

// Certificados -----------------------------------------------------------------------------

/** Verifica el código de un paz y salvo o certificado de deuda (el código es la credencial). */
export function verificarCertificado(id: string, codigo: string): Promise<VerificacionCertificado> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/certificados/verificacion', { params: { path: ph(id) }, body: { codigo: codigo.trim().toUpperCase() } }),
  )
}

/** Códigos con los que el backend dice que el enlace no sirve (sin token, vencido o revocado). */
export const esCodigoDeEnlaceNoValido = (codigo: string | null) => codigo === 'no_autenticado' || codigo === 'enlace_invalido'

/** ¿El error dice que el enlace no sirve? */
export function enlaceNoValido(e: unknown): boolean {
  return e instanceof ErrorApi && (esCodigoDeEnlaceNoValido(e.codigo) || e.estado === 401)
}

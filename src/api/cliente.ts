/**
 * Cliente HTTP tipado (openapi-fetch) sobre el contrato `esquema.d.ts`.
 *
 * El middleware pone `Authorization` y `X-Request-Id`, renueva antes de que venza el token y,
 * si aun así llega un 401, renueva una vez y repite la petición (guía del backend §4).
 */
import createClient, { type Client, type Middleware } from 'openapi-fetch'
import type { paths } from './esquema'
import { ErrorApi } from './errores'
import { configurarTokens, haySesion, renovar, tokenAcceso } from './tokens'
import { uuid } from './uuid'

type Transporte = (r: Request) => Promise<Response>

let cliente: Client<paths> | null = null
let transporte: Transporte = (r) => fetch(r)
const copias = new Map<string, Request>()

const SIN_SESION = ['/auth/sesion', '/auth/contrasena/']

function esRutaSinSesion(url: string): boolean {
  const ruta = new URL(url, location.origin).pathname
  return SIN_SESION.some((p) => ruta.includes(p)) && !ruta.endsWith('/auth/sesion/renovar')
}

const autenticacion: Middleware = {
  async onRequest({ request, id }) {
    request.headers.set('X-Request-Id', uuid())
    if (esRutaSinSesion(request.url) && request.method === 'POST') return request
    if (!tokenAcceso() && haySesion()) await renovar().catch(() => false)
    const token = tokenAcceso()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    copias.set(id, request.clone())
    return request
  },
  async onResponse({ response, id }) {
    const copia = copias.get(id)
    copias.delete(id)
    if (response.status !== 401 || !copia || !haySesion()) return response
    if (!(await renovar().catch(() => false))) return response
    const repetida = new Request(copia)
    repetida.headers.set('Authorization', `Bearer ${tokenAcceso()}`)
    return transporte(repetida)
  },
  onError({ id }) {
    copias.delete(id)
  },
}

/** `apiUrl`: origen del backend sin `/api/v1` (las rutas del contrato ya lo traen). */
export function iniciarCliente(apiUrl: string, fetchPropio?: Transporte): void {
  transporte = fetchPropio ?? ((r) => fetch(r))
  configurarTokens({ apiUrl, transporte })
  cliente = createClient<paths>({ baseUrl: apiUrl, fetch: transporte })
  cliente.use(autenticacion)
}

export function api(): Client<paths> {
  if (!cliente) throw new Error('iniciarCliente() no se ha llamado')
  return cliente
}

/**
 * Desenvuelve la respuesta de openapi-fetch: devuelve `data` o lanza `ErrorApi`.
 *
 * ```ts
 * const yo = await exigir(api().GET('/api/v1/yo'))
 * ```
 */
export async function exigir<T>(
  p: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let r: Awaited<typeof p>
  try {
    r = await p
  } catch {
    throw ErrorApi.red()
  }
  if (r.error !== undefined || !r.response.ok) throw ErrorApi.desde(r.response, r.error)
  return r.data as T
}

/** Cabecera `Idempotency-Key`: genere una por acción del usuario y reutilícela al reintentar. */
export function idempotencia(clave: string = uuid()): { 'Idempotency-Key': string } {
  return { 'Idempotency-Key': clave }
}

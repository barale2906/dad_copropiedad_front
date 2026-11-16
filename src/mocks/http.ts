/** Utilidades del backend simulado: respuestas con el formato del contrato. */
import type { CodigoError } from '@/api/tipos'

/** Atiende una petición del demo; `null` = no es suya (sigue con el siguiente manejador). */
export type Manejador = (req: Request, ruta: string) => Promise<Response | null> | Response | null

export function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'demo' },
  })
}

export function error(estado: number, codigo: CodigoError, mensaje: string): Response {
  return json({ error: { codigo, mensaje } }, estado)
}

export function sinContenido(estado = 204): Response {
  return new Response(null, { status: estado, headers: { 'X-Request-Id': 'demo' } })
}

export async function cuerpo<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}

/** Código de verificación que acepta el demo (2FA, correo, definir contraseña). */
export const CODIGO_DEMO = '123456'

/**
 * Autorización de publicidad de la plataforma (`/entidades/{id}/publicidad/autorizacion`): la da
 * o la retira solo el titular, por persona y entidad. La usan «Mi privacidad» y las ofertas del
 * directorio.
 */
import { api, exigir } from './cliente'
import type { AutorizacionPublicidad } from './tipos'

const ruta = '/api/v1/entidades/{entidad_id}/publicidad/autorizacion' as const
const en = (entidadId: string) => ({ params: { path: { entidad_id: entidadId } } })

/** ¿La cuenta autorizó la publicidad? Incluye la política vigente que tendría que aceptar. */
export function autorizacionPublicidad(entidadId: string): Promise<AutorizacionPublicidad> {
  return exigir(api().GET(ruta, en(entidadId)))
}

/** Acepta la política de publicidad vigente (`version`); 422 si ya no es la vigente. */
export async function autorizarPublicidad(entidadId: string, version: number): Promise<void> {
  await exigir(api().POST(ruta, { ...en(entidadId), body: { version, medio: 'web' } }))
}

export async function retirarPublicidad(entidadId: string): Promise<void> {
  await exigir(api().DELETE(ruta, en(entidadId)))
}

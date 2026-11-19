/** Llamadas de la protección de datos personales de la PH (`/copropiedades/{id}/…`). */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  AutorizacionTratamiento,
  DatosTitular,
  EstadoSolicitudTitular,
  FinalidadTratamiento,
  MedioAutorizacion,
  NuevaPolitica,
  Politica,
  SolicitudTitular,
  TipoSolicitudTitular,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const persona = (id: string, personaId: string) => ({ path: { copropiedad_id: id, persona_id: personaId } })
const solicitud = (id: string, solicitudId: string) => ({ path: { copropiedad_id: id, solicitud_id: solicitudId } })

/** Política vigente, o `null` si aún no se ha publicado ninguna. */
export async function politicaVigente(id: string): Promise<Politica | null> {
  const r = await exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/politica', { params: ph(id) }))
  return (r as Politica | null | undefined) ?? null
}

export function politicas(id: string): Promise<Politica[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/politicas', { params: ph(id) }))
}

/** Publica una versión nueva (422 sin texto ni archivo, o con vigencia pasada). */
export function publicarPolitica(id: string, datos: NuevaPolitica, clave: string): Promise<Politica> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/politicas', {
      params: ph(id),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

export interface FiltrosSolicitudes {
  estado?: EstadoSolicitudTitular
  personaId?: string
  /** Sin responder que vencen hasta esta fecha (`YYYY-MM-DD`; hoy = las vencidas). */
  vencenHasta?: string
}

export function listarSolicitudes(id: string, despues: string | undefined, f: FiltrosSolicitudes = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/solicitudes', {
      params: {
        ...ph(id),
        query: { limite: 50, despues, estado: f.estado, persona_id: f.personaId, vencen_hasta: f.vencenHasta },
      },
    }),
  )
}

export function radicarSolicitud(
  id: string,
  datos: { persona_id: string; tipo: TipoSolicitudTitular; detalle?: string | null },
  clave: string,
): Promise<SolicitudTitular> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/solicitudes', {
      params: ph(id),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

export function tramitarSolicitud(id: string, solicitudId: string): Promise<SolicitudTitular> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/solicitudes/{solicitud_id}/tramite', {
      params: solicitud(id, solicitudId),
    }),
  )
}

/** Prórroga única antes del vencimiento (422 si ya se prorrogó o venció). */
export function prorrogarSolicitud(id: string, solicitudId: string, motivo: string): Promise<SolicitudTitular> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/solicitudes/{solicitud_id}/prorroga', {
      params: solicitud(id, solicitudId),
      body: { motivo },
    }),
  )
}

export function responderSolicitud(
  id: string,
  solicitudId: string,
  datos: { respuesta?: string | null; archivo_id?: string | null },
): Promise<SolicitudTitular> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/solicitudes/{solicitud_id}/respuesta', {
      params: solicitud(id, solicitudId),
      body: datos,
    }),
  )
}

export function autorizacionesDe(id: string, personaId: string): Promise<AutorizacionTratamiento[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}/autorizaciones-tratamiento', {
      params: persona(id, personaId),
    }),
  )
}

export async function otorgarAutorizacion(
  id: string,
  personaId: string,
  datos: { finalidades: FinalidadTratamiento[]; medio: MedioAutorizacion; evidencia_archivo_id?: string | null },
  clave: string,
): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}/autorizaciones-tratamiento', {
      params: persona(id, personaId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

/** Revoca las finalidades dadas; devuelve cuántas autorizaciones se revocaron. */
export async function revocarAutorizacion(id: string, personaId: string, finalidades: FinalidadTratamiento[]): Promise<number> {
  const r = await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}/autorizaciones-tratamiento/revocacion', {
      params: persona(id, personaId),
      body: { finalidades },
    }),
  )
  return r.revocadas
}

/** Lo que la PH trata de una persona. **Se audita**: pedir solo tras `AvisoAuditado`. */
export function datosTratados(id: string, personaId: string): Promise<DatosTitular> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}/datos-tratados', { params: persona(id, personaId) }),
  )
}

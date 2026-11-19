/**
 * Llamadas del directorio y la publicidad. Lo común a PH y empresas va por `/entidades/{id}`;
 * reseñas, «Busco …» y el enlace público solo existen en la PH (`/copropiedades/{id}`).
 */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  BusquedaDirectorio,
  CategoriaDirectorio,
  ContactoAutorizado,
  CuponPublicidad,
  EnlaceDirectorioGenerado,
  EstadoEnlaceDirectorio,
  EventoPublicidad,
  FichaDirectorio,
  NuevaResena,
  PiezaPublicidad,
  Resena,
} from '@/api/tipos'
import type { Pagina } from '@/composables/useListado'

const en = (id: string) => ({ entidad_id: id })
const ph = (id: string) => ({ copropiedad_id: id })

/** Filtros del directorio: categoría (o rama, con sus subcategorías) y texto libre. */
export interface FiltrosDirectorio {
  categoria: string
  q: string
}

// Directorio (PH y empresa) ----------------------------------------------------------------

export function listarDirectorio(id: string, despues: string | undefined, f: FiltrosDirectorio): Promise<Pagina<FichaDirectorio>> {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/directorio', {
      params: { path: en(id), query: { despues, limite: 30, categoria: f.categoria || undefined, q: f.q.trim() || undefined } },
    }),
  )
}

/** Hasta 10 fichas destacadas vigentes (vacío si la plataforma excluyó la entidad). */
export function destacadas(id: string, categoria = ''): Promise<FichaDirectorio[]> {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/directorio/destacadas', {
      params: { path: en(id), query: { categoria: categoria || undefined } },
    }),
  )
}

export function categorias(id: string): Promise<CategoriaDirectorio[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/directorio/categorias', { params: { path: en(id) } }))
}

export function fichaAnunciante(id: string, anuncianteId: string): Promise<FichaDirectorio> {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/directorio/anunciantes/{anunciante_id}', {
      params: { path: { ...en(id), anunciante_id: anuncianteId } },
    }),
  )
}

// Reseñas (solo PH) ------------------------------------------------------------------------

export function resenas(id: string, anuncianteId: string, despues?: string): Promise<Pagina<Resena>> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/directorio/anunciantes/{anunciante_id}/resenas', {
      params: { path: { ...ph(id), anunciante_id: anuncianteId }, query: { despues, limite: 50 } },
    }),
  )
}

/** Crea o reemplaza la reseña de la cuenta (una por anunciante); 409 si la moderación ocultó la anterior. */
export function guardarResena(id: string, anuncianteId: string, resena: NuevaResena): Promise<Resena> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/directorio/anunciantes/{anunciante_id}/resena', {
      params: { path: { ...ph(id), anunciante_id: anuncianteId } },
      body: { calificacion: resena.calificacion, texto: resena.texto?.trim() || null },
    }),
  )
}

/** Reporta una reseña a la moderación; `false` si ya la había reportado. */
export async function reportarResena(id: string, resenaId: string, motivo: string): Promise<boolean> {
  const r = await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/directorio/resenas/{resena_id}/reportes', {
      params: { path: { ...ph(id), resena_id: resenaId } },
      body: { motivo },
    }),
  )
  return r.nuevo
}

// «Busco …» (solo PH) ----------------------------------------------------------------------

/** Sugiere hasta 3 proveedores para la necesidad; no comparte nada con ellos. */
export function buscarProveedores(id: string, texto: string, clave: string): Promise<BusquedaDirectorio> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/directorio/busquedas', {
      params: { path: ph(id) },
      body: { texto: texto.trim() },
      headers: idempotencia(clave),
    }),
  )
}

/** Con el «Sí» explícito: comparte el nombre y el celular del censo con los sugeridos de esta búsqueda. */
export function autorizarContacto(id: string, solicitudId: string, clave: string): Promise<ContactoAutorizado> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/directorio/busquedas/{solicitud_id}/contacto', {
      params: { path: { ...ph(id), solicitud_id: solicitudId } },
      headers: idempotencia(clave),
    }),
  )
}

// Enlace público (solo PH) -----------------------------------------------------------------

/** El enlace vigente: el mismo token mientras no se regenere ni se revoque. */
export function estadoEnlace(id: string): Promise<EstadoEnlaceDirectorio> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/directorio/enlace-publico', { params: { path: ph(id) } }))
}

/** Genera un enlace nuevo; el anterior deja de funcionar. */
export function generarEnlace(id: string, clave: string): Promise<EnlaceDirectorioGenerado> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/directorio/enlace-publico', { params: { path: ph(id) }, headers: idempotencia(clave) }),
  )
}

export async function revocarEnlace(id: string): Promise<void> {
  await exigir(api().DELETE('/api/v1/copropiedades/{copropiedad_id}/directorio/enlace-publico', { params: { path: ph(id) } }))
}

// Piezas publicitarias (PH y empresa) ------------------------------------------------------

/** Piezas para la persona (vacío si no autorizó la publicidad). */
export function piezas(id: string): Promise<PiezaPublicidad[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/publicidad/piezas', { params: { path: en(id) } }))
}

export async function registrarEventos(id: string, eventos: EventoPublicidad[]): Promise<void> {
  await exigir(api().POST('/api/v1/entidades/{entidad_id}/publicidad/eventos', { params: { path: en(id) }, body: { eventos } }))
}

/** El código de la oferta para presentarlo en el comercio. */
export function obtenerCupon(id: string, creativoId: string): Promise<CuponPublicidad> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/publicidad/creativos/{creativo_id}/cupon', {
      params: { path: { ...en(id), creativo_id: creativoId } },
    }),
  )
}

/** Reporta un anuncio a la moderación; `false` si ya lo había reportado. */
export async function reportarAnuncio(id: string, creativoId: string, motivo: string): Promise<boolean> {
  const r = await exigir(
    api().POST('/api/v1/entidades/{entidad_id}/publicidad/creativos/{creativo_id}/reporte', {
      params: { path: { ...en(id), creativo_id: creativoId } },
      body: { motivo },
    }),
  )
  return r.nuevo
}

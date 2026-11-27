/**
 * Directorio y publicidad desde la plataforma (ADR 0023): categorías, comercios y su ficha,
 * campañas y piezas, métricas y leads, enlace de cupones, exclusiones, moderación (otra cuenta:
 * quien cargó o editó recibe 409 `conflicto`), tarifas, política, liquidaciones y pantallas.
 */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  Anunciante,
  Campana,
  CategoriaDirectorio,
  Corte,
  Creativo,
  CreativoReportado,
  DatosAnunciante,
  DetalleCampana,
  EstadoLiquidacion,
  EstadoVerificacion,
  ExclusionPublicidad,
  FichaAnunciante,
  ImagenPublicidad,
  Lead,
  LiquidacionPublicidad,
  MetricasCampana,
  NuevaCampana,
  NuevaCategoriaDirectorio,
  NuevaFichaAnunciante,
  NuevoAnunciante,
  NuevoCreativo,
  PoliticaPublicidad,
  ResenaReportada,
  TarifaPublicidad,
} from '@/api/tipos'
import type { Pagina } from '@/composables/useListado'

const P = '/api/v1/plataforma/publicidad' as const
const anun = (id: string) => ({ path: { anunciante_id: id } })
const camp = (id: string, campanaId: string) => ({ path: { anunciante_id: id, campana_id: campanaId } })
const pagina = (despues?: string) => ({ query: { despues, limite: 50 } })

// Categorías y comercios -------------------------------------------------------------------

/** Todo el catálogo, incluidas las restringidas e inactivas. */
export function categoriasPlataforma(): Promise<CategoriaDirectorio[]> {
  return exigir(api().GET(`${P}/categorias`))
}

/** Crea o edita la categoría `codigo`. */
export function guardarCategoria(codigo: string, datos: NuevaCategoriaDirectorio): Promise<CategoriaDirectorio> {
  return exigir(api().PUT(`${P}/categorias/{codigo}`, { params: { path: { codigo } }, body: datos }))
}

export function listarAnunciantes(despues: string | undefined, f: { q: string; estado: EstadoVerificacion | '' }): Promise<Pagina<Anunciante>> {
  return exigir(api().GET(`${P}/anunciantes`, { params: { query: { despues, limite: 50, q: f.q.trim() || undefined, estado: f.estado || undefined } } }))
}

export function crearAnunciante(datos: NuevoAnunciante, clave: string): Promise<Anunciante> {
  return exigir(api().POST(`${P}/anunciantes`, { body: datos, headers: idempotencia(clave) }))
}

export function anunciante(id: string): Promise<Anunciante> {
  return exigir(api().GET(`${P}/anunciantes/{anunciante_id}`, { params: anun(id) }))
}

export function editarAnunciante(id: string, datos: DatosAnunciante): Promise<Anunciante> {
  return exigir(api().PUT(`${P}/anunciantes/{anunciante_id}`, { params: anun(id), body: datos }))
}

/** Crea o reemplaza la ficha del directorio (cobertura, categorías, contacto, destacada). */
export function guardarFicha(id: string, ficha: NuevaFichaAnunciante): Promise<FichaAnunciante> {
  return exigir(api().PUT(`${P}/anunciantes/{anunciante_id}/ficha`, { params: anun(id), body: ficha }))
}

/** Verifica, rechaza, suspende o vuelve a pendiente (motivo obligatorio para rechazar o suspender). */
export function cambiarEstadoAnunciante(id: string, estado: EstadoVerificacion, motivo: string | null): Promise<Anunciante> {
  return exigir(api().POST(`${P}/anunciantes/{anunciante_id}/estado`, { params: anun(id), body: { estado, motivo } }))
}

// Campañas y piezas ------------------------------------------------------------------------

export function campanas(id: string, despues?: string): Promise<Pagina<Campana>> {
  return exigir(api().GET(`${P}/anunciantes/{anunciante_id}/campanas`, { params: { ...anun(id), ...pagina(despues) } }))
}

export function crearCampana(id: string, datos: NuevaCampana, clave: string): Promise<Campana> {
  return exigir(api().POST(`${P}/anunciantes/{anunciante_id}/campanas`, { params: anun(id), body: datos, headers: idempotencia(clave) }))
}

export function campana(id: string, campanaId: string): Promise<DetalleCampana> {
  return exigir(api().GET(`${P}/anunciantes/{anunciante_id}/campanas/{campana_id}`, { params: camp(id, campanaId) }))
}

export function editarCampana(id: string, campanaId: string, datos: NuevaCampana): Promise<Campana> {
  return exigir(api().PUT(`${P}/anunciantes/{anunciante_id}/campanas/{campana_id}`, { params: camp(id, campanaId), body: datos }))
}

/** Acción del ciclo de la campaña: `enviar_a_revision`, `activar`, `pausar` o `finalizar`. */
export function accionCampana(id: string, campanaId: string, accion: string): Promise<Campana> {
  return exigir(api().POST(`${P}/anunciantes/{anunciante_id}/campanas/{campana_id}/estado`, { params: camp(id, campanaId), body: { accion } }))
}

/** Agrega una pieza (queda pendiente de moderación). */
export function crearCreativo(id: string, campanaId: string, datos: NuevoCreativo, clave: string): Promise<Creativo> {
  return exigir(
    api().POST(`${P}/anunciantes/{anunciante_id}/campanas/{campana_id}/creativos`, { params: camp(id, campanaId), body: datos, headers: idempotencia(clave) }),
  )
}

/** Edita una pieza (si cambia, vuelve a moderación). */
export function editarCreativo(id: string, campanaId: string, creativoId: string, datos: NuevoCreativo): Promise<Creativo> {
  return exigir(
    api().PUT(`${P}/anunciantes/{anunciante_id}/campanas/{campana_id}/creativos/{creativo_id}`, {
      params: { path: { anunciante_id: id, campana_id: campanaId, creativo_id: creativoId } },
      body: datos,
    }),
  )
}

export function metricasCampana(id: string, campanaId: string): Promise<MetricasCampana> {
  return exigir(api().GET(`${P}/anunciantes/{anunciante_id}/campanas/{campana_id}/metricas`, { params: camp(id, campanaId) }))
}

/** Contactos que los residentes autorizaron compartir con el comercio. */
export function leads(id: string, despues?: string): Promise<Pagina<Lead>> {
  return exigir(api().GET(`${P}/anunciantes/{anunciante_id}/leads`, { params: { ...anun(id), ...pagina(despues) } }))
}

/** Token vigente del enlace de redención de cupones (`null` si no hay). */
export async function enlaceCupones(id: string): Promise<string | null> {
  return (await exigir(api().GET(`${P}/anunciantes/{anunciante_id}/enlace-cupones`, { params: anun(id) }))).token ?? null
}

/** Genera un enlace nuevo; el anterior deja de funcionar. */
export async function generarEnlaceCupones(id: string): Promise<string | null> {
  return (await exigir(api().POST(`${P}/anunciantes/{anunciante_id}/enlace-cupones`, { params: anun(id) }))).token ?? null
}

export async function revocarEnlaceCupones(id: string): Promise<void> {
  await exigir(api().DELETE(`${P}/anunciantes/{anunciante_id}/enlace-cupones`, { params: anun(id) }))
}

// Exclusiones ------------------------------------------------------------------------------

export function exclusiones(): Promise<ExclusionPublicidad[]> {
  return exigir(api().GET(`${P}/exclusiones`))
}

/** Excluye una entidad de la publicidad (su directorio sigue funcionando). */
export function excluir(entidadId: string, motivo: string): Promise<ExclusionPublicidad> {
  return exigir(api().POST(`${P}/exclusiones`, { body: { entidad_id: entidadId, motivo } }))
}

export async function incluir(entidadId: string): Promise<void> {
  await exigir(api().DELETE(`${P}/exclusiones/{entidad_id}`, { params: { path: { entidad_id: entidadId } } }))
}

// Moderación -------------------------------------------------------------------------------

export function creativosPendientes(despues?: string): Promise<Pagina<Creativo>> {
  return exigir(api().GET(`${P}/moderacion/creativos`, { params: pagina(despues) }))
}

/** `aprobar` o `rechazar` (con motivo). 409 `conflicto` si la cuenta cargó o editó la pieza. */
export function decidirCreativo(id: string, aprobar: boolean, motivo: string | null): Promise<Creativo> {
  return exigir(api().POST(`${P}/moderacion/creativos/{creativo_id}`, { params: { path: { creativo_id: id } }, body: { decision: aprobar ? 'aprobar' : 'rechazar', motivo } }))
}

export function campanasEnRevision(despues?: string): Promise<Pagina<Campana>> {
  return exigir(api().GET(`${P}/moderacion/campanas`, { params: pagina(despues) }))
}

/** Aprueba (fija la tarifa vigente) o rechaza con motivo. */
export function decidirCampana(id: string, aprobar: boolean, motivo: string | null): Promise<Campana> {
  return exigir(api().POST(`${P}/moderacion/campanas/{campana_id}`, { params: { path: { campana_id: id } }, body: { decision: aprobar ? 'aprobar' : 'rechazar', motivo } }))
}

export function resenasReportadas(despues?: string): Promise<Pagina<ResenaReportada>> {
  return exigir(api().GET(`${P}/moderacion/resenas`, { params: pagina(despues) }))
}

/** Oculta la reseña con motivo, o la mantiene; los reportes quedan atendidos. */
export async function moderarResena(id: string, copropiedadId: string, ocultar: boolean, motivo: string | null): Promise<void> {
  await exigir(api().POST(`${P}/moderacion/resenas/{resena_id}`, { params: { path: { resena_id: id } }, body: { copropiedad_id: copropiedadId, ocultar, motivo } }))
}

export function creativosReportados(despues?: string): Promise<Pagina<CreativoReportado>> {
  return exigir(api().GET(`${P}/moderacion/reportes`, { params: pagina(despues) }))
}

/** Retira la pieza (con motivo) o la mantiene; devuelve cuántos reportes se atendieron. */
export async function atenderReportes(id: string, retirar: boolean, motivo: string | null): Promise<number> {
  return (await exigir(api().POST(`${P}/moderacion/reportes/{creativo_id}`, { params: { path: { creativo_id: id } }, body: { retirar, motivo } }))).atendidos
}

// Tarifas, política, liquidaciones y pantallas ---------------------------------------------

export function tarifasPublicidad(): Promise<TarifaPublicidad[]> {
  return exigir(api().GET(`${P}/tarifas`))
}

export function crearTarifaPublicidad(datos: TarifaPublicidad, clave: string): Promise<TarifaPublicidad> {
  return exigir(api().POST(`${P}/tarifas`, { body: datos, headers: idempotencia(clave) }))
}

/** Publica una versión nueva de la política (rige desde ya: las autorizaciones piden aceptarla). */
export function publicarPolitica(texto: string, clave: string): Promise<PoliticaPublicidad> {
  return exigir(api().POST(`${P}/politica`, { body: { texto }, headers: idempotencia(clave) }))
}

/** Liquidaciones del mes de `mes` (cualquier día). */
export function liquidaciones(mes: string): Promise<LiquidacionPublicidad[]> {
  return exigir(api().GET(`${P}/liquidaciones`, { params: { query: { mes } } }))
}

/** Calcula (o recalcula) las liquidaciones del mes. */
export function liquidarMes(mes: string, clave: string): Promise<LiquidacionPublicidad[]> {
  return exigir(api().POST(`${P}/liquidaciones`, { body: { mes }, headers: idempotencia(clave) }))
}

export function marcarLiquidacion(anuncianteId: string, mes: string, estado: EstadoLiquidacion): Promise<LiquidacionPublicidad> {
  return exigir(api().POST(`${P}/liquidaciones/{anunciante_id}/estado`, { params: anun(anuncianteId), body: { mes, estado } }))
}

/** Crea el corte (borrador) que cobra una liquidación. */
export function cortePorLiquidacion(liquidacionId: string, clave: string): Promise<Corte> {
  return exigir(
    api().POST('/api/v1/plataforma/cobros/liquidaciones/{liquidacion_id}/corte', { params: { path: { liquidacion_id: liquidacionId } }, headers: idempotencia(clave) }),
  )
}

/** Token vigente de la pantalla del lobby de una PH (`null` si no hay). */
export async function tokenPantalla(copropiedadId: string): Promise<string | null> {
  return (await exigir(api().GET(`${P}/pantallas/{copropiedad_id}`, { params: { path: { copropiedad_id: copropiedadId } } }))).token ?? null
}

/** Genera el token de la pantalla del lobby (el anterior deja de funcionar). */
export async function generarPantalla(copropiedadId: string, clave: string): Promise<string> {
  return (await exigir(api().POST(`${P}/pantallas/{copropiedad_id}`, { params: { path: { copropiedad_id: copropiedadId } }, headers: idempotencia(clave) }))).token
}

// Imágenes ---------------------------------------------------------------------------------

/** Sube una imagen (JPEG, PNG o WebP de hasta 2 MB) para una pieza o el logo de un comercio. */
export function subirImagen(nombreArchivo: string, archivoBase64: string): Promise<ImagenPublicidad> {
  return exigir(api().POST(`${P}/imagenes`, { body: { nombre_archivo: nombreArchivo, archivo_base64: archivoBase64 } }))
}

/** Pone (o quita, con `null`) el logo del comercio. */
export function ponerLogo(id: string, archivoId: string | null): Promise<{ anunciante_id: string; logo_archivo_id?: string | null }> {
  return exigir(api().PUT(`${P}/anunciantes/{anunciante_id}/logo`, { params: anun(id), body: { archivo_id: archivoId } }))
}

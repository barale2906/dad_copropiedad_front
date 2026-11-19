/**
 * Llamadas del módulo «Tributario» (`/entidades/{id}/tributario/…` y, con contabilidad,
 * `/entidades/{id}/contabilidad/tributario/…`). El sistema **prepara**: presentar y firmar las
 * declaraciones lo hace el responsable tributario.
 */
import { api, exigir } from '@/api/cliente'
import type {
  Beneficiario,
  CatalogoTributario,
  ExogenaGenerada,
  GeneracionExogena,
  NuevaResolucion,
  NuevoBeneficiario,
  NuevoPerfilTributario,
  PerfilTributario,
  PreparacionIca,
  PreparacionIva,
  PreparacionRetencion,
  Resolucion,
} from '@/api/tipos'

const e = (id: string) => ({ path: { entidad_id: id } })

export interface Rango {
  desde: string
  hasta: string
}

/** Terceros por nombre o documento, por cursor (para `useListado`). */
export function terceros(id: string, despues: string | undefined, texto?: string) {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/terceros', { params: { ...e(id), query: { texto: texto?.trim() || undefined, limite: 30, despues } } }))
}

export function catalogo(id: string, fecha?: string): Promise<CatalogoTributario> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/tributario/catalogo', { params: { ...e(id), query: { fecha } } }))
}

/** Versión nueva del perfil: queda en borrador hasta que el contador la confirme. */
export function crearPerfil(id: string, datos: NuevoPerfilTributario): Promise<PerfilTributario> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/tributario/perfiles', { params: e(id), body: datos }))
}

export function confirmarPerfil(id: string, perfilId: string): Promise<PerfilTributario> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/tributario/perfiles/{perfil_id}/confirmacion', { params: { path: { entidad_id: id, perfil_id: perfilId } } }))
}

export function resoluciones(id: string): Promise<Resolucion[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/tributario/resoluciones', { params: e(id) }))
}

/** La clave técnica se escribe aquí y no vuelve (`tiene_clave_tecnica`). */
export function crearResolucion(id: string, datos: NuevaResolucion): Promise<Resolucion> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/tributario/resoluciones', { params: e(id), body: datos }))
}

export async function activarResolucion(id: string, resolucionId: string, activa: boolean): Promise<void> {
  await exigir(api().PUT('/api/v1/entidades/{entidad_id}/tributario/resoluciones/{resolucion_id}/activa', { params: { path: { entidad_id: id, resolucion_id: resolucionId } }, body: { activa } }))
}

export function prepararRetencion(id: string, r: Rango): Promise<PreparacionRetencion> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tributario/retencion', { params: { ...e(id), query: r } }))
}

export function prepararIva(id: string, r: Rango): Promise<PreparacionIva> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tributario/iva', { params: { ...e(id), query: r } }))
}

/** 422 si no hay perfil tributario confirmado. */
export function prepararIca(id: string, r: Rango): Promise<PreparacionIca> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tributario/ica', { params: { ...e(id), query: r } }))
}

export function generacionesExogena(id: string, anio: number): Promise<GeneracionExogena[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tributario/exogena', { params: { ...e(id), query: { anio } } }))
}

/** Genera un formato: devuelve el CSV, su huella y los terceros con datos por corregir. */
export function generarExogena(id: string, formatoId: string): Promise<ExogenaGenerada> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tributario/exogena', { params: e(id), body: { formato_id: formatoId } }))
}

export function beneficiarios(id: string): Promise<Beneficiario[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tributario/beneficiarios', { params: e(id) }))
}

/** Beneficiario final (RUB); el porcentaje solo con el criterio de propiedad. */
export function crearBeneficiario(id: string, datos: NuevoBeneficiario): Promise<Beneficiario> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tributario/beneficiarios', { params: e(id), body: datos }))
}

export async function terminarBeneficiario(id: string, beneficiarioId: string, hasta: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tributario/beneficiarios/{beneficiario_id}/terminacion', {
      params: { path: { entidad_id: id, beneficiario_id: beneficiarioId } },
      body: { hasta },
    }),
  )
}

/**
 * Catálogos normativos de la plataforma (PUC, retenciones, UVT, IVA, ICA, exógena, tasas de
 * referencia y plantillas contables), líneas y tarifas de WhatsApp y reclamaciones de
 * organizaciones. Las versiones nuevas rigen desde su fecha: las anteriores no se editan.
 */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  CambiosFichaOrganizacion,
  CambiosLineaWhatsapp,
  CatalogoRetenciones,
  CatalogoTributario,
  ConceptoRetencion,
  CuentaPuc,
  EstadoPlantillaContable,
  FormatoExogena,
  LineaWhatsapp,
  NuevaLineaWhatsapp,
  NuevaPlantillaContable,
  NuevaTarifaIca,
  NuevaTarifaIva,
  NuevaTasaReferencia,
  NuevoConceptoRetencion,
  NuevoFormatoExogena,
  PlantillaContable,
  PlantillaContableResumen,
  Reclamacion,
  RolOrganizacion,
  TarifaIca,
  TarifaIva,
  TarifaWhatsapp,
  TasaReferencia,
  Uvt,
} from '@/api/tipos'

// Normativa contable y tributaria ----------------------------------------------------------

/** Inserta o actualiza cuentas del PUC; devuelve cuántas cambió. */
export async function cargarPuc(cuentas: CuentaPuc[]): Promise<number> {
  const r = await exigir(api().PUT('/api/v1/plataforma/puc', { body: { cuentas } }))
  return r.cuentas
}

export function retenciones(): Promise<CatalogoRetenciones> {
  return exigir(api().GET('/api/v1/plataforma/retenciones'))
}

export function crearConceptoRetencion(datos: NuevoConceptoRetencion, clave: string): Promise<ConceptoRetencion> {
  return exigir(api().POST('/api/v1/plataforma/retenciones', { body: datos, headers: idempotencia(clave) }))
}

/** Crea o corrige el valor de la UVT de un año. */
export function guardarUvt(anio: number, valor: string, fuente: string): Promise<Uvt> {
  return exigir(api().PUT('/api/v1/plataforma/uvt/{anio}', { params: { path: { anio } }, body: { valor, fuente } }))
}

export function catalogoTributario(): Promise<CatalogoTributario> {
  return exigir(api().GET('/api/v1/plataforma/tributario/catalogo'))
}

export function crearTarifaIva(datos: NuevaTarifaIva, clave: string): Promise<TarifaIva> {
  return exigir(api().POST('/api/v1/plataforma/tributario/tarifas-iva', { body: datos, headers: idempotencia(clave) }))
}

export function crearTarifaIca(datos: NuevaTarifaIca, clave: string): Promise<TarifaIca> {
  return exigir(api().POST('/api/v1/plataforma/tributario/tarifas-ica', { body: datos, headers: idempotencia(clave) }))
}

export function crearFormatoExogena(datos: NuevoFormatoExogena, clave: string): Promise<FormatoExogena> {
  return exigir(api().POST('/api/v1/plataforma/tributario/formatos-exogena', { body: datos, headers: idempotencia(clave) }))
}

export function tasasReferencia(): Promise<TasaReferencia[]> {
  return exigir(api().GET('/api/v1/plataforma/tasas-referencia'))
}

export function crearTasaReferencia(datos: NuevaTasaReferencia, clave: string): Promise<TasaReferencia> {
  return exigir(api().POST('/api/v1/plataforma/tasas-referencia', { body: datos, headers: idempotencia(clave) }))
}

export function plantillasContables(): Promise<PlantillaContableResumen[]> {
  return exigir(api().GET('/api/v1/plataforma/plantillas-contables'))
}

export function plantillaContable(id: string): Promise<PlantillaContable> {
  return exigir(api().GET('/api/v1/plataforma/plantillas-contables/{plantilla_id}', { params: { path: { plantilla_id: id } } }))
}

export function crearPlantillaContable(datos: NuevaPlantillaContable, clave: string): Promise<PlantillaContable> {
  return exigir(api().POST('/api/v1/plataforma/plantillas-contables', { body: datos, headers: idempotencia(clave) }))
}

/** Reemplaza el contenido de una plantilla en borrador (JSON `PlantillaContable`). */
export async function guardarContenidoPlantilla(id: string, contenido: PlantillaContable['contenido']): Promise<void> {
  await exigir(api().PUT('/api/v1/plataforma/plantillas-contables/{plantilla_id}/contenido', { params: { path: { plantilla_id: id } }, body: { contenido } }))
}

export async function cambiarEstadoPlantilla(id: string, estado: EstadoPlantillaContable): Promise<void> {
  await exigir(api().PUT('/api/v1/plataforma/plantillas-contables/{plantilla_id}/estado', { params: { path: { plantilla_id: id } }, body: { estado } }))
}

// WhatsApp ---------------------------------------------------------------------------------

export function lineasWhatsapp(): Promise<LineaWhatsapp[]> {
  return exigir(api().GET('/api/v1/plataforma/whatsapp/lineas'))
}

export function crearLineaWhatsapp(datos: NuevaLineaWhatsapp, clave: string): Promise<LineaWhatsapp> {
  return exigir(api().POST('/api/v1/plataforma/whatsapp/lineas', { body: datos, headers: idempotencia(clave) }))
}

/** Cambia el estado, el ritmo (mensajes por segundo) o la franquicia mensual de una línea. */
export async function actualizarLineaWhatsapp(id: string, cambios: CambiosLineaWhatsapp): Promise<void> {
  await exigir(api().PATCH('/api/v1/plataforma/whatsapp/lineas/{linea_id}', { params: { path: { linea_id: id } }, body: cambios }))
}

export function tarifasWhatsapp(): Promise<TarifaWhatsapp[]> {
  return exigir(api().GET('/api/v1/plataforma/whatsapp/tarifas'))
}

export function crearTarifaWhatsapp(datos: TarifaWhatsapp, clave: string): Promise<TarifaWhatsapp> {
  return exigir(api().POST('/api/v1/plataforma/whatsapp/tarifas', { body: datos, headers: idempotencia(clave) }))
}

// Organizaciones ---------------------------------------------------------------------------

export function reclamaciones(): Promise<Reclamacion[]> {
  return exigir(api().GET('/api/v1/plataforma/reclamaciones'))
}

/** Aprueba (la cuenta queda como dueña de la ficha) o rechaza con motivo. */
export async function resolverReclamacion(id: string, aprobar: boolean, motivo: string | null): Promise<void> {
  await exigir(api().POST('/api/v1/plataforma/reclamaciones/{reclamacion_id}/resolver', { params: { path: { reclamacion_id: id } }, body: { aprobar, motivo } }))
}

/** Corrige la ficha global de una organización (como soporte). */
export async function editarOrganizacion(id: string, cambios: CambiosFichaOrganizacion): Promise<void> {
  await exigir(api().PATCH('/api/v1/organizaciones/{organizacion_id}', { params: { path: { organizacion_id: id } }, body: cambios }))
}

/** Agrega una cuenta a la organización o cambia su papel. */
export async function agregarMiembro(id: string, cuentaId: string, rol: RolOrganizacion): Promise<void> {
  await exigir(api().POST('/api/v1/organizaciones/{organizacion_id}/miembros', { params: { path: { organizacion_id: id } }, body: { cuenta_id: cuentaId, rol } }))
}

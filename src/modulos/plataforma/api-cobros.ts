/**
 * Consumo de facturación electrónica y cobros de la plataforma (ADR 0024): productos con tarifas
 * versionadas, suscripciones con sus líneas y la bandeja de cortes (borrador → aprobado →
 * facturado → pagado, o descartado).
 */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  CambiosSuscripcion,
  ConsumoDocumentos,
  Corte,
  DetalleSuscripcion,
  EstadoCorte,
  LineaSuscripcion,
  NuevaLineaSuscripcion,
  NuevaSuscripcion,
  NuevoProducto,
  Producto,
  Suscripcion,
  TarifaCobro,
} from '@/api/tipos'
import type { Pagina } from '@/composables/useListado'

const C = '/api/v1/plataforma/cobros' as const
const corte = (id: string) => ({ path: { corte_id: id } })

/** Documentos electrónicos transmitidos por entidad y tipo entre `desde` y `hasta` (fechas). */
export function consumo(desde: string, hasta: string): Promise<ConsumoDocumentos[]> {
  return exigir(api().GET('/api/v1/plataforma/facturacion/consumo', { params: { query: { desde, hasta } } }))
}

// Productos --------------------------------------------------------------------------------

export function productos(): Promise<Producto[]> {
  return exigir(api().GET(`${C}/productos`))
}

export function crearProducto(datos: NuevoProducto, clave: string): Promise<Producto> {
  return exigir(api().POST(`${C}/productos`, { body: datos, headers: idempotencia(clave) }))
}

export function editarProducto(id: string, datos: NuevoProducto): Promise<Producto> {
  return exigir(api().PUT(`${C}/productos/{producto_id}`, { params: { path: { producto_id: id } }, body: datos }))
}

/** Fija una tarifa desde una fecha (versionada: las anteriores no se editan). */
export function fijarTarifa(id: string, tarifa: TarifaCobro, clave: string): Promise<TarifaCobro> {
  return exigir(api().POST(`${C}/productos/{producto_id}/tarifas`, { params: { path: { producto_id: id } }, body: tarifa, headers: idempotencia(clave) }))
}

// Suscripciones ----------------------------------------------------------------------------

export function suscripciones(): Promise<Suscripcion[]> {
  return exigir(api().GET(`${C}/suscripciones`))
}

export function crearSuscripcion(datos: NuevaSuscripcion, clave: string): Promise<Suscripcion> {
  return exigir(api().POST(`${C}/suscripciones`, { body: datos, headers: idempotencia(clave) }))
}

export function suscripcion(id: string): Promise<DetalleSuscripcion> {
  return exigir(api().GET(`${C}/suscripciones/{suscripcion_id}`, { params: { path: { suscripcion_id: id } } }))
}

export function cambiarSuscripcion(id: string, cambios: CambiosSuscripcion): Promise<Suscripcion> {
  return exigir(api().PATCH(`${C}/suscripciones/{suscripcion_id}`, { params: { path: { suscripcion_id: id } }, body: cambios }))
}

export function agregarLinea(id: string, datos: NuevaLineaSuscripcion, clave: string): Promise<LineaSuscripcion> {
  return exigir(api().POST(`${C}/suscripciones/{suscripcion_id}/lineas`, { params: { path: { suscripcion_id: id } }, body: datos, headers: idempotencia(clave) }))
}

/** Deja de cobrar la línea desde `hasta` (excluido). */
export async function terminarLinea(id: string, hasta: string): Promise<void> {
  await exigir(api().POST(`${C}/lineas/{linea_id}/fin`, { params: { path: { linea_id: id } }, body: { hasta } }))
}

// Cortes -----------------------------------------------------------------------------------

export function cortes(despues: string | undefined, f: { estado: EstadoCorte | ''; suscripcion: string }): Promise<Pagina<Corte>> {
  return exigir(
    api().GET(`${C}/cortes`, {
      params: { query: { despues, limite: 50, estado: f.estado || undefined, suscripcion_id: f.suscripcion || undefined } },
    }),
  )
}

/** Calcula el corte de un periodo (`hasta` solo en suscripciones por evento). */
export function calcularCorte(suscripcionId: string, desde: string, hasta: string | null, clave: string): Promise<Corte> {
  return exigir(api().POST(`${C}/cortes`, { body: { suscripcion_id: suscripcionId, desde, hasta }, headers: idempotencia(clave) }))
}

export function aprobarCorte(id: string, clave: string): Promise<Corte> {
  return exigir(api().POST(`${C}/cortes/{corte_id}/aprobar`, { params: corte(id), headers: idempotencia(clave) }))
}

export function descartarCorte(id: string, motivo: string): Promise<Corte> {
  return exigir(api().POST(`${C}/cortes/{corte_id}/descartar`, { params: corte(id), body: { motivo } }))
}

/** Emite la factura de venta en la entidad de la plataforma. */
export function facturarCorte(id: string, clave: string): Promise<Corte> {
  return exigir(api().POST(`${C}/cortes/{corte_id}/facturar`, { params: corte(id), headers: idempotencia(clave) }))
}

/** Marca el corte facturado por fuera del sistema (número y fecha de la factura externa). */
export function facturaExterna(id: string, numero: string, fecha: string): Promise<Corte> {
  return exigir(api().POST(`${C}/cortes/{corte_id}/factura-externa`, { params: corte(id), body: { numero, fecha } }))
}

/** Registra el pago; si la entidad estaba suspendida por mora y no debe otro, se reactiva. */
export function pagarCorte(id: string, fecha: string, clave: string): Promise<Corte> {
  return exigir(api().POST(`${C}/cortes/{corte_id}/pago`, { params: corte(id), body: { fecha }, headers: idempotencia(clave) }))
}

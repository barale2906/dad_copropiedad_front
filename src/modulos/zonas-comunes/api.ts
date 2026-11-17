/** Llamadas del módulo «Zonas comunes» (`/copropiedades/{id}/…`, módulo `bienes_comunes`). */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  AsignacionParqueadero,
  CambiosRecurso,
  CategoriaBienComun,
  CobroRecurso,
  DetalleReserva,
  EntregaReserva,
  EstadoPago,
  EstadoRecurso,
  EstadoReserva,
  FranjaLibre,
  NuevaAsignacionParqueadero,
  NuevaReserva,
  NuevaRestriccion,
  NuevoParqueadero,
  NuevoRecurso,
  NuevoSorteo,
  Parqueadero,
  Recurso,
  Reserva,
  Restriccion,
  ResultadoSorteo,
  Sorteo,
  TipoRecurso,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const recurso = (id: string, recursoId: string) => ({ path: { copropiedad_id: id, recurso_id: recursoId } })
const reserva = (id: string, reservaId: string) => ({ path: { copropiedad_id: id, reserva_id: reservaId } })

// Recursos ----------------------------------------------------------------------------------

export function listarRecursos(id: string, f: { categoria?: CategoriaBienComun; tipo?: TipoRecurso } = {}): Promise<Recurso[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/recursos', { params: { ...ph(id), query: f } }))
}

export function obtenerRecurso(id: string, recursoId: string): Promise<Recurso> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/recursos/{recurso_id}', { params: recurso(id, recursoId) }))
}

export function crearRecurso(id: string, datos: NuevoRecurso, clave: string): Promise<Recurso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/recursos', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export function editarRecurso(id: string, recursoId: string, cambios: CambiosRecurso): Promise<Recurso> {
  return exigir(
    api().PATCH('/api/v1/copropiedades/{copropiedad_id}/recursos/{recurso_id}', { params: recurso(id, recursoId), body: cambios }),
  )
}

/** Cambia el estado; cerrarlo cancela las reservas futuras. Devuelve cuántas se cancelaron. */
export async function cambiarEstadoRecurso(id: string, recursoId: string, estado: EstadoRecurso, motivo?: string): Promise<number> {
  const r = await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/recursos/{recurso_id}/estado', {
      params: recurso(id, recursoId),
      body: { estado, motivo: motivo?.trim() || null },
    }),
  )
  return r.reservas_canceladas
}

/** Franjas libres entre dos días de calendario (`YYYY-MM-DD`, ambos incluidos). */
export function disponibilidad(id: string, recursoId: string, desde: string, hasta: string): Promise<FranjaLibre[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/recursos/{recurso_id}/disponibilidad', {
      params: { ...recurso(id, recursoId), query: { desde, hasta } },
    }),
  )
}

export function obtenerCobro(id: string, recursoId: string): Promise<CobroRecurso> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/recursos/{recurso_id}/cobro', { params: recurso(id, recursoId) }))
}

export function cambiarCobro(id: string, recursoId: string, cobro: CobroRecurso): Promise<CobroRecurso> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/recursos/{recurso_id}/cobro', { params: recurso(id, recursoId), body: cobro }),
  )
}

/** Ítems de facturación de la entidad (para cobrar reservas con factura; `facturacion.ver`). */
export async function itemsFacturacion(id: string): Promise<{ id: string; descripcion: string }[]> {
  const items = await exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/items', { params: { path: { entidad_id: id } } }))
  return items.map((i) => ({ id: i.id, descripcion: `${i.codigo} · ${i.descripcion}` }))
}

// Reservas ----------------------------------------------------------------------------------

export interface FiltrosReservas {
  mias?: boolean
  recursoId?: string
  bienPrivadoId?: string
  estado?: EstadoReserva
  /** Instantes UTC (ISO). */
  desde?: string
  hasta?: string
}

export function listarReservas(id: string, f: FiltrosReservas = {}): Promise<Reserva[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/reservas', {
      params: {
        ...ph(id),
        query: {
          mias: f.mias || undefined,
          recurso_id: f.recursoId,
          bien_privado_id: f.bienPrivadoId,
          estado: f.estado,
          desde: f.desde,
          hasta: f.hasta,
        },
      },
    }),
  )
}

/**
 * Solicita una reserva. La clave de idempotencia viaja en el cuerpo (el contrato la exige ahí)
 * y en la cabecera; reintentar con la misma devuelve la reserva original.
 */
export function reservar(id: string, datos: Omit<NuevaReserva, 'idempotency_key'>, clave: string): Promise<Reserva> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas', {
      params: ph(id),
      body: { ...datos, idempotency_key: clave },
      headers: idempotencia(clave),
    }),
  )
}

export function detalleReserva(id: string, reservaId: string): Promise<DetalleReserva> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}', { params: reserva(id, reservaId) }))
}

export function aprobarReserva(id: string, reservaId: string): Promise<Reserva> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/aprobar', { params: reserva(id, reservaId) }))
}

export function rechazarReserva(id: string, reservaId: string, motivo: string): Promise<Reserva> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/rechazar', { params: reserva(id, reservaId), body: { motivo } }),
  )
}

/** Cancela (la propia, con penalidad si es tarde; o cualquiera con `reservas.cancelar_cualquiera`). */
export function cancelarReserva(id: string, reservaId: string, motivo: string): Promise<Reserva> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/cancelar', { params: reserva(id, reservaId), body: { motivo } }),
  )
}

export function entregarReserva(id: string, reservaId: string, datos: EntregaReserva): Promise<Reserva> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/entrega', { params: reserva(id, reservaId), body: datos }),
  )
}

/** Recibo: finalizada, o con novedad si se reporta novedad o daños. */
export function recibirReserva(id: string, reservaId: string, datos: EntregaReserva): Promise<Reserva> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/recibo', { params: reserva(id, reservaId), body: datos }),
  )
}

export function noAsistio(id: string, reservaId: string): Promise<Reserva> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/no-asistio', { params: reserva(id, reservaId) }))
}

/** Pago a mano (solo recursos con cobro `manual`; los demás responden 422). */
export function registrarPago(id: string, reservaId: string, estado: Extract<EstadoPago, 'pagado' | 'exonerado'>): Promise<Reserva> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/pago', {
      params: reserva(id, reservaId),
      body: { estado_pago: estado },
    }),
  )
}

/** Factura en borrador por el valor de la reserva (recursos con cobro `factura`). */
export async function facturarReserva(id: string, reservaId: string): Promise<string> {
  const r = await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/reservas/{reserva_id}/factura', { params: reserva(id, reservaId) }),
  )
  return r.id
}

// Restricciones -----------------------------------------------------------------------------

export function listarRestricciones(id: string): Promise<Restriccion[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/restricciones-reserva', { params: ph(id) }))
}

export function crearRestriccion(id: string, datos: NuevaRestriccion, clave: string): Promise<Restriccion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/restricciones-reserva', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export async function levantarRestriccion(id: string, restriccionId: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/restricciones-reserva/{restriccion_id}/levantar', {
      params: { path: { copropiedad_id: id, restriccion_id: restriccionId } },
    }),
  )
}

// Parqueaderos y sorteos --------------------------------------------------------------------

export function listarParqueaderos(id: string): Promise<Parqueadero[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/parqueaderos', { params: ph(id) }))
}

export function crearParqueadero(id: string, datos: NuevoParqueadero, clave: string): Promise<Recurso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/parqueaderos', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export function asignarParqueadero(
  id: string,
  recursoId: string,
  datos: NuevaAsignacionParqueadero,
  clave: string,
): Promise<AsignacionParqueadero> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/parqueaderos/{recurso_id}/asignaciones', {
      params: recurso(id, recursoId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

export async function liberarParqueadero(id: string, asignacionId: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asignaciones-parqueadero/{asignacion_id}/liberar', {
      params: { path: { copropiedad_id: id, asignacion_id: asignacionId } },
    }),
  )
}

export function listarSorteos(id: string): Promise<Sorteo[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/sorteos', { params: ph(id) }))
}

/** Crea el sorteo y publica el compromiso de su semilla. */
export function crearSorteo(id: string, datos: NuevoSorteo, clave: string): Promise<Sorteo> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/sorteos', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export async function inscribirEnSorteo(id: string, sorteoId: string, bienPrivadoId: string, discapacidad: boolean): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/sorteos/{sorteo_id}/inscripciones', {
      params: { path: { copropiedad_id: id, sorteo_id: sorteoId } },
      body: { bien_privado_id: bienPrivadoId, discapacidad },
    }),
  )
}

/** Ejecuta: revela la semilla y asigna los parqueaderos por el periodo. */
export function ejecutarSorteo(id: string, sorteoId: string): Promise<ResultadoSorteo> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/sorteos/{sorteo_id}/ejecutar', {
      params: { path: { copropiedad_id: id, sorteo_id: sorteoId } },
    }),
  )
}

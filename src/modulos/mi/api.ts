/**
 * Llamadas del portal del propietario y residente (`/copropiedades/{id}/…` y `/yo/…`). No exigen
 * permisos de administración: el backend responde según el **vínculo** de la cuenta con el bien.
 */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  BienCartera,
  CambioCenso,
  CategoriaTicket,
  CertificadoEmitido,
  ComunicadoAbierto,
  ComunicadoRecibido,
  CuentaCobro,
  DatosTitular,
  DetalleTicket,
  EstadoCuenta,
  NuevoTicket,
  Politica,
  Preautorizacion,
  SolicitudTitular,
  Ticket,
  TicketDeCuenta,
  TipoCambioCenso,
  TipoSolicitudTitular,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })

// Bienes y censo -----------------------------------------------------------------------------

/** Propuestas de cambio del censo que hizo la cuenta (y su estado). */
export function misPropuestas(id: string): Promise<CambioCenso[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cambios-censo', { params: { ...ph(id), query: { mias: true } } }))
}

/** Propone un cambio del censo de su bien (queda pendiente de aprobación). */
export function proponerCambio(id: string, bienId: string, tipo: TipoCambioCenso, datos: Record<string, unknown>): Promise<CambioCenso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/cambios-censo', {
      params: ph(id),
      // El contrato tipa `datos` como objeto sin forma fija.
      body: { bien_privado_id: bienId, tipo, datos: datos as CambioCenso['datos'] },
    }),
  )
}

/** Reservas propias (la vista completa está en Zonas comunes). */
export function misReservas(id: string) {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/reservas', { params: { ...ph(id), query: { mias: true } } }))
}

// Mi cartera ---------------------------------------------------------------------------------

/** Bienes de los que la cuenta es titular o pagador, con su referencia de pago. */
export function bienesCartera(id: string): Promise<BienCartera[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/mi-cartera/bienes', { params: ph(id) }))
}

export function estadoCuenta(id: string, bienId: string): Promise<EstadoCuenta> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/mi-cartera/bienes/{bien_privado_id}/estado-cuenta', {
      params: { path: { copropiedad_id: id, bien_privado_id: bienId } },
    }),
  )
}

export function cuentasCobro(id: string, bienId: string): Promise<CuentaCobro[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/mi-cartera/bienes/{bien_privado_id}/cuentas-cobro', {
      params: { path: { copropiedad_id: id, bien_privado_id: bienId } },
    }),
  )
}

export function descargarCuentaCobro(id: string, cuenta: Pick<CuentaCobro, 'id' | 'numero'>) {
  return descargar(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/mi-cartera/cuentas-cobro/{cuenta_cobro_id}/pdf', {
      params: { path: { copropiedad_id: id, cuenta_cobro_id: cuenta.id } },
      parseAs: 'blob',
    }),
    `cuenta-de-cobro-${cuenta.numero}.pdf`,
  )
}

/**
 * Emite el paz y salvo del bien (409 `conflicto` si tiene saldo). El código y el PDF se entregan
 * **una sola vez**: se guarda el PDF de inmediato.
 */
export function pedirPazYSalvo(id: string, bienId: string): Promise<CertificadoEmitido> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/mi-cartera/bienes/{bien_privado_id}/paz-y-salvo', {
      params: { path: { copropiedad_id: id, bien_privado_id: bienId } },
    }),
  )
}

// Comunicados --------------------------------------------------------------------------------

export function misComunicados(id: string, despues?: string, limite = 20) {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/mis-comunicados', { params: { ...ph(id), query: { limite, despues } } }))
}

/** Abre el comunicado: **registra la lectura** y trae los adjuntos con enlaces de 5 minutos. */
export function abrirComunicado(id: string, comunicadoId: string): Promise<ComunicadoAbierto> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/mis-comunicados/{comunicado_id}', {
      params: { path: { copropiedad_id: id, comunicado_id: comunicadoId } },
    }),
  )
}

/** «Enterado» (idempotente; 409 si el comunicado no pide confirmación). */
export function marcarEnterado(id: string, comunicadoId: string): Promise<ComunicadoRecibido> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/mis-comunicados/{comunicado_id}/enterado', {
      params: { path: { copropiedad_id: id, comunicado_id: comunicadoId } },
    }),
  )
}

// PQRS ---------------------------------------------------------------------------------------

/** Solicitudes que la cuenta radicó en todas sus copropiedades (más recientes primero). */
export function misTickets(): Promise<TicketDeCuenta[]> {
  return exigir(api().GET('/api/v1/yo/tickets', { params: { query: { limite: 100 } } }))
}

export function categoriasTicket(id: string): Promise<CategoriaTicket[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/tickets/categorias', { params: ph(id) }))
}

export function radicarTicket(id: string, datos: Omit<NuevoTicket, 'idempotency_key'>, clave: string): Promise<Ticket> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets', {
      params: ph(id),
      body: { ...datos, idempotency_key: clave },
      headers: idempotencia(clave),
    }),
  )
}

/** Detalle de una solicitud propia (el backend nunca envía las notas internas al solicitante). */
export function detalleTicket(id: string, ticketId: string): Promise<DetalleTicket> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}', { params: { path: { copropiedad_id: id, ticket_id: ticketId } } }),
  )
}

export function responderTicket(id: string, ticketId: string, texto: string, adjuntos: string[]) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}/mensajes', {
      params: { path: { copropiedad_id: id, ticket_id: ticketId } },
      body: { texto, adjuntos },
    }),
  )
}

/** Califica la atención (una vez, resuelta o cerrada). */
export function calificarTicket(id: string, ticketId: string, calificacion: number, comentario: string | null): Promise<Ticket> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}/encuesta', {
      params: { path: { copropiedad_id: id, ticket_id: ticketId } },
      body: { calificacion, comentario },
    }),
  )
}

/** El solicitante cierra o reabre (dentro del plazo de reapertura). */
export function cambiarEstadoTicket(id: string, ticketId: string, hacia: 'cerrado' | 'reabierto', motivo?: string): Promise<Ticket> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}/transiciones', {
      params: { path: { copropiedad_id: id, ticket_id: ticketId } },
      body: { hacia, motivo: motivo?.trim() || null },
    }),
  )
}

// Visitas y paquetes -------------------------------------------------------------------------

/** Visitas del bien de la cuenta (el backend filtra: un residente solo ve las suyas). */
export function misVisitas(id: string, bienId?: string) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/visitas', { params: { ...ph(id), query: { bien_privado_id: bienId, limite: 50 } } }),
  )
}

/** Pre-autoriza una visita y devuelve el QR (texto firmado) para compartirlo. */
export function preautorizar(id: string, datos: Preautorizacion, clave: string) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas/preautorizaciones', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

/** QR vigente de una pre-autorización (409 si ya no está vigente). */
export async function qrDeVisita(id: string, visitaId: string): Promise<string> {
  const r = await exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}/qr', { params: { path: { copropiedad_id: id, visita_id: visitaId } } }),
  )
  return r.qr
}

/** Autoriza o rechaza una visita anunciada. `decidida_ahora: false` = otro residente ya respondió. */
export function responderVisita(id: string, visitaId: string, autorizar: boolean) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}/respuesta', {
      params: { path: { copropiedad_id: id, visita_id: visitaId } },
      body: { autorizar, canal: 'web' },
    }),
  )
}

/** Correspondencia del bien de la cuenta («mis paquetes»). */
export function misPaquetes(id: string) {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/correspondencia', { params: { ...ph(id), query: { limite: 50 } } }))
}

// Privacidad ---------------------------------------------------------------------------------

/** Política de tratamiento vigente, o `null` si no hay. */
export async function politicaVigente(id: string): Promise<Politica | null> {
  const r = await exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/politica', { params: ph(id) }))
  return (r as Politica | null | undefined) ?? null
}

/** «Mis datos»: la ficha de la persona de la cuenta, sus autorizaciones y solicitudes (se audita). */
export function misDatos(id: string): Promise<DatosTitular> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/mis-datos', { params: ph(id) }))
}

/** El titular radica su propia solicitud (consulta, rectificación, revocatoria…). */
export function radicarMiSolicitud(id: string, personaId: string, tipo: TipoSolicitudTitular, detalle: string | null, clave: string): Promise<SolicitudTitular> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/proteccion-datos/solicitudes', {
      params: ph(id),
      body: { persona_id: personaId, tipo, detalle },
      headers: idempotencia(clave),
    }),
  )
}


/** Llamadas del módulo «Gestión administrativa» (`/copropiedades/{id}/…`, módulo `gestion_administrativa`). */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  Activo,
  AlertasCenso,
  AlertasMantenimiento,
  AvanceOrden,
  CambiosActivo,
  CategoriaTicket,
  ClaseActivo,
  Comunicado,
  ComunicadoConResumen,
  ConfiguracionTickets,
  Conversacion,
  Cumplimiento,
  DetalleConversacion,
  DetalleOrden,
  DetalleTicket,
  EstadoActivo,
  EstadoOrden,
  EstadoTicket,
  HojaDeVida,
  MensajeConversacion,
  MensajeTicket,
  MomentoEvidencia,
  MovimientoActivo,
  NuevaObligacionMantenimiento,
  NuevaOrden,
  NuevaPreguntaFrecuente,
  NuevoActivo,
  NuevoComunicado,
  NuevoMovimiento,
  NuevoPlan,
  ObligacionMantenimiento,
  ObligacionSugerida,
  OrdenTrabajo,
  PlanMantenimiento,
  PreguntaFrecuente,
  PrioridadTicket,
  Responsable,
  TableroMantenimiento,
  TableroTickets,
  Ticket,
  TipoArchivoActivo,
  TipoTicket,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const conTicket = (id: string, t: string) => ({ path: { copropiedad_id: id, ticket_id: t } })
const conOrden = (id: string, o: string) => ({ path: { copropiedad_id: id, orden_id: o } })
const conActivo = (id: string, a: string) => ({ path: { copropiedad_id: id, activo_id: a } })
const conComunicado = (id: string, c: string) => ({ path: { copropiedad_id: id, comunicado_id: c } })

// Tickets (PQRS) -----------------------------------------------------------------------------

export interface FiltroTickets {
  estado?: EstadoTicket
  tipo?: TipoTicket
  prioridad?: PrioridadTicket
  vencidos?: boolean
  mios?: boolean
}

export function listarTickets(id: string, despues: string | undefined, f: FiltroTickets = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/tickets', {
      params: {
        ...ph(id),
        query: { estado: f.estado, tipo: f.tipo, prioridad: f.prioridad, vencidos: f.vencidos || undefined, mios: f.mios || undefined, limite: 30, despues },
      },
    }),
  )
}

export function tableroTickets(id: string): Promise<TableroTickets> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/tickets/tablero', { params: ph(id) }))
}

/** Detalle con las `transiciones_permitidas` para la cuenta que consulta (solo esos botones). */
export function detalleTicket(id: string, ticketId: string): Promise<DetalleTicket> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}', { params: conTicket(id, ticketId) }))
}

export function clasificarTicket(id: string, ticketId: string, datos: { tipo?: TipoTicket; categoria_id?: string | null; prioridad?: PrioridadTicket }): Promise<Ticket> {
  return exigir(api().PATCH('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}', { params: conTicket(id, ticketId), body: datos }))
}

export function asignarTicket(id: string, ticketId: string, responsable: Responsable): Promise<Ticket> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}/asignacion', { params: conTicket(id, ticketId), body: responsable }),
  )
}

export function transicionTicket(id: string, ticketId: string, hacia: EstadoTicket, motivo?: string, duplicadoDe?: string): Promise<Ticket> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}/transiciones', {
      params: conTicket(id, ticketId),
      body: { hacia, motivo: motivo?.trim() || null, duplicado_de: duplicadoDe || null },
    }),
  )
}

/** Mensaje público al solicitante o **nota interna** (que el solicitante nunca ve). */
export function mensajeTicket(id: string, ticketId: string, texto: string, interno: boolean, adjuntos: string[] = []): Promise<MensajeTicket> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets/{ticket_id}/mensajes', {
      params: conTicket(id, ticketId),
      body: { texto, interno, adjuntos },
    }),
  )
}

export function categoriasTicket(id: string): Promise<CategoriaTicket[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/tickets/categorias', { params: ph(id) }))
}

export function crearCategoria(id: string, nombre: string, clave: string): Promise<CategoriaTicket> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/tickets/categorias', { params: ph(id), body: { nombre, activa: true }, headers: idempotencia(clave) }),
  )
}

export function editarCategoria(id: string, c: CategoriaTicket): Promise<CategoriaTicket> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/tickets/categorias/{categoria_id}', {
      params: { path: { copropiedad_id: id, categoria_id: c.id } },
      body: { nombre: c.nombre, activa: c.activa },
    }),
  )
}

export function configuracionTickets(id: string): Promise<ConfiguracionTickets> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/tickets/configuracion', { params: ph(id) }))
}

export function guardarConfiguracionTickets(id: string, datos: ConfiguracionTickets): Promise<ConfiguracionTickets> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/tickets/configuracion', { params: ph(id), body: datos }))
}

// Preguntas frecuentes y chat ----------------------------------------------------------------

export function preguntasFrecuentes(id: string): Promise<PreguntaFrecuente[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/preguntas-frecuentes', { params: ph(id) }))
}

export function crearPregunta(id: string, datos: NuevaPreguntaFrecuente, clave: string): Promise<PreguntaFrecuente> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/preguntas-frecuentes', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export function editarPregunta(id: string, preguntaId: string, datos: NuevaPreguntaFrecuente): Promise<PreguntaFrecuente> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/preguntas-frecuentes/{pregunta_id}', {
      params: { path: { copropiedad_id: id, pregunta_id: preguntaId } },
      body: datos,
    }),
  )
}

export function conversaciones(id: string, despues: string | undefined, f: { estado?: Conversacion['estado'] } = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/conversaciones', { params: { ...ph(id), query: { estado: f.estado, limite: 30, despues } } }),
  )
}

export function detalleConversacion(id: string, c: string): Promise<DetalleConversacion> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/conversaciones/{conversacion_id}', { params: { path: { copropiedad_id: id, conversacion_id: c } } }),
  )
}

/** Responde por WhatsApp; 409 si la conversación se cerró o venció la ventana de 24 h. */
export function responderConversacion(id: string, c: string, texto: string): Promise<MensajeConversacion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/conversaciones/{conversacion_id}/mensajes', {
      params: { path: { copropiedad_id: id, conversacion_id: c } },
      body: { texto },
    }),
  )
}

export function cerrarConversacion(id: string, c: string): Promise<Conversacion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/conversaciones/{conversacion_id}/cierre', { params: { path: { copropiedad_id: id, conversacion_id: c } } }),
  )
}

// Comunicados --------------------------------------------------------------------------------

export function listarComunicados(id: string, despues: string | undefined) {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/comunicados', { params: { ...ph(id), query: { limite: 30, despues } } }))
}

export function comunicado(id: string, c: string): Promise<ComunicadoConResumen> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/comunicados/{comunicado_id}', { params: conComunicado(id, c) }))
}

export function crearComunicado(id: string, datos: NuevoComunicado, clave: string): Promise<Comunicado> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/comunicados', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

/** Solo un borrador se edita (409 si ya no lo es). */
export function editarComunicado(id: string, c: string, datos: NuevoComunicado): Promise<Comunicado> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/comunicados/{comunicado_id}', { params: conComunicado(id, c), body: datos }))
}

/** Envía ya o programa (`programadoPara` ISO UTC, a menos de un año). */
export function publicarComunicado(id: string, c: string, programadoPara: string | null): Promise<Comunicado> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/comunicados/{comunicado_id}/publicar', {
      params: conComunicado(id, c),
      body: { programado_para: programadoPara },
    }),
  )
}

/** Un programado vuelve a borrador. */
export function retirarComunicado(id: string, c: string): Promise<Comunicado> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/comunicados/{comunicado_id}/retirar', { params: conComunicado(id, c) }))
}

/** Lo enviado no se anula (409). */
export function anularComunicado(id: string, c: string): Promise<Comunicado> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/comunicados/{comunicado_id}/anular', { params: conComunicado(id, c) }))
}

// Inventario ---------------------------------------------------------------------------------

export function listarActivos(id: string, despues: string | undefined, f: { q?: string; clase?: ClaseActivo; estado?: EstadoActivo } = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/activos', {
      params: { ...ph(id), query: { q: f.q?.trim() || undefined, clase: f.clase, estado: f.estado, limite: 30, despues } },
    }),
  )
}

export function crearActivo(id: string, datos: NuevoActivo, clave: string): Promise<Activo> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/activos', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

/** Hoja de vida: archivos, movimientos, órdenes y costo total. */
export function hojaDeVida(id: string, activoId: string): Promise<HojaDeVida> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/activos/{activo_id}', { params: conActivo(id, activoId) }))
}

export function editarActivo(id: string, activoId: string, datos: CambiosActivo): Promise<Activo> {
  return exigir(api().PATCH('/api/v1/copropiedades/{copropiedad_id}/activos/{activo_id}', { params: conActivo(id, activoId), body: datos }))
}

export async function adjuntarArchivoActivo(id: string, activoId: string, archivoId: string, tipo: TipoArchivoActivo): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/activos/{activo_id}/archivos', { params: conActivo(id, activoId), body: { archivo_id: archivoId, tipo } }),
  )
}

/** Movimiento del activo; `baja` es definitiva y exige soporte (422 sin él). */
export function registrarMovimiento(id: string, activoId: string, datos: NuevoMovimiento, clave: string): Promise<MovimientoActivo> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/activos/{activo_id}/movimientos', {
      params: conActivo(id, activoId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

// Mantenimiento ------------------------------------------------------------------------------

export function tableroMantenimiento(id: string): Promise<TableroMantenimiento> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/mantenimiento/tablero', { params: ph(id) }))
}

export function alertasMantenimiento(id: string): Promise<AlertasMantenimiento> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/mantenimiento/alertas', { params: ph(id) }))
}

export function listarOrdenes(id: string, despues: string | undefined, f: { estado?: EstadoOrden; vencidas?: boolean; activoId?: string } = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/ordenes-trabajo', {
      params: { ...ph(id), query: { estado: f.estado, vencidas: f.vencidas || undefined, activo_id: f.activoId, limite: 30, despues } },
    }),
  )
}

export function crearOrden(id: string, datos: NuevaOrden, clave: string): Promise<OrdenTrabajo> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/ordenes-trabajo', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

export function detalleOrden(id: string, ordenId: string): Promise<DetalleOrden> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/ordenes-trabajo/{orden_id}', { params: conOrden(id, ordenId) }))
}

/** Iniciar, ejecutar, verificar (otra cuenta que la que ejecutó) o cancelar. */
export function avanzarOrden(id: string, ordenId: string, avance: AvanceOrden): Promise<OrdenTrabajo> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/ordenes-trabajo/{orden_id}/avance', { params: conOrden(id, ordenId), body: avance }))
}

export async function agregarEvidencia(id: string, ordenId: string, archivoId: string, momento: MomentoEvidencia): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/ordenes-trabajo/{orden_id}/evidencias', { params: conOrden(id, ordenId), body: { archivo_id: archivoId, momento } }),
  )
}

export function planes(id: string): Promise<PlanMantenimiento[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/planes-mantenimiento', { params: ph(id) }))
}

export function crearPlan(id: string, datos: NuevoPlan, clave: string): Promise<PlanMantenimiento> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/planes-mantenimiento', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

export function editarPlan(id: string, planId: string, datos: NuevoPlan): Promise<PlanMantenimiento> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/planes-mantenimiento/{plan_id}', { params: { path: { copropiedad_id: id, plan_id: planId } }, body: datos }),
  )
}

export function obligaciones(id: string): Promise<ObligacionMantenimiento[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/obligaciones', { params: ph(id) }))
}

export function obligacionesSugeridas(id: string): Promise<ObligacionSugerida[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/obligaciones/sugeridas', { params: ph(id) }))
}

export function crearObligacion(id: string, datos: NuevaObligacionMantenimiento, clave: string): Promise<ObligacionMantenimiento> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/obligaciones', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

export function editarObligacion(id: string, obligacionId: string, datos: NuevaObligacionMantenimiento): Promise<ObligacionMantenimiento> {
  return exigir(
    api().PATCH('/api/v1/copropiedades/{copropiedad_id}/obligaciones/{obligacion_id}', {
      params: { path: { copropiedad_id: id, obligacion_id: obligacionId } },
      body: datos,
    }),
  )
}

export function cumplimientos(id: string, obligacionId: string): Promise<Cumplimiento[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/obligaciones/{obligacion_id}/cumplimientos', {
      params: { path: { copropiedad_id: id, obligacion_id: obligacionId } },
    }),
  )
}

/** Registra que se cumplió (fecha no futura) y mueve la próxima fecha. */
export function registrarCumplimiento(id: string, obligacionId: string, realizadaEl: string, soporte: string | null, observacion: string | null) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/obligaciones/{obligacion_id}/cumplimientos', {
      params: { path: { copropiedad_id: id, obligacion_id: obligacionId } },
      body: { realizada_el: realizadaEl, soporte_archivo_id: soporte, observacion },
    }),
  )
}

// Tablero -------------------------------------------------------------------------------------

/** Alertas del censo (mascotas con vacunas vencidas, residentes sin autorización). `censo.ver`. */
export function alertasCenso(id: string): Promise<AlertasCenso> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/censo/alertas', { params: ph(id) }))
}

// Audiencias de los comunicados ----------------------------------------------------------------

/** Torres o etapas de primer nivel (`bienes_privados.ver`), para la audiencia por agrupaciones. */
export async function agrupacionesAudiencia(id: string): Promise<{ id: string; nombre: string }[]> {
  const arbol = await exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/agrupaciones', { params: ph(id) }))
  return arbol.agrupaciones.map((n) => ({ id: n.agrupacion.id, nombre: n.agrupacion.nombre }))
}

/** Roles de la entidad (`roles.ver`), para la audiencia por roles. */
export async function rolesAudiencia(id: string): Promise<{ id: string; nombre: string }[]> {
  const roles = await exigir(api().GET('/api/v1/entidades/{entidad_id}/roles', { params: { path: { entidad_id: id } } }))
  return roles.map((r) => ({ id: r.id, nombre: r.nombre }))
}

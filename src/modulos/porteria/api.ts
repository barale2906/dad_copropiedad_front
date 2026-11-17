/** Llamadas del módulo «Portería» (`/copropiedades/{id}/…`, módulo `control_acceso`). */
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  AlertaAcceso,
  AutorizacionAcceso,
  ConfiguracionAcceso,
  ConsentimientoBiometrico,
  ContactoVisita,
  CostoAvisos,
  Credencial,
  CredencialEmitida,
  DetalleCorrespondencia,
  DetalleVisita,
  DispositivoAcceso,
  EntregaCorrespondencia,
  EstadoCorrespondencia,
  EstadoCredencial,
  EstadoVisita,
  EventoAcceso,
  NovedadMinuta,
  NuevaAutorizacionAcceso,
  NuevaCorrespondencia,
  NuevaCredencial,
  NuevaVisita,
  NuevoEventoAcceso,
  PersonaEntrega,
  Puente,
  PuntoAcceso,
  ResultadoAcceso,
  ResultadoLlamada,
  TipoNovedadMinuta,
  Visita,
  Correspondencia,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const visita = (id: string, visitaId: string) => ({ path: { copropiedad_id: id, visita_id: visitaId } })
const paquete = (id: string, c: string) => ({ path: { copropiedad_id: id, correspondencia_id: c } })

// Visitas ------------------------------------------------------------------------------------

export function listarVisitas(id: string, f: { estado?: EstadoVisita; dentro?: boolean; bienId?: string; despues?: string } = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/visitas', {
      params: { ...ph(id), query: { estado: f.estado, dentro: f.dentro || undefined, bien_privado_id: f.bienId, limite: 100, despues: f.despues } },
    }),
  )
}

/** Anuncia una visita: avisa al responsable, a los 2 min a todos y a los 5 min queda para llamar. */
export function anunciarVisita(id: string, datos: NuevaVisita, clave: string): Promise<Visita> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

/** Visita con la línea de tiempo de avisos, decisiones, llamadas, ingreso y salida. */
export function detalleVisita(id: string, visitaId: string): Promise<DetalleVisita> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}', { params: visita(id, visitaId) }))
}

/** Teléfonos para llamar (solo en `requiere_llamada`; **cada consulta se audita**). */
export function contactosVisita(id: string, visitaId: string): Promise<ContactoVisita[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}/contactos', { params: visita(id, visitaId) }))
}

export function registrarLlamada(id: string, visitaId: string, resultado: ResultadoLlamada, personaId?: string): Promise<Visita> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}/llamada', {
      params: visita(id, visitaId),
      body: { resultado, persona_id: personaId ?? null },
    }),
  )
}

export function ingresoVisita(id: string, visitaId: string): Promise<Visita> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}/ingreso', { params: visita(id, visitaId), body: {} }))
}

export function salidaVisita(id: string, visitaId: string): Promise<Visita> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}/salida', { params: visita(id, visitaId), body: {} }))
}

export function cancelarVisita(id: string, visitaId: string): Promise<Visita> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas/{visita_id}/cancelacion', { params: visita(id, visitaId) }))
}

/** Ingreso con el QR temporal: verifica firma, ventana y usos (409 fuera de ventana; 422 inválido). */
export function ingresoConQr(id: string, qr: string): Promise<Visita> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/visitas/ingreso-qr', { params: ph(id), body: { qr: qr.trim() } }))
}

// Correspondencia ----------------------------------------------------------------------------

export function listarCorrespondencia(id: string, estado?: EstadoCorrespondencia, despues?: string) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/correspondencia', { params: { ...ph(id), query: { estado, limite: 100, despues } } }),
  )
}

/** Registra lo recibido y avisa al primer respondiente. */
export function recibirCorrespondencia(id: string, datos: NuevaCorrespondencia, clave: string): Promise<Correspondencia> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/correspondencia', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

/** Residentes adultos y propietarios del bien, para elegir a quién se entrega. */
export function personasParaEntrega(id: string, bienId: string): Promise<PersonaEntrega[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/correspondencia/personas-para-entrega', {
      params: { ...ph(id), query: { bien_privado_id: bienId } },
    }),
  )
}

/** Entrega (exige firma o foto en Base64; 422 si falta o la persona no es del bien). */
export function entregarCorrespondencia(id: string, c: string, datos: EntregaCorrespondencia): Promise<DetalleCorrespondencia> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/correspondencia/{correspondencia_id}/entrega', { params: paquete(id, c), body: datos }),
  )
}

export function devolverCorrespondencia(id: string, c: string, motivo: string): Promise<Correspondencia> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/correspondencia/{correspondencia_id}/devolucion', {
      params: paquete(id, c),
      body: { motivo },
    }),
  )
}

// Minuta y bitácora --------------------------------------------------------------------------

export function minuta(id: string, despues: string | undefined, f: { tipo?: TipoNovedadMinuta } = {}) {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/minuta', { params: { ...ph(id), query: { tipo: f.tipo, limite: 50, despues } } }))
}

/** Agrega una novedad (la minuta nunca se edita). */
export function registrarNovedad(id: string, tipo: TipoNovedadMinuta, texto: string, adjuntosBase64: string[], clave: string): Promise<NovedadMinuta> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/minuta', {
      params: ph(id),
      body: { tipo, texto, adjuntos_base64: adjuntosBase64 },
      headers: idempotencia(clave),
    }),
  )
}

export function eventosAcceso(id: string, despues: string | undefined, f: { resultado?: ResultadoAcceso; desde?: string; hasta?: string } = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/eventos-acceso', {
      params: { ...ph(id), query: { resultado: f.resultado, desde: f.desde, hasta: f.hasta, limite: 50, despues } },
    }),
  )
}

/** Registra a mano un paso por la portería (entrada o salida sin credencial). */
export function registrarEvento(id: string, datos: NuevoEventoAcceso, clave: string): Promise<EventoAcceso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/eventos-acceso', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export function alertasAcceso(id: string): Promise<AlertaAcceso[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/acceso/alertas', { params: ph(id) }))
}

// Credenciales, autorizaciones y biometría ---------------------------------------------------

export function credenciales(id: string, personaId: string): Promise<Credencial[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/credenciales', { params: { ...ph(id), query: { persona_id: personaId } } }))
}

/** Emite una credencial; el `secreto` (PIN, QR) solo vuelve esta vez. 409 si el identificador ya está en otra vigente. */
export function emitirCredencial(id: string, datos: NuevaCredencial, clave: string): Promise<CredencialEmitida> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/credenciales', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

/** Suspender, reactivar, revocar o reportar perdida (revocada y perdida son definitivas: 409). */
export function cambiarEstadoCredencial(id: string, credencialId: string, estado: EstadoCredencial): Promise<Credencial> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/credenciales/{credencial_id}/estado', {
      params: { path: { copropiedad_id: id, credencial_id: credencialId } },
      body: { estado },
    }),
  )
}

/** Rota un QR permanente o de la app (el nuevo secreto vuelve una sola vez). */
export function rotarCredencial(id: string, credencialId: string): Promise<CredencialEmitida> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/credenciales/{credencial_id}/rotacion', {
      params: { path: { copropiedad_id: id, credencial_id: credencialId } },
    }),
  )
}

export function autorizacionesAcceso(id: string, personaId: string): Promise<AutorizacionAcceso[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/autorizaciones-acceso', { params: { ...ph(id), query: { persona_id: personaId } } }),
  )
}

export function crearAutorizacionAcceso(id: string, datos: NuevaAutorizacionAcceso, clave: string): Promise<AutorizacionAcceso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/autorizaciones-acceso', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export async function revocarAutorizacionAcceso(id: string, autorizacionId: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/autorizaciones-acceso/{autorizacion_id}/revocacion', {
      params: { path: { copropiedad_id: id, autorizacion_id: autorizacionId } },
    }),
  )
}

/** Consentimiento biométrico vigente, o `null`. */
export async function consentimiento(id: string, personaId: string): Promise<ConsentimientoBiometrico | null> {
  const r = await exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}/consentimiento-biometrico', {
      params: { path: { copropiedad_id: id, persona_id: personaId } },
    }),
  )
  return (r as ConsentimientoBiometrico | null | undefined) ?? null
}

export function registrarConsentimiento(id: string, personaId: string, versionTexto: string, soporteBase64: string | null): Promise<ConsentimientoBiometrico> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}/consentimiento-biometrico', {
      params: { path: { copropiedad_id: id, persona_id: personaId } },
      body: { version_texto: versionTexto, soporte_base64: soporteBase64 },
    }),
  )
}

/** Revoca el consentimiento: las credenciales biométricas se revocan. Devuelve cuántas. */
export async function revocarConsentimiento(id: string, personaId: string): Promise<number> {
  const r = await exigir(
    api().DELETE('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}/consentimiento-biometrico', {
      params: { path: { copropiedad_id: id, persona_id: personaId } },
    }),
  )
  return r.credenciales_revocadas
}

// Configuración ------------------------------------------------------------------------------

export function configuracion(id: string): Promise<ConfiguracionAcceso> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/acceso/configuracion', { params: ph(id) }))
}

export function guardarConfiguracion(id: string, datos: ConfiguracionAcceso): Promise<ConfiguracionAcceso> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/acceso/configuracion', { params: ph(id), body: datos }))
}

/** Avisos enviados y su costo estimado entre dos días (`YYYY-MM-DD`). */
export function costoAvisos(id: string, desde: string, hasta: string): Promise<CostoAvisos> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/acceso/costo-avisos', { params: { ...ph(id), query: { desde, hasta } } }))
}

export function puntosAcceso(id: string): Promise<PuntoAcceso[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/puntos-acceso', { params: ph(id) }))
}

export function crearPuntoAcceso(id: string, datos: PuntoAcceso, clave: string): Promise<PuntoAcceso> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/puntos-acceso', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

/** Activar, desactivar o renombrar un punto (requiere su `id`, ver S14). */
export function actualizarPuntoAcceso(id: string, puntoId: string, datos: PuntoAcceso): Promise<PuntoAcceso> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/puntos-acceso/{punto_id}', {
      params: { path: { copropiedad_id: id, punto_id: puntoId } },
      body: { nombre: datos.nombre, tipo: datos.tipo, sentido: datos.sentido, recurso_id: datos.recurso_id, activo: datos.activo },
    }),
  )
}

export function puentes(id: string): Promise<Puente[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/puentes', { params: ph(id) }))
}

/** Registra un puente: el token de máquina se muestra **una sola vez**. */
export function registrarPuente(id: string, nombre: string, clave: string) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/puentes', { params: ph(id), body: { nombre }, headers: idempotencia(clave) }),
  )
}

/** Nuevo token del puente (invalida el anterior; se muestra una sola vez). */
export async function nuevoTokenPuente(id: string, puenteId: string): Promise<string> {
  const r = await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/puentes/{puente_id}/credencial', {
      params: { path: { copropiedad_id: id, puente_id: puenteId } },
    }),
  )
  return r.token
}

export function retirarPuente(id: string, puenteId: string): Promise<Puente> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/puentes/{puente_id}/retiro', { params: { path: { copropiedad_id: id, puente_id: puenteId } } }),
  )
}

export function dispositivos(id: string): Promise<DispositivoAcceso[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/dispositivos-acceso', { params: ph(id) }))
}

export function registrarDispositivo(id: string, datos: DispositivoAcceso, clave: string): Promise<DispositivoAcceso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/dispositivos-acceso', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

// Búsquedas de la portería --------------------------------------------------------------------

/**
 * Bienes activos por código, con lo mínimo (id y código). Exige `acceso.registrar`, no
 * `bienes_privados.ver`: así trabaja la plantilla «vigilante».
 */
export function bienesPorteria(id: string, q: string | undefined, despues?: string, limite = 20) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/acceso/bienes', {
      params: { ...ph(id), query: { q: q?.trim() || undefined, limite, despues } },
    }),
  )
}

/**
 * Opciones para `SelectorPersona`: nombre y documento enmascarado (`****3456`). Exige
 * `acceso.credenciales.gestionar` o `acceso.biometria.enrolar` y al menos 2 caracteres.
 */
export async function opcionesPersona(id: string, q: string) {
  const { datos } = await exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/acceso/personas', { params: { ...ph(id), query: { q: q.trim(), limite: 20 } } }),
  )
  return datos.map((p) => ({ id: p.id, nombre: p.nombre, detalle: p.documento ? `Documento ${p.documento}` : 'Sin documento' }))
}

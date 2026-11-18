/** Llamadas del módulo «Asambleas» (`/copropiedades/{id}/asambleas/…`, Ley 675 arts. 37–49). */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  AccionReunion,
  Asistente,
  CoincidenciaMesa,
  ConfiguracionAsamblea,
  Constancia,
  DetalleReunion,
  DocumentoReunion,
  EstadoPoder,
  EstadoPunto,
  EstadoReunion,
  MotivoSalida,
  NuevaReunion,
  NuevoAsistente,
  Poder,
  PuntoOrdenDia,
  Quorum,
  RegistroAsistente,
  ResultadoConvocatoria,
  ResultadoMorosos,
  Reunion,
  TableroReunion,
  TipoDocumentoReunion,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const r = (id: string, reunion: string) => ({ path: { copropiedad_id: id, reunion_id: reunion } })
const asis = (id: string, reunion: string, a: string) => ({ path: { copropiedad_id: id, reunion_id: reunion, asistente_id: a } })

// Reuniones ----------------------------------------------------------------------------------

export function listarReuniones(id: string, despues: string | undefined, f: { estado?: EstadoReunion } = {}) {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas', { params: { ...ph(id), query: { estado: f.estado, limite: 30, despues } } }))
}

/** Reuniones cerradas con acta publicada. */
export function actasPublicadas(id: string): Promise<Reunion[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/actas', { params: ph(id) }))
}

export function crearReunion(id: string, datos: NuevaReunion, clave: string): Promise<Reunion> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

export function detalleReunion(id: string, reunion: string): Promise<DetalleReunion> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}', { params: r(id, reunion) }))
}

/** Edita los datos (solo en borrador) o la configuración (409 si el estado ya no lo permite). */
export function editarReunion(id: string, reunion: string, cambios: { datos?: NuevaReunion; configuracion?: ConfiguracionAsamblea }): Promise<Reunion> {
  return exigir(api().PATCH('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}', { params: r(id, reunion), body: cambios }))
}

/** Abrir registro, instalar (exige quórum), suspender, reanudar, cerrar o cancelar (con motivo). */
export function transicionReunion(id: string, reunion: string, accion: AccionReunion, motivo?: string): Promise<Reunion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/transiciones', {
      params: r(id, reunion),
      body: { accion, motivo: motivo?.trim() || null },
    }),
  )
}

// Orden del día y anexos ---------------------------------------------------------------------

export function crearPunto(id: string, reunion: string, orden: number, titulo: string, descripcion: string | null): Promise<PuntoOrdenDia> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/puntos', { params: r(id, reunion), body: { orden, titulo, descripcion } }),
  )
}

export function editarPunto(id: string, reunion: string, p: Pick<PuntoOrdenDia, 'id' | 'orden' | 'titulo' | 'descripcion'>): Promise<PuntoOrdenDia> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/puntos/{punto_id}', {
      params: { path: { copropiedad_id: id, reunion_id: reunion, punto_id: p.id } },
      body: { orden: p.orden, titulo: p.titulo, descripcion: p.descripcion ?? null },
    }),
  )
}

export async function borrarPunto(id: string, reunion: string, puntoId: string): Promise<void> {
  await exigir(
    api().DELETE('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/puntos/{punto_id}', {
      params: { path: { copropiedad_id: id, reunion_id: reunion, punto_id: puntoId } },
    }),
  )
}

/** Punto en curso, terminado o aplazado (solo con la reunión instalada). */
export function estadoPunto(id: string, reunion: string, puntoId: string, estado: EstadoPunto): Promise<PuntoOrdenDia> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/puntos/{punto_id}/estado', {
      params: { path: { copropiedad_id: id, reunion_id: reunion, punto_id: puntoId } },
      body: { estado },
    }),
  )
}

export function anexarDocumento(id: string, reunion: string, archivoId: string, tipo: TipoDocumentoReunion, titulo: string): Promise<DocumentoReunion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/documentos', {
      params: r(id, reunion),
      body: { archivo_id: archivoId, tipo, titulo },
    }),
  )
}

export async function quitarDocumento(id: string, reunion: string, archivoId: string): Promise<void> {
  await exigir(
    api().DELETE('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/documentos/{archivo_id}', {
      params: { path: { copropiedad_id: id, reunion_id: reunion, archivo_id: archivoId } },
    }),
  )
}

// Convocatoria y morosos ---------------------------------------------------------------------

/** Convoca: **fija el padrón** (cuadro de coeficientes vigente) y envía por los canales elegidos. */
export function convocar(id: string, reunion: string, canales: { whatsapp: boolean; correo: boolean }): Promise<ResultadoConvocatoria> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/convocatoria', { params: r(id, reunion), body: canales }))
}

export function constancias(id: string, reunion: string): Promise<Constancia[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/convocatoria/constancias', { params: r(id, reunion) }))
}

/** Sin quórum en el registro: crea la reunión de segunda convocatoria (art. 41). */
export function segundaConvocatoria(id: string, reunion: string, canales: { whatsapp: boolean; correo: boolean }): Promise<ResultadoConvocatoria> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/segunda-convocatoria', { params: r(id, reunion), body: canales }),
  )
}

/** Marca como morosos los bienes de esos códigos (reemplaza la lista; 409 si ya se instaló). */
export function marcarMorosos(id: string, reunion: string, codigos: string[]): Promise<ResultadoMorosos> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/morosos', { params: r(id, reunion), body: { codigos } }))
}

// Quórum y tablero ---------------------------------------------------------------------------

export function quorum(id: string, reunion: string): Promise<Quorum> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/quorum', { params: r(id, reunion) }))
}

/** Foto del quórum para el acta (queda registrada). */
export function fotoQuorum(id: string, reunion: string): Promise<Quorum> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/quorum', { params: r(id, reunion) }))
}

/** Tablero: reunión, quórum con `hay_quorum` (lo decide el backend), punto en curso y preguntas. */
export function tablero(id: string, reunion: string): Promise<TableroReunion> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/tablero', { params: r(id, reunion) }))
}

// Mesa de registro ---------------------------------------------------------------------------

/** Busca en el padrón por código del bien o documento del representante. */
export function buscarEnMesa(id: string, reunion: string, texto: string): Promise<CoincidenciaMesa[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/mesa', { params: { ...r(id, reunion), query: { texto: texto.trim() } } }),
  )
}

export function asistentes(id: string, reunion: string): Promise<Asistente[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/asistentes', { params: r(id, reunion) }))
}

/** Registra al asistente con sus bienes y poderes (409 si un bien ya está en otro asistente). */
export function registrarAsistente(id: string, reunion: string, datos: NuevoAsistente, clave: string): Promise<RegistroAsistente> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/asistentes', { params: r(id, reunion), body: datos, headers: idempotencia(clave) }),
  )
}

export function agregarPoder(id: string, reunion: string, asistente: string, bienId: string, soporte: string | null): Promise<Asistente> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/asistentes/{asistente_id}/poderes', {
      params: asis(id, reunion, asistente),
      body: { bien_privado_id: bienId, soporte_archivo_id: soporte },
    }),
  )
}

export function salida(id: string, reunion: string, asistente: string, motivo: MotivoSalida, detalle?: string): Promise<Asistente> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/asistentes/{asistente_id}/salida', {
      params: asis(id, reunion, asistente),
      body: { motivo, detalle: detalle?.trim() || null },
    }),
  )
}

export function reingreso(id: string, reunion: string, asistente: string): Promise<Asistente> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/asistentes/{asistente_id}/reingreso', { params: asis(id, reunion, asistente) }),
  )
}

/** Asigna (o quita con `null`) el rótulo Code 128 con que el asistente vota en papel. */
export function asignarRotulo(id: string, reunion: string, asistente: string, codigo: string | null): Promise<Asistente> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/asistentes/{asistente_id}/rotulo', {
      params: asis(id, reunion, asistente),
      body: { codigo },
    }),
  )
}

export function poderes(id: string, reunion: string): Promise<Poder[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/poderes', { params: r(id, reunion) }))
}

export function revisarPoder(id: string, reunion: string, poderId: string, estado: EstadoPoder, motivo?: string): Promise<Poder> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/asambleas/{reunion_id}/poderes/{poder_id}/estado', {
      params: { path: { copropiedad_id: id, reunion_id: reunion, poder_id: poderId } },
      body: { estado, motivo: motivo?.trim() || null },
    }),
  )
}

/** Hoja de rótulos Code 128 en PDF para recortar (`PREFIJO-0001`…). */
export function imprimirRotulos(id: string, prefijo: string, desde: number, cantidad: number) {
  return descargar(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/asambleas/rotulos', { params: ph(id), body: { prefijo, desde, cantidad }, parseAs: 'blob' }),
    'rotulos.pdf',
  )
}

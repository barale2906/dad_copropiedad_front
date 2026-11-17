/** Llamadas del módulo «Unidades y residentes» (`/copropiedades/{id}/…`, incluido con la PH). */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  AlertasCenso,
  ArbolAgrupaciones,
  BienPrivado,
  CambioCenso,
  CambiosBien,
  CambiosMascota,
  CambiosPersona,
  CampanaCenso,
  Cuadro,
  DetalleCuadro,
  EstadoCambioCenso,
  FichaBien,
  FilaCoeficiente,
  FilaLibroPropietarios,
  FilaLibroResidentes,
  Importacion,
  Mascota,
  NuevaAgrupacion,
  NuevaMascota,
  NuevaResidencia,
  NuevoBien,
  NuevoTitular,
  NuevoUsoExclusivo,
  NuevoVehiculo,
  Persona,
  Residencia,
  RespuestaCampana,
  RevisionCuadro,
  TipoBienPrivado,
  Titular,
  Vehiculo,
  VistaPreviaBienes,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const bien = (id: string, bienId: string) => ({ path: { copropiedad_id: id, bien_privado_id: bienId } })
const cuadro = (id: string, cuadroId: string) => ({ path: { copropiedad_id: id, cuadro_id: cuadroId } })

// Agrupaciones y bienes ---------------------------------------------------------------------

/** Árbol agrupación → bienes activos (hasta 3 niveles) y los bienes sin agrupación. */
export function arbol(id: string): Promise<ArbolAgrupaciones> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/agrupaciones', { params: ph(id) }))
}

export function crearAgrupacion(id: string, datos: NuevaAgrupacion, clave: string) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/agrupaciones', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export interface FiltrosBienes {
  q?: string
  agrupacionId?: string
  tipo?: TipoBienPrivado
  incluirInactivos?: boolean
}

export function listarBienes(id: string, despues: string | undefined, f: FiltrosBienes = {}) {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/bienes-privados', {
      params: {
        ...ph(id),
        query: {
          limite: 50,
          despues,
          q: f.q?.trim() || undefined,
          agrupacion_id: f.agrupacionId || undefined,
          tipo: f.tipo,
          incluir_inactivos: f.incluirInactivos || undefined,
        },
      },
    }),
  )
}

export function crearBien(id: string, datos: NuevoBien, clave: string): Promise<BienPrivado> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/bienes-privados', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

/** Ficha: el bien con su coeficiente vigente, anexos, usos exclusivos y titulares. */
export function fichaBien(id: string, bienId: string): Promise<FichaBien> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}', { params: bien(id, bienId) }))
}

export function editarBien(id: string, bienId: string, cambios: CambiosBien): Promise<BienPrivado> {
  return exigir(
    api().PATCH('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}', { params: bien(id, bienId), body: cambios }),
  )
}

/** Inactiva el bien (conserva su historia; el próximo cuadro ya no lo incluye). */
export function inactivarBien(id: string, bienId: string): Promise<BienPrivado> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/inactivar', { params: bien(id, bienId) }))
}

/** Vincula un anexo (parqueadero, depósito) con folio propio a su bien principal; `null` lo desvincula. */
export function vincularPrincipal(id: string, bienId: string, principalId: string | null): Promise<BienPrivado> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/principal', {
      params: bien(id, bienId),
      body: { bien_principal_id: principalId },
    }),
  )
}

export function asignarUsoExclusivo(id: string, bienId: string, datos: NuevoUsoExclusivo, clave: string) {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/usos-exclusivos', {
      params: bien(id, bienId),
      body: datos,
      headers: idempotencia(clave),
    }),
  )
}

export async function terminarUsoExclusivo(id: string, bienId: string, usoId: string): Promise<void> {
  await exigir(
    api().DELETE('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/usos-exclusivos/{uso_id}', {
      params: { path: { copropiedad_id: id, bien_privado_id: bienId, uso_id: usoId } },
    }),
  )
}

// Titulares ---------------------------------------------------------------------------------

/** Historial de titulares del bien (vigentes primero), con nombre y contacto. */
export function titulares(id: string, bienId: string): Promise<Titular[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/titulares', { params: bien(id, bienId) }))
}

/** Registra los titulares de un bien que aún no tiene (409 si ya tiene: use la transferencia). */
export async function registrarTitulares(id: string, bienId: string, lista: NuevoTitular[], clave: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/titulares', {
      params: bien(id, bienId),
      body: { titulares: lista },
      headers: idempotencia(clave),
    }),
  )
}

/** Transfiere el bien: termina a los titulares vigentes y registra a los nuevos en una transacción. */
export async function transferir(id: string, bienId: string, lista: NuevoTitular[], soporteId: string | null, clave: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/transferencias', {
      params: bien(id, bienId),
      body: { titulares: lista, soporte_archivo_id: soporteId },
      headers: idempotencia(clave),
    }),
  )
}

export async function designarRepresentante(id: string, bienId: string, personaId: string): Promise<void> {
  await exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}/representante', {
      params: bien(id, bienId),
      body: { persona_id: personaId },
    }),
  )
}

// Coeficientes ------------------------------------------------------------------------------

export function cuadros(id: string): Promise<Cuadro[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cuadros-coeficientes', { params: ph(id) }))
}

/** Crea un borrador (siguiente versión), copiando el vigente si se pide. */
export function crearCuadro(id: string, copiarVigente: boolean, descripcion: string | null, clave: string): Promise<Cuadro> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/cuadros-coeficientes', {
      params: ph(id),
      body: { copiar_vigente: copiarVigente, descripcion },
      headers: idempotencia(clave),
    }),
  )
}

export function detalleCuadro(id: string, cuadroId: string): Promise<DetalleCuadro> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cuadros-coeficientes/{cuadro_id}', { params: cuadro(id, cuadroId) }))
}

/** Reemplaza los coeficientes del borrador y devuelve la revisión (suma y diferencia). */
export function guardarCoeficientes(id: string, cuadroId: string, filas: FilaCoeficiente[]): Promise<RevisionCuadro> {
  return exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/cuadros-coeficientes/{cuadro_id}/coeficientes', {
      params: cuadro(id, cuadroId),
      body: { coeficientes: filas },
    }),
  )
}

export function validarCuadro(id: string, cuadroId: string): Promise<RevisionCuadro> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cuadros-coeficientes/{cuadro_id}/validar', { params: cuadro(id, cuadroId) }))
}

/**
 * Activa el borrador (el vigente pasa a histórico). 422 `coeficientes_no_suman_uno` si no suma
 * exactamente 1; 409 si hay una asamblea instalada.
 */
export function activarCuadro(id: string, cuadroId: string): Promise<Cuadro> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cuadros-coeficientes/{cuadro_id}/activar', { params: cuadro(id, cuadroId) }))
}

// Censo -------------------------------------------------------------------------------------

export function residencias(id: string, bienId?: string, historial = false): Promise<Residencia[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/residencias', {
      params: { ...ph(id), query: { bien_privado_id: bienId, historial: historial || undefined } },
    }),
  )
}

export function registrarResidencia(id: string, datos: NuevaResidencia, clave: string): Promise<Residencia> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/residencias', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export async function terminarResidencia(id: string, residenciaId: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/residencias/{residencia_id}/terminar', {
      params: { path: { copropiedad_id: id, residencia_id: residenciaId } },
    }),
  )
}

/** El propietario (o la administración) autoriza o retira las reservas del tenedor. */
export async function autorizarReservas(id: string, residenciaId: string, autorizadas: boolean): Promise<void> {
  await exigir(
    api().PUT('/api/v1/copropiedades/{copropiedad_id}/residencias/{residencia_id}/autorizacion-reservas', {
      params: { path: { copropiedad_id: id, residencia_id: residenciaId } },
      body: { autorizadas },
    }),
  )
}

export function vehiculos(id: string, f: { bienId?: string; placa?: string } = {}): Promise<Vehiculo[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/vehiculos', {
      params: { ...ph(id), query: { bien_privado_id: f.bienId, placa: f.placa?.trim() || undefined } },
    }),
  )
}

/** Registra un vehículo (409 si la placa ya está en otro vigente). */
export function registrarVehiculo(id: string, datos: NuevoVehiculo, clave: string): Promise<Vehiculo> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/vehiculos', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export async function retirarVehiculo(id: string, vehiculoId: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/vehiculos/{vehiculo_id}/retirar', {
      params: { path: { copropiedad_id: id, vehiculo_id: vehiculoId } },
    }),
  )
}

export function mascotas(id: string, bienId?: string): Promise<Mascota[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/mascotas', { params: { ...ph(id), query: { bien_privado_id: bienId } } }))
}

export function registrarMascota(id: string, datos: NuevaMascota, clave: string): Promise<Mascota> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/mascotas', { params: ph(id), body: datos, headers: idempotencia(clave) }),
  )
}

export function editarMascota(id: string, mascotaId: string, cambios: CambiosMascota): Promise<Mascota> {
  return exigir(
    api().PATCH('/api/v1/copropiedades/{copropiedad_id}/mascotas/{mascota_id}', {
      params: { path: { copropiedad_id: id, mascota_id: mascotaId } },
      body: cambios,
    }),
  )
}

/** Vacunas y pólizas vencidas o por vencer, y residentes sin autorización de datos. */
export function alertasCenso(id: string): Promise<AlertasCenso> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/censo/alertas', { params: ph(id) }))
}

export function campanas(id: string): Promise<CampanaCenso[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/censo/campanas', { params: ph(id) }))
}

/** Lanza una campaña de actualización por WhatsApp; devuelve a cuántos se envió. */
export async function lanzarCampana(id: string, clave: string): Promise<number> {
  const r = await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/censo/campanas', { params: ph(id), headers: idempotencia(clave) }),
  )
  return r.enviados
}

export function respuestasCampana(id: string, campanaId: string): Promise<RespuestaCampana[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/censo/campanas/{campana_id}/respuestas', {
      params: { path: { copropiedad_id: id, campana_id: campanaId } },
    }),
  )
}

export async function atenderRespuesta(id: string, campanaId: string, personaId: string, bienId: string): Promise<void> {
  await exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/censo/campanas/{campana_id}/respuestas/{persona_id}/{bien_privado_id}/atender', {
      params: { path: { copropiedad_id: id, campana_id: campanaId, persona_id: personaId, bien_privado_id: bienId } },
    }),
  )
}

// Cambios propuestos ------------------------------------------------------------------------

export function cambiosCenso(id: string, estado?: EstadoCambioCenso): Promise<CambioCenso[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cambios-censo', { params: { ...ph(id), query: { estado } } }))
}

/** Aprueba: crea el registro en la misma transacción (409 si ya se revisó). */
export function aprobarCambio(id: string, cambioId: string): Promise<CambioCenso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/cambios-censo/{cambio_id}/aprobar', {
      params: { path: { copropiedad_id: id, cambio_id: cambioId } },
    }),
  )
}

export function rechazarCambio(id: string, cambioId: string, motivo: string): Promise<CambioCenso> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/cambios-censo/{cambio_id}/rechazar', {
      params: { path: { copropiedad_id: id, cambio_id: cambioId } },
      body: { motivo },
    }),
  )
}

// Personas ----------------------------------------------------------------------------------

export function persona(id: string, personaId: string): Promise<Persona> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}', { params: { path: { copropiedad_id: id, persona_id: personaId } } }),
  )
}

export function editarPersona(id: string, personaId: string, cambios: CambiosPersona): Promise<Persona> {
  return exigir(
    api().PATCH('/api/v1/copropiedades/{copropiedad_id}/personas/{persona_id}', {
      params: { path: { copropiedad_id: id, persona_id: personaId } },
      body: cambios,
    }),
  )
}

// Libros del art. 51 ------------------------------------------------------------------------

export function libroPropietarios(id: string, corte: string): Promise<FilaLibroPropietarios[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/libros/propietarios', { params: { ...ph(id), query: { corte } } }))
}

export function libroResidentes(id: string, corte: string): Promise<FilaLibroResidentes[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/libros/residentes', { params: { ...ph(id), query: { corte } } }))
}

/** Descarga un libro en CSV o PDF (con su huella SHA-256 si el backend la envía). */
export function descargarLibro(id: string, libro: 'propietarios' | 'residentes', corte: string, formato: 'csv' | 'pdf') {
  const params = { ...ph(id), query: { corte, formato } }
  const nombre = `libro-${libro}-${corte}.${formato}`
  return libro === 'propietarios'
    ? descargar(api().GET('/api/v1/copropiedades/{copropiedad_id}/libros/propietarios', { params, parseAs: 'blob' }), nombre)
    : descargar(api().GET('/api/v1/copropiedades/{copropiedad_id}/libros/residentes', { params, parseAs: 'blob' }), nombre)
}

// Importación de bienes ---------------------------------------------------------------------

export function descargarPlantillaBienes(id: string) {
  return descargar(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/importaciones/bienes-privados/plantilla', { params: ph(id), parseAs: 'blob' }),
    'plantilla-bienes-privados.csv',
  )
}

/** Sube la planilla (CSV o XLSX) y devuelve la vista previa con errores por fila; no aplica nada. */
export function importarBienes(id: string, archivo: File): Promise<VistaPreviaBienes> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/importaciones/bienes-privados', {
      params: { ...ph(id), query: { nombre: archivo.name } },
      // El contrato describe el cuerpo como bytes; se envía el archivo tal cual.
      body: [],
      bodySerializer: () => archivo,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  )
}

/** Aplica la importación validada (todo o nada): bienes, titulares y un cuadro borrador. */
export function confirmarImportacionBienes(id: string, importacionId: string, clave: string): Promise<Importacion> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/importaciones/{importacion_id}/confirmar', {
      params: { path: { copropiedad_id: id, importacion_id: importacionId } },
      headers: idempotencia(clave),
    }),
  )
}

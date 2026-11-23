/**
 * Reglas puras de la consola de la plataforma: textos y tonos de los estados, qué se puede hacer
 * en cada estado (el backend vuelve a decidir), el alta con un solo administrador, la vigencia de
 * las versiones normativas y la lectura del PUC con vista previa.
 */
import type {
  AdministradorNuevo,
  CuentaPuc,
  EstadoCampana,
  EstadoCorte,
  EstadoCreativo,
  EstadoEntidad,
  EstadoLinea,
  EstadoLiquidacion,
  EstadoPlantillaContable,
  EstadoSuscripcion,
  EstadoVerificacion,
  ImpuestoRetencion,
  Modulo,
  ModeloCobro,
  ModeloTarifa,
  NuevaCopropiedad,
  NuevaEntidad,
  ObjetivoCampana,
  TipoCobertura,
  TipoEntidad,
  TratamientoIva,
} from '@/api/tipos'

export type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'
export interface TextoEstado {
  texto: string
  tono: Tono
}

// Clientes ---------------------------------------------------------------------------------

/** Nombre comercial de cada módulo contratable. */
export const NOMBRE_MODULO: Record<Modulo, string> = {
  contabilidad: 'Contabilidad',
  contabilidad_ph: 'Contabilidad de la PH (cartera)',
  facturacion_electronica: 'Factura electrónica',
  bienes_comunes: 'Zonas comunes',
  control_acceso: 'Portería y control de acceso',
  asambleas: 'Asambleas',
  gestion_administrativa: 'Gestión administrativa',
  nomina: 'Nómina',
}

/**
 * Los módulos que se venden a cada tipo de entidad (la cartera y la portería son de la PH; la
 * nómina se vende sola a cualquiera).
 */
export function modulosDe(tipo: TipoEntidad): Modulo[] {
  const todos = Object.keys(NOMBRE_MODULO) as Modulo[]
  return tipo === 'propiedad_horizontal' ? todos : ['contabilidad', 'facturacion_electronica', 'nomina']
}

export const TONO_ESTADO_ENTIDAD: Record<EstadoEntidad, Tono> = {
  en_configuracion: 'info',
  activa: 'exito',
  suspendida: 'aviso',
  retirada: 'neutro',
}

/**
 * A qué estados puede pasar una entidad: desde la configuración solo activarla o retirarla;
 * activa o suspendida se alternan; retirada es final.
 */
export function estadosSiguientes(estado: EstadoEntidad): EstadoEntidad[] {
  switch (estado) {
    case 'en_configuracion':
      return ['activa', 'retirada']
    case 'activa':
      return ['suspendida', 'retirada']
    case 'suspendida':
      return ['activa', 'retirada']
    case 'retirada':
      return []
  }
}

/** Texto del botón para pasar a cada estado. */
export const ACCION_ESTADO: Record<EstadoEntidad, string> = {
  en_configuracion: 'Volver a configuración',
  activa: 'Activar',
  suspendida: 'Suspender',
  retirada: 'Retirar',
}

/** Datos del asistente de alta (PH o empresa). */
export interface FormularioAlta {
  tipo: 'propiedad_horizontal' | 'empresa'
  nombre: string
  nit: string
  /** `nuevo`: se crea la cuenta del administrador; `existente`: se elige una cuenta. */
  administrador: 'nuevo' | 'existente'
  nuevo: Required<{ [K in keyof AdministradorNuevo]: string }>
  cuentaId: string
}

/** Errores del asistente por campo (vacío = se puede enviar). */
export function erroresAlta(f: FormularioAlta): Partial<Record<'nombre' | 'nit' | 'adminNombre' | 'adminCorreo' | 'adminUsuario' | 'cuenta', string>> {
  const e: ReturnType<typeof erroresAlta> = {}
  if (f.nombre.trim().length < 3) e.nombre = 'Escriba el nombre (al menos 3 caracteres).'
  if (f.nit.trim() && !/^\d{6,10}(-?\d)?$/.test(f.nit.replace(/\./g, '').trim())) e.nit = 'Escriba el NIT solo con números (el dígito de verificación es opcional).'
  if (f.administrador === 'nuevo') {
    if (f.nuevo.nombre.trim().length < 3) e.adminNombre = 'Escriba el nombre del administrador.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.nuevo.correo.trim())) e.adminCorreo = 'Escriba un correo válido: allí llega el código para definir la contraseña.'
    const u = f.nuevo.usuario?.trim()
    if (u && !/^[a-z0-9._-]{3,30}$/.test(u)) e.adminUsuario = 'Use de 3 a 30 letras minúsculas, números, punto, guion o guion bajo.'
  } else if (!f.cuentaId) {
    e.cuenta = 'Busque y elija la cuenta del administrador.'
  }
  return e
}

/** Cuerpo del alta con **un solo** administrador: el nuevo o el de la cuenta existente. */
export function cuerpoAlta(f: FormularioAlta): NuevaCopropiedad | NuevaEntidad {
  const administrador =
    f.administrador === 'nuevo'
      ? { administrador: { nombre: f.nuevo.nombre.trim(), correo: f.nuevo.correo.trim(), usuario: f.nuevo.usuario?.trim() || null } }
      : { administrador_cuenta_id: f.cuentaId }
  return { nombre: f.nombre.trim(), nit: f.nit.trim() || null, ...administrador }
}

// Publicidad -------------------------------------------------------------------------------

export const ESTADO_ANUNCIANTE: Record<EstadoVerificacion, TextoEstado> = {
  pendiente: { texto: 'Por verificar', tono: 'aviso' },
  verificado: { texto: 'Verificado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'peligro' },
  suspendido: { texto: 'Suspendido', tono: 'neutro' },
}

/** Cambios de estado de un comercio y si exigen motivo. */
export function cambiosAnunciante(estado: EstadoVerificacion): { estado: EstadoVerificacion; texto: string; motivo: boolean }[] {
  const verificar = { estado: 'verificado' as const, texto: 'Verificar', motivo: false }
  const rechazar = { estado: 'rechazado' as const, texto: 'Rechazar', motivo: true }
  const suspender = { estado: 'suspendido' as const, texto: 'Suspender', motivo: true }
  const pendiente = { estado: 'pendiente' as const, texto: 'Volver a revisión', motivo: false }
  switch (estado) {
    case 'pendiente':
      return [verificar, rechazar]
    case 'verificado':
      return [suspender]
    case 'suspendido':
      return [verificar]
    case 'rechazado':
      return [pendiente]
  }
}

export const COBERTURA: Record<TipoCobertura, string> = {
  nacional: 'Todo el país',
  municipio: 'Su municipio',
  radio: 'Un radio alrededor del comercio',
}

export const ESTADO_CAMPANA: Record<EstadoCampana, TextoEstado> = {
  borrador: { texto: 'Borrador', tono: 'neutro' },
  en_revision: { texto: 'En revisión', tono: 'info' },
  aprobada: { texto: 'Aprobada', tono: 'info' },
  rechazada: { texto: 'Rechazada', tono: 'peligro' },
  activa: { texto: 'Activa', tono: 'exito' },
  pausada: { texto: 'Pausada', tono: 'aviso' },
  finalizada: { texto: 'Finalizada', tono: 'neutro' },
}

/** Acciones del ciclo de la campaña según su estado. */
export function accionesCampana(estado: EstadoCampana): { accion: string; texto: string }[] {
  const enviar = { accion: 'enviar_a_revision', texto: 'Enviar a revisión' }
  const activar = { accion: 'activar', texto: 'Activar' }
  const pausar = { accion: 'pausar', texto: 'Pausar' }
  const finalizar = { accion: 'finalizar', texto: 'Finalizar' }
  switch (estado) {
    case 'borrador':
    case 'rechazada':
      return [enviar]
    case 'aprobada':
      return [activar, finalizar]
    case 'activa':
      return [pausar, finalizar]
    case 'pausada':
      return [activar, finalizar]
    default:
      return []
  }
}

/** La campaña se edita solo antes de la revisión (o tras un rechazo). */
export const campanaEditable = (estado: EstadoCampana) => estado === 'borrador' || estado === 'rechazada'

export const ESTADO_CREATIVO: Record<EstadoCreativo, TextoEstado> = {
  pendiente: { texto: 'Por moderar', tono: 'aviso' },
  aprobado: { texto: 'Aprobada', tono: 'exito' },
  rechazado: { texto: 'Rechazada', tono: 'peligro' },
}

export const OBJETIVO_CAMPANA: Record<ObjetivoCampana, string> = {
  visibilidad: 'Visibilidad',
  trafico: 'Visitas a su enlace',
  cupones: 'Cupones',
  leads: 'Contactos (leads)',
}

export const MODELO_COBRO: Record<ModeloCobro, string> = {
  tarifa_fija: 'Tarifa fija',
  cpm: 'Por mil impresiones (CPM)',
  cpc: 'Por clic (CPC)',
  por_redencion: 'Por cupón redimido',
  por_lead: 'Por contacto',
  directorio_destacado: 'Destacado en el directorio',
}

export const ESTADO_LIQUIDACION: Record<EstadoLiquidacion, TextoEstado> = {
  calculada: { texto: 'Calculada', tono: 'info' },
  facturada: { texto: 'Facturada', tono: 'aviso' },
  pagada: { texto: 'Pagada', tono: 'exito' },
}

// WhatsApp ---------------------------------------------------------------------------------

export const ESTADO_LINEA: Record<EstadoLinea, TextoEstado> = {
  activa: { texto: 'Activa', tono: 'exito' },
  degradada: { texto: 'Calidad baja', tono: 'aviso' },
  pausada: { texto: 'Pausada', tono: 'neutro' },
}

// Normativa --------------------------------------------------------------------------------

export const IMPUESTO_RETENCION: Record<ImpuestoRetencion, string> = { renta: 'Retención en la fuente', iva: 'ReteIVA', ica: 'ReteICA' }

export const TRATAMIENTO_IVA: Record<TratamientoIva, string> = {
  gravado: 'Gravado',
  exento: 'Exento',
  excluido: 'Excluido',
  no_sujeto: 'No sujeto',
}

export const ESTADO_PLANTILLA: Record<EstadoPlantillaContable, TextoEstado> = {
  borrador: { texto: 'Borrador', tono: 'neutro' },
  publicada: { texto: 'Publicada', tono: 'exito' },
  retirada: { texto: 'Retirada', tono: 'aviso' },
}

/** Una versión normativa con su vigencia (`vigente_hasta` nulo = sin fin). */
export interface Vigencia {
  vigente_desde: string
  vigente_hasta?: string | null
}

/**
 * Estado de una versión respecto a `hoy` (`YYYY-MM-DD`): `vigente`, `futura` o `vencida`. Las
 * fechas del contrato son de calendario, así que se comparan como texto.
 */
export function vigencia(v: Vigencia, hoy: string): 'vigente' | 'futura' | 'vencida' {
  if (v.vigente_desde.slice(0, 10) > hoy) return 'futura'
  if (v.vigente_hasta && v.vigente_hasta.slice(0, 10) < hoy) return 'vencida'
  return 'vigente'
}

export const TEXTO_VIGENCIA: Record<ReturnType<typeof vigencia>, TextoEstado> = {
  vigente: { texto: 'Vigente', tono: 'exito' },
  futura: { texto: 'Desde más adelante', tono: 'info' },
  vencida: { texto: 'Vencida', tono: 'neutro' },
}

/** Resultado de leer un PUC pegado: las cuentas válidas y los errores por fila. */
export interface LecturaPuc {
  cuentas: CuentaPuc[]
  errores: { fila: number; mensaje: string }[]
}

/**
 * Lee el PUC pegado como CSV (`codigo,nombre,naturaleza`, con o sin encabezado). La naturaleza
 * es `debito` o `credito` (o D/C). Así se revisa antes de cargarlo.
 */
export function leerPuc(texto: string): LecturaPuc {
  const lectura: LecturaPuc = { cuentas: [], errores: [] }
  const vistos = new Set<string>()
  texto.split(/\r?\n/).forEach((linea, i) => {
    const fila = i + 1
    if (!linea.trim()) return
    const [codigo = '', nombre = '', nat = ''] = linea.split(/[;,\t]/).map((x) => x.trim())
    if (i === 0 && codigo.toLowerCase() === 'codigo') return
    const naturaleza = { d: 'debito', debito: 'debito', c: 'credito', credito: 'credito' }[nat.toLowerCase()] as CuentaPuc['naturaleza'] | undefined
    if (!/^\d{1,10}$/.test(codigo)) lectura.errores.push({ fila, mensaje: `El código «${codigo}» debe tener solo números.` })
    else if (!nombre) lectura.errores.push({ fila, mensaje: 'Falta el nombre de la cuenta.' })
    else if (!naturaleza) lectura.errores.push({ fila, mensaje: 'La naturaleza debe ser débito o crédito.' })
    else if (vistos.has(codigo)) lectura.errores.push({ fila, mensaje: `El código ${codigo} está repetido.` })
    else {
      vistos.add(codigo)
      lectura.cuentas.push({ codigo, nombre, naturaleza })
    }
  })
  return lectura
}

// Cobros -----------------------------------------------------------------------------------

export const ESTADO_CORTE: Record<EstadoCorte, TextoEstado> = {
  borrador: { texto: 'Por revisar', tono: 'aviso' },
  aprobado: { texto: 'Por facturar', tono: 'info' },
  facturado: { texto: 'Facturado', tono: 'aviso' },
  pagado: { texto: 'Pagado', tono: 'exito' },
  descartado: { texto: 'Descartado', tono: 'neutro' },
}

export type AccionCorte = 'aprobar' | 'descartar' | 'facturar' | 'factura_externa' | 'pago'

/** Qué se puede hacer con un corte según su estado. */
export function accionesCorte(estado: EstadoCorte): AccionCorte[] {
  switch (estado) {
    case 'borrador':
      return ['aprobar', 'descartar']
    case 'aprobado':
      return ['facturar', 'factura_externa', 'descartar']
    case 'facturado':
      return ['pago']
    default:
      return []
  }
}

export const ESTADO_SUSCRIPCION: Record<EstadoSuscripcion, TextoEstado> = {
  activa: { texto: 'Activa', tono: 'exito' },
  suspendida: { texto: 'Suspendida', tono: 'aviso' },
  terminada: { texto: 'Terminada', tono: 'neutro' },
}

export const MODELO_TARIFA: Record<ModeloTarifa, string> = {
  plana: 'Valor fijo por periodo',
  por_unidad: 'Por unidad',
  por_paquete: 'Paquete con excedente',
  por_consumo: 'Por consumo',
  unica: 'Pago único',
}

/** Métricas que cobran las tarifas por unidad, paquete o consumo. */
export const METRICAS_TARIFA = {
  'ph.bienes_privados': 'Bienes privados de la PH',
  'facturacion.documentos': 'Documentos electrónicos',
  'whatsapp.mensajes': 'Mensajes de WhatsApp',
  'usuarios.cuentas': 'Usuarios',
} as const

/** El modelo de tarifa exige una métrica (por unidad, paquete o consumo). */
export const exigeMetrica = (m: ModeloTarifa) => m === 'por_unidad' || m === 'por_paquete' || m === 'por_consumo'

/** Contenido de una plantilla contable (el contrato lo tipa como objeto sin forma fija). */
export type ContenidoPlantilla = Record<string, never>

/** Lee el JSON del contenido de una plantilla; `null` si no es un objeto JSON válido. */
export function leerContenido(texto: string): ContenidoPlantilla | null {
  try {
    const v: unknown = JSON.parse(texto)
    // El contrato tipa el contenido como `Record<string, never>`: cualquier objeto JSON vale.
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as ContenidoPlantilla) : null
  } catch {
    return null
  }
}

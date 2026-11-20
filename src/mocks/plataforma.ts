/**
 * Demo de la consola de la plataforma (plan 15): clientes (PH y empresas en cada estado), cuentas
 * y roles de plataforma, soporte de solo lectura (2 h), reclamaciones, normativa, WhatsApp,
 * directorio y publicidad (comercios, campañas, moderación con **cuatro ojos**: lo que cargó la
 * cuenta de la sesión da 409), consumo y cobros (cortes en cada estado).
 *
 * Usuarios y roles de una entidad (`/plataforma/entidades/{id}/{usuarios,roles,asignaciones}`)
 * los atiende el mismo demo de «Datos y usuarios» (`entidad.ts`).
 */
import type {
  Anunciante,
  Campana,
  CategoriaDirectorio,
  ConceptoRetencion,
  Corte,
  Creativo,
  CuentaPlataforma,
  EntidadPlataforma,
  EstadoCorte,
  ExclusionPublicidad,
  FormatoExogena,
  LineaSuscripcion,
  LineaWhatsapp,
  LiquidacionPublicidad,
  Modulo,
  PlantillaContable,
  Producto,
  Reclamacion,
  ResenaReportada,
  CreativoReportado,
  Rol,
  Suscripcion,
  TarifaIca,
  TarifaIva,
  TarifaPublicidad,
  TarifaWhatsapp,
  TasaReferencia,
  Uvt,
} from '@/api/tipos'
import { cuentaDemoId } from './cuenta'
import { CATEGORIAS, piezasDemo } from './directorio'
import { entidad } from './entidad'
import { cuerpo, error, fechaDemo, json, type Manejador, sinContenido } from './http'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const DIA = 86_400_000
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
/** Otra cuenta del equipo (lo que cargó ella sí lo puede moderar la de la sesión). */
const OTRA_CUENTA = id(15999)

let cuentaSesion = ''
let consecutivo = 15500
const nuevoId = () => id(++consecutivo)

let clientes: EntidadPlataforma[] = []
let soportes = new Map<string, number>()
let cuentas: CuentaPlataforma[] = []
let roles: Rol[] = []
let asignaciones = new Map<string, string>()
let reclamos: Reclamacion[] = []
let conceptos: ConceptoRetencion[] = []
let uvts: Uvt[] = []
let iva: TarifaIva[] = []
let ica: TarifaIca[] = []
let exogena: FormatoExogena[] = []
let tasas: TasaReferencia[] = []
let plantillas: PlantillaContable[] = []
let lineas: LineaWhatsapp[] = []
let tarifasWa: TarifaWhatsapp[] = []
let categorias: CategoriaDirectorio[] = []
let anunciantes: Anunciante[] = []
let campanas: Campana[] = []
let creativos: Creativo[] = []
/** Quién cargó o editó cada pieza o campaña (cuatro ojos). */
let autores = new Map<string, string>()
let resenas: ResenaReportada[] = []
let reportes: CreativoReportado[] = []
let enlaces = new Map<string, string>()
let exclusiones: ExclusionPublicidad[] = []
let tarifasPub: TarifaPublicidad[] = []
let liquidaciones: LiquidacionPublicidad[] = []
let pantallas = new Map<string, string>()
let productos: Producto[] = []
let suscripciones: Suscripcion[] = []
let lineasSus: (LineaSuscripcion & { suscripcion_id: string })[] = []
let cortes: Corte[] = []

/** ¿La cuenta de la sesión tiene abierto un acceso de soporte a la entidad? */
export function accesoSoporte(entidadId: string): boolean {
  return (soportes.get(entidadId) ?? 0) > Date.now()
}

const cliente = (n: number, nombre: string, tipo: EntidadPlataforma['tipo'], estado: EntidadPlataforma['estado'], modulos: Modulo[], nit: string | null = null): EntidadPlataforma => ({
  id: id(n), nombre, tipo, estado, modulos, nit,
})

const vigente = (desde: number, hasta?: number) => ({ vigente_desde: fechaDemo(desde), vigente_hasta: hasta === undefined ? null : fechaDemo(hasta) })

function iniciarPublicidad(): void {
  categorias = CATEGORIAS.map((c) => ({ ...c }))
  const ficha = (cats: string[], extra = {}) => ({
    descripcion: 'Arreglos de ropa a domicilio.', categorias: cats, cobertura: 'municipio', radio_km: null,
    contacto: { whatsapp: '573001234567' }, horario: null, destacada_hasta: null, publicada: true, actualizada_en: hace(3), ...extra,
  })
  anunciantes = [
    { id: id(14001), organizacion_id: id(15101), nombre_comercial: 'Modistería Rosa', direccion: 'Calle 45 # 12-30', municipio_dane: '11001', estado: 'verificado', creado_en: hace(90), actualizado_en: hace(3), ficha: ficha(['costura']) },
    { id: id(14002), organizacion_id: id(15102), nombre_comercial: 'Técnico Lavadoras Ya', municipio_dane: '11001', estado: 'pendiente', creado_en: hace(4), actualizado_en: hace(4), ficha: null },
    { id: id(14009), organizacion_id: id(15103), nombre_comercial: 'Licorera Nocturna', estado: 'rechazado', motivo_estado: 'Categoría restringida (licores).', creado_en: hace(30), actualizado_en: hace(29), ficha: null },
  ]
  const segmentacion = { entidades: [], tipos_entidad: [], radio_km: null, municipios: ['11001'], tipos: [], bienes_min: null, bienes_max: null, estratos: [] }
  const campana = (n: number, nombre: string, estado: Campana['estado'], extra: Partial<Campana> = {}): Campana => ({
    id: id(n), anunciante_id: id(14001), nombre, objetivo: 'cupones', categoria: 'costura', inicio: fechaDemo(-10), fin: fechaDemo(20),
    modelo: 'cpm', presupuesto_total: '500000.00', presupuesto_diario: null, tarifa: estado === 'activa' ? '12000.00' : null, consumido: estado === 'activa' ? '84000.00' : '0',
    segmentacion, conflicto_interes: false, estado, creada_en: hace(15), ...extra,
  })
  campanas = [
    campana(15201, 'Arreglos de temporada', 'activa'),
    campana(15202, 'Uniformes escolares', 'borrador'),
    campana(15203, 'Confección a la medida', 'en_revision', { conflicto_interes: true }),
  ]
  const creativo = (n: number, campanaId: number, titulo: string, estado: Creativo['estado'], extra: Partial<Creativo> = {}): Creativo => ({
    id: id(n), campana_id: id(campanaId), formato: 'banner', titulo, texto: `${titulo}: para los vecinos del conjunto.`, es_promocion: false, cupon_usos: 0, estado, ...extra,
  })
  creativos = [
    creativo(15301, 15201, '10 % en arreglos de ropa', 'aprobado', { formato: 'oferta_cupon', es_promocion: true, condiciones: 'Un cupón por persona.', cupon_codigo: 'ROSA10', cupon_usos: 7 }),
    creativo(15302, 15202, 'Uniformes listos en una semana', 'pendiente'),
    creativo(15303, 15203, 'Vestidos a la medida', 'pendiente', { enlace: 'https://modisteriarosa.example.co' }),
  ]
  // La pieza de «Uniformes» la cargó la cuenta de la sesión: moderarla da 409.
  autores = new Map([[id(15302), cuentaSesion], [id(15303), OTRA_CUENTA], [id(15203), OTRA_CUENTA]])
  resenas = [
    { resena_id: id(14301), copropiedad_id: id(1), copropiedad: 'Conjunto Residencial Los Robles', anunciante_id: id(14001), nombre_comercial: 'Modistería Rosa', calificacion: 1, texto: 'Pésimo servicio, son unos ladrones.', reportes: 2, motivos: ['Lenguaje ofensivo'], creada_en: hace(6) },
  ]
  reportes = [
    { creativo_id: id(15301), campana_id: id(15201), anunciante_id: id(14001), nombre_comercial: 'Modistería Rosa', titulo: '10 % en arreglos de ropa', reportes: 1, motivos: ['Publicidad engañosa'], primero_en: hace(2) },
  ]
  enlaces = new Map([[id(14001), 'demo-cupones-ROSA']])
  exclusiones = [{ entidad_id: id(2), motivo: 'El consejo pidió no recibir publicidad.', creada_en: hace(40) }]
  tarifasPub = [
    { modelo: 'cpm', valor: '12000.00', vigente_desde: fechaDemo(-200) },
    { modelo: 'cpc', valor: '800.00', vigente_desde: fechaDemo(-200) },
    { modelo: 'directorio_destacado', valor: '90000.00', vigente_desde: fechaDemo(-60) },
  ]
  liquidaciones = [
    { id: id(15401), anunciante_id: id(14001), periodo: fechaDemo(-30), variable: '84000.00', fijos: '90000.00', leads: 3, valor_leads: '15000.00', valor: '189000.00', costo_whatsapp: '1200.00', estado: 'calculada' },
  ]
  pantallas = new Map([[id(1), 'demo-pantalla-ROBLES']])
}

function iniciarCobros(): void {
  productos = [
    { id: id(15601), codigo: 'ph_base', nombre: 'DAD Copropiedad (por bien)', descripcion_factura: '{producto} {periodo}: {cantidad} bienes', modulo: null, item_facturacion_id: null, activo: true,
      tarifas: [{ modelo: 'por_unidad', valor: '1500.00', metrica: 'ph.bienes_privados', vigente_desde: fechaDemo(-365) }] },
    { id: id(15602), codigo: 'fe_paquete', nombre: 'Factura electrónica (paquete)', descripcion_factura: '{producto} {periodo}', modulo: 'facturacion_electronica', item_facturacion_id: null, activo: true,
      tarifas: [{ modelo: 'por_paquete', valor: '60000.00', incluidas: 100, valor_excedente: '450.00', metrica: 'facturacion.documentos', vigente_desde: fechaDemo(-120) }] },
  ]
  suscripciones = [
    { id: id(15701), entidad_id: id(1), ciclo_meses: 1, inicio: fechaDemo(-300), dias_prueba: 0, plazo_pago_dias: 15, correo_facturacion: 'administracion@losrobles.co', estado: 'activa', suspendida_por_mora: false },
    { id: id(15702), entidad_id: id(4), ciclo_meses: 1, inicio: fechaDemo(-90), dias_prueba: 30, plazo_pago_dias: 15, correo_facturacion: 'pagos@andina.co', estado: 'activa', suspendida_por_mora: false },
  ]
  lineasSus = [
    { id: id(15711), suscripcion_id: id(15701), producto_id: id(15601), producto: 'ph_base', nombre: 'DAD Copropiedad (por bien)', desde: fechaDemo(-300) },
    { id: id(15712), suscripcion_id: id(15702), producto_id: id(15602), producto: 'fe_paquete', nombre: 'Factura electrónica (paquete)', desde: fechaDemo(-90), precio_pactado: '50000.00', motivo_precio: 'Lanzamiento' },
  ]
  const linea = (descripcion: string, cantidad: string, unitario: string, valor: string) => ({ producto: 'ph_base', descripcion, cantidad, valor_unitario: unitario, valor })
  const corte = (n: number, sus: number, desde: number, estado: EstadoCorte, extra: Partial<Corte> = {}): Corte => ({
    id: id(n), suscripcion_id: id(sus), periodo_desde: fechaDemo(desde), periodo_hasta: fechaDemo(desde + 30),
    lineas: [linea('DAD Copropiedad: 40 bienes', '40', '1500.00', '60000.00')], total: '60000.00', huella: `h${n}`, estado, ...extra,
  })
  cortes = [
    corte(15801, 15701, -30, 'borrador'),
    corte(15802, 15701, -60, 'aprobado', { aprobado_por: null, aprobado_en: hace(30) }),
    corte(15803, 15701, -90, 'facturado', { aprobado_por: cuentaSesion, factura_venta_id: id(15899), facturado_en: hace(55), vencimiento: fechaDemo(-40) }),
    corte(15804, 15701, -120, 'pagado', { aprobado_por: cuentaSesion, facturado_en: hace(85), pagado_en: hace(75) }),
  ]
}

export function iniciarPlataforma(usuario: string): void {
  cuentaSesion = cuentaDemoId(usuario)
  consecutivo = 15500
  clientes = [
    cliente(1, 'Conjunto Residencial Los Robles', 'propiedad_horizontal', 'activa', ['bienes_comunes', 'asambleas', 'gestion_administrativa', 'contabilidad', 'contabilidad_ph'], '900123456-7'),
    cliente(2, 'Edificio Torres del Parque', 'propiedad_horizontal', 'en_configuracion', ['asambleas'], '900765432-1'),
    cliente(3, 'DAD Servicios Contables S.A.S.', 'empresa', 'activa', ['contabilidad', 'facturacion_electronica'], '901555222-3'),
    cliente(4, 'Comercial Andina S.A.S.', 'empresa', 'activa', ['facturacion_electronica'], '901777888-1'),
    cliente(5, 'GISLA S.A.S.', 'plataforma', 'activa', ['contabilidad', 'facturacion_electronica'], '901999000-2'),
    cliente(6, 'Ferretería El Tornillo S.A.S.', 'empresa', 'suspendida', ['contabilidad'], '901333444-5'),
  ]
  soportes = new Map()
  cuentas = [
    { id: id(801), nombre: 'Andrés Administrador', usuario: 'admin', correo: 'admin@demo.dad', correo_verificado: true, estado: 'activa', contrasena_pendiente: false, segundo_factor_activo: false },
    { id: id(803), nombre: 'Pedro Portero', usuario: 'pedro', correo: 'pedro@demo.dad', correo_verificado: false, estado: 'activa', contrasena_pendiente: true, segundo_factor_activo: false, bloqueo_temporal_hasta: new Date(Date.now() + 600_000).toISOString() },
    { id: id(805), nombre: 'Julián Bloqueado', usuario: 'julian', correo: 'julian@demo.dad', correo_verificado: true, estado: 'bloqueada', contrasena_pendiente: false, segundo_factor_activo: true },
  ]
  roles = [
    { id: id(15001), codigo: 'superusuario', nombre: 'Superusuario', ambito: 'plataforma', es_plantilla: true, permisos: ['plataforma.cuentas.ver', 'plataforma.entidades.usuarios', 'plataforma.soporte.ver'] },
    { id: id(15002), codigo: 'soporte', nombre: 'Soporte', ambito: 'plataforma', es_plantilla: true, permisos: ['plataforma.soporte.ver'] },
    { id: id(15003), codigo: 'comercial', nombre: 'Comercial', ambito: 'plataforma', es_plantilla: false, descripcion: 'Altas y cobros.', permisos: ['plataforma.cuentas.ver'] },
  ]
  asignaciones = new Map()
  reclamos = [
    { id: id(15051), organizacion_id: id(15061), cuenta_id: id(802), mensaje: 'Soy la representante legal de Contables Unidos; adjunto el RUT.', estado: 'pendiente', creada_en: hace(2) },
    { id: id(15052), organizacion_id: id(15062), cuenta_id: id(804), mensaje: 'Manejo la ficha de Vigilancia Andina.', estado: 'pendiente', creada_en: hace(1) },
  ]
  conceptos = [
    { id: id(15071), codigo: 'servicios', impuesto: 'renta', nombre: 'Servicios en general', base_minima_uvt: '2', tarifa: '4', fuente: 'Decreto 1625 de 2016', ...vigente(-400, -40) },
    { id: id(15072), codigo: 'servicios', impuesto: 'renta', nombre: 'Servicios en general', base_minima_uvt: '2', tarifa: '6', fuente: 'Decreto 572 de 2025', ...vigente(-39) },
    { id: id(15073), codigo: 'reteica_bogota', impuesto: 'ica', nombre: 'ReteICA Bogotá', base_minima_uvt: '4', tarifa: '0.966', municipio_dane: '11001', fuente: 'Acuerdo 648 de 2016', ...vigente(-700) },
  ]
  uvts = [{ anio: Number(fechaDemo().slice(0, 4)), valor: '52374.00', fuente: 'Resolución 000193 de 2025' }, { anio: Number(fechaDemo().slice(0, 4)) - 1, valor: '49799.00', fuente: 'Resolución 000187 de 2024' }]
  iva = [
    { id: id(15081), codigo: 'general', nombre: 'Tarifa general', tratamiento: 'gravado', tarifa: '19', fuente: 'Estatuto Tributario art. 468', ...vigente(-2000) },
    { id: id(15082), codigo: 'excluido', nombre: 'Bienes y servicios excluidos', tratamiento: 'excluido', tarifa: '0', fuente: 'Estatuto Tributario art. 476', ...vigente(-2000) },
  ]
  ica = [{ id: id(15091), municipio_dane: '11001', actividad: '6820', nombre: 'Administración de inmuebles', tarifa_por_mil: '9.66', fuente: 'Acuerdo 65 de 2002', ...vigente(-1000) }]
  exogena = [
    { id: id(15095), anio: 2025, codigo: '1001', version: 1, nombre: 'Pagos y abonos en cuenta', resolucion: 'Resolución 162 de 2023', cuantia_menor: '100000', campos: [{ concepto: '5002', cuenta_prefijo: '5135', columna: 'pago_deducible', lado: 'debito' }], creado_en: hace(200) },
  ]
  tasas = [
    { id: id(15097), modalidad: 'consumo_ordinario', vigente_desde: fechaDemo(-60), vigente_hasta: fechaDemo(-31), tasa_efectiva_anual: '24.36', resolucion: 'Res. 1715', fuente: 'Superintendencia Financiera', creada_en: hace(61) },
    { id: id(15098), modalidad: 'consumo_ordinario', vigente_desde: fechaDemo(-30), vigente_hasta: fechaDemo(1), tasa_efectiva_anual: '24.12', resolucion: 'Res. 1904', fuente: 'Superintendencia Financiera', creada_en: hace(31) },
  ]
  plantillas = [
    { id: id(15091 + 20), nombre: 'Propiedad horizontal (NIIF grupo 2)', tipo_empresa: 'propiedad_horizontal', version: 2, estado: 'publicada', contenido: {}, creada_en: hace(100), publicada_en: hace(90) },
    { id: id(15092 + 20), nombre: 'Empresa de servicios', tipo_empresa: 'empresa_servicios', version: 1, estado: 'borrador', contenido: {}, creada_en: hace(5) },
  ]
  lineas = [
    { id: id(15501), phone_number_id: '1098765432', numero_visible: '+57 300 000 0000', nombre: 'DAD principal', limite_mps: 80, estado: 'activa', calidad: 'GREEN', franquicia_servicio_mes: 1000, servicio_mes: 420, plantillas_mes: 86, franquicia_disponible: 580 },
    { id: id(15502), phone_number_id: '1098765433', numero_visible: '+57 300 000 0001', nombre: 'DAD respaldo', limite_mps: 20, estado: 'degradada', calidad: 'YELLOW', franquicia_servicio_mes: 1000, servicio_mes: 980, plantillas_mes: 12, franquicia_disponible: 20 },
  ]
  tarifasWa = [
    { pais: 'CO', categoria: 'marketing', moneda: 'USD', valor: '0.0125', vigente_desde: fechaDemo(-80) },
    { pais: 'CO', categoria: 'utilidad', moneda: 'USD', valor: '0.0008', vigente_desde: fechaDemo(-80) },
  ]
  iniciarPublicidad()
  iniciarCobros()
}

/** Respuesta paginada por cursor (el id del último). */
const porId = (x: { id: string }) => x.id

function pagina<T>(lista: T[], url: URL, clave: (x: T) => string) {
  const limite = Number(url.searchParams.get('limite') ?? 50)
  const despues = url.searchParams.get('despues')
  const desde = despues ? lista.findIndex((x) => clave(x) === despues) + 1 : 0
  const datos = lista.slice(desde, desde + limite)
  return json({ datos, siguiente: desde + limite < lista.length ? clave(datos.at(-1) as T) : null })
}

/** Cuatro ojos: quien cargó o editó no modera. */
const propio = (recursoId: string) => autores.get(recursoId) === cuentaSesion

async function atenderClientes(req: Request, ruta: string, url: URL): Promise<Response | null> {
  const m = req.method
  if (m === 'GET' && ruta === '/plataforma/entidades') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    return pagina(clientes.filter((c) => !q || c.nombre.toLowerCase().includes(q) || (c.nit ?? '').includes(q)), url, porId)
  }
  if (m === 'POST' && (ruta === '/plataforma/entidades' || ruta === '/plataforma/copropiedades')) {
    const p = await cuerpo<{ nombre: string; nit?: string | null; administrador?: { correo: string } | null; administrador_cuenta_id?: string | null }>(req)
    if (!!p.administrador === !!p.administrador_cuenta_id) return error(422, 'validacion', 'Envíe el administrador nuevo o el de una cuenta existente, uno solo.')
    if (!p.nombre?.trim()) return error(422, 'validacion', 'Escriba el nombre.')
    const c = cliente(++consecutivo, p.nombre, ruta.endsWith('copropiedades') ? 'propiedad_horizontal' : 'empresa', 'en_configuracion', [], p.nit ?? null)
    clientes.push(c)
    return json({ id: c.id, nombre: c.nombre }, 201)
  }
  const estado = ruta.match(/^\/plataforma\/(?:entidades|copropiedades)\/([^/]+)\/estado$/)
  if (m === 'POST' && estado) {
    const c = clientes.find((x) => x.id === estado[1])
    if (!c) return error(404, 'no_encontrado', 'La entidad no existe.')
    const { estado: nuevo } = await cuerpo<{ estado: EntidadPlataforma['estado'] }>(req)
    if (c.estado === 'retirada' || (c.estado === 'en_configuracion' && nuevo === 'suspendida')) return error(409, 'conflicto_estado', 'Ese cambio de estado no se permite.')
    c.estado = nuevo
    return json({ estado: nuevo })
  }
  const modulo = ruta.match(/^\/plataforma\/copropiedades\/([^/]+)\/modulos(?:\/([^/]+))?$/)
  if (modulo) {
    const c = clientes.find((x) => x.id === modulo[1])
    if (!c) return error(404, 'no_encontrado', 'La entidad no existe.')
    if (m === 'POST') {
      const { modulo: mod } = await cuerpo<{ modulo: Modulo }>(req)
      if (!c.modulos.includes(mod)) c.modulos = [...c.modulos, mod]
      return json({ modulo: mod, desde: new Date().toISOString(), hasta: null }, 201)
    }
    if (m === 'DELETE') {
      const antes = c.modulos.length
      c.modulos = c.modulos.filter((x) => x !== modulo[2])
      return json({ terminados: antes - c.modulos.length })
    }
  }
  const soporte = ruta.match(/^\/plataforma\/entidades\/([^/]+)\/soporte$/)
  if (m === 'POST' && soporte) {
    const { motivo } = await cuerpo<{ motivo: string }>(req)
    if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo del acceso.')
    const hasta = Date.now() + 2 * 3_600_000
    soportes.set(soporte[1] ?? '', hasta)
    return json({ id: nuevoId(), entidad_id: soporte[1], hasta: new Date(hasta).toISOString() }, 201)
  }
  const usuarios = ruta.match(/^\/plataforma(\/entidades\/[^/]+\/(?:usuarios|roles|asignaciones).*)$/)
  if (usuarios) return entidad(req, usuarios[1] ?? '')
  if (m === 'PUT' && ruta === '/plataforma/entidad-plataforma') return sinContenido()
  return null
}

async function atenderCuentas(req: Request, ruta: string, url: URL): Promise<Response | null> {
  const m = req.method
  if (m === 'GET' && ruta === '/plataforma/cuentas') {
    const q = (url.searchParams.get('identificador') ?? '').toLowerCase()
    const c = cuentas.find((x) => x.usuario === q || x.correo === q)
    return c ? json(c) : error(404, 'no_encontrado', 'No existe la cuenta.')
  }
  if (m === 'POST' && ruta === '/plataforma/cuentas') {
    const p = await cuerpo<{ nombre: string; correo: string; usuario?: string | null; rol_plataforma_id?: string | null }>(req)
    const existente = cuentas.find((x) => x.correo === p.correo)
    const c = existente ?? { id: nuevoId(), nombre: p.nombre, usuario: p.usuario ?? null, correo: p.correo, correo_verificado: false, estado: 'activa' as const, contrasena_pendiente: true, segundo_factor_activo: false }
    if (!existente) cuentas.push(c)
    return json({ cuenta_id: c.id, cuenta_nueva: !existente, asignacion_id: p.rol_plataforma_id ? nuevoId() : null }, 201)
  }
  const bloqueo = ruta.match(/^\/plataforma\/cuentas\/([^/]+)\/(bloquear|desbloquear)$/)
  if (m === 'POST' && bloqueo) {
    const c = cuentas.find((x) => x.id === bloqueo[1])
    if (!c) return error(404, 'no_encontrado', 'No existe la cuenta.')
    if (bloqueo[2] === 'desbloquear') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
    }
    c.estado = bloqueo[2] === 'bloquear' ? 'bloqueada' : 'activa'
    if (bloqueo[2] === 'desbloquear') c.bloqueo_temporal_hasta = null
    return sinContenido()
  }
  if (m === 'GET' && ruta === '/plataforma/roles') return json(roles)
  if (m === 'POST' && ruta === '/plataforma/roles') {
    const p = await cuerpo<Omit<Rol, 'id' | 'ambito' | 'es_plantilla'>>(req)
    if (roles.some((r) => r.codigo === p.codigo)) return error(409, 'conflicto', `Ya existe el rol «${p.codigo}».`)
    const r: Rol = { ...p, id: nuevoId(), ambito: 'plataforma', es_plantilla: false }
    roles.push(r)
    return json(r, 201)
  }
  const permisos = ruta.match(/^\/plataforma\/roles\/([^/]+)\/permisos$/)
  if (m === 'PUT' && permisos) {
    const r = roles.find((x) => x.id === permisos[1])
    if (!r) return error(404, 'no_encontrado', 'No existe el rol.')
    if (r.es_plantilla) return error(409, 'conflicto', 'Los roles del sistema no se editan.')
    r.permisos = (await cuerpo<{ permisos: Rol['permisos'] }>(req)).permisos
    return json(r)
  }
  if (m === 'POST' && ruta === '/plataforma/asignaciones') {
    const p = await cuerpo<{ cuenta_id: string; rol_id: string }>(req)
    const a = nuevoId()
    asignaciones.set(a, p.rol_id)
    return json({ id: a }, 201)
  }
  const quitar = ruta.match(/^\/plataforma\/asignaciones\/([^/]+)$/)
  if (m === 'DELETE' && quitar) {
    if (asignaciones.get(quitar[1] ?? '') === id(15001)) return error(409, 'conflicto', 'No se puede quitar el último superusuario.')
    asignaciones.delete(quitar[1] ?? '')
    return sinContenido()
  }
  return null
}

async function atenderNormativa(req: Request, ruta: string): Promise<Response | null> {
  const m = req.method
  if (m === 'GET' && ruta === '/plataforma/reclamaciones') return json(reclamos)
  const resolver = ruta.match(/^\/plataforma\/reclamaciones\/([^/]+)\/resolver$/)
  if (m === 'POST' && resolver) {
    const r = reclamos.find((x) => x.id === resolver[1])
    if (!r) return error(404, 'no_encontrado', 'No existe la reclamación.')
    const p = await cuerpo<{ aprobar: boolean; motivo?: string | null }>(req)
    if (!p.aprobar && !p.motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo del rechazo.')
    r.estado = p.aprobar ? 'aprobada' : 'rechazada'
    return sinContenido()
  }
  if (ruta.match(/^\/organizaciones\/[^/]+(\/miembros)?$/) && (m === 'PATCH' || m === 'POST')) return sinContenido()
  if (m === 'PUT' && ruta === '/plataforma/puc') return json({ cuentas: (await cuerpo<{ cuentas: unknown[] }>(req)).cuentas.length })
  if (m === 'GET' && ruta === '/plataforma/retenciones') return json({ conceptos, uvt: uvts })
  if (m === 'POST' && ruta === '/plataforma/retenciones') {
    const p = await cuerpo<Omit<ConceptoRetencion, 'id'>>(req)
    const anterior = conceptos.find((c) => c.codigo === p.codigo && !c.vigente_hasta)
    if (anterior && anterior.vigente_desde >= p.vigente_desde) return error(409, 'conflicto', 'Ya hay una versión desde esa fecha o después.')
    const c: ConceptoRetencion = { ...p, id: nuevoId(), vigente_hasta: null }
    conceptos.push(c)
    return json(c, 201)
  }
  const uvt = ruta.match(/^\/plataforma\/uvt\/(\d{4})$/)
  if (m === 'PUT' && uvt) {
    const p = await cuerpo<{ valor: string; fuente: string }>(req)
    const u: Uvt = { anio: Number(uvt[1]), ...p }
    uvts = [...uvts.filter((x) => x.anio !== u.anio), u]
    return json(u)
  }
  if (m === 'GET' && ruta === '/plataforma/tributario/catalogo') return json({ iva, ica, formatos_exogena: exogena })
  if (m === 'POST' && ruta === '/plataforma/tributario/tarifas-iva') {
    const t: TarifaIva = { ...(await cuerpo<Omit<TarifaIva, 'id'>>(req)), id: nuevoId(), vigente_hasta: null }
    iva.push(t)
    return json(t, 201)
  }
  if (m === 'POST' && ruta === '/plataforma/tributario/tarifas-ica') {
    const t: TarifaIca = { ...(await cuerpo<Omit<TarifaIca, 'id'>>(req)), id: nuevoId(), vigente_hasta: null }
    ica.push(t)
    return json(t, 201)
  }
  if (m === 'POST' && ruta === '/plataforma/tributario/formatos-exogena') {
    const p = await cuerpo<Omit<FormatoExogena, 'id' | 'version' | 'creado_en'>>(req)
    const version = exogena.filter((f) => f.anio === p.anio && f.codigo === p.codigo).length + 1
    const f: FormatoExogena = { ...p, id: nuevoId(), version, creado_en: new Date().toISOString() }
    exogena.push(f)
    return json(f, 201)
  }
  if (m === 'GET' && ruta === '/plataforma/tasas-referencia') return json(tasas)
  if (m === 'POST' && ruta === '/plataforma/tasas-referencia') {
    const t: TasaReferencia = { ...(await cuerpo<Omit<TasaReferencia, 'id' | 'modalidad' | 'creada_en'>>(req)), id: nuevoId(), modalidad: 'consumo_ordinario', creada_en: new Date().toISOString() }
    tasas.push(t)
    return json(t, 201)
  }
  if (m === 'GET' && ruta === '/plataforma/plantillas-contables') {
    return json(
      plantillas.map((p) => ({ id: p.id, nombre: p.nombre, tipo_empresa: p.tipo_empresa, version: p.version, estado: p.estado, publicada_en: p.publicada_en ?? null, ambito: 'plataforma', organizacion: null })),
    )
  }
  if (m === 'POST' && ruta === '/plataforma/plantillas-contables') {
    const p = await cuerpo<Pick<PlantillaContable, 'nombre' | 'tipo_empresa' | 'contenido'>>(req)
    const t: PlantillaContable = { ...p, id: nuevoId(), version: 1, estado: 'borrador', creada_en: new Date().toISOString() }
    plantillas.push(t)
    return json(t, 201)
  }
  const plantilla = ruta.match(/^\/plataforma\/plantillas-contables\/([^/]+)(\/contenido|\/estado)?$/)
  if (plantilla) {
    const t = plantillas.find((x) => x.id === plantilla[1])
    if (!t) return error(404, 'no_encontrado', 'No existe la plantilla.')
    if (m === 'GET' && !plantilla[2]) return json(t)
    if (m === 'PUT' && plantilla[2] === '/contenido') {
      if (t.estado !== 'borrador') return error(409, 'conflicto_estado', 'Solo una plantilla en borrador cambia su contenido.')
      t.contenido = (await cuerpo<{ contenido: PlantillaContable['contenido'] }>(req)).contenido
      return sinContenido()
    }
    if (m === 'PUT' && plantilla[2] === '/estado') {
      t.estado = (await cuerpo<{ estado: PlantillaContable['estado'] }>(req)).estado
      if (t.estado === 'publicada') t.publicada_en = new Date().toISOString()
      return sinContenido()
    }
  }
  if (m === 'GET' && ruta === '/plataforma/whatsapp/lineas') return json(lineas)
  if (m === 'POST' && ruta === '/plataforma/whatsapp/lineas') {
    const p = await cuerpo<Pick<LineaWhatsapp, 'phone_number_id' | 'numero_visible' | 'nombre'>>(req)
    const l: LineaWhatsapp = { ...p, id: nuevoId(), limite_mps: 80, estado: 'activa', calidad: null, franquicia_servicio_mes: 1000, servicio_mes: 0, plantillas_mes: 0, franquicia_disponible: 1000 }
    lineas.push(l)
    return json(l, 201)
  }
  const linea = ruta.match(/^\/plataforma\/whatsapp\/lineas\/([^/]+)$/)
  if (m === 'PATCH' && linea) {
    const l = lineas.find((x) => x.id === linea[1])
    if (!l) return error(404, 'no_encontrado', 'No existe la línea.')
    Object.assign(l, await cuerpo<Partial<LineaWhatsapp>>(req))
    return sinContenido()
  }
  if (m === 'GET' && ruta === '/plataforma/whatsapp/tarifas') return json(tarifasWa)
  if (m === 'POST' && ruta === '/plataforma/whatsapp/tarifas') {
    const t = await cuerpo<TarifaWhatsapp>(req)
    tarifasWa.push(t)
    return json(t, 201)
  }
  if (m === 'GET' && ruta === '/plataforma/facturacion/consumo') {
    return json([
      { entidad_id: id(4), nombre: 'Comercial Andina S.A.S.', tipo: 'factura', cantidad: 128 },
      { entidad_id: id(4), nombre: 'Comercial Andina S.A.S.', tipo: 'nota_credito', cantidad: 4 },
      { entidad_id: id(3), nombre: 'DAD Servicios Contables S.A.S.', tipo: 'factura', cantidad: 37 },
      { entidad_id: id(3), nombre: 'DAD Servicios Contables S.A.S.', tipo: 'documento_soporte', cantidad: 9 },
    ])
  }
  return null
}

async function atenderPublicidad(req: Request, ruta: string, url: URL): Promise<Response | null> {
  const base = ruta.match(/^\/plataforma\/publicidad(\/.*)$/)?.[1]
  if (!base) return null
  const m = req.method
  if (m === 'GET' && base === '/categorias') return json(categorias)
  const cat = base.match(/^\/categorias\/([^/]+)$/)
  if (m === 'PUT' && cat) {
    const p = await cuerpo<Omit<CategoriaDirectorio, 'codigo' | 'sinonimos' | 'restringida' | 'activa'> & Partial<CategoriaDirectorio>>(req)
    const c: CategoriaDirectorio = { codigo: cat[1] ?? '', nombre: p.nombre, padre: p.padre ?? null, sinonimos: p.sinonimos ?? [], restringida: p.restringida ?? false, activa: p.activa ?? true }
    categorias = [...categorias.filter((x) => x.codigo !== c.codigo), c]
    return json(c)
  }
  if (m === 'GET' && base === '/anunciantes') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const estado = url.searchParams.get('estado')
    return pagina(anunciantes.filter((a) => (!q || a.nombre_comercial.toLowerCase().includes(q)) && (!estado || a.estado === estado)), url, porId)
  }
  if (m === 'POST' && base === '/anunciantes') {
    const p = await cuerpo<{ nombre_comercial: string; direccion?: string | null; municipio_dane?: string | null; organizacion?: { nit: string } | null; organizacion_id?: string | null }>(req)
    if (!p.organizacion && !p.organizacion_id) return error(422, 'validacion', 'Indique la organización del comercio.')
    const a: Anunciante = { id: nuevoId(), organizacion_id: p.organizacion_id ?? nuevoId(), nombre_comercial: p.nombre_comercial, direccion: p.direccion ?? null, municipio_dane: p.municipio_dane ?? null, estado: 'pendiente', creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString(), ficha: null }
    anunciantes.push(a)
    return json(a, 201)
  }
  const anun = base.match(/^\/anunciantes\/([^/]+)(\/.*)?$/)
  if (anun) {
    const a = anunciantes.find((x) => x.id === anun[1])
    if (!a) return error(404, 'no_encontrado', 'El comercio no existe.')
    const resto = anun[2] ?? ''
    if (m === 'GET' && !resto) return json(a)
    if (m === 'PUT' && !resto) {
      Object.assign(a, await cuerpo<Partial<Anunciante>>(req), { actualizado_en: new Date().toISOString() })
      return json(a)
    }
    if (m === 'PUT' && resto === '/ficha') {
      const p = await cuerpo<{ categorias: string[]; cobertura: string; telefono?: string | null; whatsapp?: string | null; correo?: string | null; sitio_web?: string | null } & Record<string, unknown>>(req)
      if (p.categorias.some((c) => categorias.find((x) => x.codigo === c)?.restringida)) return error(422, 'validacion', 'Una ficha no puede tener categorías restringidas.')
      a.ficha = {
        descripcion: (p.descripcion as string | null) ?? null, categorias: p.categorias, cobertura: p.cobertura, radio_km: (p.radio_km as number | null) ?? null,
        contacto: { telefono: p.telefono ?? null, whatsapp: p.whatsapp ?? null, correo: p.correo ?? null, sitio_web: p.sitio_web ?? null },
        horario: (p.horario as string | null) ?? null, destacada_hasta: (p.destacada_hasta as string | null) ?? null, publicada: (p.publicada as boolean | null) ?? true, actualizada_en: new Date().toISOString(),
      }
      return json(a.ficha)
    }
    if (m === 'POST' && resto === '/estado') {
      const p = await cuerpo<{ estado: Anunciante['estado']; motivo?: string | null }>(req)
      if ((p.estado === 'rechazado' || p.estado === 'suspendido') && !p.motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      a.estado = p.estado
      a.motivo_estado = p.motivo ?? null
      return json(a)
    }
    if (m === 'GET' && resto === '/campanas') return pagina(campanas.filter((c) => c.anunciante_id === a.id), url, porId)
    if (m === 'POST' && resto === '/campanas') {
      const p = await cuerpo<Omit<Campana, 'id' | 'anunciante_id' | 'consumido' | 'conflicto_interes' | 'estado' | 'creada_en'>>(req)
      const c: Campana = { ...p, id: nuevoId(), anunciante_id: a.id, consumido: '0', conflicto_interes: false, estado: 'borrador', creada_en: new Date().toISOString() }
      campanas.push(c)
      autores.set(c.id, cuentaSesion)
      return json(c, 201)
    }
    if (m === 'GET' && resto === '/leads') {
      return json({ datos: a.id === id(14001) ? [{ solicitud_id: id(15451), creado_en: hace(3), categoria: 'costura', nombre: 'Titular T1-101', telefono: '573001112233' }] : [], siguiente: null })
    }
    if (resto === '/enlace-cupones') {
      if (m === 'GET') return json({ token: enlaces.get(a.id) ?? null })
      if (m === 'POST') {
        const t = `demo-cupones-${(++consecutivo).toString(36).toUpperCase()}`
        enlaces.set(a.id, t)
        return json({ token: t }, 201)
      }
      if (m === 'DELETE') {
        enlaces.delete(a.id)
        return sinContenido()
      }
    }
    const camp = resto.match(/^\/campanas\/([^/]+)(\/.*)?$/)
    if (camp) {
      const c = campanas.find((x) => x.id === camp[1] && x.anunciante_id === a.id)
      if (!c) return error(404, 'no_encontrado', 'La campaña no existe.')
      const r = camp[2] ?? ''
      if (m === 'GET' && !r) return json({ campana: c, creativos: creativos.filter((x) => x.campana_id === c.id) })
      if (m === 'PUT' && !r) {
        if (c.estado !== 'borrador' && c.estado !== 'rechazada') return error(409, 'conflicto_estado', 'Solo se edita en borrador o rechazada.')
        Object.assign(c, await cuerpo<Partial<Campana>>(req))
        autores.set(c.id, cuentaSesion)
        return json(c)
      }
      if (m === 'POST' && r === '/estado') {
        const { accion } = await cuerpo<{ accion: string }>(req)
        const siguiente: Record<string, Partial<Record<Campana['estado'], Campana['estado']>>> = {
          enviar_a_revision: { borrador: 'en_revision', rechazada: 'en_revision' },
          activar: { aprobada: 'activa', pausada: 'activa' },
          pausar: { activa: 'pausada' },
          finalizar: { aprobada: 'finalizada', activa: 'finalizada', pausada: 'finalizada' },
        }
        const nuevo = siguiente[accion]?.[c.estado]
        if (!nuevo) return error(409, 'conflicto_estado', 'Esa acción no aplica en el estado actual.')
        if (accion === 'enviar_a_revision' && !creativos.some((x) => x.campana_id === c.id)) return error(422, 'validacion', 'Agregue al menos una pieza antes de enviarla a revisión.')
        c.estado = nuevo
        return json(c)
      }
      if (m === 'POST' && r === '/creativos') {
        const x: Creativo = { ...(await cuerpo<Omit<Creativo, 'id' | 'campana_id' | 'estado' | 'cupon_usos'>>(req)), id: nuevoId(), campana_id: c.id, estado: 'pendiente', cupon_usos: 0 }
        creativos.push(x)
        autores.set(x.id, cuentaSesion)
        return json(x, 201)
      }
      const cre = r.match(/^\/creativos\/([^/]+)$/)
      if (m === 'PUT' && cre) {
        const x = creativos.find((y) => y.id === cre[1])
        if (!x) return error(404, 'no_encontrado', 'La pieza no existe.')
        Object.assign(x, await cuerpo<Partial<Creativo>>(req), { estado: 'pendiente', motivo_estado: null })
        autores.set(x.id, cuentaSesion)
        return json(x)
      }
      if (m === 'GET' && r === '/metricas') {
        const dias = c.estado === 'activa' ? [1, 2, 3].map((d) => ({ dia: fechaDemo(-d), canal: 'app' as const, impresiones: 2400 - d * 100, clics: 60 - d * 4, redenciones: 3 - Math.min(d, 2), costo: '28000.00' })) : []
        return json({ alcance: c.estado === 'activa' ? 12 : 0, impresiones: dias.reduce((s, d) => s + d.impresiones, 0), clics: dias.reduce((s, d) => s + d.clics, 0), redenciones: 7, consumido: c.consumido, dias })
      }
    }
  }
  if (m === 'GET' && base === '/exclusiones') return json(exclusiones)
  if (m === 'POST' && base === '/exclusiones') {
    const p = await cuerpo<{ entidad_id: string; motivo: string }>(req)
    if (!p.motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
    const x: ExclusionPublicidad = { ...p, creada_en: new Date().toISOString() }
    exclusiones = [...exclusiones.filter((e) => e.entidad_id !== p.entidad_id), x]
    return json(x, 201)
  }
  const excl = base.match(/^\/exclusiones\/([^/]+)$/)
  if (m === 'DELETE' && excl) {
    exclusiones = exclusiones.filter((e) => e.entidad_id !== excl[1])
    return sinContenido()
  }
  if (m === 'GET' && base === '/moderacion/creativos') return pagina(creativos.filter((c) => c.estado === 'pendiente'), url, porId)
  if (m === 'GET' && base === '/moderacion/campanas') return pagina(campanas.filter((c) => c.estado === 'en_revision'), url, porId)
  if (m === 'GET' && base === '/moderacion/resenas') return pagina(resenas, url, (r) => r.resena_id)
  if (m === 'GET' && base === '/moderacion/reportes') return pagina(reportes, url, (r) => r.creativo_id)
  const decision = base.match(/^\/moderacion\/(creativos|campanas)\/([^/]+)$/)
  if (m === 'POST' && decision) {
    const recurso = decision[2] ?? ''
    if (propio(recurso)) return error(409, 'conflicto', 'Quien cargó o editó no puede moderarlo.')
    const p = await cuerpo<{ decision: string; motivo?: string | null }>(req)
    if (p.decision === 'rechazar' && !p.motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo del rechazo.')
    if (decision[1] === 'creativos') {
      const x = creativos.find((c) => c.id === recurso)
      if (!x) return error(404, 'no_encontrado', 'La pieza no existe.')
      x.estado = p.decision === 'aprobar' ? 'aprobado' : 'rechazado'
      x.motivo_estado = p.motivo ?? null
      return json(x)
    }
    const c = campanas.find((x) => x.id === recurso)
    if (!c) return error(404, 'no_encontrado', 'La campaña no existe.')
    c.estado = p.decision === 'aprobar' ? 'aprobada' : 'rechazada'
    c.tarifa = p.decision === 'aprobar' ? (tarifasPub.find((t) => t.modelo === c.modelo)?.valor ?? null) : null
    c.motivo_estado = p.motivo ?? null
    return json(c)
  }
  const resena = base.match(/^\/moderacion\/resenas\/([^/]+)$/)
  if (m === 'POST' && resena) {
    const p = await cuerpo<{ ocultar: boolean; motivo?: string | null }>(req)
    if (p.ocultar && !p.motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
    resenas = resenas.filter((r) => r.resena_id !== resena[1])
    return sinContenido()
  }
  const reporte = base.match(/^\/moderacion\/reportes\/([^/]+)$/)
  if (m === 'POST' && reporte) {
    const r = reportes.find((x) => x.creativo_id === reporte[1])
    reportes = reportes.filter((x) => x.creativo_id !== reporte[1])
    return json({ atendidos: r?.reportes ?? 0 })
  }
  if (m === 'GET' && base === '/tarifas') return json(tarifasPub)
  if (m === 'POST' && base === '/tarifas') {
    const t = await cuerpo<TarifaPublicidad>(req)
    tarifasPub.push(t)
    return json(t, 201)
  }
  if (m === 'POST' && base === '/politica') {
    const { texto } = await cuerpo<{ texto: string }>(req)
    return json({ version: 2, texto, vigente_desde: new Date().toISOString() }, 201)
  }
  if (base === '/liquidaciones') {
    const mes = (m === 'GET' ? url.searchParams.get('mes') : (await cuerpo<{ mes: string }>(req)).mes) ?? ''
    // El demo guarda un solo mes (el anterior): cualquier mes muestra esas liquidaciones.
    return json(mes ? liquidaciones : [], m === 'POST' ? 201 : 200)
  }
  const liq = base.match(/^\/liquidaciones\/([^/]+)\/estado$/)
  if (m === 'POST' && liq) {
    const l = liquidaciones.find((x) => x.anunciante_id === liq[1])
    if (!l) return error(404, 'no_encontrado', 'No hay liquidación del comercio en ese mes.')
    l.estado = (await cuerpo<{ estado: LiquidacionPublicidad['estado'] }>(req)).estado
    return json(l)
  }
  const pantalla = base.match(/^\/pantallas\/([^/]+)$/)
  if (pantalla) {
    if (m === 'GET') return json({ token: pantallas.get(pantalla[1] ?? '') ?? null })
    if (m === 'POST') {
      const t = `demo-pantalla-${(++consecutivo).toString(36).toUpperCase()}`
      pantallas.set(pantalla[1] ?? '', t)
      return json({ token: t }, 201)
    }
  }
  return null
}

async function atenderCobros(req: Request, ruta: string, url: URL): Promise<Response | null> {
  const base = ruta.match(/^\/plataforma\/cobros(\/.*)$/)?.[1]
  if (!base) return null
  const m = req.method
  if (m === 'GET' && base === '/productos') return json(productos)
  if (m === 'POST' && base === '/productos') {
    const p = await cuerpo<Omit<Producto, 'id' | 'tarifas' | 'activo'> & { activo?: boolean }>(req)
    if (productos.some((x) => x.codigo === p.codigo)) return error(409, 'conflicto', 'Ya existe un producto con ese código.')
    const x: Producto = { ...p, id: nuevoId(), activo: p.activo ?? true, tarifas: [] }
    productos.push(x)
    return json(x, 201)
  }
  const prod = base.match(/^\/productos\/([^/]+)(\/tarifas)?$/)
  if (prod) {
    const x = productos.find((p) => p.id === prod[1])
    if (!x) return error(404, 'no_encontrado', 'No existe el producto.')
    if (m === 'PUT' && !prod[2]) {
      Object.assign(x, await cuerpo<Partial<Producto>>(req), { codigo: x.codigo })
      return json(x)
    }
    if (m === 'POST' && prod[2]) {
      const t = await cuerpo<Producto['tarifas'][number]>(req)
      x.tarifas = [t, ...x.tarifas]
      return json(t, 201)
    }
  }
  if (m === 'GET' && base === '/suscripciones') return json(suscripciones)
  if (m === 'POST' && base === '/suscripciones') {
    const p = await cuerpo<Omit<Suscripcion, 'id' | 'estado' | 'suspendida_por_mora' | 'dias_prueba' | 'plazo_pago_dias'> & { dias_prueba?: number; plazo_pago_dias?: number | null }>(req)
    if (suscripciones.some((s) => s.entidad_id === p.entidad_id && s.estado !== 'terminada')) return error(409, 'conflicto', 'La entidad ya tiene una suscripción vigente.')
    const s: Suscripcion = { ...p, id: nuevoId(), dias_prueba: p.dias_prueba ?? 0, plazo_pago_dias: p.plazo_pago_dias ?? 15, estado: 'activa', suspendida_por_mora: false }
    suscripciones.push(s)
    return json(s, 201)
  }
  const sus = base.match(/^\/suscripciones\/([^/]+)(\/lineas)?$/)
  if (sus) {
    const s = suscripciones.find((x) => x.id === sus[1])
    if (!s) return error(404, 'no_encontrado', 'No existe la suscripción.')
    if (m === 'GET' && !sus[2]) {
      const propias = lineasSus.filter((l) => l.suscripcion_id === s.id)
      const cliente = clientes.find((c) => c.id === s.entidad_id)
      const cobrados = new Set(propias.map((l) => productos.find((p) => p.id === l.producto_id)?.modulo).filter(Boolean))
      return json({ suscripcion: s, lineas: propias.map((l) => ({ id: l.id, producto_id: l.producto_id, producto: l.producto, nombre: l.nombre, precio_pactado: l.precio_pactado, motivo_precio: l.motivo_precio, desde: l.desde, hasta: l.hasta })), modulos_sin_cobro: (cliente?.modulos ?? []).filter((x) => x === 'facturacion_electronica' && !cobrados.has(x)) })
    }
    if (m === 'PATCH') {
      const p = await cuerpo<{ correo_facturacion?: string | null; plazo_pago_dias?: number | null; terminar_en?: string | null; motivo?: string | null }>(req)
      if (p.terminar_en && !p.motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo de la terminación.')
      if (p.correo_facturacion) s.correo_facturacion = p.correo_facturacion
      if (p.plazo_pago_dias) s.plazo_pago_dias = p.plazo_pago_dias
      if (p.terminar_en) {
        s.terminada_en = p.terminar_en
        s.estado = 'terminada'
      }
      return json(s)
    }
    if (m === 'POST' && sus[2]) {
      const p = await cuerpo<{ producto_id: string; desde: string; precio_pactado?: string | null; motivo_precio?: string | null }>(req)
      const prodLinea = productos.find((x) => x.id === p.producto_id)
      if (!prodLinea) return error(404, 'no_encontrado', 'No existe el producto.')
      if (p.precio_pactado && !p.motivo_precio?.trim()) return error(422, 'validacion', 'El precio pactado exige el motivo.')
      const l = { id: nuevoId(), suscripcion_id: s.id, producto_id: prodLinea.id, producto: prodLinea.codigo, nombre: prodLinea.nombre, desde: p.desde, precio_pactado: p.precio_pactado ?? null, motivo_precio: p.motivo_precio ?? null }
      lineasSus.push(l)
      return json(l, 201)
    }
  }
  const fin = base.match(/^\/lineas\/([^/]+)\/fin$/)
  if (m === 'POST' && fin) {
    const l = lineasSus.find((x) => x.id === fin[1])
    if (!l) return error(404, 'no_encontrado', 'No existe la línea.')
    l.hasta = (await cuerpo<{ hasta: string }>(req)).hasta
    return sinContenido()
  }
  if (m === 'GET' && base === '/cortes') {
    const estado = url.searchParams.get('estado')
    const s = url.searchParams.get('suscripcion_id')
    return pagina(cortes.filter((c) => (!estado || c.estado === estado) && (!s || c.suscripcion_id === s)), url, porId)
  }
  if (m === 'POST' && base === '/cortes') {
    const p = await cuerpo<{ suscripcion_id: string; desde: string; hasta?: string | null }>(req)
    const s = suscripciones.find((x) => x.id === p.suscripcion_id)
    if (!s) return error(404, 'no_encontrado', 'No existe la suscripción.')
    if (cortes.some((c) => c.suscripcion_id === s.id && c.periodo_desde === p.desde && c.estado !== 'descartado')) return error(409, 'conflicto', 'Ya hay un corte de ese periodo.')
    const c: Corte = {
      id: nuevoId(), suscripcion_id: s.id, periodo_desde: p.desde, periodo_hasta: p.hasta ?? p.desde,
      lineas: [{ producto: 'ph_base', descripcion: 'DAD Copropiedad: 40 bienes', cantidad: '40', valor_unitario: '1500.00', valor: '60000.00' }],
      total: '60000.00', huella: `h${consecutivo}`, estado: 'borrador',
    }
    cortes.unshift(c)
    return json(c, 201)
  }
  const corte = base.match(/^\/cortes\/([^/]+)(?:\/(aprobar|descartar|facturar|factura-externa|pago))?$/)
  if (corte) {
    const c = cortes.find((x) => x.id === corte[1])
    if (!c) return error(404, 'no_encontrado', 'No existe el corte.')
    const accion = corte[2]
    if (m === 'GET' && !accion) return json(c)
    const desde: Record<string, EstadoCorte[]> = { aprobar: ['borrador'], descartar: ['borrador', 'aprobado'], facturar: ['aprobado'], 'factura-externa': ['aprobado'], pago: ['facturado'] }
    if (m !== 'POST' || !accion) return null
    if (!desde[accion]?.includes(c.estado)) return error(409, 'conflicto_estado', 'El corte cambió de estado: recárguelo.')
    const ahora = new Date().toISOString()
    switch (accion) {
      case 'aprobar':
        Object.assign(c, { estado: 'aprobado', aprobado_por: cuentaSesion, aprobado_en: ahora })
        break
      case 'descartar': {
        const { motivo } = await cuerpo<{ motivo: string }>(req)
        if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
        Object.assign(c, { estado: 'descartado', motivo })
        break
      }
      case 'facturar':
        Object.assign(c, { estado: 'facturado', factura_venta_id: nuevoId(), facturado_en: ahora, vencimiento: fechaDemo(15) })
        break
      case 'factura-externa': {
        const p = await cuerpo<{ numero: string; fecha: string }>(req)
        if (!p.numero?.trim()) return error(422, 'validacion', 'Escriba el número de la factura.')
        Object.assign(c, { estado: 'facturado', factura_externa: p.numero, facturado_en: `${p.fecha}T12:00:00Z`, vencimiento: fechaDemo(15) })
        break
      }
      case 'pago': {
        const p = await cuerpo<{ fecha: string }>(req)
        Object.assign(c, { estado: 'pagado', pagado_en: `${p.fecha}T12:00:00Z` })
        break
      }
    }
    return json(c)
  }
  const liq = base.match(/^\/liquidaciones\/([^/]+)\/corte$/)
  if (m === 'POST' && liq) {
    const l = liquidaciones.find((x) => x.id === liq[1])
    if (!l) return error(404, 'no_encontrado', 'No existe la liquidación.')
    const c: Corte = { id: nuevoId(), suscripcion_id: null, liquidacion_id: l.id, periodo_desde: l.periodo, periodo_hasta: fechaDemo(0), lineas: [{ producto: 'publicidad', descripcion: 'Publicidad del mes', cantidad: '1', valor_unitario: l.valor, valor: l.valor }], total: l.valor, huella: `l${l.id}`, estado: 'borrador' }
    cortes.unshift(c)
    return json(c, 201)
  }
  return null
}

export const plataforma: Manejador = async (req, ruta) => {
  if (!ruta.startsWith('/plataforma') && !ruta.startsWith('/organizaciones/')) return null
  const url = new URL(req.url)
  return (
    (await atenderClientes(req, ruta, url)) ??
    (await atenderCuentas(req, ruta, url)) ??
    (await atenderNormativa(req, ruta)) ??
    (await atenderPublicidad(req, ruta, url)) ??
    (await atenderCobros(req, ruta, url))
  )
}

/**
 * Lo público de la publicidad: la cartelera de la pantalla del lobby (`X-Pantalla`) y la redención
 * de cupones en el mostrador del comercio (`X-Comercio`; el código `VENCIDO1` simula una oferta
 * vencida).
 */
export const publicidadPublicaDemo: Manejador = async (req, ruta) => {
  const pantalla = ruta.match(/^\/copropiedades\/([^/]+)\/publicidad\/pantalla$/)
  if (req.method === 'GET' && pantalla) {
    const token = pantallas.get(pantalla[1] ?? '')
    if (!token || req.headers.get('X-Pantalla') !== token) return error(401, 'no_autenticado', 'La pantalla no tiene un token vigente.')
    return json(piezasDemo())
  }
  if (req.method === 'POST' && ruta === '/publicidad/cupones/redimir') {
    const token = req.headers.get('X-Comercio')
    const anuncianteId = [...enlaces.entries()].find(([, t]) => t === token)?.[0]
    if (!token || !anuncianteId) return error(401, 'no_autenticado', 'El enlace del comercio no es válido.')
    const { codigo } = await cuerpo<{ codigo: string }>(req)
    if (codigo === 'VENCIDO1') return error(422, 'validacion', 'La oferta ya venció.')
    const campanasDelComercio = new Set(campanas.filter((c) => c.anunciante_id === anuncianteId).map((c) => c.id))
    const x = creativos.find((c) => c.cupon_codigo === codigo && campanasDelComercio.has(c.campana_id))
    if (!x) return error(404, 'no_encontrado', 'El código no existe.')
    if (x.cupon_limite != null && x.cupon_usos >= x.cupon_limite) return error(422, 'validacion', 'El cupón ya no tiene usos disponibles.')
    x.cupon_usos++
    return json({ creativo_id: x.id, titulo: x.titulo, usos: x.cupon_usos, restantes: x.cupon_limite == null ? null : x.cupon_limite - x.cupon_usos })
  }
  return null
}

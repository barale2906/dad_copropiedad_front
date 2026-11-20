/**
 * Único mapa de la app: secciones (lo que hace cada módulo), sus acciones y el módulo/permiso
 * que las habilita. Lo usan la maqueta 3D, el menú alterno (lista) y el menú lateral de los
 * módulos; agregar una sección o una acción nueva es tocar solo este archivo. Sigue el catálogo
 * del menú de la guía del backend (§4).
 *
 * El frontend solo **oculta**: el backend vuelve a exigir módulo y permiso en cada operación.
 */
import type { Modulo, Permiso } from '@/api/tipos'

export interface Accion {
  id: string
  etiqueta: string
  descripcion: string
  /** Basta con uno de estos permisos para mostrar la acción. */
  permisos: Permiso[]
  /** Basta con uno de estos módulos; si falta, se oculta la acción (no apaga la sección). */
  modulos?: Modulo[]
  /** Solo existe en la propiedad horizontal. */
  soloPH?: boolean
  /**
   * Acción personal: se muestra por el **vínculo** con un bien (roles derivados `propietario` o
   * `residente`), no por permisos de administración. Con vínculo, `permisos` se ignora.
   */
  vinculo?: Vinculo[]
}

/** Roles derivados del vínculo con un bien privado. */
export type Vinculo = 'propietario' | 'residente'

export interface Seccion {
  /** Segmento de la ruta: `/e/:entidad/:seccion/:accion`. */
  slug: string
  nombre: string
  resumen: string
  /** Basta con uno de estos módulos contratados; `[]` = incluida con la entidad. */
  modulos: Modulo[]
  /** Además exige **todos** estos módulos (p. ej. la cartera). */
  requiereTodos?: Modulo[]
  /** Aún no existe en el backend: se muestra apagada con «Próximamente». */
  proximamente?: boolean
  soloPH?: boolean
  /**
   * Consola de la plataforma: solo en la entidad de tipo `plataforma`. Sus acciones se habilitan
   * con los permisos de plataforma de la cuenta (`GET /yo`) y exigen segundo factor.
   */
  plataforma?: boolean
  acciones: Accion[]
}

/** Atajo para declarar una acción; `extra` agrega módulos propios o `soloPH`. */
const a = (
  id: string,
  etiqueta: string,
  descripcion: string,
  permisos: Permiso[],
  extra: Pick<Accion, 'modulos' | 'soloPH' | 'vinculo'> = {},
): Accion => ({ id, etiqueta, descripcion, permisos, ...extra })

/** Acción personal de propietarios y residentes (por vínculo, no por permisos). */
const mia = (id: string, etiqueta: string, descripcion: string, modulos?: Modulo[]): Accion =>
  a(id, etiqueta, descripcion, [], { vinculo: ['propietario', 'residente'], soloPH: true, ...(modulos ? { modulos } : {}) })

const SOLO_FE = { modulos: ['facturacion_electronica'] } satisfies Pick<Accion, 'modulos'>
const SOLO_CONTABILIDAD = { modulos: ['contabilidad'] } satisfies Pick<Accion, 'modulos'>
const SOLO_PH = { soloPH: true }

export const SECCIONES: Record<string, Seccion> = {
  mi: {
    slug: 'mi',
    nombre: 'Mi hogar',
    resumen: 'Sus bienes, saldo, comunicados, solicitudes y visitas.',
    modulos: [],
    soloPH: true,
    acciones: [
      mia('inicio', 'Mi hogar', 'Resumen de su bien en un vistazo.'),
      mia('bienes', 'Mis bienes', 'Sus bienes, residentes y cambios del censo.'),
      mia('cartera', 'Mi cartera', 'Saldo, cuentas de cobro y paz y salvo.', ['contabilidad_ph']),
      mia('comunicados', 'Mis comunicados', 'Avisos de la administración.', ['gestion_administrativa']),
      mia('pqrs', 'Mis solicitudes', 'Peticiones, quejas y reclamos.', ['gestion_administrativa']),
      mia('visitas', 'Mis visitas y paquetes', 'Autorizar visitas y ver lo que llegó.', ['control_acceso']),
      mia('privacidad', 'Mis datos y privacidad', 'Sus autorizaciones y la publicidad.'),
    ],
  },
  unidades: {
    slug: 'unidades',
    nombre: 'Unidades y residentes',
    resumen: 'Apartamentos, propietarios, coeficientes y censo de residentes.',
    modulos: [],
    soloPH: true,
    acciones: [
      a('bienes', 'Bienes privados', 'Apartamentos, locales, parqueaderos y depósitos.', ['bienes_privados.ver']),
      a('titulares', 'Propietarios', 'Titulares, representantes y transferencias.', ['titulares.ver']),
      a('censo', 'Censo', 'Residentes, vehículos y mascotas.', ['censo.ver']),
      a('cambios-censo', 'Aprobar cambios del censo', 'Cambios que reportan los residentes.', ['censo.aprobar']),
      a('coeficientes', 'Coeficientes', 'Cuadros de coeficientes y su activación.', ['bienes_privados.ver']),
      a('importar', 'Importar planilla', 'Carga masiva de bienes y personas.', ['importaciones.ejecutar']),
      a('libros', 'Libros art. 51', 'Libro de propietarios y residentes.', ['censo.exportar']),
      a('personas', 'Personas', 'Datos de contacto y vínculos de cada persona.', ['personas.ver']),
    ],
  },
  'zonas-comunes': {
    slug: 'zonas-comunes',
    nombre: 'Zonas comunes',
    resumen: 'Reservas, disponibilidad, tarifas y reglas de uso.',
    modulos: ['bienes_comunes'],
    soloPH: true,
    acciones: [
      a('reservar', 'Reservar', 'Solicitar una reserva de la zona.', ['reservas.crear']),
      a('mis-reservas', 'Mis reservas', 'Sus reservas y cancelaciones.', ['reservas.crear']),
      a('disponibilidad', 'Disponibilidad', 'Calendario y franjas libres.', ['bienes_comunes.ver']),
      a('aprobaciones', 'Aprobar reservas', 'Solicitudes pendientes.', ['reservas.aprobar']),
      a('entregas', 'Entregas y recibos', 'Entrega y recibo de la zona reservada.', ['reservas.entregas.registrar']),
      a('recursos', 'Recursos y reglas', 'Reglamento, capacidad, tarifa y cobro.', ['bienes_comunes.ver']),
      a('restricciones', 'Restricciones', 'Quién no puede reservar y por qué.', ['reservas.restringir']),
      a('parqueaderos', 'Parqueaderos', 'Asignación de parqueaderos.', ['parqueaderos.ver']),
      a('sorteos', 'Sorteos', 'Sorteos de parqueaderos con semilla publicada.', ['sorteos.gestionar', 'bienes_comunes.ver']),
    ],
  },
  porteria: {
    slug: 'porteria',
    nombre: 'Portería',
    resumen: 'Visitantes, correspondencia, bitácora y minuta.',
    modulos: ['control_acceso'],
    soloPH: true,
    acciones: [
      a('turno', 'Turno', 'Visitas, ingreso con QR y paquetes, a un toque.', ['acceso.registrar']),
      a('visitas', 'Visitas', 'Historial y detalle de cada visita.', ['acceso.registrar', 'acceso.bitacora.ver']),
      a('correspondencia', 'Correspondencia', 'Paquetes recibidos y entregas.', ['acceso.correspondencia.entregar', 'acceso.registrar']),
      a('bitacora', 'Bitácora', 'Entradas y salidas registradas.', ['acceso.bitacora.ver']),
      a('minuta', 'Minuta', 'Novedades del turno.', ['acceso.minuta.ver', 'acceso.minuta.registrar']),
      a('credenciales', 'Credenciales y autorizaciones', 'Tarjetas, códigos y permisos de ingreso.', ['acceso.credenciales.gestionar']),
      a('biometria', 'Biometría', 'Enrolamiento biométrico.', ['acceso.biometria.enrolar']),
      a('configuracion', 'Puntos y puentes', 'Puertas, puentes y configuración.', ['acceso.configurar']),
    ],
  },
  asambleas: {
    slug: 'asambleas',
    nombre: 'Asambleas',
    resumen: 'Convocatorias, quórum, votaciones y actas.',
    modulos: ['asambleas'],
    soloPH: true,
    acciones: [
      a('reuniones', 'Reuniones y actas', 'Asambleas programadas y realizadas.', ['asambleas.ver']),
      a('convocar', 'Convocar', 'Nueva convocatoria y orden del día.', ['asambleas.convocar']),
      a('en-vivo', 'Tablero en vivo', 'Quórum y resultados en tiempo real.', ['asambleas.conducir', 'asambleas.ver']),
      a('registro', 'Mesa de registro', 'Ingreso de asistentes y poderes.', ['asambleas.registrar']),
      a('voto-presencial', 'Voto presencial', 'Registrar votos en la sala.', ['asambleas.votos.registrar']),
      a('resultados', 'Resultados', 'Escrutinio de cada votación.', ['asambleas.ver']),
      a('proyeccion', 'Proyección en sala', 'Quórum y votaciones en pantalla grande.', ['asambleas.ver']),
      a('acta', 'Actas', 'Generar, firmar, aprobar y publicar el acta.', ['asambleas.ver']),
      a('reportes', 'Reportes', 'Asistencia, votos por canal y costo de WhatsApp.', ['asambleas.ver']),
    ],
  },
  administracion: {
    slug: 'administracion',
    nombre: 'Gestión administrativa',
    resumen: 'PQRS, comunicados, mantenimiento e inventario.',
    modulos: ['gestion_administrativa'],
    soloPH: true,
    acciones: [
      a('tablero', 'Tablero', 'Pendientes del día: PQRS, alertas y mantenimiento.', ['tickets.ver_todos', 'mantenimiento.planificar', 'inventario.ver']),
      a('tickets', 'PQRS y tickets', 'Solicitudes, reportes y su atención.', ['tickets.ver_todos', 'tickets.atender']),
      a('comunicados', 'Comunicados', 'Avisos a residentes.', ['comunicados.gestionar']),
      a('chat', 'Chat de WhatsApp', 'Conversaciones con residentes.', ['conversaciones.atender']),
      a('preguntas', 'Preguntas frecuentes', 'Respuestas del asistente.', ['preguntas_frecuentes.editar']),
      a('mantenimiento', 'Mantenimiento', 'Plan preventivo y órdenes.', [
        'mantenimiento.planificar',
        'mantenimiento.ejecutar',
        'mantenimiento.verificar',
      ]),
      a('inventario', 'Inventario', 'Activos de la copropiedad.', ['inventario.ver']),
      a('citas', 'Citas', 'Agendar una cita con la administración.', ['reservas.crear'], { modulos: ['bienes_comunes'] }),
    ],
  },
  cartera: {
    slug: 'cartera',
    nombre: 'Cartera',
    resumen: 'Cuotas, recaudos, mora y paz y salvos.',
    modulos: [],
    requiereTodos: ['contabilidad_ph', 'contabilidad'],
    soloPH: true,
    acciones: [
      a('inicio', 'Inicio de cartera', 'Recaudo del mes, mora y tareas del periodo.', ['cartera.ver']),
      a('saldos', 'Saldos y edades', 'Estado de cuenta de cada unidad y cuadre con el mayor.', ['cartera.ver']),
      a('liquidacion', 'Liquidación mensual', 'Cuotas del periodo, cuentas de cobro y cuotas extraordinarias.', ['cartera.liquidar']),
      a('recaudos', 'Recaudos', 'Registrar pagos y recaudar por referencia.', ['tesoreria.recibos.registrar']),
      a('intereses', 'Intereses de mora', 'Vista previa y causación de los intereses.', ['cartera.liquidar']),
      a('ajustes', 'Ajustes', 'Cobros puntuales, notas crédito y cartera inicial.', ['cartera.ajustar']),
      a('acuerdos', 'Acuerdos de pago', 'Proponer y aprobar acuerdos (cuatro ojos).', ['cartera.ajustar', 'cartera.liquidar']),
      a('certificados', 'Paz y salvo', 'Certificados de deuda o paz y salvo.', ['cartera.certificados.emitir']),
      a('presupuesto', 'Presupuesto', 'Presupuesto anual, aprobación y ejecución.', ['presupuesto.gestionar']),
      a('informes', 'Informes', 'Fondo de imprevistos, flujo de caja e informe para la asamblea.', ['cartera.ver']),
      a('integraciones', 'Morosos y restricciones', 'Morosos de una asamblea y reservas restringidas por mora.', ['cartera.ver']),
      a('configuracion', 'Configuración', 'Conceptos, política, módulos de contribución y referencias de pago.', ['cartera.configurar']),
    ],
  },
  contabilidad: {
    slug: 'contabilidad',
    nombre: 'Contabilidad',
    resumen: 'Comprobantes, PUC, periodos y reportes.',
    modulos: ['contabilidad'],
    acciones: [
      a('inicio', 'Inicio', 'Periodo en curso, borradores y pendientes.', ['contabilidad.ver']),
      a('comprobantes', 'Comprobantes', 'Registrar, contabilizar y revertir.', ['contabilidad.ver', 'contabilidad.comprobantes.crear']),
      a('puc', 'Plan de cuentas', 'PUC, cuentas y centros de costo.', ['contabilidad.ver']),
      a('periodos', 'Periodos', 'Revisión, cierre y reapertura de los meses.', ['contabilidad.ver']),
      a('apertura', 'Apertura y cierre anual', 'Saldos iniciales y cierre del ejercicio.', ['contabilidad.comprobantes.contabilizar']),
      a('reportes', 'Reportes', 'Balance, estado de resultados y libros.', ['contabilidad.ver']),
      a('configuracion', 'Configuración y plantillas', 'Parámetros y plantillas contables.', ['contabilidad.configurar']),
    ],
  },
  tesoreria: {
    slug: 'tesoreria',
    nombre: 'Tesorería',
    resumen: 'Bancos, recibos, egresos y conciliación.',
    modulos: ['contabilidad'],
    acciones: [
      a('cuentas', 'Bancos y cajas', 'Cuentas de tesorería y su saldo.', ['contabilidad.ver']),
      a('recibos', 'Recibos de caja', 'Ingresos y su aplicación.', ['tesoreria.recibos.registrar', 'contabilidad.ver']),
      a('egresos', 'Egresos', 'Pagos, autorización y soporte.', ['tesoreria.egresos.registrar', 'tesoreria.egresos.autorizar']),
      a('cuentas-por-pagar', 'Cuentas por pagar', 'Facturas de proveedores y certificados de retención.', ['tesoreria.facturas_proveedor.gestionar', 'contabilidad.ver']),
      a('conciliacion', 'Conciliación', 'Extractos bancarios y conciliación.', ['tesoreria.conciliar']),
      a('cartera-clientes', 'Cartera de clientes', 'Cuentas por cobrar por edades.', ['contabilidad.ver']),
    ],
  },
  tributario: {
    slug: 'tributario',
    nombre: 'Tributario',
    resumen: 'Terceros, perfil tributario, resoluciones y declaraciones.',
    modulos: ['contabilidad', 'facturacion_electronica'],
    acciones: [
      a('terceros', 'Terceros', 'Clientes, proveedores y datos fiscales.', ['terceros.gestionar', 'contabilidad.ver', 'facturacion.ver']),
      a('perfil', 'Perfil tributario', 'Responsabilidades de la entidad.', ['tributario.configurar', 'tributario.perfil.confirmar', 'contabilidad.ver', 'facturacion.ver']),
      a('resoluciones', 'Resoluciones de numeración', 'Rangos autorizados por la DIAN.', ['tributario.configurar']),
      a('impuestos', 'Retención, IVA e ICA', 'Preparación de declaraciones.', ['tributario.preparar'], SOLO_CONTABILIDAD),
      a('exogena', 'Información exógena', 'Formatos para la DIAN.', ['tributario.preparar'], SOLO_CONTABILIDAD),
      a('beneficiarios', 'Beneficiarios finales', 'Registro Único de Beneficiarios (RUB).', ['tributario.preparar'], SOLO_CONTABILIDAD),
    ],
  },
  facturacion: {
    slug: 'facturacion',
    nombre: 'Facturación',
    resumen: 'Facturas de venta, compras y documentos ante la DIAN.',
    modulos: ['facturacion_electronica', 'contabilidad'],
    acciones: [
      a('inicio', 'Inicio de facturación', 'Lo facturado del mes y lo que requiere atención.', ['facturacion.ver']),
      a('facturas', 'Facturas de venta', 'Ventas, notas y su estado.', ['facturacion.ver']),
      a('catalogo', 'Catálogo de productos', 'Productos y servicios que se facturan.', ['facturacion.ver', 'facturacion.items.gestionar']),
      a('compras', 'Compras y documento soporte', 'Compras a no obligados a facturar.', ['facturacion.facturas.gestionar'], SOLO_FE),
      a('documentos', 'Documentos electrónicos', 'Estado ante la DIAN, PDF y reintentos.', ['facturacion.ver', 'facturacion.emitir'], SOLO_FE),
      a('recibidas', 'Recibidas y RADIAN', 'Facturas de proveedores y sus eventos.', ['facturacion.recibir'], SOLO_FE),
      a('libros', 'Libros y paquete', 'Libros de ventas y compras para el contador.', ['facturacion.exportar']),
      a('contabilizacion', 'Contabilizar lo facturado', 'Facturas emitidas antes de llevar contabilidad.', ['contabilidad.comprobantes.contabilizar'], SOLO_CONTABILIDAD),
      a('habilitacion', 'Habilitación DIAN', 'Software, certificado y set de pruebas.', ['facturacion.configurar', 'facturacion.certificado.gestionar'], SOLO_FE),
    ],
  },
  reportes: {
    slug: 'reportes',
    nombre: 'Reportes',
    resumen: 'Estados financieros para la junta.',
    modulos: ['contabilidad'],
    acciones: [a('estados-financieros', 'Estados financieros', 'Balance y estado de resultados.', ['contabilidad.ver'])],
  },
  directorio: {
    slug: 'directorio',
    nombre: 'Directorio',
    resumen: 'Comercios y servicios del sector, y sus ofertas.',
    modulos: [],
    acciones: [
      a('inicio', 'Directorio', 'Comercios y servicios por categoría.', ['directorio.ver']),
      a('ofertas', 'Ofertas', 'Piezas y cupones para quien los autorizó.', ['directorio.ver']),
      a('busco', 'Busco…', 'Pedir proveedores para una necesidad.', ['directorio.ver'], SOLO_PH),
      a('enlace', 'Enlace para los grupos', 'Enlace del directorio para WhatsApp.', ['directorio.compartir'], SOLO_PH),
    ],
  },
  entidad: {
    slug: 'entidad',
    nombre: 'Datos y usuarios',
    resumen: 'Ficha de la entidad, usuarios, roles y auditoría.',
    modulos: [],
    acciones: [
      a('ficha', 'Ficha', 'Datos generales y de contacto.', ['copropiedad.datos.ver']),
      a('usuarios', 'Usuarios', 'Quién trabaja en la entidad y con qué rol.', ['roles.ver']),
      a('roles', 'Roles y permisos', 'Qué puede hacer cada rol.', ['roles.ver']),
      a('suscripcion', 'Mi suscripción', 'Plan con DAD, consumo y facturas.', ['suscripcion.ver']),
      a('auditoria', 'Auditoría', 'Registro de operaciones.', ['auditoria.ver']),
      a('proteccion-datos', 'Protección de datos', 'Políticas y solicitudes (Ley 1581).', ['proteccion_datos.gestionar'], SOLO_PH),
      a('organizaciones', 'Organizaciones y contratos', 'Administradora, contador, vigilancia…', [
        'organizaciones.vincular',
        'contratos.gestionar',
      ], SOLO_PH),
    ],
  },
  archivo: {
    slug: 'archivo',
    nombre: 'Archivo',
    resumen: 'Documentos y soportes de la entidad.',
    modulos: [],
    acciones: [a('documentos', 'Documentos', 'Subir archivos y abrirlos con enlace seguro.', ['archivos.ver', 'archivos.subir'])],
  },
  plataforma: {
    slug: 'plataforma',
    nombre: 'Centro de operación',
    resumen: 'Clientes, usuarios, normativa, publicidad y cobros de la plataforma.',
    modulos: [],
    plataforma: true,
    acciones: [
      a('clientes', 'Clientes', 'PH y empresas: alta, estado, módulos, usuarios y soporte.', ['plataforma.copropiedades.ver']),
      a('usuarios', 'Usuarios de la plataforma', 'Cuentas, bloqueos, roles y permisos.', [
        'plataforma.cuentas.ver', 'plataforma.cuentas.crear', 'plataforma.cuentas.bloquear',
        'plataforma.roles.gestionar', 'plataforma.roles.asignar',
      ]),
      a('organizaciones', 'Organizaciones', 'Reclamaciones de fichas y sus miembros.', ['plataforma.organizaciones.revisar']),
      a('normativa', 'Normativa', 'PUC, retenciones, UVT, IVA, ICA, exógena, tasas y plantillas.', [
        'plataforma.normativa.gestionar', 'plataforma.plantillas_contables.publicar',
      ]),
      a('whatsapp', 'WhatsApp', 'Líneas de la plataforma y tarifas.', ['plataforma.whatsapp.gestionar']),
      a('comercios', 'Comercios y campañas', 'Directorio, categorías, campañas, piezas y leads.', [
        'plataforma.directorio.gestionar', 'plataforma.publicidad.gestionar', 'plataforma.publicidad.moderar',
      ]),
      a('moderacion', 'Moderación', 'Piezas, campañas, reseñas y reportes por revisar.', ['plataforma.publicidad.moderar']),
      a('publicidad', 'Publicidad', 'Tarifas, política, liquidaciones y exclusiones.', [
        'plataforma.publicidad.liquidar', 'plataforma.publicidad.gestionar',
      ]),
      a('consumo', 'Consumo', 'Documentos electrónicos transmitidos por entidad.', ['plataforma.facturacion.ver']),
      a('cobros', 'Cobros', 'Productos, suscripciones y cortes de facturación.', [
        'plataforma.comercial.gestionar', 'plataforma.cobros.aprobar', 'plataforma.cobros.facturar',
      ]),
    ],
  },
  nomina: {
    slug: 'nomina',
    nombre: 'Nómina electrónica',
    resumen: 'Empleados, liquidación y nómina ante la DIAN.',
    modulos: [],
    proximamente: true,
    acciones: [],
  },
}

export type EstadoSeccion = 'activa' | 'sin_acceso' | 'no_contratada' | 'proximamente'

/** Lo que se sabe de la entidad activa para decidir qué mostrar. */
export interface Consulta {
  tieneModulo: (m: Modulo) => boolean
  tienePermiso: (p: Permiso) => boolean
  esPH: boolean
  /** Roles de la cuenta en la entidad (para las acciones por vínculo). */
  tieneRol?: (rol: string) => boolean
  /** La entidad activa es la de la plataforma (tipo `plataforma`). */
  esPlataforma?: boolean
  /** Permisos de plataforma de la cuenta (`GET /yo`), para la consola. */
  tienePermisoPlataforma?: (p: Permiso) => boolean
  /** La cuenta tiene el segundo factor activo (lo exige la consola). */
  segundoFactor?: boolean
}

const algunoDe = (modulos: Modulo[] | undefined, c: Consulta) =>
  !modulos?.length || modulos.some((m) => c.tieneModulo(m))

/** ¿La entidad tiene contratado lo que exige la sección? */
export function seccionContratada(s: Seccion, c: Consulta): boolean {
  return algunoDe(s.modulos, c) && (s.requiereTodos ?? []).every((m) => c.tieneModulo(m))
}

export function accionesVisibles(s: Seccion, c: Consulta): Accion[] {
  if (s.plataforma) {
    return c.esPlataforma ? s.acciones.filter((x) => x.permisos.some((p) => c.tienePermisoPlataforma?.(p))) : []
  }
  return s.acciones.filter(
    (x) =>
      (!x.soloPH || c.esPH) &&
      algunoDe(x.modulos, c) &&
      (x.vinculo ? x.vinculo.some((r) => c.tieneRol?.(r)) : x.permisos.some((p) => c.tienePermiso(p))),
  )
}

export function estadoSeccion(s: Seccion, c: Consulta): EstadoSeccion {
  if (s.proximamente) return 'proximamente'
  if (!seccionContratada(s, c)) return 'no_contratada'
  if (faltaSegundoFactor(s, c)) return 'sin_acceso'
  return accionesVisibles(s, c).length > 0 ? 'activa' : 'sin_acceso'
}

/**
 * La consola de la plataforma está con candado porque falta el segundo factor (la cuenta sí
 * tiene permisos): se ofrece activarlo en Mi cuenta.
 */
export function faltaSegundoFactor(s: Seccion, c: Consulta): boolean {
  return !!s.plataforma && !c.segundoFactor && accionesVisibles(s, c).length > 0
}

/**
 * Estado de una acción concreta de la sección (la ruta `/:seccion/:accion`): el de la sección
 * y, si está activa pero la acción no es visible para el rol, `sin_acceso`.
 */
export function estadoAccion(s: Seccion, accionId: string, c: Consulta): EstadoSeccion {
  const estado = estadoSeccion(s, c)
  if (estado !== 'activa' || !accionId) return estado
  return accionesVisibles(s, c).some((a) => a.id === accionId) ? 'activa' : 'sin_acceso'
}

/** Estado de una zona: activa si al menos una de sus secciones lo está. */
export function estadoDeSecciones(slugs: string[], c: Consulta): EstadoSeccion {
  const estados = slugs.map((s) => estadoSeccion(SECCIONES[s]!, c))
  for (const e of ['activa', 'sin_acceso', 'no_contratada'] as const) {
    if (estados.includes(e)) return e
  }
  return 'proximamente'
}

export const TEXTO_ESTADO: Record<EstadoSeccion, string> = {
  activa: 'Disponible',
  sin_acceso: 'Sin acceso para su rol',
  no_contratada: 'Módulo no contratado',
  proximamente: 'Próximamente',
}

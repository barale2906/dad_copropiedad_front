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
    ],
  },
  administracion: {
    slug: 'administracion',
    nombre: 'Gestión administrativa',
    resumen: 'PQRS, comunicados, mantenimiento e inventario.',
    modulos: ['gestion_administrativa'],
    soloPH: true,
    acciones: [
      a('tickets', 'PQRS y tickets', 'Solicitudes, reportes y su atención.', ['tickets.ver_todos', 'tickets.atender', 'tickets.crear']),
      a('comunicados', 'Comunicados', 'Avisos a residentes.', ['comunicados.gestionar']),
      a('chat', 'Chat de WhatsApp', 'Conversaciones con residentes.', ['conversaciones.atender']),
      a('preguntas', 'Preguntas frecuentes', 'Respuestas del asistente.', ['preguntas_frecuentes.editar']),
      a('mantenimiento', 'Mantenimiento', 'Plan preventivo y órdenes.', [
        'mantenimiento.planificar',
        'mantenimiento.ejecutar',
        'mantenimiento.verificar',
      ]),
      a('inventario', 'Inventario', 'Activos de la copropiedad.', ['inventario.ver']),
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
      a('saldos', 'Saldos y edades', 'Estado de cuenta de cada unidad.', ['cartera.ver']),
      a('liquidacion', 'Liquidación mensual', 'Cuotas de administración del periodo.', ['cartera.liquidar']),
      a('recaudos', 'Recaudos', 'Registrar pagos.', ['tesoreria.recibos.registrar']),
      a('ajustes', 'Ajustes y acuerdos', 'Notas, cartera inicial y acuerdos de pago.', ['cartera.ajustar']),
      a('certificados', 'Paz y salvo', 'Certificados de deuda o paz y salvo.', ['cartera.certificados.emitir']),
      a('presupuesto', 'Presupuesto', 'Presupuesto anual y su ejecución.', ['presupuesto.gestionar']),
      a('configuracion', 'Configuración', 'Conceptos, políticas y módulos de contribución.', ['cartera.configurar']),
    ],
  },
  contabilidad: {
    slug: 'contabilidad',
    nombre: 'Contabilidad',
    resumen: 'Comprobantes, PUC, periodos y reportes.',
    modulos: ['contabilidad'],
    acciones: [
      a('comprobantes', 'Comprobantes', 'Registrar, contabilizar y revertir.', ['contabilidad.ver', 'contabilidad.comprobantes.crear']),
      a('puc', 'Plan de cuentas', 'PUC, cuentas y centros de costo.', ['contabilidad.ver']),
      a('periodos', 'Periodos y cierre', 'Apertura y cierre contable.', ['contabilidad.ver']),
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
      a('recibos', 'Recibos de caja', 'Ingresos y su aplicación.', ['tesoreria.recibos.registrar']),
      a('egresos', 'Egresos', 'Pagos, autorización y soporte.', ['tesoreria.egresos.registrar', 'tesoreria.egresos.autorizar']),
      a('cuentas-por-pagar', 'Cuentas por pagar', 'Facturas de proveedores.', ['tesoreria.facturas_proveedor.gestionar']),
      a('conciliacion', 'Conciliación', 'Extractos bancarios.', ['tesoreria.conciliar']),
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
      a('perfil', 'Perfil tributario', 'Responsabilidades de la entidad.', ['tributario.configurar', 'tributario.perfil.confirmar']),
      a('resoluciones', 'Resoluciones de numeración', 'Rangos autorizados por la DIAN.', ['tributario.configurar']),
      a('impuestos', 'Retención, IVA e ICA', 'Preparación de declaraciones.', ['tributario.preparar'], SOLO_CONTABILIDAD),
      a('exogena', 'Información exógena', 'Formatos para la DIAN.', ['tributario.preparar'], SOLO_CONTABILIDAD),
    ],
  },
  facturacion: {
    slug: 'facturacion',
    nombre: 'Facturación',
    resumen: 'Facturas de venta, compras y documentos ante la DIAN.',
    modulos: ['facturacion_electronica', 'contabilidad'],
    acciones: [
      a('facturas', 'Facturas de venta', 'Ventas, notas y su estado.', ['facturacion.ver']),
      a('catalogo', 'Catálogo de productos', 'Productos y servicios que se facturan.', ['facturacion.items.gestionar']),
      a('compras', 'Compras y documento soporte', 'Compras a no obligados a facturar.', ['facturacion.facturas.gestionar']),
      a('libros', 'Libros y paquete', 'Libros de ventas y compras para el contador.', ['facturacion.exportar']),
      a('emitir', 'Emitir ante la DIAN', 'Documentos electrónicos y contingencia.', ['facturacion.emitir'], SOLO_FE),
      a('recibidas', 'Recibidas y RADIAN', 'Facturas de proveedores y sus eventos.', ['facturacion.recibir'], SOLO_FE),
      a('habilitacion', 'Habilitación DIAN', 'Software, certificado y set de pruebas.', ['facturacion.configurar'], SOLO_FE),
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
}

const algunoDe = (modulos: Modulo[] | undefined, c: Consulta) =>
  !modulos?.length || modulos.some((m) => c.tieneModulo(m))

/** ¿La entidad tiene contratado lo que exige la sección? */
export function seccionContratada(s: Seccion, c: Consulta): boolean {
  return algunoDe(s.modulos, c) && (s.requiereTodos ?? []).every((m) => c.tieneModulo(m))
}

export function accionesVisibles(s: Seccion, c: Consulta): Accion[] {
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
  return accionesVisibles(s, c).length > 0 ? 'activa' : 'sin_acceso'
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

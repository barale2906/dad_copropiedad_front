/**
 * Único mapa de la app: secciones (lo que hace cada módulo), sus acciones y el módulo/permiso
 * que las habilita. Lo usan la maqueta 3D, el menú alterno (lista) y el menú lateral de los
 * módulos; agregar una sección o una acción nueva es tocar solo este archivo.
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
}

export interface Seccion {
  /** Segmento de la ruta: `/e/:entidad/:seccion/:accion`. */
  slug: string
  nombre: string
  resumen: string
  /** Módulo contratable que la habilita; `null` = incluido con la entidad. */
  modulo: Modulo | null
  /** Aún no existe en el backend: se muestra apagada con «Próximamente». */
  proximamente?: boolean
  soloPH?: boolean
  acciones: Accion[]
}

const a = (id: string, etiqueta: string, descripcion: string, ...permisos: Permiso[]): Accion => ({
  id,
  etiqueta,
  descripcion,
  permisos,
})

export const SECCIONES: Record<string, Seccion> = {
  unidades: {
    slug: 'unidades',
    nombre: 'Unidades y residentes',
    resumen: 'Apartamentos, propietarios, coeficientes y censo de residentes.',
    modulo: null,
    soloPH: true,
    acciones: [
      a('bienes', 'Bienes privados', 'Apartamentos, locales, parqueaderos y depósitos.', 'bienes_privados.ver'),
      a('titulares', 'Propietarios', 'Titulares, representantes y transferencias.', 'titulares.ver'),
      a('censo', 'Censo', 'Residentes, vehículos y mascotas.', 'censo.ver'),
      a('coeficientes', 'Coeficientes', 'Cuadros de coeficientes y su activación.', 'bienes_privados.ver'),
    ],
  },
  'zonas-comunes': {
    slug: 'zonas-comunes',
    nombre: 'Zonas comunes',
    resumen: 'Reservas, disponibilidad, tarifas y reglas de uso.',
    modulo: 'bienes_comunes',
    soloPH: true,
    acciones: [
      a('reservar', 'Reservar', 'Solicitar una reserva de la zona.', 'reservas.crear'),
      a('disponibilidad', 'Disponibilidad', 'Calendario y franjas libres.', 'bienes_comunes.ver'),
      a('aprobaciones', 'Aprobar reservas', 'Solicitudes pendientes y entregas.', 'reservas.aprobar'),
      a('reglas', 'Reglas y tarifas', 'Reglamento, capacidad, tarifa y depósito.', 'bienes_comunes.ver'),
      a('parqueaderos', 'Parqueaderos', 'Asignación y sorteos.', 'parqueaderos.ver', 'sorteos.gestionar'),
    ],
  },
  porteria: {
    slug: 'porteria',
    nombre: 'Portería',
    resumen: 'Visitantes, correspondencia, bitácora y minuta.',
    modulo: 'control_acceso',
    soloPH: true,
    acciones: [
      a('visitas', 'Visitas', 'Anunciar y autorizar visitantes.', 'acceso.registrar', 'acceso.visitantes.autorizar'),
      a('correspondencia', 'Correspondencia', 'Paquetes recibidos y entregas.', 'acceso.correspondencia.entregar'),
      a('bitacora', 'Bitácora', 'Entradas y salidas registradas.', 'acceso.bitacora.ver'),
      a('minuta', 'Minuta', 'Novedades del turno.', 'acceso.minuta.ver', 'acceso.minuta.registrar'),
      a('configuracion', 'Puntos de acceso', 'Puertas, puentes y credenciales.', 'acceso.configurar'),
    ],
  },
  asambleas: {
    slug: 'asambleas',
    nombre: 'Asambleas',
    resumen: 'Convocatorias, quórum, votaciones y actas.',
    modulo: 'asambleas',
    soloPH: true,
    acciones: [
      a('reuniones', 'Reuniones', 'Asambleas programadas y realizadas.', 'asambleas.ver'),
      a('convocar', 'Convocar', 'Nueva convocatoria y orden del día.', 'asambleas.convocar'),
      a('en-vivo', 'Tablero en vivo', 'Quórum y resultados en tiempo real.', 'asambleas.conducir', 'asambleas.ver'),
    ],
  },
  administracion: {
    slug: 'administracion',
    nombre: 'Gestión administrativa',
    resumen: 'PQRS, comunicados, mantenimiento e inventario.',
    modulo: 'gestion_administrativa',
    soloPH: true,
    acciones: [
      a('tickets', 'PQRS y tickets', 'Solicitudes, reportes y su atención.', 'tickets.ver_todos', 'tickets.crear'),
      a('comunicados', 'Comunicados', 'Avisos a residentes.', 'comunicados.gestionar'),
      a('mantenimiento', 'Mantenimiento', 'Plan preventivo y órdenes.', 'mantenimiento.planificar', 'mantenimiento.ejecutar'),
      a('inventario', 'Inventario', 'Activos de la copropiedad.', 'inventario.ver'),
      a('chat', 'Bandeja de chat', 'Conversaciones de WhatsApp.', 'conversaciones.atender'),
    ],
  },
  cartera: {
    slug: 'cartera',
    nombre: 'Cartera',
    resumen: 'Cuotas, recaudos, mora y paz y salvos.',
    modulo: 'contabilidad_ph',
    soloPH: true,
    acciones: [
      a('saldos', 'Saldos y edades', 'Estado de cuenta de cada unidad.', 'cartera.ver'),
      a('liquidacion', 'Liquidación mensual', 'Cuotas de administración del periodo.', 'cartera.liquidar'),
      a('recaudos', 'Recaudos', 'Registrar pagos.', 'tesoreria.recibos.registrar'),
      a('certificados', 'Paz y salvo', 'Certificados de deuda o paz y salvo.', 'cartera.certificados.emitir'),
      a('presupuesto', 'Presupuesto', 'Presupuesto anual y su ejecución.', 'presupuesto.gestionar'),
    ],
  },
  contabilidad: {
    slug: 'contabilidad',
    nombre: 'Contabilidad',
    resumen: 'Comprobantes, PUC, periodos y reportes.',
    modulo: 'contabilidad',
    acciones: [
      a('comprobantes', 'Comprobantes', 'Registrar, contabilizar y revertir.', 'contabilidad.comprobantes.crear', 'contabilidad.ver'),
      a('puc', 'Plan de cuentas', 'PUC, cuentas y centros de costo.', 'contabilidad.ver'),
      a('periodos', 'Periodos', 'Apertura y cierre contable.', 'contabilidad.ver'),
      a('reportes', 'Reportes', 'Balance, estado de resultados y libros.', 'contabilidad.ver'),
      a('terceros', 'Terceros', 'Clientes, proveedores y datos fiscales.', 'terceros.gestionar'),
    ],
  },
  tesoreria: {
    slug: 'tesoreria',
    nombre: 'Tesorería',
    resumen: 'Bancos, recibos, egresos y conciliación.',
    modulo: 'contabilidad',
    acciones: [
      a('recibos', 'Recibos de caja', 'Ingresos y su aplicación.', 'tesoreria.recibos.registrar'),
      a('egresos', 'Egresos', 'Pagos, autorización y soporte.', 'tesoreria.egresos.registrar', 'tesoreria.egresos.autorizar'),
      a('cuentas-por-pagar', 'Cuentas por pagar', 'Facturas de proveedores.', 'tesoreria.facturas_proveedor.gestionar'),
      a('conciliacion', 'Conciliación', 'Extractos bancarios.', 'tesoreria.conciliar'),
    ],
  },
  tributario: {
    slug: 'tributario',
    nombre: 'Tributario',
    resumen: 'Retenciones, IVA, ICA y exógena.',
    modulo: 'contabilidad',
    acciones: [
      a('impuestos', 'Retención, IVA e ICA', 'Preparación de declaraciones.', 'tributario.preparar'),
      a('exogena', 'Información exógena', 'Formatos para la DIAN.', 'tributario.preparar'),
      a('perfil', 'Perfil tributario', 'Responsabilidades de la entidad.', 'tributario.configurar', 'tributario.perfil.confirmar'),
    ],
  },
  facturacion: {
    slug: 'facturacion',
    nombre: 'Facturación electrónica',
    resumen: 'Facturas, notas y documentos recibidos.',
    modulo: 'facturacion_electronica',
    acciones: [
      a('facturas', 'Facturas', 'Ventas y su estado ante la DIAN.', 'facturacion.ver'),
      a('emitir', 'Emitir', 'Nueva factura electrónica.', 'facturacion.emitir'),
      a('recibidas', 'Recibidas', 'Facturas de proveedores y eventos RADIAN.', 'facturacion.recibir'),
    ],
  },
  publicidad: {
    slug: 'publicidad',
    nombre: 'Publicidad y directorio',
    resumen: 'Pantallas del lobby y comercios cercanos.',
    modulo: 'publicidad',
    soloPH: true,
    acciones: [
      a('directorio', 'Directorio', 'Comercios y servicios del sector.', 'directorio.ver'),
      a('pantallas', 'Pantallas', 'Contenido de las pantallas del lobby.', 'copropiedad.datos.ver'),
    ],
  },
  entidad: {
    slug: 'entidad',
    nombre: 'Datos y usuarios',
    resumen: 'Ficha de la entidad, usuarios, roles y auditoría.',
    modulo: null,
    acciones: [
      a('ficha', 'Ficha', 'Datos generales y de contacto.', 'copropiedad.datos.ver'),
      a('usuarios', 'Usuarios y roles', 'Quién puede hacer qué.', 'roles.ver'),
      a('auditoria', 'Auditoría', 'Registro de operaciones.', 'auditoria.ver'),
      a('proteccion-datos', 'Protección de datos', 'Políticas y solicitudes (Ley 1581).', 'proteccion_datos.gestionar'),
    ],
  },
  archivo: {
    slug: 'archivo',
    nombre: 'Archivo',
    resumen: 'Documentos y soportes de la entidad.',
    modulo: null,
    acciones: [a('documentos', 'Documentos', 'Archivos cargados y sus enlaces.', 'archivos.ver')],
  },
  nomina: {
    slug: 'nomina',
    nombre: 'Nómina electrónica',
    resumen: 'Empleados, liquidación y nómina ante la DIAN.',
    modulo: null,
    proximamente: true,
    acciones: [],
  },
}

export type EstadoSeccion = 'activa' | 'sin_acceso' | 'no_contratada' | 'proximamente'

export interface Consulta {
  tieneModulo: (m: Modulo) => boolean
  tienePermiso: (p: Permiso) => boolean
}

export function accionesVisibles(s: Seccion, c: Consulta): Accion[] {
  return s.acciones.filter((x) => x.permisos.some((p) => c.tienePermiso(p)))
}

export function estadoSeccion(s: Seccion, c: Consulta): EstadoSeccion {
  if (s.proximamente) return 'proximamente'
  if (s.modulo && !c.tieneModulo(s.modulo)) return 'no_contratada'
  return accionesVisibles(s, c).length > 0 ? 'activa' : 'sin_acceso'
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

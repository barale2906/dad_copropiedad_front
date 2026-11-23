/**
 * Permisos para personas: su texto, su agrupación por módulo y las reglas de la matriz de un rol
 * (funciones puras). El catálogo del backend solo trae códigos; los textos viven aquí.
 */
import type { Ambito, Permiso, PermisoDelCatalogo } from '@/api/tipos'

/**
 * Texto de cada permiso. Es un `Record` completo a propósito: si el contrato agrega un permiso,
 * no compila hasta darle su texto.
 */
export const ETIQUETA_PERMISO: Record<Permiso, string> = {
  'plataforma.copropiedades.crear': 'Crear copropiedades',
  'plataforma.copropiedades.ver': 'Ver copropiedades',
  'plataforma.cuentas.ver': 'Ver cuentas',
  'plataforma.cuentas.bloquear': 'Bloquear y desbloquear cuentas',
  'plataforma.cuentas.crear': 'Crear cuentas',
  'plataforma.roles.gestionar': 'Gestionar roles de la plataforma',
  'plataforma.roles.asignar': 'Asignar roles de la plataforma',
  'plataforma.organizaciones.revisar': 'Revisar organizaciones',
  'plataforma.modulos.gestionar': 'Habilitar módulos a las entidades',
  'plataforma.entidades.crear': 'Crear entidades',
  'plataforma.entidades.usuarios': 'Gestionar usuarios de las entidades',
  'plataforma.soporte.ver': 'Entrar a una entidad en modo soporte',
  'plataforma.entidad_propia.designar': 'Designar la entidad propia',
  'plataforma.plantillas_contables.publicar': 'Publicar plantillas contables',
  'plataforma.normativa.gestionar': 'Gestionar catálogos normativos',
  'plataforma.auditoria.ver': 'Ver la auditoría de la plataforma',
  'plataforma.publicidad.moderar': 'Moderar publicidad',
  'plataforma.publicidad.gestionar': 'Gestionar campañas de publicidad',
  'plataforma.publicidad.liquidar': 'Liquidar publicidad',
  'plataforma.directorio.gestionar': 'Gestionar el directorio',
  'plataforma.facturacion.ver': 'Ver el consumo de facturación',
  'plataforma.comercial.gestionar': 'Gestionar el catálogo comercial y las suscripciones',
  'plataforma.cobros.aprobar': 'Calcular y aprobar cortes de cobro',
  'plataforma.cobros.facturar': 'Facturar cortes y registrar pagos',
  'plataforma.whatsapp.gestionar': 'Gestionar líneas de WhatsApp',
  'copropiedad.datos.ver': 'Ver la ficha de la entidad',
  'copropiedad.datos.editar': 'Editar la ficha de la entidad',
  'roles.ver': 'Ver usuarios y roles',
  'roles.gestionar': 'Crear roles y cambiar sus permisos',
  'roles.asignar': 'Crear usuarios y asignar roles',
  'auditoria.ver': 'Ver la auditoría',
  'archivos.subir': 'Subir archivos',
  'archivos.ver': 'Ver archivos',
  'archivos.personales.ver': 'Ver archivos personales o sensibles',
  'suscripcion.ver': 'Ver la suscripción con la plataforma',
  'importaciones.ejecutar': 'Hacer cargas masivas',
  'personas.ver': 'Ver personas',
  'personas.editar': 'Editar personas',
  'personas.datos_sensibles.ver': 'Ver datos sensibles de las personas',
  'proteccion_datos.gestionar': 'Gestionar la protección de datos',
  'organizaciones.crear': 'Crear organizaciones',
  'organizaciones.vincular': 'Vincular organizaciones',
  'contratos.gestionar': 'Gestionar contratos de servicio',
  'bienes_privados.ver': 'Ver unidades privadas',
  'bienes_privados.editar': 'Editar unidades privadas',
  'bienes_privados.coeficientes.editar': 'Editar coeficientes',
  'bienes_privados.coeficientes.activar': 'Activar una versión de coeficientes',
  'agrupaciones.editar': 'Editar agrupaciones (torres, bloques…)',
  'titulares.ver': 'Ver titulares',
  'titulares.editar': 'Editar titulares',
  'censo.ver': 'Ver el censo',
  'censo.editar': 'Editar el censo',
  'censo.aprobar': 'Aprobar cambios del censo',
  'censo.exportar': 'Exportar el censo',
  'bienes_comunes.ver': 'Ver zonas comunes',
  'bienes_comunes.editar': 'Editar zonas comunes',
  'reservas.crear': 'Reservar',
  'reservas.aprobar': 'Aprobar reservas',
  'reservas.ver_todas': 'Ver todas las reservas',
  'reservas.cancelar_cualquiera': 'Cancelar cualquier reserva',
  'reservas.entregas.registrar': 'Registrar entregas y devoluciones',
  'reservas.restringir': 'Restringir reservas a una unidad',
  'parqueaderos.ver': 'Ver parqueaderos',
  'parqueaderos.asignar': 'Asignar parqueaderos',
  'sorteos.gestionar': 'Hacer sorteos de parqueaderos',
  'tickets.crear': 'Radicar solicitudes (PQRS)',
  'tickets.asignar': 'Asignar solicitudes',
  'tickets.atender': 'Atender solicitudes',
  'tickets.ver_todos': 'Ver todas las solicitudes',
  'tickets.configurar': 'Configurar categorías y tiempos',
  'tickets.convivencia.ver': 'Ver casos de convivencia',
  'tickets.urgencias.recibir': 'Recibir urgencias',
  'conversaciones.atender': 'Atender el chat',
  'preguntas_frecuentes.editar': 'Editar preguntas frecuentes',
  'comunicados.gestionar': 'Publicar comunicados',
  'inventario.ver': 'Ver el inventario',
  'inventario.editar': 'Editar el inventario',
  'mantenimiento.planificar': 'Planificar mantenimientos',
  'mantenimiento.ejecutar': 'Ejecutar mantenimientos',
  'mantenimiento.verificar': 'Verificar mantenimientos',
  'asambleas.ver': 'Ver asambleas',
  'asambleas.convocar': 'Convocar asambleas',
  'asambleas.conducir': 'Conducir asambleas',
  'asambleas.registrar': 'Registrar asistencia y poderes',
  'asambleas.votos.registrar': 'Registrar votos',
  'asambleas.votos.ver_detalle': 'Ver el detalle de los votos',
  'acceso.registrar': 'Registrar ingresos y salidas',
  'acceso.visitantes.autorizar': 'Autorizar visitantes',
  'acceso.bitacora.ver': 'Ver la bitácora de accesos',
  'acceso.correspondencia.entregar': 'Recibir y entregar correspondencia',
  'acceso.minuta.registrar': 'Escribir en la minuta',
  'acceso.minuta.ver': 'Ver la minuta',
  'acceso.configurar': 'Configurar la portería',
  'acceso.credenciales.gestionar': 'Gestionar credenciales de acceso',
  'acceso.biometria.enrolar': 'Enrolar datos biométricos',
  'contabilidad.ver': 'Ver la contabilidad',
  'contabilidad.configurar': 'Configurar la contabilidad',
  'contabilidad.comprobantes.crear': 'Crear comprobantes',
  'contabilidad.comprobantes.contabilizar': 'Contabilizar comprobantes',
  'contabilidad.comprobantes.revertir': 'Revertir comprobantes',
  'contabilidad.periodos.cerrar': 'Cerrar periodos',
  'contabilidad.periodos.reabrir': 'Pedir la reapertura de un periodo',
  'contabilidad.periodos.aprobar_reapertura': 'Aprobar la reapertura de un periodo',
  'contabilidad.exportar': 'Exportar la contabilidad',
  'presupuesto.gestionar': 'Gestionar el presupuesto',
  'tesoreria.configurar': 'Configurar la tesorería',
  'tesoreria.recibos.registrar': 'Registrar recibos de caja',
  'tesoreria.egresos.registrar': 'Registrar egresos',
  'tesoreria.egresos.autorizar': 'Autorizar egresos',
  'tesoreria.facturas_proveedor.gestionar': 'Gestionar facturas de proveedores',
  'tesoreria.conciliar': 'Conciliar bancos',
  'cartera.ver': 'Ver la cartera',
  'cartera.configurar': 'Configurar la cartera',
  'cartera.liquidar': 'Liquidar cuotas e intereses',
  'cartera.ajustar': 'Hacer ajustes de cartera',
  'cartera.certificados.emitir': 'Emitir paz y salvos y certificados',
  'tributario.configurar': 'Configurar el perfil tributario',
  'tributario.perfil.confirmar': 'Confirmar el perfil tributario',
  'tributario.preparar': 'Preparar declaraciones',
  'terceros.gestionar': 'Gestionar terceros',
  'facturacion.ver': 'Ver la facturación',
  'facturacion.facturas.gestionar': 'Crear y editar facturas',
  'facturacion.items.gestionar': 'Gestionar productos y servicios',
  'facturacion.exportar': 'Exportar la facturación',
  'facturacion.configurar': 'Configurar la facturación',
  'facturacion.certificado.gestionar': 'Gestionar el certificado digital',
  'facturacion.emitir': 'Emitir facturas ante la DIAN',
  'facturacion.recibir': 'Recibir facturas de proveedores',
  'nomina.ver': 'Ver la nómina',
  'nomina.salarios.ver': 'Ver salarios, cuentas y liquidaciones',
  'nomina.empleados.gestionar': 'Gestionar empleados y contratos',
  'nomina.configurar': 'Configurar la nómina',
  'nomina.novedades.registrar': 'Registrar novedades de nómina',
  'nomina.liquidar': 'Liquidar y pagar la nómina',
  'nomina.aprobar': 'Aprobar la nómina',
  'directorio.ver': 'Ver el directorio',
  'directorio.resenar': 'Escribir reseñas',
  'directorio.compartir': 'Compartir el enlace del directorio',
}

/** Grupos de la matriz, en el orden del menú. Cada prefijo del código cae en un solo grupo. */
const GRUPOS: readonly { nombre: string; prefijos: readonly string[] }[] = [
  { nombre: 'Datos y usuarios', prefijos: ['copropiedad', 'roles', 'auditoria', 'archivos', 'suscripcion', 'importaciones'] },
  { nombre: 'Personas y protección de datos', prefijos: ['personas', 'proteccion_datos'] },
  { nombre: 'Organizaciones y contratos', prefijos: ['organizaciones', 'contratos'] },
  { nombre: 'Unidades y residentes', prefijos: ['bienes_privados', 'agrupaciones', 'titulares', 'censo'] },
  { nombre: 'Zonas comunes y reservas', prefijos: ['bienes_comunes', 'reservas', 'parqueaderos', 'sorteos'] },
  {
    nombre: 'Gestión administrativa',
    prefijos: ['tickets', 'conversaciones', 'preguntas_frecuentes', 'comunicados', 'inventario', 'mantenimiento'],
  },
  { nombre: 'Asambleas', prefijos: ['asambleas'] },
  { nombre: 'Portería', prefijos: ['acceso'] },
  { nombre: 'Contabilidad', prefijos: ['contabilidad', 'presupuesto'] },
  { nombre: 'Tesorería', prefijos: ['tesoreria'] },
  { nombre: 'Cartera', prefijos: ['cartera'] },
  { nombre: 'Tributario', prefijos: ['tributario', 'terceros'] },
  { nombre: 'Facturación', prefijos: ['facturacion'] },
  { nombre: 'Nómina', prefijos: ['nomina'] },
  { nombre: 'Directorio', prefijos: ['directorio'] },
  { nombre: 'Plataforma', prefijos: ['plataforma'] },
]

const OTROS = 'Otros'

export interface PermisoVisible {
  codigo: Permiso
  etiqueta: string
}

export interface GrupoPermisos {
  nombre: string
  permisos: PermisoVisible[]
}

/** Texto de un permiso; si el backend envía uno que el cliente aún no conoce, su código. */
export function etiquetaPermiso(codigo: string): string {
  return (ETIQUETA_PERMISO as Record<string, string>)[codigo] ?? codigo
}

function grupoDe(codigo: string): string {
  const prefijo = codigo.split('.')[0] ?? ''
  return GRUPOS.find((g) => g.prefijos.includes(prefijo))?.nombre ?? OTROS
}

/**
 * Agrupa el catálogo por módulo (solo el `ambito` pedido), en el orden del menú y con los
 * permisos en el orden del catálogo. Los grupos vacíos no aparecen.
 */
export function agruparPermisos(catalogo: PermisoDelCatalogo[], ambito: Ambito): GrupoPermisos[] {
  const porGrupo = new Map<string, PermisoVisible[]>()
  for (const p of catalogo) {
    if (p.ambito !== ambito) continue
    const codigo = p.codigo as Permiso
    const nombre = grupoDe(codigo)
    porGrupo.set(nombre, [...(porGrupo.get(nombre) ?? []), { codigo, etiqueta: etiquetaPermiso(codigo) }])
  }
  const orden = [...GRUPOS.map((g) => g.nombre), OTROS]
  return orden.flatMap((nombre) => {
    const permisos = porGrupo.get(nombre)
    return permisos ? [{ nombre, permisos }] : []
  })
}

/** Qué cambia entre los permisos guardados y los elegidos. */
export function diferencia(antes: readonly Permiso[], despues: readonly Permiso[]) {
  const a = new Set(antes)
  const d = new Set(despues)
  return {
    agregados: despues.filter((p) => !a.has(p)),
    quitados: antes.filter((p) => !d.has(p)),
  }
}

/**
 * Los permisos que la cuenta **no** puede otorgar entre los elegidos: el backend rechaza (403)
 * un rol con permisos que quien lo crea o edita no tiene.
 */
export function noOtorgables(elegidos: readonly Permiso[], propios: (p: Permiso) => boolean): Permiso[] {
  return elegidos.filter((p) => !propios(p))
}

/** Código de rol válido para el backend: 2 a 60 caracteres `a-z`, `0-9`, `_`. */
export const CODIGO_ROL = /^[a-z0-9_]{2,60}$/

/** Propone el código de un rol a partir de su nombre («Auxiliar de cartera» → `auxiliar_de_cartera`). */
export function sugerirCodigo(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

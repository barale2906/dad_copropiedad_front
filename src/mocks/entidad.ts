/** Demo del módulo «Datos y usuarios»: usuarios, roles, asignaciones e importación. */
import type {
  Asignacion,
  Importacion,
  NuevoRol,
  NuevoUsuario,
  Permiso,
  PermisoDelCatalogo,
  Rol,
  Usuario,
  UsuarioCreado,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

/** Catálogo del demo: una muestra de cada módulo (el real trae todos los del contrato). */
const CATALOGO: PermisoDelCatalogo[] = [
  ...(['plataforma.cuentas.ver', 'plataforma.entidades.usuarios', 'plataforma.soporte.ver'] satisfies Permiso[]).map(
    (codigo) => ({ codigo, ambito: 'plataforma' as const }),
  ),
  ...([
    'copropiedad.datos.ver', 'copropiedad.datos.editar', 'roles.ver', 'roles.gestionar', 'roles.asignar',
    'auditoria.ver', 'archivos.subir', 'archivos.ver', 'archivos.personales.ver', 'suscripcion.ver',
    'importaciones.ejecutar', 'personas.ver', 'personas.datos_sensibles.ver', 'proteccion_datos.gestionar',
    'organizaciones.crear', 'organizaciones.vincular', 'contratos.gestionar', 'bienes_privados.ver',
    'censo.ver', 'censo.editar', 'censo.aprobar', 'bienes_comunes.ver', 'reservas.crear', 'reservas.aprobar',
    'tickets.crear', 'tickets.atender', 'comunicados.gestionar', 'asambleas.ver', 'asambleas.convocar',
    'acceso.registrar', 'acceso.bitacora.ver', 'acceso.correspondencia.entregar', 'acceso.minuta.registrar',
    'acceso.biometria.enrolar', 'contabilidad.ver', 'contabilidad.comprobantes.crear',
    'contabilidad.periodos.cerrar', 'tesoreria.recibos.registrar', 'cartera.ver', 'cartera.liquidar',
    'cartera.ajustar', 'facturacion.ver', 'directorio.ver',
  ] satisfies Permiso[]).map((codigo) => ({ codigo, ambito: 'copropiedad' as const })),
]

const PLANTILLAS: Rol[] = [
  {
    id: id(901), codigo: 'administrador', nombre: 'Administrador', ambito: 'copropiedad', es_plantilla: true,
    permisos: ['copropiedad.datos.ver', 'copropiedad.datos.editar', 'roles.ver', 'roles.gestionar', 'roles.asignar',
      'auditoria.ver', 'archivos.ver', 'archivos.subir', 'censo.ver', 'cartera.ver', 'contabilidad.ver'],
  },
  {
    id: id(902), codigo: 'contador', nombre: 'Contador', ambito: 'copropiedad', es_plantilla: true,
    descripcion: 'Contabilidad, tesorería y cartera.',
    permisos: ['contabilidad.ver', 'contabilidad.comprobantes.crear', 'contabilidad.periodos.cerrar', 'cartera.ver'],
  },
  {
    id: id(903), codigo: 'porteria', nombre: 'Portería', ambito: 'copropiedad', es_plantilla: true,
    permisos: ['acceso.registrar', 'acceso.bitacora.ver', 'acceso.correspondencia.entregar', 'acceso.minuta.registrar'],
  },
  { id: id(904), codigo: 'residente', nombre: 'Residente', ambito: 'copropiedad', es_plantilla: true, permisos: ['reservas.crear', 'tickets.crear'] },
]

const rolesIniciales = (): Rol[] => [
  ...PLANTILLAS.map((r) => ({ ...r, permisos: [...r.permisos] })),
  {
    id: id(905), codigo: 'auxiliar_cartera', nombre: 'Auxiliar de cartera', ambito: 'copropiedad',
    es_plantilla: false, descripcion: 'Apoya el recaudo.', permisos: ['cartera.ver', 'censo.ver'],
  },
]

let ROLES = rolesIniciales()
const rolPorCodigo = (c: string) => ROLES.find((r) => r.codigo === c)

let usuarios: Usuario[] = []
let asignaciones: Asignacion[] = []
let importaciones = new Map<string, { importacion: Importacion; filas: NuevoUsuario[] }>()
let consecutivo = 1000

function asignar(cuentaId: string, codigo: string, origen: Asignacion['origen'] = 'manual') {
  const rol = rolPorCodigo(codigo)
  if (!rol) return null
  const a: Asignacion = {
    id: id(++consecutivo),
    cuenta_id: cuentaId,
    rol_id: rol.id,
    vigente_desde: '2026-01-15T13:00:00Z',
    vigente_hasta: null,
    origen,
  }
  asignaciones.push(a)
  return a
}

function rolesDe(cuentaId: string): string[] {
  const ahora = Date.now()
  return asignaciones
    .filter((a) => a.cuenta_id === cuentaId && (!a.vigente_hasta || Date.parse(a.vigente_hasta) > ahora))
    .map((a) => ROLES.find((r) => r.id === a.rol_id)?.codigo ?? '')
}

const conRoles = (u: Usuario): Usuario => ({ ...u, roles: rolesDe(u.cuenta_id) })

/** Datos iniciales de la entidad demo (se reinician en cada inicio de sesión). */
export function iniciarEntidad(): void {
  consecutivo = 1000
  ROLES = rolesIniciales()
  importaciones = new Map()
  asignaciones = []
  usuarios = [
    { cuenta_id: id(801), nombre: 'Andrés Administrador', usuario: 'admin', correo: 'admin@demo.dad', estado: 'activa', contrasena_pendiente: false, ultimo_acceso_en: '2026-11-16T14:10:00Z', roles: [] },
    { cuenta_id: id(802), nombre: 'Laura Contadora', usuario: null, correo: 'laura@demo.dad', estado: 'activa', contrasena_pendiente: false, ultimo_acceso_en: '2026-11-12T20:30:00Z', roles: [] },
    { cuenta_id: id(803), nombre: 'Pedro Portero', usuario: 'pedro', correo: 'pedro@demo.dad', estado: 'activa', contrasena_pendiente: true, ultimo_acceso_en: null, roles: [] },
    { cuenta_id: id(804), nombre: 'Marta Residente', usuario: null, correo: 'marta@demo.dad', estado: 'activa', contrasena_pendiente: false, ultimo_acceso_en: '2026-11-01T11:00:00Z', roles: [] },
  ]
  asignar(id(801), 'administrador')
  asignar(id(802), 'contador')
  asignar(id(803), 'porteria')
  asignar(id(804), 'residente', 'residencia')
}

function crear(p: NuevoUsuario): Response {
  const rol = ROLES.find((r) => r.id === p.rol_id)
  if (!rol) return error(404, 'no_encontrado', 'El rol no existe en la entidad.')
  if (!p.correo.includes('@')) return error(422, 'validacion', 'Escriba un correo válido.')
  if (p.usuario && usuarios.some((u) => u.usuario === p.usuario && u.correo !== p.correo)) {
    return error(409, 'conflicto', 'Ese usuario ya lo usa otra cuenta. Elija otro o déjelo vacío.')
  }
  const existente = usuarios.find((u) => u.correo === p.correo)
  // Un correo de «otra entidad» simula una cuenta que ya existe en DAD.
  const deOtraEntidad = !existente && p.correo.endsWith('@otra.dad')
  const cuenta = existente ?? {
    cuenta_id: id(++consecutivo),
    nombre: p.nombre,
    usuario: p.usuario ?? null,
    correo: p.correo,
    estado: 'activa' as const,
    contrasena_pendiente: !deOtraEntidad,
    ultimo_acceso_en: null,
    roles: [],
  }
  if (!existente) usuarios.push(cuenta)
  const yaLoTenia = rolesDe(cuenta.cuenta_id).includes(rol.codigo)
  const asignacion = yaLoTenia ? null : asignar(cuenta.cuenta_id, rol.codigo)
  const r: UsuarioCreado = {
    cuenta_id: cuenta.cuenta_id,
    cuenta_nueva: !existente && !deOtraEntidad,
    persona_id: id(++consecutivo),
    asignacion_id: asignacion?.id ?? null,
  }
  return json(r, 201)
}

/** CSV simple de la demo: `nombre,correo,rol[,usuario,telefono,documento]`. */
function validar(texto: string, nombre: string): Response {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const [cabecera, ...filas] = lineas
  if (!cabecera?.toLowerCase().startsWith('nombre,correo,rol')) {
    return error(422, 'validacion', `${nombre}: la primera fila debe ser nombre,correo,rol.`)
  }
  const errores: Importacion['errores'] = []
  const validas: { fila: number; datos: NuevoUsuario; rol: string }[] = []
  filas.forEach((l, i) => {
    const [n = '', c = '', r = '', u = ''] = l.split(',').map((x) => x.trim())
    const fila = i + 2
    const rol = rolPorCodigo(r)
    if (!n) errores.push({ fila, mensaje: 'Falta el nombre.' })
    else if (!c.includes('@')) errores.push({ fila, mensaje: 'El correo no es válido.' })
    else if (!rol) errores.push({ fila, mensaje: `El rol «${r}» no existe en la entidad.` })
    else validas.push({ fila, rol: rol.codigo, datos: { nombre: n, correo: c, rol_id: rol.id, usuario: u || null } })
  })
  const importacion: Importacion = {
    id: id(++consecutivo),
    archivo_id: id(++consecutivo),
    estado: errores.length ? 'con_errores' : 'validada',
    total_filas: filas.length,
    filas_validas: validas.length,
    errores,
    resumen: { bienes_privados: 0, agrupaciones_nuevas: 0, titulares: 0, personas_nuevas: 0, coeficientes: 0, usuarios: validas.length, cuentas_nuevas: 0 },
    creada_en: new Date().toISOString(),
  }
  importaciones.set(importacion.id, { importacion, filas: validas.map((v) => v.datos) })
  return json({ importacion, filas: validas.map((v) => ({ fila: v.fila, rol: v.rol })) }, 201)
}

function crearRol(datos: NuevoRol): Response {
  if (!/^[a-z0-9_]{2,60}$/.test(datos.codigo)) return error(422, 'validacion', 'El código no es válido.')
  if (rolPorCodigo(datos.codigo)) return error(409, 'conflicto', `Ya existe un rol con el código «${datos.codigo}».`)
  const rol: Rol = { id: id(++consecutivo), ambito: 'copropiedad', es_plantilla: false, ...datos }
  ROLES.push(rol)
  return json(rol, 201)
}

/** Catálogo de permisos (no depende de la entidad). */
export const permisos: Manejador = (req, ruta) =>
  req.method === 'GET' && ruta === '/permisos' ? json(CATALOGO) : null

export const entidad: Manejador = async (req, ruta) => {
  const m = req.method
  const base = ruta.match(/^\/entidades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null

  if (m === 'GET' && base === '/roles') return json(ROLES)
  if (m === 'POST' && base === '/roles') return crearRol(await cuerpo<NuevoRol>(req))
  const permisosRol = base.match(/^\/roles\/([^/]+)\/permisos$/)
  if (m === 'PUT' && permisosRol) {
    const rol = ROLES.find((r) => r.id === permisosRol[1])
    if (!rol) return error(404, 'no_encontrado', 'El rol no existe en la entidad.')
    if (rol.es_plantilla) return error(409, 'conflicto', 'Los roles del sistema no se editan.')
    const { permisos } = await cuerpo<{ permisos: Permiso[] }>(req)
    rol.permisos = permisos
    return json(rol)
  }

  if (m === 'GET' && base === '/usuarios') {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const limite = Number(url.searchParams.get('limite') ?? 50)
    const desde = Number(url.searchParams.get('despues') ?? 0)
    const todos = usuarios
      .filter((u) => !q || `${u.nombre} ${u.usuario ?? ''} ${u.correo ?? ''}`.toLowerCase().includes(q))
      .map(conRoles)
    const datos = todos.slice(desde, desde + limite)
    return json({ datos, siguiente: desde + limite < todos.length ? String(desde + limite) : null })
  }
  if (m === 'POST' && base === '/usuarios') return crear(await cuerpo<NuevoUsuario>(req))

  const codigo = base.match(/^\/usuarios\/([^/]+)\/codigo-contrasena$/)
  if (m === 'POST' && codigo) {
    const u = usuarios.find((x) => x.cuenta_id === codigo[1])
    if (!u) return error(404, 'no_encontrado', 'No encontrado.')
    if (!u.contrasena_pendiente) return error(422, 'validacion', 'Este usuario ya definió su contraseña.')
    return sinContenido()
  }

  if (m === 'GET' && base === '/asignaciones') {
    const cuenta = new URL(req.url).searchParams.get('cuenta_id')
    return json(asignaciones.filter((a) => !cuenta || a.cuenta_id === cuenta).reverse())
  }
  const quitar = base.match(/^\/asignaciones\/([^/]+)$/)
  if (m === 'DELETE' && quitar) {
    const a = asignaciones.find((x) => x.id === quitar[1])
    if (!a) return error(404, 'no_encontrado', 'No encontrada.')
    const admin = rolPorCodigo('administrador')?.id
    const admins = asignaciones.filter((x) => x.rol_id === admin && !x.vigente_hasta)
    if (a.rol_id === admin && admins.length === 1) {
      return error(409, 'conflicto', 'La entidad no puede quedarse sin administrador. Asigne otro antes de quitar este.')
    }
    a.vigente_hasta = new Date(Date.now() - 1000).toISOString()
    return sinContenido()
  }

  if (m === 'GET' && base === '/usuarios/importaciones/plantilla') {
    return new Response('nombre,correo,rol,usuario,telefono,documento\nAna Pérez,ana@correo.co,contador,,3001234567,\n', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="plantilla-usuarios.csv"' },
    })
  }
  if (m === 'POST' && base === '/usuarios/importaciones') {
    return validar(await req.text(), new URL(req.url).searchParams.get('nombre') ?? 'planilla')
  }
  const confirmar = base.match(/^\/usuarios\/importaciones\/([^/]+)\/confirmar$/)
  if (m === 'POST' && confirmar) {
    const i = importaciones.get(confirmar[1] ?? '')
    if (!i) return error(404, 'no_encontrado', 'La importación no existe.')
    if (i.importacion.estado !== 'validada') return error(409, 'conflicto_estado', 'La importación tiene errores o ya se aplicó.')
    let nuevas = 0
    for (const f of i.filas) {
      const r = await crear(f).json()
      if ((r as UsuarioCreado).cuenta_nueva) nuevas++
    }
    i.importacion = {
      ...i.importacion,
      estado: 'aplicada',
      aplicada_en: new Date().toISOString(),
      resumen: { ...i.importacion.resumen, cuentas_nuevas: nuevas },
    }
    return json(i.importacion)
  }
  return null
}

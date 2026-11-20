/**
 * Backend simulado para `modoDemo: true` (config.json). Responde con el formato del contrato
 * para poder diseñar sin la API. Se carga en un chunk aparte solo en modo demo.
 *
 * Es un enrutador: aquí viven la sesión y las entidades; cada área tiene su archivo
 * (`cuenta.ts`, y uno por módulo en `src/mocks/<seccion>.ts`) con un `Manejador`.
 *
 * Usuarios: cualquiera con cualquier contraseña.
 *  - que contenga `2fa` → pide segundo factor (código 123456)
 *  - que contenga `uno` → una sola entidad (entra directo)
 *  - que contenga `empresa` → solo la empresa con contabilidad y factura electrónica (oficina)
 *  - que contenga `facturador` → solo «Comercial Andina»: factura electrónica sin contabilidad
 *  - que contenga `nuevo` → sin entidades (cuenta aún sin roles)
 *  - que contenga `revisor` → otra cuenta con las mismas entidades (cuatro ojos: verifica lo que
 *    ejecutó el administrador)
 *  - que contenga `porteria` → guarda y jefe de seguridad de la PH (portería, plan 06)
 *  - que contenga `residente` → propietario y residente de la PH (portal «Mi hogar», plan 05)
 *  - que contenga `plataforma` → equipo de la plataforma con segundo factor (consola, plan 15);
 *    `operador` → igual pero sin segundo factor (el centro de operación sale con candado)
 */
import type { Capacidades, EntidadDeLaCuenta, Permiso, Tokens } from '@/api/tipos'
import { archivos, iniciarArchivos } from './archivos'
import { cuenta, cuentaPublica, esDePlataforma, iniciarCuenta } from './cuenta'
import { entidad, iniciarEntidad, permisos } from './entidad'
import { ficha, iniciarFicha } from './ficha'
import { iniciarProteccion, proteccion } from './proteccion'
import { asambleas, iniciarAsambleas, papeletaDemo } from './asambleas'
import { cartera, iniciarCartera } from './cartera'
import { contabilidad, iniciarContabilidad } from './contabilidad'
import { directorio, directorioPublicoDemo, iniciarDirectorio } from './directorio'
import { facturacion, iniciarFacturacion } from './facturacion'
import { iniciarTesoreria, tesoreria } from './tesoreria'
import { iniciarTributario, tributario } from './tributario'
import { gestion, iniciarGestion } from './gestion'
import { iniciarMi, mi } from './mi'
import { accesoSoporte, iniciarPlataforma, plataforma, publicidadPublicaDemo } from './plataforma'
import { iniciarPublico, verificacionDemo } from './publico'
import { iniciarPorteria, porteria } from './porteria'
import { iniciarUnidades, unidades } from './unidades'
import { iniciarZonasComunes, zonasComunes } from './zonas-comunes'
import { error, json, ZONA_DEMO, type Manejador } from './http'

/** Manejadores que exigen sesión, en orden; el primero que responda gana. */
const CON_SESION: Manejador[] = [cuenta, plataforma, archivos, ficha, unidades, mi, directorio, gestion, asambleas, cartera, facturacion, tesoreria, tributario, contabilidad, porteria, proteccion, zonasComunes, entidad, permisos]
/** Manejadores sin sesión (además del inicio de sesión): definir contraseña y las páginas públicas. */
const SIN_SESION: Manejador[] = [cuentaPublica, papeletaDemo, directorioPublicoDemo, publicidadPublicaDemo, verificacionDemo]

const TODOS: Permiso[] = [
  'copropiedad.datos.ver', 'roles.ver', 'roles.gestionar', 'auditoria.ver', 'archivos.ver',
  'archivos.subir', 'personas.ver', 'bienes_privados.ver', 'bienes_privados.editar',
  'titulares.ver', 'censo.ver', 'censo.editar', 'bienes_comunes.ver', 'bienes_comunes.editar',
  'reservas.crear', 'reservas.aprobar', 'reservas.ver_todas', 'parqueaderos.ver', 'sorteos.gestionar',
  'tickets.crear', 'tickets.ver_todos', 'tickets.atender', 'conversaciones.atender',
  'inventario.ver', 'inventario.editar', 'mantenimiento.planificar', 'mantenimiento.ejecutar',
  'mantenimiento.verificar', 'tickets.asignar', 'tickets.configurar', 'preguntas_frecuentes.editar',
  'comunicados.gestionar', 'asambleas.ver',
  'asambleas.convocar', 'asambleas.conducir', 'asambleas.registrar', 'asambleas.votos.registrar',
  'asambleas.votos.ver_detalle', 'acceso.registrar', 'acceso.bitacora.ver',
  'acceso.correspondencia.entregar', 'acceso.minuta.ver', 'acceso.configurar',
  'contabilidad.ver', 'contabilidad.configurar', 'contabilidad.comprobantes.crear',
  'contabilidad.comprobantes.contabilizar', 'contabilidad.comprobantes.revertir', 'contabilidad.periodos.cerrar',
  'contabilidad.periodos.reabrir', 'contabilidad.periodos.aprobar_reapertura',
  'tesoreria.configurar', 'tesoreria.egresos.autorizar', 'tesoreria.facturas_proveedor.gestionar',
  'tributario.perfil.confirmar',
  'contabilidad.exportar', 'tesoreria.recibos.registrar', 'tesoreria.egresos.registrar',
  'tesoreria.conciliar', 'cartera.ver', 'cartera.liquidar', 'cartera.certificados.emitir',
  'presupuesto.gestionar', 'cartera.ajustar', 'tributario.preparar', 'terceros.gestionar', 'facturacion.ver',
  'facturacion.facturas.gestionar', 'facturacion.emitir', 'facturacion.items.gestionar', 'facturacion.exportar',
  'facturacion.configurar', 'facturacion.certificado.gestionar', 'facturacion.recibir', 'directorio.ver', 'directorio.compartir', 'directorio.resenar',
  'importaciones.ejecutar',
  'roles.asignar', 'proteccion_datos.gestionar', 'tributario.configurar',
  'copropiedad.datos.editar', 'archivos.personales.ver', 'suscripcion.ver', 'organizaciones.crear',
  'organizaciones.vincular', 'contratos.gestionar', 'personas.datos_sensibles.ver',
  'reservas.entregas.registrar', 'reservas.cancelar_cualquiera', 'reservas.restringir',
  'parqueaderos.asignar', 'cartera.configurar',
  'agrupaciones.editar', 'titulares.editar', 'bienes_privados.coeficientes.editar',
  'bienes_privados.coeficientes.activar', 'censo.aprobar', 'censo.exportar', 'personas.editar',
]

const ENTIDADES: (EntidadDeLaCuenta & { capacidades: Capacidades })[] = [
  {
    entidad_id: '01930000-0000-7000-8000-000000000001',
    nombre: 'Conjunto Residencial Los Robles',
    nit: '900123456-7',
    tipo: 'propiedad_horizontal',
    estado: 'activa',
    roles: ['administrador'],
    capacidades: {
      tipo: 'propiedad_horizontal',
      permisos: TODOS,
      // Sin `control_acceso` (la portería se ve apagada) ni `facturacion_electronica` (sus
      // acciones propias no se ofrecen).
      modulos: ['bienes_comunes', 'asambleas', 'gestion_administrativa',
        'contabilidad', 'contabilidad_ph'],
      modo_soporte: false, entidad_suspendida: false, zona_horaria: ZONA_DEMO,
    },
  },
  {
    entidad_id: '01930000-0000-7000-8000-000000000002',
    nombre: 'Edificio Torres del Parque',
    nit: '900765432-1',
    tipo: 'propiedad_horizontal',
    estado: 'en_configuracion',
    roles: ['consejero'],
    capacidades: { tipo: 'propiedad_horizontal', permisos: ['asambleas.ver', 'censo.ver'], modulos: ['asambleas'], modo_soporte: false, entidad_suspendida: false, zona_horaria: ZONA_DEMO },
  },
  {
    entidad_id: '01930000-0000-7000-8000-000000000003',
    nombre: 'DAD Servicios Contables S.A.S.',
    nit: '901555222-3',
    tipo: 'empresa',
    estado: 'activa',
    roles: ['contador'],
    capacidades: { tipo: 'empresa', permisos: TODOS, modulos: ['contabilidad', 'facturacion_electronica'], modo_soporte: false, entidad_suspendida: false, zona_horaria: ZONA_DEMO },
  },
  {
    // Solo factura electrónica (sin contabilidad): la facturación del plan 12 sin cuentas.
    entidad_id: '01930000-0000-7000-8000-000000000004',
    nombre: 'Comercial Andina S.A.S.',
    nit: '901777888-1',
    tipo: 'empresa',
    estado: 'activa',
    roles: ['administrador'],
    capacidades: { tipo: 'empresa', permisos: TODOS, modulos: ['facturacion_electronica'], modo_soporte: false, entidad_suspendida: false, zona_horaria: ZONA_DEMO },
  },
]

/** La entidad que opera la plataforma (GISLA): oficina con el centro de operación. */
const ENTIDAD_PLATAFORMA: EntidadDeLaCuenta & { capacidades: Capacidades } = {
  entidad_id: '01930000-0000-7000-8000-000000000005',
  nombre: 'GISLA S.A.S.',
  nit: '901999000-2',
  tipo: 'plataforma',
  estado: 'activa',
  roles: ['superusuario'],
  capacidades: { tipo: 'plataforma', permisos: TODOS, modulos: ['contabilidad', 'facturacion_electronica'], modo_soporte: false, entidad_suspendida: false, zona_horaria: ZONA_DEMO },
}

/**
 * Capacidades en modo soporte: solo lectura (los permisos `….ver`), como las entrega el backend
 * durante las 2 h de acceso.
 */
function comoSoporte(c: Capacidades): Capacidades {
  return { ...c, modo_soporte: true, permisos: c.permisos.filter((p) => /\.ver(_|$)/.test(p)) }
}

let usuario = ''

function tokens(): Tokens {
  const ahora = Date.now()
  return {
    sesion_id: '01930000-0000-7000-8000-00000000aaaa',
    token_acceso: `demo-acceso-${ahora}`,
    acceso_expira_en: new Date(ahora + 30 * 60_000).toISOString(),
    token_renovacion: `demo-renovacion-${usuario}-${ahora}`,
    expira_maximo_en: new Date(ahora + 30 * 86_400_000).toISOString(),
  }
}

/**
 * Capacidades del propietario residente en la PH demo: solo autoservicio. Ve la portería
 * contratada para probar visitas y paquetes (licencia del demo: al administrador se le muestra
 * apagada).
 */
const CAPACIDADES_RESIDENTE: Capacidades = {
  tipo: 'propiedad_horizontal',
  permisos: ['reservas.crear', 'bienes_comunes.ver', 'tickets.crear', 'acceso.visitantes.autorizar', 'directorio.ver', 'directorio.resenar', 'asambleas.ver'],
  modulos: ['bienes_comunes', 'asambleas', 'gestion_administrativa', 'contabilidad', 'contabilidad_ph', 'control_acceso'],
  modo_soporte: false,
  entidad_suspendida: false,
  zona_horaria: ZONA_DEMO,
}

/**
 * Capacidades de la portería en la PH demo: todo el control de acceso (turno y configuración),
 * sin `bienes_privados.ver` ni `personas.ver`, como las plantillas vigilante y supervisor.
 */
const CAPACIDADES_PORTERIA: Capacidades = {
  tipo: 'propiedad_horizontal',
  permisos: [
    'acceso.registrar', 'acceso.correspondencia.entregar', 'acceso.minuta.ver', 'acceso.minuta.registrar',
    'acceso.bitacora.ver', 'acceso.credenciales.gestionar', 'acceso.biometria.enrolar', 'acceso.configurar',
  ],
  modulos: ['control_acceso'],
  modo_soporte: false,
  entidad_suspendida: false,
  zona_horaria: ZONA_DEMO,
}

/** Capacidades fijas por usuario demo en la primera PH (o `null` para las de la entidad). */
function capacidadesDe(u: string): Capacidades | null {
  if (u.includes('residente')) return CAPACIDADES_RESIDENTE
  if (u.includes('porteria')) return CAPACIDADES_PORTERIA
  return null
}

function entidadesDe(u: string): EntidadDeLaCuenta[] {
  if (u.includes('nuevo')) return []
  if (esDePlataforma(u)) {
    const e = ENTIDAD_PLATAFORMA
    return [{ entidad_id: e.entidad_id, nombre: e.nombre, nit: e.nit, tipo: e.tipo, estado: e.estado, roles: e.roles }]
  }
  const roles = u.includes('residente') ? ['propietario', 'residente'] : u.includes('porteria') ? ['portero'] : null
  if (roles) {
    const e = ENTIDADES[0]!
    return [{ entidad_id: e.entidad_id, nombre: e.nombre, nit: e.nit, tipo: e.tipo, estado: e.estado, roles }]
  }
  const lista = u.includes('facturador')
    ? ENTIDADES.filter((e) => e.nombre.startsWith('Comercial Andina'))
    : u.includes('empresa')
    ? ENTIDADES.filter((e) => e.nombre.startsWith('DAD Servicios'))
    : u.includes('uno')
      ? ENTIDADES.slice(0, 1)
      : ENTIDADES
  return lista.map((e) => ({
    entidad_id: e.entidad_id,
    nombre: e.nombre,
    nit: e.nit,
    tipo: e.tipo,
    estado: e.estado,
    roles: e.roles,
  }))
}

/** ¿Ya se cargaron los datos del demo? (una página pública puede abrirse sin iniciar sesión). */
let iniciado = false

/** Datos iniciales de todas las áreas para el usuario (se reinician en cada inicio de sesión). */
function iniciarDemo(u: string): void {
  iniciado = true
  iniciarCuenta(u)
  iniciarEntidad()
  iniciarUnidades()
  iniciarMi()
  iniciarPorteria(u.includes('residente'))
  iniciarGestion(u, u.includes('residente'))
  iniciarAsambleas()
  iniciarContabilidad(u)
  iniciarTesoreria(u)
  iniciarTributario(u)
  iniciarFicha(ENTIDADES)
  iniciarProteccion()
  iniciarZonasComunes()
  iniciarArchivos()
  iniciarFacturacion()
  iniciarCartera(u)
  iniciarDirectorio()
  iniciarPlataforma(u)
  iniciarPublico()
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Latencia simulada de la red (en el navegador se ven los estados de carga). */
let latencia = true

/**
 * Sin latencia simulada: las pruebas no dependen de esperas aleatorias (con 250–500 ms por
 * petición, una prueba de muchas llamadas pasaba o no según el azar).
 */
export function sinLatenciaDemo(): void {
  latencia = false
}

export async function fetchDemo(req: Request): Promise<Response> {
  if (latencia) await espera(250 + Math.random() * 250)
  const ruta = new URL(req.url).pathname.replace(/^.*\/api\/v1/, '')
  const m = req.method

  if (m === 'POST' && ruta === '/auth/sesion') {
    const p = (await req.json()) as { identificador: string; contrasena: string }
    if (!p.identificador || !p.contrasena) return error(401, 'credenciales_invalidas', 'Usuario o contraseña incorrectos.')
    usuario = p.identificador.toLowerCase()
    iniciarDemo(usuario)
    if (usuario.includes('2fa')) {
      return json({ resultado: 'segundo_factor', desafio: 'demo-desafio', desafio_expira_en: new Date(Date.now() + 300_000).toISOString() })
    }
    return json({ resultado: 'sesion', tokens: tokens(), entidades: entidadesDe(usuario) })
  }
  if (m === 'POST' && ruta === '/auth/sesion/segundo-factor') {
    const p = (await req.json()) as { codigo: string }
    if (p.codigo !== '123456') return error(401, 'credenciales_invalidas', 'El código no es válido.')
    return json({ tokens: tokens(), entidades: entidadesDe(usuario) })
  }
  if (m === 'POST' && ruta === '/auth/sesion/renovar') {
    const p = (await req.json()) as { token_renovacion: string }
    usuario = p.token_renovacion.split('-')[2] ?? ''
    iniciarDemo(usuario)
    return json(tokens())
  }
  if (m === 'POST' && ruta === '/auth/contrasena/recuperar') return new Response(null, { status: 202 })
  if (m === 'DELETE' && ruta === '/auth/sesion') return new Response(null, { status: 204 })
  if (!iniciado) iniciarDemo('')
  for (const atender of SIN_SESION) {
    const r = await atender(req, ruta)
    if (r) return r
  }

  if (!req.headers.get('Authorization')) return error(401, 'no_autenticado', 'Inicie sesión.')

  if (m === 'GET' && ruta === '/yo/entidades') return json(entidadesDe(usuario))
  const cap = ruta.match(/^\/entidades\/([^/]+)\/capacidades$/)
  if (m === 'GET' && cap) {
    if (cap[1] === ENTIDAD_PLATAFORMA.entidad_id) return json(ENTIDAD_PLATAFORMA.capacidades)
    const e = ENTIDADES.find((x) => x.entidad_id === cap[1])
    if (e && esDePlataforma(usuario)) return accesoSoporte(e.entidad_id) ? json(comoSoporte(e.capacidades)) : error(403, 'sin_permiso', 'Abra un acceso de soporte.')
    const fijas = capacidadesDe(usuario)
    if (e && fijas) return json(fijas)
    return e ? json(e.capacidades) : error(404, 'no_encontrado', 'No encontrada.')
  }
  for (const atender of CON_SESION) {
    const r = await atender(req, ruta)
    if (r) return r
  }
  return error(404, 'no_encontrado', `Demo: ${m} ${ruta} no está simulado.`)
}

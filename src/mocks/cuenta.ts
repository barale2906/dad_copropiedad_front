/** Demo de la cuenta del usuario (`/yo/…`) y de «definir contraseña». */
import type { DispositivoPush, Perfil, Permiso } from '@/api/tipos'
import { CODIGO_DEMO, cuerpo, error, json, type Manejador, sinContenido } from './http'

let perfil: Perfil | null = null
let dispositivos: DispositivoPush[] = []

/** Perfil del usuario que inició sesión en el demo. */
/**
 * Cuenta de cada usuario demo: `revisor` es otra persona (Rosa Revisora, para los cuatro ojos);
 * los demás comparten la cuenta del administrador.
 */
export const cuentaDemoId = (usuario: string) =>
  usuario.includes('revisor') ? '01930000-0000-7000-8000-00000000c002' : '01930000-0000-7000-8000-00000000c001'

/** Todos los permisos de plataforma: los tienen los usuarios demo `plataforma` y `operador`. */
export const PERMISOS_PLATAFORMA: Permiso[] = [
  'plataforma.copropiedades.crear', 'plataforma.copropiedades.ver', 'plataforma.cuentas.ver', 'plataforma.cuentas.bloquear',
  'plataforma.cuentas.crear', 'plataforma.roles.gestionar', 'plataforma.roles.asignar', 'plataforma.organizaciones.revisar',
  'plataforma.modulos.gestionar', 'plataforma.entidades.crear', 'plataforma.entidades.usuarios', 'plataforma.soporte.ver',
  'plataforma.entidad_propia.designar', 'plataforma.plantillas_contables.publicar', 'plataforma.normativa.gestionar',
  'plataforma.auditoria.ver', 'plataforma.publicidad.moderar', 'plataforma.publicidad.gestionar', 'plataforma.publicidad.liquidar',
  'plataforma.directorio.gestionar', 'plataforma.facturacion.ver', 'plataforma.comercial.gestionar', 'plataforma.cobros.aprobar',
  'plataforma.cobros.facturar', 'plataforma.whatsapp.gestionar',
]

/** Usuario demo del equipo de la plataforma: `plataforma` (con segundo factor) u `operador` (sin él). */
export const esDePlataforma = (usuario: string) => usuario.includes('plataforma') || usuario.includes('operador')

export function iniciarCuenta(usuario: string): void {
  perfil = {
    id: cuentaDemoId(usuario),
    nombre: usuario.includes('empresa') ? 'Laura Contadora' : usuario.includes('revisor') ? 'Rosa Revisora' : 'Andrés Administrador',
    usuario,
    correo: `${usuario.replace(/[^a-z0-9]/g, '') || 'demo'}@demo.dad`,
    correo_verificado: !usuario.includes('sinverificar'),
    segundo_factor_activo: usuario.includes('2fa') || usuario.includes('plataforma'),
    es_superusuario: usuario.includes('plataforma'),
    permisos_plataforma: esDePlataforma(usuario) ? PERMISOS_PLATAFORMA : [],
  }
  dispositivos = [
    {
      id: '01930000-0000-7000-8000-00000000d001',
      plataforma: 'android',
      nombre: 'Pixel 7',
      registrado_en: '2026-10-02T14:00:00Z',
    },
  ]
}

/** Sin sesión: «definir contraseña» con el código que llegó al correo. */
export const cuentaPublica: Manejador = async (req, ruta) => {
  if (req.method === 'POST' && ruta === '/auth/contrasena/restablecer') {
    const p = await cuerpo<{ codigo: string; contrasena_nueva: string }>(req)
    if (p.codigo !== CODIGO_DEMO) return error(422, 'validacion', 'El código no es válido o ya venció.')
    if (p.contrasena_nueva.length < 10) {
      return error(422, 'validacion', 'La contraseña debe tener al menos 10 caracteres.')
    }
    return sinContenido()
  }
  return null
}

export const cuenta: Manejador = async (req, ruta) => {
  if (!perfil) return null
  const m = req.method
  if (m === 'GET' && ruta === '/yo') return json(perfil)
  if (m === 'PUT' && ruta === '/yo/contrasena') {
    const p = await cuerpo<{ contrasena_actual: string; contrasena_nueva: string }>(req)
    if (p.contrasena_actual === 'mala') return error(422, 'validacion', 'La contraseña actual no es correcta.')
    if (p.contrasena_nueva.length < 10) {
      return error(422, 'validacion', 'La contraseña nueva debe tener al menos 10 caracteres.')
    }
    return sinContenido()
  }
  if (m === 'POST' && ruta === '/yo/correo/reenviar') return sinContenido(202)
  if (m === 'POST' && ruta === '/yo/correo/verificar') {
    const p = await cuerpo<{ codigo: string }>(req)
    if (p.codigo !== CODIGO_DEMO) return error(422, 'validacion', 'El código no es válido.')
    perfil = { ...perfil, correo_verificado: true }
    return sinContenido()
  }
  if (m === 'POST' && ruta === '/yo/segundo-factor') {
    const secreto = 'JBSWY3DPEHPK3PXP'
    return json({ secreto, uri: `otpauth://totp/DAD:${perfil.usuario ?? 'demo'}?secret=${secreto}&issuer=DAD` })
  }
  if (m === 'POST' && ruta === '/yo/segundo-factor/confirmar') {
    const p = await cuerpo<{ codigo: string }>(req)
    if (p.codigo !== CODIGO_DEMO) return error(422, 'validacion', 'El código no es válido.')
    perfil = { ...perfil, segundo_factor_activo: true }
    return sinContenido()
  }
  if (m === 'DELETE' && ruta === '/yo/sesiones') return json({ cerradas: 3 })
  if (m === 'GET' && ruta === '/yo/dispositivos-push') return json(dispositivos)
  const disp = ruta.match(/^\/yo\/dispositivos-push\/([^/]+)$/)
  if (m === 'DELETE' && disp) {
    dispositivos = dispositivos.filter((d) => d.id !== disp[1])
    return sinContenido()
  }
  return null
}

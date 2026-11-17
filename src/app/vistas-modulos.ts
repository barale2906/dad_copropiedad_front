/**
 * Registro de las vistas reales de los módulos (`seccion/accion`), cargadas en diferido. Una
 * acción sin vista aquí se muestra «en construcción» en el marco de módulos.
 */
import type { VistasModulo } from '@/pantallas/vistas-modulo'

export const VISTAS_MODULOS: VistasModulo = {
  'entidad/usuarios': () => import('@/modulos/entidad/vistas/UsuariosView.vue'),
  'entidad/roles': () => import('@/modulos/entidad/vistas/RolesView.vue'),
  'entidad/ficha': () => import('@/modulos/entidad/vistas/FichaView.vue'),
  'entidad/suscripcion': () => import('@/modulos/entidad/vistas/SuscripcionView.vue'),
  'entidad/auditoria': () => import('@/modulos/entidad/vistas/AuditoriaView.vue'),
  'archivo/documentos': () => import('@/modulos/archivo/vistas/DocumentosView.vue'),
}

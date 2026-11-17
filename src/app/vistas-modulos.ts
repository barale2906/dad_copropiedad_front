/**
 * Registro de las vistas reales de los módulos (`seccion/accion`), cargadas en diferido. Una
 * acción sin vista aquí se muestra «en construcción» en el marco de módulos.
 */
import type { VistasModulo } from '@/pantallas/vistas-modulo'

export const VISTAS_MODULOS: VistasModulo = {
  'entidad/usuarios': () => import('@/modulos/entidad/vistas/UsuariosView.vue'),
  'entidad/roles': () => import('@/modulos/entidad/vistas/RolesView.vue'),
}

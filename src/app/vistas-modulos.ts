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
  'entidad/proteccion-datos': () => import('@/modulos/entidad/vistas/ProteccionDatosView.vue'),
  'entidad/organizaciones': () => import('@/modulos/entidad/vistas/OrganizacionesView.vue'),
  'mi/inicio': () => import('@/modulos/mi/vistas/InicioView.vue'),
  'mi/bienes': () => import('@/modulos/mi/vistas/BienesView.vue'),
  'mi/cartera': () => import('@/modulos/mi/vistas/CarteraView.vue'),
  'mi/comunicados': () => import('@/modulos/mi/vistas/ComunicadosView.vue'),
  'mi/pqrs': () => import('@/modulos/mi/vistas/PqrsView.vue'),
  'mi/visitas': () => import('@/modulos/mi/vistas/VisitasView.vue'),
  'mi/privacidad': () => import('@/modulos/mi/vistas/PrivacidadView.vue'),
  'unidades/bienes': () => import('@/modulos/unidades/vistas/BienesView.vue'),
  'unidades/titulares': () => import('@/modulos/unidades/vistas/TitularesView.vue'),
  'unidades/censo': () => import('@/modulos/unidades/vistas/CensoView.vue'),
  'unidades/cambios-censo': () => import('@/modulos/unidades/vistas/CambiosCensoView.vue'),
  'unidades/coeficientes': () => import('@/modulos/unidades/vistas/CoeficientesView.vue'),
  'unidades/importar': () => import('@/modulos/unidades/vistas/ImportarView.vue'),
  'unidades/libros': () => import('@/modulos/unidades/vistas/LibrosView.vue'),
  'unidades/personas': () => import('@/modulos/unidades/vistas/PersonasView.vue'),
  'zonas-comunes/reservar': () => import('@/modulos/zonas-comunes/vistas/ReservarView.vue'),
  'zonas-comunes/mis-reservas': () => import('@/modulos/zonas-comunes/vistas/MisReservasView.vue'),
  'zonas-comunes/disponibilidad': () => import('@/modulos/zonas-comunes/vistas/DisponibilidadView.vue'),
  'zonas-comunes/aprobaciones': () => import('@/modulos/zonas-comunes/vistas/AprobacionesView.vue'),
  'zonas-comunes/entregas': () => import('@/modulos/zonas-comunes/vistas/EntregasView.vue'),
  'zonas-comunes/recursos': () => import('@/modulos/zonas-comunes/vistas/RecursosView.vue'),
  'zonas-comunes/restricciones': () => import('@/modulos/zonas-comunes/vistas/RestriccionesView.vue'),
  'zonas-comunes/parqueaderos': () => import('@/modulos/zonas-comunes/vistas/ParqueaderosView.vue'),
  'zonas-comunes/sorteos': () => import('@/modulos/zonas-comunes/vistas/SorteosView.vue'),
  'archivo/documentos': () => import('@/modulos/archivo/vistas/DocumentosView.vue'),
}

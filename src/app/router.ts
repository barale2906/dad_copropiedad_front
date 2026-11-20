import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { SECCIONES } from '@/escena/mapa-modulos'
import LoginView from '@/pantallas/LoginView.vue'
import SelectorEntidadView from '@/pantallas/SelectorEntidadView.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'

declare module 'vue-router' {
  interface RouteMeta {
    /** Accesible sin sesión. */
    publica?: boolean
    /** Exige entrar a la entidad de `:entidadId` (pide sus capacidades). */
    entidad?: boolean
    /** Se muestra con o sin sesión, sin redirigir (p. ej. «no encontrado»). */
    libre?: boolean
  }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/ingresar', name: 'ingresar', component: LoginView, meta: { publica: true } },
    {
      path: '/',
      name: 'inicio',
      redirect: () => {
        const { entidades } = useSesion()
        return entidades.length === 1
          ? { name: 'maqueta', params: { entidadId: entidades[0]!.entidad_id } }
          : { name: 'entidades' }
      },
    },
    {
      path: '/contrasena',
      name: 'contrasena',
      component: () => import('@/pantallas/DefinirContrasenaView.vue'),
      meta: { publica: true },
    },
    { path: '/entidades', name: 'entidades', component: SelectorEntidadView },
    { path: '/cuenta', name: 'cuenta', component: () => import('@/pantallas/cuenta/CuentaView.vue') },
    {
      path: '/e/:entidadId',
      name: 'maqueta',
      component: () => import('@/pantallas/MaquetaView.vue'),
      meta: { entidad: true },
    },
    {
      // `:id` es el detalle de un recurso dentro de la acción (p. ej. `entidad/roles/:id`).
      path: '/e/:entidadId/:seccion/:accion?/:id?',
      name: 'modulo',
      component: () => import('@/pantallas/ModuloView.vue'),
      meta: { entidad: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'no-encontrado',
      component: () => import('@/pantallas/NoEncontradoView.vue'),
      meta: { libre: true },
    },
  ],
})

/** ¿La ruta de módulo nombra una sección y una acción que existen en el mapa? */
export function existeEnElMapa(to: { name?: unknown; params: Record<string, unknown> }): boolean {
  if (to.name !== 'modulo') return true
  const seccion = SECCIONES[String(to.params.seccion)]
  const accion = String(to.params.accion ?? '')
  return !!seccion && (!accion || seccion.acciones.some((a) => a.id === accion))
}

/** Muestra «no encontrado» conservando la dirección que se pidió. */
const noEncontrado = (to: RouteLocationNormalized) => ({
  name: 'no-encontrado',
  params: { pathMatch: to.path.slice(1).split('/') },
  query: to.query,
  hash: to.hash,
})

router.beforeEach(async (to) => {
  const sesion = useSesion()
  if (sesion.estado === 'desconocido') await sesion.restaurar()

  if (to.meta.libre) return true
  if (to.meta.publica) return sesion.estado === 'autenticado' ? { name: 'inicio' } : true
  if (sesion.estado !== 'autenticado') {
    return { name: 'ingresar', query: to.fullPath !== '/' ? { volver: to.fullPath } : {} }
  }
  if (to.meta.entidad) {
    const entidad = useEntidad()
    try {
      await entidad.entrar(String(to.params.entidadId))
    } catch {
      return { name: 'entidades' }
    }
    // La consola de la plataforma se habilita con los permisos de `GET /yo` (y su segundo factor).
    if (entidad.capacidades?.tipo === 'plataforma') await useCuenta().asegurar().catch(() => undefined)
  }
  return existeEnElMapa(to) || noEncontrado(to)
})

import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/pantallas/LoginView.vue'
import SelectorEntidadView from '@/pantallas/SelectorEntidadView.vue'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'

declare module 'vue-router' {
  interface RouteMeta {
    /** Accesible sin sesión. */
    publica?: boolean
    /** Exige entrar a la entidad de `:entidadId` (pide sus capacidades). */
    entidad?: boolean
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
    { path: '/entidades', name: 'entidades', component: SelectorEntidadView },
    {
      path: '/e/:entidadId',
      name: 'maqueta',
      component: () => import('@/pantallas/MaquetaView.vue'),
      meta: { entidad: true },
    },
    {
      path: '/e/:entidadId/:seccion/:accion?',
      name: 'modulo',
      component: () => import('@/pantallas/ModuloView.vue'),
      meta: { entidad: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const sesion = useSesion()
  if (sesion.estado === 'desconocido') await sesion.restaurar()

  if (to.meta.publica) return sesion.estado === 'autenticado' ? { name: 'inicio' } : true
  if (sesion.estado !== 'autenticado') {
    return { name: 'ingresar', query: to.fullPath !== '/' ? { volver: to.fullPath } : {} }
  }
  if (to.meta.entidad) {
    try {
      await useEntidad().entrar(String(to.params.entidadId))
    } catch {
      return { name: 'entidades' }
    }
  }
  return true
})

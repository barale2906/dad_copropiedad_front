import { ref, type Ref } from 'vue'
import { type Router, START_LOCATION } from 'vue-router'

/**
 * `true` mientras una navegación tarda más de `retardo` ms (cargar un módulo diferido, entrar a
 * una entidad, restaurar la sesión). El retardo evita que la pantalla de carga parpadee en las
 * navegaciones rápidas. Si se llama antes de terminar la navegación inicial, también la cubre.
 */
export function vigilarNavegacion(router: Router, retardo = 250): Ref<boolean> {
  const cargando = ref(false)
  let temporizador: ReturnType<typeof setTimeout> | undefined

  function empezar() {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => (cargando.value = true), retardo)
  }

  function terminar() {
    clearTimeout(temporizador)
    temporizador = undefined
    cargando.value = false
  }

  if (router.currentRoute.value === START_LOCATION) empezar()
  router.beforeEach(() => empezar())
  router.afterEach(terminar)
  router.onError(terminar)
  return cargando
}

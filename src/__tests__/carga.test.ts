import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vigilarNavegacion } from '@/app/carga'

const Vacio = defineComponent({ render: () => null })

/** Router con una ruta cuyo componente diferido se resuelve cuando la prueba lo decide. */
function prepararRouter() {
  let liberar: () => void = () => {}
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Vacio },
      {
        path: '/lenta',
        component: () => new Promise<typeof Vacio>((ok) => (liberar = () => ok(Vacio))),
      },
      { path: '/rota', component: () => Promise.reject(new Error('sin red')) },
    ],
  })
  return { router, liberar: () => liberar() }
}

describe('vigilarNavegacion', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('no muestra la carga si la navegación termina antes del retardo', async () => {
    const { router } = prepararRouter()
    const cargando = vigilarNavegacion(router, 250)
    await router.push('/')
    vi.advanceTimersByTime(500)
    expect(cargando.value).toBe(false)
  })

  it('muestra la carga si la navegación tarda y la quita al terminar', async () => {
    const { router, liberar } = prepararRouter()
    await router.push('/')
    const cargando = vigilarNavegacion(router, 250)
    const navegacion = router.push('/lenta')
    await vi.advanceTimersByTimeAsync(100)
    expect(cargando.value).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(cargando.value).toBe(true)
    liberar()
    await navegacion
    expect(cargando.value).toBe(false)
  })

  it('cubre la navegación inicial si se llama antes de que termine', async () => {
    const { router } = prepararRouter()
    const cargando = vigilarNavegacion(router, 250)
    vi.advanceTimersByTime(300)
    expect(cargando.value).toBe(true)
    await router.push('/')
    expect(cargando.value).toBe(false)
  })

  it('quita la carga si la navegación falla', async () => {
    const { router } = prepararRouter()
    await router.push('/')
    const cargando = vigilarNavegacion(router, 0)
    const resultado = router.push('/rota').catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(1)
    expect(await resultado).toMatchObject({ message: 'sin red' })
    expect(cargando.value).toBe(false)
  })
})

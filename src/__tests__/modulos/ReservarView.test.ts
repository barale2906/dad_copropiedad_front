import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { limpiar } from '@/api/tokens'
import ReservarView from '@/modulos/zonas-comunes/vistas/ReservarView.vue'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { conRespuesta, prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
/** Vistas montadas: se desmontan al final de cada prueba para que su trabajo pendiente no
 * reactive el Pinia de la prueba anterior. */
const montadas: VueWrapper[] = []

async function montar(consulta: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/e/:entidadId/:seccion/:accion?/:id?', name: 'modulo', component: ReservarView }],
  })
  await router.push(`/e/${PH}/zonas-comunes/reservar${consulta}`)
  const w = mount(ReservarView, { global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } }, attachTo: document.body })
  montadas.push(w)
  await vi.waitFor(() => expect(w.text()).not.toContain('Cargando'))
  return { w, router }
}

/** Espera las franjas y el bien propio (se cargan en paralelo). */
async function listoParaReservar(w: Awaited<ReturnType<typeof montar>>['w']) {
  await vi.waitFor(() => {
    expect(w.findAll('.inicios button').length).toBeGreaterThan(1)
    expect(w.text()).toContain('Reserva a nombre de: T1-101')
  })
}

describe('ReservarView', () => {
  afterEach(async () => {
    montadas.splice(0).forEach((w) => w.unmount())
    await flushPromises()
  })

  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
    await useEntidad().entrar(PH)
  })

  it('una zona con un solo recurso lo abre directo con sus reglas', async () => {
    const { w } = await montar('?zona=piscina')
    expect(w.get('h1').text()).toBe('Reservar: Piscina')
    expect(w.text()).toContain('Reglas de uso')
    expect(w.text()).toContain('Aforo: 25 personas')
  })

  it('una zona con varios recursos muestra la lista; sin zona, todas las reservables', async () => {
    const { w, router } = await montar('?zona=salon-social')
    expect(w.findAll('.tarjeta').map((t) => t.text())).toEqual([expect.stringContaining('Salón social principal'), expect.stringContaining('Salón comunal')])
    await w.findAll('.tarjeta')[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.recurso).toBeTruthy()
  })

  it('una zona sin recursos lo dice y ofrece ver todas', async () => {
    conRespuesta('GET', /\/recursos$/, () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
    const { w } = await montar('?zona=cancha')
    expect(w.text()).toContain('Esta copropiedad no tiene cancha para reservar.')
    expect(w.text()).toContain('Ver todas las zonas')
  })

  it('reserva una franja y confirma; sin hora elegida no envía', async () => {
    const { w } = await montar('?zona=piscina')
    await listoParaReservar(w)
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Elija la hora de inicio en el calendario.')
    await w.findAll('.inicios button')[0]!.trigger('click')
    expect(w.text()).toContain('Resumen')
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('quedó confirmada'))
  })

  it('tras un rechazo por política no deja reintentar hasta cambiar algo', async () => {
    conRespuesta('POST', /\/reservas$/, () =>
      new Response(JSON.stringify({ error: { codigo: 'validacion', mensaje: 'El bien está en mora.' } }), { status: 422, headers: { 'Content-Type': 'application/json' } }),
    )
    const { w } = await montar('?zona=piscina')
    await listoParaReservar(w)
    await w.findAll('.inicios button')[0]!.trigger('click')
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('El bien está en mora.'))
    const enviar = () => w.findAll('button').find((b) => b.text().includes('Confirmar reserva'))!
    expect(enviar().attributes('disabled')).toBeDefined()
    await w.findAll('.inicios button')[1]!.trigger('click')
    expect(enviar().attributes('disabled')).toBeUndefined()
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { olvidarCredencial } from '@/api/credencial-externa'
import { limpiar } from '@/api/tokens'
import EnlaceNoValido from '@/pantallas/publicas/EnlaceNoValido.vue'
import MarcoPublico from '@/pantallas/publicas/MarcoPublico.vue'
import PapeletaView from '@/pantallas/publicas/PapeletaView.vue'
import VerificarView from '@/pantallas/publicas/VerificarView.vue'
import { prepararConDemo } from './ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

async function montar(componente: typeof PapeletaView | typeof VerificarView, ruta: string, hash = '') {
  window.history.replaceState(null, '', `${ruta}${hash}`)
  const vacia = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/papeleta/:copropiedadId', component: vacia },
      { path: '/verificar/:copropiedadId', component: vacia },
    ],
  })
  await router.push(ruta)
  const w = mount(componente, { global: { plugins: [router] }, attachTo: document.body })
  await vi.waitFor(async () => {
    await flushPromises()
    expect(w.text()).not.toContain('Cargando')
  })
  return w
}

describe('marco y aviso de las páginas públicas', () => {
  it('el marco muestra la marca, el título y el contenido', () => {
    const w = mount(MarcoPublico, { props: { titulo: 'Papeleta', subtitulo: 'De Ana' }, slots: { default: '<p>hola</p>' } })
    expect(w.get('h1').text()).toBe('Papeleta')
    expect(w.text()).toContain('De Ana')
    expect(w.find('main').text()).toContain('hola')
  })

  it('el enlace no válido dice a quién pedir otro', () => {
    const w = mount(EnlaceNoValido, { props: { quien: 'a la administración' } })
    expect(w.get('[role="alert"]').text()).toBe('Este enlace ya no es válido.')
    expect(w.text()).toContain('Pida uno nuevo a la administración.')
  })
})

describe('PapeletaView', () => {
  beforeEach(() => {
    limpiar(false)
    prepararConDemo()
    olvidarCredencial('papeleta')
  })

  it('sin token avisa que el enlace no es válido', async () => {
    const w = await montar(PapeletaView, `/papeleta/${PH}`)
    expect(w.text()).toContain('Este enlace ya no es válido.')
    w.unmount()
  })

  it('vota una pregunta y confirma por qué bienes; el token sale de la barra', async () => {
    const w = await montar(PapeletaView, `/papeleta/${PH}`, `#t=demo-papeleta-${vid(4409)}`)
    expect(window.location.hash).toBe('')
    expect(w.text()).toContain('¿Aprueba los estados financieros de 2026?')
    const votar = () => w.findAll('button').find((b) => b.text() === 'Votar')!
    expect(votar().attributes('disabled')).toBeDefined()
    await w.findAll('input[type="radio"]')[0]!.setValue(true)
    await w.get('form').trigger('submit')
    await vi.waitFor(async () => {
      await flushPromises()
      expect(w.text()).toContain('Su voto quedó registrado por')
    })
    w.unmount()
  })

  it('el ausente de una asamblea mixta registra su ingreso', async () => {
    const w = await montar(PapeletaView, `/papeleta/${PH}`, `#t=demo-papeleta-${vid(4303)}`)
    expect(w.text()).toContain('Entrar a la videollamada')
    await w.findAll('button').find((b) => b.text() === 'Registrar mi ingreso')!.trigger('click')
    await vi.waitFor(async () => {
      await flushPromises()
      expect(w.text()).toContain('Salir de la asamblea')
    })
    w.unmount()
  })
})

describe('VerificarView', () => {
  beforeEach(() => {
    limpiar(false)
    prepararConDemo()
  })

  it('dice si el código corresponde a un certificado', async () => {
    const w = await montar(VerificarView, `/verificar/${PH}`)
    await w.get('input').setValue('PYS-7Q4K-2M9D')
    await w.get('form').trigger('submit')
    await vi.waitFor(async () => {
      await flushPromises()
      expect(w.text()).toContain('Paz y salvo válido')
    })
    await w.get('input').setValue('NADA')
    await w.get('form').trigger('submit')
    await vi.waitFor(async () => {
      await flushPromises()
      expect(w.text()).toContain('no corresponde a ningún certificado')
    })
    w.unmount()
  })
})

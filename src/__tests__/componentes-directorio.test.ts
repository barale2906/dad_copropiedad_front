import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { FichaDirectorio } from '@/api/tipos'
import CalificacionEstrellas from '@/hud/componentes/CalificacionEstrellas.vue'
import ElegirCalificacion from '@/hud/componentes/ElegirCalificacion.vue'
import HiloMensajes from '@/hud/componentes/HiloMensajes.vue'
import TarjetaAnunciante from '@/hud/componentes/TarjetaAnunciante.vue'

const ficha = (extra: Partial<FichaDirectorio> = {}): FichaDirectorio => ({
  anunciante_id: 'a1', nombre_comercial: 'Modistería Rosa', descripcion: 'Arreglos de ropa', categorias: ['costura'],
  contacto: { whatsapp: '573001234567', telefono: '6015551234' }, destacada: false, resenas: 12,
  calificacion_promedio: '4.5', distancia_km: '0.35', ...extra,
})

describe('CalificacionEstrellas', () => {
  it('se anuncia como «4,5 de 5» con las reseñas y dibuja media estrella', () => {
    const w = mount(CalificacionEstrellas, { props: { valor: '4.5', resenas: 12 } })
    expect(w.attributes('aria-label')).toBe('Calificación 4,5 de 5, 12 reseñas')
    expect(w.findAll('.estrellas svg')).toHaveLength(5)
    expect(w.findAll('.estrellas .vacia')).toHaveLength(0)
  })

  it('una calificación entera, en singular, y sin promedio dice «Sin reseñas»', () => {
    expect(mount(CalificacionEstrellas, { props: { valor: 3, resenas: 1 } }).attributes('aria-label')).toBe('Calificación 3,0 de 5, 1 reseña')
    expect(mount(CalificacionEstrellas, { props: { valor: 2 } }).findAll('.vacia')).toHaveLength(3)
    const sin = mount(CalificacionEstrellas, { props: { valor: null, resenas: 0 } })
    expect(sin.attributes('aria-label')).toBe('Sin reseñas')
    expect(sin.text()).toContain('Sin reseñas')
  })
})

describe('ElegirCalificacion', () => {
  it('son cinco radios con nombre accesible y emite la elegida', async () => {
    const w = mount(ElegirCalificacion, { props: { modelValue: 0, etiqueta: '¿Cómo le fue?' } })
    expect(w.get('legend').text()).toBe('¿Cómo le fue?')
    const radios = w.findAll('input[type="radio"]')
    expect(radios).toHaveLength(5)
    expect(w.text()).toContain('4 estrellas: Buena')
    await radios[3]!.setValue(true)
    expect(w.emitted('update:modelValue')?.[0]).toEqual([4])
  })

  it('muestra el error y marca el grupo', () => {
    const w = mount(ElegirCalificacion, { props: { modelValue: 2, error: 'Elija de 1 a 5 estrellas.' } })
    expect(w.get('fieldset').attributes('aria-invalid')).toBe('true')
    expect(w.text()).toContain('Elija de 1 a 5 estrellas.')
    expect(w.findAll('label.activa')).toHaveLength(2)
  })
})

describe('TarjetaAnunciante', () => {
  const global = { stubs: { RouterLink: RouterLinkStub } }

  it('enlaza la ficha y ofrece solo los contactos válidos', async () => {
    const w = mount(TarjetaAnunciante, {
      props: { ficha: ficha({ contacto: { whatsapp: '573001234567', sitio_web: 'javascript:alert(1)', correo: 'no' } }), categoria: 'Costura', a: { name: 'x' } },
      global,
    })
    expect(w.findComponent(RouterLinkStub).props('to')).toEqual({ name: 'x' })
    expect(w.text()).toContain('Costura')
    expect(w.text()).toContain('a 350 m')
    const enlaces = w.findAll('.contacto a')
    expect(enlaces).toHaveLength(1)
    expect(enlaces[0]!.attributes('href')).toBe('https://wa.me/573001234567')
    expect(enlaces[0]!.attributes('rel')).toBe('noopener noreferrer')
    await enlaces[0]!.trigger('click')
    expect(w.emitted('contacto')?.[0]).toEqual(['whatsapp'])
  })

  it('destacada lleva insignia; la ficha completa es h1 con horario y dirección', () => {
    const w = mount(TarjetaAnunciante, {
      props: { ficha: ficha({ destacada: true, horario: 'Lunes a sábado', direccion: 'Calle 45' }), nivel: 1, completa: true },
      global,
    })
    expect(w.get('h1').text()).toBe('Modistería Rosa')
    expect(w.text()).toContain('Destacada')
    expect(w.text()).toContain('Lunes a sábado')
    expect(w.text()).toContain('Calle 45')
    expect(w.findComponent(RouterLinkStub).exists()).toBe(false)
  })

  it('sin contacto válido no dibuja la lista', () => {
    const w = mount(TarjetaAnunciante, { props: { ficha: ficha({ contacto: {} }) }, global })
    expect(w.find('.contacto').exists()).toBe(false)
    expect(w.find('h3').exists()).toBe(true)
  })
})

describe('HiloMensajes con pie', () => {
  it('el slot pie recibe cada mensaje', () => {
    const w = mount(HiloMensajes, {
      props: { mensajes: [{ id: 'm1', texto: 'Hola', autor: 'Vecino', hora: 'hoy' }] },
      slots: { pie: '<template #pie="{ mensaje }"><button>Reportar {{ mensaje.id }}</button></template>' },
    })
    expect(w.get('.pie button').text()).toBe('Reportar m1')
  })
})

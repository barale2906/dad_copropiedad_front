import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { DatosCopropiedad } from '@/api/tipos'
import FormularioFicha from '@/modulos/entidad/componentes/FormularioFicha.vue'
import { aValores, type ValoresFicha } from '@/modulos/entidad/ficha'

const VALORES = aValores({
  nombre: 'Los Robles', tipo: 'residencial', forma: 'conjunto', zona_horaria: 'America/Bogota',
  estado: 'activa', plantilla_codigo: '{numero}',
} as DatosCopropiedad)

async function abrir(propiedadHorizontal: boolean, extra: Record<string, unknown> = {}) {
  const w = mount(FormularioFicha, {
    props: { valores: VALORES, propiedadHorizontal, abierto: false, ...extra },
    attachTo: document.body,
  })
  await w.setProps({ abierto: true })
  return w
}

const campo = (w: Awaited<ReturnType<typeof abrir>>, etiqueta: string) =>
  w.findAll('label').find((l) => l.text() === etiqueta)!.attributes('for')

describe('FormularioFicha', () => {
  it('en la PH muestra los datos legales; en la empresa no', async () => {
    const ph = await abrir(true)
    expect(ph.text()).toContain('Datos de la propiedad horizontal')
    ph.unmount()
    const empresa = await abrir(false)
    expect(empresa.text()).not.toContain('Datos de la propiedad horizontal')
    empresa.unmount()
  })

  it('no envía con errores y los muestra junto al campo', async () => {
    const w = await abrir(true)
    await w.get(`#${campo(w, 'Nombre')}`).setValue(' ')
    await w.get(`#${campo(w, 'Estrato')}`).setValue('8')
    await w.get('form').trigger('submit')
    expect(w.emitted('enviar')).toBeUndefined()
    expect(w.text()).toContain('Escriba el nombre.')
    expect(w.text()).toContain('El estrato va de 1 a 6.')
    w.unmount()
  })

  it('emite los valores editados', async () => {
    const w = await abrir(false)
    await w.get(`#${campo(w, 'Teléfono')}`).setValue('601 555 0101')
    await w.get('form').trigger('submit')
    expect(w.emitted<[ValoresFicha]>('enviar')![0]![0].telefono).toBe('601 555 0101')
    w.unmount()
  })

  it('muestra el error del backend', async () => {
    const w = await abrir(false, { error: 'El NIT no es válido.' })
    expect(w.text()).toContain('El NIT no es válido.')
    w.unmount()
  })
})

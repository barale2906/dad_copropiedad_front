import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useAdjuntos } from '@/composables/useAdjuntos'
import HiloMensajes from '@/hud/componentes/HiloMensajes.vue'
import SelectorAudiencia, { type AudienciaHud } from '@/hud/componentes/SelectorAudiencia.vue'
import SemaforoVencimiento from '@/hud/componentes/SemaforoVencimiento.vue'

vi.mock('@/api/archivos', async () => {
  const { ErrorApi } = await import('@/api/errores')
  return {
    subirArchivo: vi.fn(async (_e: string, f: File) => {
      if (f.name === 'malo.exe') throw new ErrorApi(422, 'validacion', 'Tipo no permitido')
      return { id: `id-${f.name}`, nombre: f.name }
    }),
    abrirArchivo: vi.fn(async () => undefined),
  }
})

afterEach(() => vi.clearAllMocks())

describe('HiloMensajes', () => {
  it('marca las notas internas con texto, no solo con color', () => {
    const w = mount(HiloMensajes, {
      props: {
        mensajes: [
          { id: '1', texto: 'Hola', autor: 'Solicitante', hora: '9:00' },
          { id: '2', texto: 'Llamar al contratista', autor: 'Usted', hora: '9:05', propio: true, interno: true },
        ],
      },
    })
    const items = w.findAll('li')
    expect(items[0]!.classes()).not.toContain('interno')
    expect(items[1]!.classes()).toEqual(expect.arrayContaining(['propio', 'interno']))
    expect(items[1]!.text()).toContain('Nota interna')
    expect(items[0]!.text()).not.toContain('Nota interna')
  })

  it('sin mensajes muestra el texto de vacío', () => {
    expect(mount(HiloMensajes, { props: { mensajes: [], vacio: 'Nada aún.' } }).text()).toBe('Nada aún.')
  })
})

describe('SemaforoVencimiento', () => {
  it('muestra el tono y el texto del plazo', () => {
    const ahora = new Date('2026-11-17T12:00:00Z')
    const w = mount(SemaforoVencimiento, { props: { venceEn: '2026-11-17T10:00:00Z', ahora } })
    expect(w.text()).toBe('Vencido hace 2 h')
    expect(w.find('.peligro').exists()).toBe(true)
  })
})

describe('SelectorAudiencia', () => {
  const montar = (inicial: AudienciaHud, extra: Record<string, unknown> = {}) =>
    mount(SelectorAudiencia, {
      props: {
        modelValue: inicial,
        'onUpdate:modelValue': (v: AudienciaHud) => w.setProps({ modelValue: v }),
        agrupaciones: [{ id: 't1', nombre: 'Torre 1' }, { id: 't2', nombre: 'Torre 2' }],
        ...extra,
      },
    })
  let w: ReturnType<typeof montar>

  it('solo ofrece las listas que tiene y reinicia los elegidos al cambiar de tipo', async () => {
    w = montar({ tipo: 'todos', ids: [] })
    const opciones = w.findAll('option').map((o) => o.text())
    expect(opciones).toContain('Torres o etapas')
    expect(opciones).not.toContain('Roles')
    expect(opciones).not.toContain('Bienes privados')
    await w.get('select').setValue('agrupaciones')
    expect(w.props('modelValue')).toEqual({ tipo: 'agrupaciones', ids: [] })
    const casillas = w.findAll('input[type="checkbox"]')
    await casillas[1]!.setValue(true)
    expect(w.props('modelValue')).toEqual({ tipo: 'agrupaciones', ids: ['t2'] })
    await casillas[1]!.setValue(false)
    expect(w.props('modelValue')!.ids).toEqual([])
  })

  it('agrega bienes buscados como chips y los quita', async () => {
    const buscar = vi.fn().mockResolvedValue([{ id: 'b1', codigo: 'T1-101' }])
    w = montar({ tipo: 'bienes', ids: [] }, { buscarBien: buscar })
    vi.useFakeTimers()
    await w.get('input[type="search"]').setValue('T1')
    vi.advanceTimersByTime(400)
    vi.useRealTimers()
    await flushPromises()
    await w.get('ul[aria-label="Bienes encontrados"] button').trigger('click')
    expect(w.props('modelValue')).toEqual({ tipo: 'bienes', ids: ['b1'] })
    expect(w.get('ul[aria-label="Bienes elegidos"]').text()).toContain('T1-101')
    await w.get('ul[aria-label="Bienes elegidos"] button').trigger('click')
    expect(w.props('modelValue')!.ids).toEqual([])
  })

  it('muestra el error de la audiencia', () => {
    w = montar({ tipo: 'agrupaciones', ids: [] }, { error: 'Elija al menos uno.' })
    expect(w.get('[role="alert"]').text()).toBe('Elija al menos uno.')
  })
})

describe('useAdjuntos', () => {
  it('sube uno a uno, conserva los buenos si uno falla y limpia', async () => {
    const { subirArchivo } = await import('@/api/archivos')
    const a = useAdjuntos(ref('e1'), 'personal')
    await a.subir([new File(['x'], 'foto.png'), new File(['y'], 'malo.exe')])
    expect(subirArchivo).toHaveBeenCalledWith('e1', expect.any(File), 'personal')
    expect(a.ids()).toEqual(['id-foto.png'])
    expect(a.error.value).toBe('Tipo no permitido')
    expect(a.subiendo.value).toBe(false)
    a.quitar('id-foto.png')
    expect(a.ids()).toEqual([])
    a.limpiar()
    expect(a.error.value).toBeNull()
  })

  it('abrir usa el enlace firmado y deja el error si falla', async () => {
    const archivos = await import('@/api/archivos')
    const { ErrorApi } = await import('@/api/errores')
    const a = useAdjuntos(() => 'e1')
    await a.abrir('arch-1')
    expect(archivos.abrirArchivo).toHaveBeenCalledWith('e1', 'arch-1')
    vi.mocked(archivos.abrirArchivo).mockRejectedValueOnce(new ErrorApi(410, 'no_encontrado', 'El enlace venció.'))
    await a.abrir('arch-2')
    expect(a.error.value).toBe('El enlace venció.')
  })
})

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Permiso } from '@/api/tipos'
import MatrizPermisos from '@/hud/componentes/MatrizPermisos.vue'
import type { GrupoPermisos } from '@/formato/permisos'

const GRUPOS: GrupoPermisos[] = [
  {
    nombre: 'Cartera',
    permisos: [
      { codigo: 'cartera.ver', etiqueta: 'Ver la cartera' },
      { codigo: 'cartera.liquidar', etiqueta: 'Liquidar cuotas e intereses' },
      { codigo: 'cartera.ajustar', etiqueta: 'Hacer ajustes de cartera' },
    ],
  },
  { nombre: 'Asambleas', permisos: [{ codigo: 'asambleas.ver', etiqueta: 'Ver asambleas' }] },
]

function montar(elegidos: Permiso[], props: Record<string, unknown> = {}) {
  return mount(MatrizPermisos, {
    props: {
      grupos: GRUPOS,
      modelValue: elegidos,
      'onUpdate:modelValue': (v: Permiso[]) => w.setProps({ modelValue: v }),
      ...props,
    },
  })
}
let w: ReturnType<typeof montar>

const casilla = (texto: string) => w.findAll('label').find((l) => l.text().includes(texto))!.get('input')
const ultimo = () => w.emitted<[Permiso[]]>('update:modelValue')!.at(-1)![0]

describe('MatrizPermisos', () => {
  it('cuenta los elegidos por grupo y en total', () => {
    w = montar(['cartera.ver'])
    expect(w.text()).toContain('1 de 4 permisos')
    expect(w.findAll('summary')[0]!.text()).toContain('1 de 3')
  })

  it('marca y desmarca un permiso', async () => {
    w = montar([])
    await casilla('Ver asambleas').setValue(true)
    expect(ultimo()).toEqual(['asambleas.ver'])
    await casilla('Ver asambleas').setValue(false)
    expect(ultimo()).toEqual([])
  })

  it('marca el grupo completo, sin los que la cuenta no puede otorgar', async () => {
    w = montar(['cartera.ver'], { puedeOtorgar: (p: Permiso) => p !== 'cartera.ajustar' })
    const todos = casilla('Todos los de Cartera')
    expect((todos.element as HTMLInputElement).indeterminate).toBe(true)
    await todos.setValue(true)
    expect([...ultimo()].sort()).toEqual(['cartera.liquidar', 'cartera.ver'])
    await casilla('Todos los de Cartera').setValue(false)
    expect(ultimo()).toEqual([])
  })

  it('un permiso que la cuenta no tiene no se marca, pero sí se puede quitar', async () => {
    w = montar([], { puedeOtorgar: () => false })
    expect(casilla('Ver la cartera').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('no puede otorgarlo')
    w = montar(['cartera.ver'], { puedeOtorgar: () => false })
    expect(casilla('Ver la cartera').attributes('disabled')).toBeUndefined()
    await casilla('Ver la cartera').setValue(false)
    expect(ultimo()).toEqual([])
  })

  it('filtra por texto o por código y avisa si nada coincide', async () => {
    w = montar([])
    await w.get('input[type="search"]').setValue('ajust')
    expect(w.text()).toContain('Hacer ajustes de cartera')
    expect(w.text()).not.toContain('Ver asambleas')
    await w.get('input[type="search"]').setValue('asambleas.ver')
    expect(w.text()).toContain('Ver asambleas')
    await w.get('input[type="search"]').setValue('zzz')
    expect(w.text()).toContain('Ningún permiso coincide')
  })

  it('en solo lectura no permite cambios ni ofrece «todos»', () => {
    w = montar(['cartera.ver'], { soloLectura: true })
    expect(w.findAll('fieldset').every((f) => f.attributes('disabled') !== undefined)).toBe(true)
    expect(w.text()).not.toContain('Todos los de')
    expect(w.text()).not.toContain('no puede otorgarlo')
  })
})

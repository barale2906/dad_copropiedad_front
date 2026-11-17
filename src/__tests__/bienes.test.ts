import { beforeEach, describe, expect, it } from 'vitest'
import { limpiar } from '@/api/tokens'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { conCapacidades, ENTIDAD_PH, prepararConDemo } from './ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const ids = [7002, 7003, 7004, 7005].map((n) => `01930000-0000-7000-8000-00000000${n}`)

describe('useBienes', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
    await useEntidad().entrar(PH)
  })

  it('carga los propios una vez y recuerda sus códigos', async () => {
    const b = useBienes()
    const [propio] = await b.asegurarPropios()
    expect(b.codigo(propio!.id)).toBe('T1-101')
    expect(await b.asegurarPropios()).toBe(b.propios)
  })

  it('busca por código y recuerda lo encontrado', async () => {
    const b = useBienes()
    const { datos } = await b.buscar('t2-30')
    expect(datos.map((x) => x.codigo)).toEqual(['T2-301', 'T2-302', 'T2-303', 'T2-304'])
    expect(b.codigo(datos[0]!.id)).toBe('T2-301')
  })

  it('resuelve varios en paralelo sin perder ninguno; los desconocidos quedan como «Bien»', async () => {
    const b = useBienes()
    await b.resolver([...ids, 'no-existe', ''])
    expect(ids.map((x) => b.codigo(x))).toEqual(['T1-102', 'T1-201', 'T2-301', 'T2-302'])
    expect(b.codigo('no-existe')).toBe('Bien')
  })

  it('sin permiso para ver bienes no los consulta', async () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] }, { ...ENTIDAD_PH, entidad_id: PH })
    const b = useBienes()
    await b.resolver(ids)
    expect(b.codigo(ids[0]!)).toBe('Bien')
  })

  it('al cambiar de entidad olvida lo de la anterior', async () => {
    const b = useBienes()
    b.recordar([{ id: 'x', codigo: 'A-1' }])
    expect(b.codigo('x')).toBe('A-1')
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] }, { ...ENTIDAD_PH, entidad_id: 'otra' })
    expect(b.codigo('x')).toBe('Bien')
    b.recordar([])
    expect(b.codigo('x')).toBe('Bien')
  })
})

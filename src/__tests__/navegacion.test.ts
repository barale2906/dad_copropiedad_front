import { beforeEach, describe, expect, it } from 'vitest'
import { useNavegacion } from '@/pantallas/navegacion'
import { useCuenta } from '@/stores/cuenta'
import { conCapacidades, ENTIDAD_PH, prepararConDemo } from './ayudantes'

describe('useNavegacion', () => {
  beforeEach(() => prepararConDemo())

  it('elige la plantilla según el tipo de entidad', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    expect(useNavegacion().plantilla.value).toBe('conjunto')
    conCapacidades({ tipo: 'empresa', modulos: [], permisos: [] }, { ...ENTIDAD_PH, tipo: 'empresa' })
    expect(useNavegacion().plantilla.value).toBe('oficina')
  })

  it('calcula el estado de cada zona', () => {
    conCapacidades({
      tipo: 'propiedad_horizontal',
      modulos: ['control_acceso'],
      permisos: ['acceso.registrar', 'censo.ver'],
    })
    const e = useNavegacion().estadosZonas.value
    expect(e.porteria).toBe('activa')
    expect(e.torres).toBe('activa')
    expect(e.piscina).toBe('no_contratada')
    // Administración incluye «Datos y usuarios» (sin módulo) pero sin permisos para verla.
    expect(e.administracion).toBe('sin_acceso')
  })

  it('arma rutas de módulo y de regreso a la maqueta', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    const nav = useNavegacion()
    const salon = nav.zonas.value.find((z) => z.id === 'salon-social')
    // El parámetro `zona` solo aplica a zonas comunes.
    expect(nav.rutaAccion('asambleas', 'reuniones', salon)).toMatchObject({
      query: { origen: 'salon-social' },
    })
    expect(nav.rutaAccion('asambleas', 'reuniones', salon)).not.toHaveProperty('query.zona')
    expect(nav.rutaMaqueta('piscina')).toEqual({
      name: 'maqueta',
      params: { entidadId: ENTIDAD_PH.entidad_id },
      query: { zona: 'piscina' },
    })
    expect(nav.rutaMaqueta()).toMatchObject({ query: { ver: 'maqueta' } })
  })


  it('la plataforma usa la oficina con el centro de operación', () => {
    conCapacidades({ tipo: 'plataforma', modulos: [], permisos: [] }, { ...ENTIDAD_PH, tipo: 'plataforma' })
    const nav = useNavegacion()
    expect(nav.plantilla.value).toBe('plataforma')
    expect(nav.zonas.value.map((z) => z.id)).toContain('centro-operacion')
  })

  it('el centro de operación se habilita con los permisos de plataforma de la cuenta y su segundo factor', () => {
    conCapacidades({ tipo: 'plataforma', modulos: [], permisos: [] }, { ...ENTIDAD_PH, tipo: 'plataforma' })
    const cuenta = useCuenta()
    const nav = useNavegacion()
    expect(nav.estadosZonas.value['centro-operacion']).toBe('sin_acceso')
    expect(nav.sinSegundoFactor('plataforma')).toBe(false)
    cuenta.perfil = { id: 'c', nombre: 'Ana', correo_verificado: true, segundo_factor_activo: false, es_superusuario: false, permisos_plataforma: ['plataforma.copropiedades.ver'] }
    expect(nav.estadosZonas.value['centro-operacion']).toBe('sin_acceso')
    expect(nav.sinSegundoFactor('plataforma')).toBe(true)
    cuenta.perfil = { ...cuenta.perfil, segundo_factor_activo: true }
    expect(nav.estadosZonas.value['centro-operacion']).toBe('activa')
    expect(nav.vistaSeccion('plataforma')!.acciones.map((a) => a.id)).toEqual(['clientes'])
  })

  it('la empresa no tiene centro de operación aunque la cuenta tenga permisos de plataforma', () => {
    conCapacidades({ tipo: 'empresa', modulos: [], permisos: [] }, { ...ENTIDAD_PH, tipo: 'empresa' })
    useCuenta().perfil = { id: 'c', nombre: 'Ana', correo_verificado: true, segundo_factor_activo: true, es_superusuario: true, permisos_plataforma: ['plataforma.copropiedades.ver'] }
    const nav = useNavegacion()
    expect(nav.zonas.value.some((z) => z.id === 'centro-operacion')).toBe(false)
    expect(nav.vistaSeccion('plataforma')!.estado).toBe('sin_acceso')
  })

  it('en la empresa el directorio no ofrece las acciones propias de la PH', () => {
    const permisos = ['directorio.ver', 'directorio.compartir'] as const
    conCapacidades({ tipo: 'empresa', modulos: [], permisos: [...permisos] }, { ...ENTIDAD_PH, tipo: 'empresa' })
    expect(useNavegacion().vistaSeccion('directorio')!.acciones.map((a) => a.id)).toEqual(['inicio', 'ofertas'])
    expect(useNavegacion().estadosZonas.value.recepcion).toBe('activa')

    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [...permisos] })
    expect(useNavegacion().vistaSeccion('directorio')!.acciones.map((a) => a.id)).toContain('enlace')
  })

  it('una sección desconocida no tiene vista', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    expect(useNavegacion().vistaSeccion('no-existe')).toBeNull()
    expect(useNavegacion().estadoDeAccion('no-existe', '')).toBeNull()
    expect(useNavegacion().estadoDeAccion('unidades', 'importar')).toBe('sin_acceso')
  })

  it('lista las secciones de la plantilla sin repetir', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    const slugs = useNavegacion().secciones.value.map((s) => s.seccion.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toContain('zonas-comunes')
  })
})

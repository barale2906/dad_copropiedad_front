import { beforeEach, describe, expect, it } from 'vitest'
import { crearTercero, guardarDatosFiscales } from '@/api/terceros'
import { limpiar } from '@/api/tokens'
import { useBuscarTerceros } from '@/composables/useBuscarTerceros'
import { digitoVerificacion, documentoLegible } from '@/formato/tributario'
import { fechaDemo } from '@/mocks/http'
import * as a from '@/modulos/tributario/api'
import { aCsv, avisosPerfil, estadoResolucion, leerCodigos, parametrosVacios, problemaResolucion } from '@/modulos/tributario/reglas'
import { useEntidad } from '@/stores/entidad'
import { usePerfilTributario } from '@/stores/perfil-tributario'
import { useSesion } from '@/stores/sesion'
import { useTercerosConocidos } from '@/stores/terceros'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const EMPRESA = '01930000-0000-7000-8000-000000000003'
const hoy = '2026-11-18'

describe('reglas tributarias', () => {
  it('dígito de verificación del NIT y documento legible', () => {
    expect(digitoVerificacion('800197268')).toBe(4)
    expect(digitoVerificacion('900.123.456')).toBe(8)
    expect(digitoVerificacion('ABC')).toBeNull()
    expect(documentoLegible('900123456', 'NIT')).toBe('900.123.456-8')
    expect(documentoLegible('79876543', 'CC')).toBe('79.876.543')
    expect(documentoLegible(null)).toBe('Sin documento')
  })

  it('lee códigos DANE y CIIU y avisa incoherencias del perfil', () => {
    expect(leerCodigos('11001, 05001;11001 abc', 5)).toEqual({ codigos: ['11001', '05001'], invalidos: ['abc'] })
    expect(avisosPerfil(parametrosVacios())).toEqual([])
    expect(avisosPerfil({ ...parametrosVacios(), gran_contribuyente: true, autorretenedor: true, canal_facturacion: 'propio', municipios_ica: ['11001'] })).toEqual([
      'Gran contribuyente: marque la responsabilidad O-13.',
      'Autorretenedor: marque la responsabilidad O-15.',
      'Para facturar electrónicamente marque «Facturador electrónico».',
      'Indique las actividades CIIU con las que declara ICA.',
    ])
  })

  it('estado de una resolución a hoy y validación de una nueva', () => {
    const r = { activa: true, vigente_desde: '2026-01-01', vigente_hasta: '2027-12-31' }
    expect(estadoResolucion(r, hoy)).toBe('activa')
    expect(estadoResolucion({ ...r, vigente_hasta: '2026-12-01' }, hoy)).toBe('por_vencer')
    expect(estadoResolucion({ ...r, vigente_hasta: '2026-11-01' }, hoy)).toBe('vencida')
    expect(estadoResolucion({ ...r, vigente_desde: '2026-12-01' }, hoy)).toBe('futura')
    expect(estadoResolucion({ ...r, activa: false }, hoy)).toBe('inactiva')
    const nueva = { tipo: 'factura' as const, prefijo: 'FE', desde: 1, hasta: 100, numero_resolucion: '1876', fecha_resolucion: hoy, vigente_desde: hoy, vigente_hasta: '2027-11-18' }
    expect(problemaResolucion(nueva)).toBeNull()
    expect(problemaResolucion({ ...nueva, prefijo: 'fe-1' })).toContain('prefijo')
    expect(problemaResolucion({ ...nueva, hasta: 1 })).toContain('rango')
    expect(problemaResolucion({ ...nueva, vigente_hasta: hoy })).toContain('vigencia')
    expect(problemaResolucion({ ...nueva, numero_resolucion: ' ' })).toContain('número')
    expect(aCsv([['a', 'b;c'], [1, 'd"e']])).toBe('a;"b;c"\n1;"d""e"')
  })
})

describe('tributario contra el demo', { timeout: 25_000 }, () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('terceros: crear (reutiliza el documento), datos fiscales y búsqueda que recuerda nombres', async () => {
    const t = await crearTercero(PH, { tipo: 'juridica', nombre: 'Jardines S.A.S.', tipo_documento: 'NIT', documento: '901222333' }, 't1')
    expect(t.nombre).toBe('Jardines S.A.S.')
    expect((await crearTercero(PH, { tipo: 'juridica', nombre: 'Otro nombre', documento: '901222333' }, 't2')).persona_id).toBe(t.persona_id)
    await expect(crearTercero(PH, { tipo: 'natural', nombre: '', documento: '1' }, 't3')).rejects.toMatchObject({ estado: 422 })
    await expect(guardarDatosFiscales(PH, t.persona_id, { correo_facturacion: 'no-es-correo' })).rejects.toMatchObject({ estado: 422 })
    expect((await guardarDatosFiscales(PH, t.persona_id, { regimen_iva: 'responsable', correo_facturacion: 'fe@jardines.co' })).regimen_iva).toBe('responsable')
    expect((await a.terceros(PH, undefined, 'jardines')).datos[0]?.fiscal.correo_facturacion).toBe('fe@jardines.co')
    const { buscar, crear } = useBuscarTerceros(PH)
    const [o] = await buscar('vigilancia')
    expect(o).toMatchObject({ nombre: 'Vigilancia Andina S.A.S.', detalle: 'NIT 900.111.222-1' })
    expect(useTercerosConocidos().nombre(o!.id)).toBe('Vigilancia Andina S.A.S.')
    expect((await crear({ tipo: 'natural', nombre: 'Ana Ruiz', tipo_documento: 'CC', documento: '52000111' })).detalle).toBe('CC 52.000.111')
  })

  it('perfil: vigente y borrador; confirmar una versión nueva; la empresa no tiene perfil', async () => {
    const perfil = usePerfilTributario()
    await perfil.asegurar()
    expect(perfil.vigente?.version).toBe(1)
    expect(perfil.borrador?.version).toBe(2)
    expect(perfil.sinConfirmar).toBe(false)
    await expect(a.crearPerfil(PH, { vigente_desde: hoy, parametros: { ...parametrosVacios(), gran_contribuyente: true } })).rejects.toMatchObject({ estado: 422 })
    const v3 = await a.crearPerfil(PH, { vigente_desde: hoy, parametros: { ...parametrosVacios(), gran_contribuyente: true, responsabilidades: ['O-13'] } })
    expect(v3).toMatchObject({ version: 3, estado: 'borrador' })
    expect((await a.confirmarPerfil(PH, v3.id)).estado).toBe('confirmado')
    await expect(a.confirmarPerfil(PH, v3.id)).rejects.toMatchObject({ estado: 409 })
    await perfil.recargar()
    expect(perfil.vigente?.version).toBe(3)
    useEntidad().activa = { ...useEntidad().activa!, entidad_id: EMPRESA }
    await perfil.asegurar()
    expect(perfil.sinConfirmar).toBe(true)
    await expect(a.prepararIca(EMPRESA, { desde: '2026-01-01', hasta: '2026-02-28' })).rejects.toMatchObject({ estado: 422 })
  })

  it('resoluciones: rango que se cruza, activar y clave técnica que no vuelve', async () => {
    const anio = Number(fechaDemo().slice(0, 4))
    const base = { tipo: 'factura' as const, prefijo: 'FE', desde: 4000, hasta: 9000, numero_resolucion: '1877', fecha_resolucion: fechaDemo(), vigente_desde: fechaDemo(), vigente_hasta: `${anio + 2}-01-01` }
    await expect(a.crearResolucion(PH, base)).rejects.toMatchObject({ estado: 409 })
    const r = await a.crearResolucion(PH, { ...base, prefijo: 'FX', clave_tecnica: 'secreta' })
    expect(r).toMatchObject({ activa: false, tiene_clave_tecnica: true })
    expect(r).not.toHaveProperty('clave_tecnica')
    await a.activarResolucion(PH, r.id, true)
    expect((await a.resoluciones(PH)).find((x) => x.id === r.id)?.activa).toBe(true)
  })

  it('preparación de impuestos, exógena y beneficiarios', async () => {
    const rango = { desde: '2026-11-01', hasta: '2026-11-30' }
    await expect(a.prepararRetencion(PH, { desde: '2026-11-30', hasta: '2026-11-01' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.prepararRetencion(PH, rango)).diferencia).toBe('0.00')
    expect((await a.prepararIva(PH, rango)).saldo.startsWith('-')).toBe(true)
    expect((await a.prepararIca(PH, rango)).lineas[0]?.impuesto).toBe('173880.00')
    const c = await a.catalogo(PH)
    const anio = Number(fechaDemo().slice(0, 4)) - 1
    const f = c.formatos_exogena.find((x) => x.anio === anio && x.codigo === '1001')!
    const g = await a.generarExogena(PH, f.id)
    expect(g.generacion).toMatchObject({ version: 1, filas: 2, errores: 1 })
    expect(g.csv.split('\n')[0]).toContain('concepto;tipo_documento')
    expect((await a.generarExogena(PH, f.id)).generacion.version).toBe(2)
    expect(await a.generacionesExogena(PH, anio)).toHaveLength(2)
    await expect(a.crearBeneficiario(PH, { persona_id: 'p', criterio: 'propiedad', porcentaje: '3', vigente_desde: '2026-01-01' })).rejects.toMatchObject({ estado: 422 })
    await expect(a.crearBeneficiario(PH, { persona_id: 'p', criterio: 'control', porcentaje: '10', vigente_desde: '2026-01-01' })).rejects.toMatchObject({ estado: 422 })
    const b = await a.crearBeneficiario(PH, { persona_id: 'p', criterio: 'propiedad', porcentaje: '25', vigente_desde: '2026-01-01' })
    await expect(a.terminarBeneficiario(PH, b.id, '2025-01-01')).rejects.toMatchObject({ estado: 422 })
    await a.terminarBeneficiario(PH, b.id, '2026-10-31')
    expect((await a.beneficiarios(PH)).find((x) => x.id === b.id)?.vigente_hasta).toBe('2026-10-31')
  })
})

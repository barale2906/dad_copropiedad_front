import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recibirArchivo } from '@/api/archivos'
import { ErrorApi } from '@/api/errores'
import type { EventoRadian, ItemFacturacion } from '@/api/tipos'
import VisorPdf from '@/hud/componentes/VisorPdf.vue'
import AvisoSimulado from '@/modulos/facturacion/componentes/AvisoSimulado.vue'
import EditorFactura from '@/modulos/facturacion/componentes/EditorFactura.vue'
import LineaTiempoRadian from '@/modulos/facturacion/componentes/LineaTiempoRadian.vue'
import { type FacturaEditable, facturaVacia } from '@/modulos/facturacion/reglas'

const ITEMS: ItemFacturacion[] = [
  { id: 'cafe', codigo: 'CAF', descripcion: 'Café 500 g', unidad: '94', precio: '28000.00', tarifa_iva: '19', clasificacion: 'venta', cuenta_id: 'c1', activo: true, actualizado_en: '' },
  { id: 'taza', codigo: 'TAZ', descripcion: 'Taza', unidad: '94', precio: '18000.00', tarifa_iva: '19', clasificacion: 'venta', cuenta_id: null, activo: false, actualizado_en: '' },
]

function montarEditor(contabilidad: boolean) {
  let modelo: FacturaEditable = facturaVacia('2026-11-19', '2026-12-19')
  const w = mount(EditorFactura, {
    props: {
      entidadId: 'e',
      items: ITEMS,
      contabilidad,
      cuentas: [{ codigo: '413595', nombre: 'Otras ventas' }],
      centros: [{ codigo: 'ADM', nombre: 'Administración' }],
      codigoCuenta: (id: string) => (id === 'c1' ? '413595' : undefined),
      modelValue: modelo,
      'onUpdate:modelValue': (v: FacturaEditable) => {
        modelo = v
      },
    },
  })
  return { w, actual: () => modelo }
}

const campo = (w: ReturnType<typeof mount>, etiqueta: string) => {
  const id = w.findAll('label').find((l) => l.text() === etiqueta)?.attributes('for')
  return w.get(`#${CSS.escape(id ?? 'nada')}`)
}

describe('EditorFactura', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('sin contabilidad: no muestra cuentas ni centros; el producto llena la línea y los totales', async () => {
    const { w, actual } = montarEditor(false)
    expect(w.text()).not.toContain('Cuenta de ingreso')
    expect(w.text()).not.toContain('Centro de costo')
    // Solo los productos activos se ofrecen.
    const producto = campo(w, 'Producto de la línea 1')
    expect(producto.findAll('option').map((o) => o.text())).toEqual(['Sin producto del catálogo', 'CAF · Café 500 g'])
    await producto.setValue('cafe')
    await campo(w, 'Cantidad de la línea 1').setValue('2')
    expect(actual().lineas[0]).toMatchObject({ item_id: 'cafe', descripcion: 'Café 500 g', valor_unitario: '28000', tarifa_iva: '19', cuenta: '413595' })
    const totales = w.get('dl[aria-label="Totales estimados"]').text()
    expect(totales).toContain('56.000,00')
    expect(totales).toContain('10.640,00')
    expect(totales).toContain('66.640,00')
  })

  it('con contabilidad: muestra la cuenta de ingreso y el centro de costo de cada línea', () => {
    const { w } = montarEditor(true)
    expect(w.text()).toContain('Cuenta de ingreso de la línea 1')
    expect(w.text()).toContain('Centro de costo de la línea 1')
  })

  it('una clasificación sin IVA lo quita y no deja escribirlo; agrega y quita líneas', async () => {
    const { w, actual } = montarEditor(false)
    await campo(w, 'IVA % de la línea 1').setValue('19')
    await campo(w, 'Clasificación de la línea 1').setValue('expensa')
    expect(actual().lineas[0]).toMatchObject({ clasificacion: 'expensa', tarifa_iva: '0' })
    expect(w.text()).toContain('Sin IVA en la línea 1')
    const agregar = w.findAll('button').find((b) => b.text().includes('Agregar línea'))!
    await agregar.trigger('click')
    expect(actual().lineas).toHaveLength(2)
    await w.findAll('button').find((b) => b.text() === 'Quitar la línea 2')!.trigger('click')
    expect(actual().lineas).toHaveLength(1)
  })
})

describe('LineaTiempoRadian', () => {
  const evento = (tipo: EventoRadian['tipo'], estado = 'enviado'): EventoRadian => ({ id: tipo, tipo, estado, numero: '1', creado_en: '2026-11-18T15:00:00Z' })

  it('sin eventos solo ofrece el acuse y exige quién recibe', async () => {
    const w = mount(LineaTiempoRadian, { props: { eventos: [], zona: 'America/Bogota' } })
    expect(w.findAll('form')).toHaveLength(1)
    expect(w.findAll('li[aria-current="step"]')).toHaveLength(1)
    expect(w.text()).toContain('Se habilita al registrar el paso anterior.')
    await w.get('form').trigger('submit')
    expect(w.get('[role="alert"]').text()).toContain('Indique quién recibe')
    await campo(w, 'Número de documento').setValue('1010')
    await campo(w, 'Nombres').setValue('Ana')
    await campo(w, 'Apellidos').setValue('Ruiz')
    await w.get('form').trigger('submit')
    expect(w.emitted('registrar')?.[0]?.[0]).toEqual({
      tipo: 'acuse', quien_recibe: { tipo_documento: 'CC', documento: '1010', nombres: 'Ana', apellidos: 'Ruiz', cargo: null, area: null },
    })
  })

  it('tras el recibo del bien: aceptar o reclamar (el reclamo exige el concepto)', async () => {
    const w = mount(LineaTiempoRadian, { props: { eventos: [evento('acuse'), evento('recibo_bien')], zona: 'America/Bogota' } })
    expect(w.findAll('form')).toHaveLength(1)
    await w.get('input[value="reclamo"]').setValue(true)
    await w.get('form').trigger('submit')
    expect(w.get('[role="alert"]').text()).toBe('Elija el concepto del reclamo.')
    await campo(w, 'Concepto del reclamo').setValue('servicio_no_prestado')
    await campo(w, 'Detalle de lo reclamado').setValue('No vinieron')
    await w.get('form').trigger('submit')
    expect(w.emitted('registrar')?.[0]?.[0]).toEqual({ tipo: 'reclamo', motivo: 'No vinieron', concepto_reclamo: 'servicio_no_prestado' })
  })

  it('un evento rechazado por la DIAN se muestra y deja repetir el paso; sin permiso no hay formularios', () => {
    const w = mount(LineaTiempoRadian, { props: { eventos: [evento('acuse', 'rechazado')], zona: 'America/Bogota' } })
    expect(w.text()).toContain('Rechazado por la DIAN')
    expect(w.findAll('form')).toHaveLength(1)
    const sin = mount(LineaTiempoRadian, { props: { eventos: [], zona: 'America/Bogota', puede: false } })
    expect(sin.findAll('form')).toHaveLength(0)
  })
})

describe('VisorPdf y aviso del simulado', () => {
  it('muestra el PDF con una URL de Blob, ofrece descargar y libera la URL al desmontar', async () => {
    const crear = vi.fn(() => 'blob:pdf')
    const revocar = vi.fn()
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar })
    const w = mount(VisorPdf, { props: { archivo: new Blob(['%PDF']), titulo: 'PDF de FE1' } })
    expect(w.get('iframe').attributes()).toMatchObject({ src: 'blob:pdf', title: 'PDF de FE1' })
    await w.findAll('button')[0]!.trigger('click')
    expect(w.emitted('descargar')).toHaveLength(1)
    w.unmount()
    expect(revocar).toHaveBeenCalledWith('blob:pdf')
  })

  it('el aviso aparece solo con documentos del proveedor simulado', () => {
    expect(mount(AvisoSimulado, { props: { documentos: [{ proveedor: 'simulado' }] } }).text()).toContain('Sin validez ante la DIAN')
    expect(mount(AvisoSimulado, { props: { documentos: [{ proveedor: 'propio' }] } }).text()).toBe('')
  })
})

describe('recibirArchivo', () => {
  it('devuelve el archivo con su nombre y huella sin guardarlo; un error se propaga', async () => {
    const respuesta = new Response('x', { headers: { 'Content-Disposition': 'attachment; filename="FE1.pdf"', 'X-Contenido-Sha256': 'abc' } })
    const r = await recibirArchivo(Promise.resolve({ data: new Blob(['x']), response: respuesta }))
    expect(r).toMatchObject({ nombre: 'FE1.pdf', sha256: 'abc' })
    expect(r.blob.size).toBe(1)
    await expect(recibirArchivo(Promise.resolve({ response: new Response(null, { status: 404 }) }))).rejects.toBeInstanceOf(ErrorApi)
    await expect(recibirArchivo(Promise.reject(new Error('red')))).rejects.toMatchObject({ codigo: 'red' })
  })
})

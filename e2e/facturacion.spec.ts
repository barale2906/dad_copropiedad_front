import { expect, type Page, test } from '@playwright/test'
import { elegirTercero, entrar } from './utilidades'

const ANDINA = '01930000-0000-7000-8000-000000000004'
const PH = '01930000-0000-7000-8000-000000000001'

/** «facturador» entra directo a Comercial Andina: factura electrónica sin contabilidad. */
async function abrir(page: Page, ruta: string, usuario = 'facturador', entidad = ANDINA) {
  await entrar(page, usuario)
  await expect(page).toHaveURL(new RegExp(`/e/${entidad}`))
  await page.goto(`/e/${entidad}/facturacion/${ruta}`)
}

test.describe('facturación', () => {
  test('crear, emitir y enviar a la DIAN una factura; ver su PDF y anularla con nota crédito', async ({ page }) => {
    await abrir(page, 'facturas')
    await expect(page.getByRole('table', { name: 'Facturas de venta' })).toContainText('Nota débito FV-6')
    await page.getByRole('link', { name: 'Factura nueva' }).click()
    await elegirTercero(page, 'Cliente', 'pedro', 'Pedro Pérez')
    await page.getByLabel('Descripción de la factura').fill('Café para la tienda de diciembre')
    // Sin contabilidad no se piden cuentas.
    await expect(page.getByText('Cuenta de ingreso', { exact: false })).toHaveCount(0)
    await page.getByLabel('Producto de la línea 1').selectOption({ label: 'CAF-500 · Café de origen 500 g' })
    await page.getByLabel('Cantidad de la línea 1').fill('2')
    await expect(page.getByRole('definition').filter({ hasText: '66.640,00' })).toBeVisible()
    await page.getByRole('button', { name: 'Guardar y emitir' }).click()

    await expect(page.getByRole('heading', { name: 'Factura FV-7' })).toBeVisible()
    await page.getByRole('button', { name: 'Enviar a la DIAN' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'validado' })).toBeVisible()
    await expect(page.getByText('Sin validez ante la DIAN:')).toBeVisible()
    await page.getByRole('button', { name: 'Ver PDF' }).click()
    await expect(page.locator('iframe[title^="PDF de SETP"]')).toBeVisible()

    await page.getByRole('button', { name: 'Anular con nota crédito' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Anular con nota crédito' })
    await dialogo.getByLabel('Motivo').fill('El cliente devolvió el pedido')
    await dialogo.getByRole('button', { name: 'Emitir nota crédito' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Nota crédito NC261 emitida' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Notas del documento' })).toContainText('Nota crédito NC261')
  })

  test('cargar una recibida, registrar sus eventos RADIAN en orden y registrarla como compra', async ({ page }) => {
    await abrir(page, 'recibidas')
    const xml = '<Invoice><cbc:UUID>e2e-cufe-1</cbc:UUID><cbc:ID>AT950</cbc:ID><cbc:CompanyID>800333444</cbc:CompanyID></Invoice>'
    await page.locator('input[type="file"]').setInputFiles({ name: 'at950.xml', mimeType: 'application/xml', buffer: Buffer.from(xml) })
    await expect(page.getByRole('status').filter({ hasText: 'Se cargó la factura FVAT950 de Aseo Total Ltda.' })).toBeVisible()

    await page.getByRole('table', { name: 'Facturas recibidas' }).getByRole('link', { name: 'FV8812' }).click()
    await expect(page.getByRole('heading', { name: /FV8812 · Vigilancia Andina/ })).toBeVisible()
    await page.getByLabel('Número de documento').fill('1010203040')
    await page.getByLabel('Nombres').fill('Ana')
    await page.getByLabel('Apellidos').fill('Ruiz')
    await page.getByRole('button', { name: 'Registrar acuse de recibo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Evento «Acuse de recibo» registrado' })).toBeVisible()
    // Quien recibe se conserva para el paso siguiente.
    await page.getByRole('button', { name: 'Registrar recibo del bien o servicio' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Evento «Recibo del bien o servicio» registrado' })).toBeVisible()
    await page.getByRole('button', { name: 'Registrar aceptación' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Evento «Aceptación expresa» registrado' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Eventos RADIAN' }).getByRole('form')).toHaveCount(0)

    await page.getByRole('button', { name: 'Registrar como compra' }).click()
    await page.getByRole('button', { name: 'Registrar y vincular' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'registrada como compra y vinculada' })).toBeVisible()
    await expect(page.getByText('Registrada', { exact: true })).toBeVisible()
  })

  test('asistente de habilitación hasta producción y rangos', async ({ page }) => {
    await abrir(page, 'habilitacion')
    await expect(page.getByRole('heading', { name: 'Habilitación DIAN', level: 1 })).toBeVisible()
    await page.getByLabel('SoftwareID').fill('6f1c7a1e-3d2b-4a5c-9e8f-0a1b2c3d4e5f')
    await page.getByLabel('PIN del software').fill('12345')
    await page.getByLabel('TestSetId').fill('0b6d4e2f-1a3c-4b5d-8e7f-9a0b1c2d3e4f')
    await page.getByRole('button', { name: 'Registrar software' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Software registrado' })).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles({ name: 'firma.p12', mimeType: 'application/x-pkcs12', buffer: Buffer.from('p12 de prueba') })
    await page.getByLabel('Contraseña del certificado').fill('secreta')
    await page.getByRole('button', { name: 'Cargar certificado' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Certificado cargado' })).toBeVisible()

    await page.getByRole('button', { name: 'Enviar set de pruebas' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Set de pruebas enviado' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Envíos del set de pruebas' })).toContainText('Enviado')
    await page.getByRole('button', { name: 'Consultar resultado' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'quedó habilitada' })).toBeVisible()

    await page.getByRole('button', { name: 'Pasar a producción' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'pasó a producción' })).toBeVisible()
    await page.getByRole('button', { name: 'Traer rangos de la DIAN' }).click()
    await expect(page.getByRole('list', { name: 'Rangos registrados' })).toContainText('FEAN 1 a 5000')
  })

  test('documentos: reintentar uno en contingencia; catálogo: crear un producto', async ({ page }) => {
    await abrir(page, 'documentos')
    await page.getByLabel('Estado ante la DIAN').selectOption({ label: 'En contingencia' })
    const lista = page.getByRole('list', { name: 'Documentos electrónicos' })
    await expect(lista).toContainText('SETP990000002')
    await lista.getByRole('button', { name: 'Reintentar SETP990000002' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'SETP990000002: validado' })).toBeVisible()

    await page.goto(`/e/${ANDINA}/facturacion/catalogo`)
    await page.getByRole('button', { name: 'Producto nuevo' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Producto nuevo' })
    await dialogo.getByLabel('Código').fill('MOL-1')
    await dialogo.getByLabel('Descripción').fill('Molino de café')
    await dialogo.getByLabel('Clasificación tributaria').selectOption({ label: 'Cuota extraordinaria' })
    await expect(dialogo.getByText('Esta clasificación no lleva IVA.')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Crear producto' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Se creó MOL-1' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Productos y servicios' })).toContainText('Molino de café')
  })

  test('la PH con contabilidad: el pago va por la tesorería y no hay acciones de la DIAN', async ({ page }) => {
    await abrir(page, 'facturas', 'uno', PH)
    await page.getByRole('table', { name: 'Facturas de venta' }).getByRole('link', { name: 'FV-120' }).click()
    await expect(page.getByText('Con contabilidad, el pago se registra con un recibo de caja en la tesorería.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrar pago' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enviar a la DIAN' })).toHaveCount(0)
  })
})

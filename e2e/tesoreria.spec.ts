import { expect, type Page, test } from '@playwright/test'
import { elegirTercero, entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'

/** Fecha en la zona de las entidades del demo, `dias` días después de hoy. */
const fechaDemo = (dias = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(Date.now() + dias * 86_400_000))

async function abrir(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/tesoreria/${ruta}`)
}

test.describe('tesorería', () => {
  test('egresos: quien registra no autoriza; otro egreso se autoriza y se paga', async ({ page }) => {
    await abrir(page, 'egresos')
    const tabla = page.getByRole('table', { name: 'Egresos' })
    await tabla.getByRole('link', { name: 'Pago vigilancia (registrado por usted)' }).click()
    await expect(page.getByText('Usted registró este egreso: lo autoriza otra persona')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Autorizar el egreso' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Egresos' }).first().click()
    await page.getByRole('table', { name: 'Egresos' }).getByRole('link', { name: 'Pago aseo de octubre' }).click()
    await page.getByRole('button', { name: 'Autorizar el egreso' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Egreso autorizado' })).toBeVisible()
    await page.getByRole('button', { name: 'Pagar' }).click()
    await page.getByRole('dialog', { name: 'Pagar el egreso' }).getByRole('button', { name: 'Registrar el pago' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Egreso pagado y contabilizado' })).toBeVisible()

    await page.getByRole('link', { name: 'Egresos' }).first().click()
    await page.getByRole('link', { name: 'Nuevo egreso' }).click()
    await elegirTercero(page, 'Beneficiario', 'aseo', 'Aseo Total')
    await page.getByLabel('Descripción').fill('Pago aseo de octubre (saldo)')
    await page.getByRole('button', { name: 'Todo lo de AT577' }).click()
    await page.getByRole('button', { name: 'Registrar el egreso' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'queda por autorizar por otra persona' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Autorizar el egreso' })).toHaveCount(0)
  })

  test('conciliación: cargar el extracto, conciliar, crear un recibo, deshacer e informe', async ({ page }) => {
    await abrir(page, 'conciliacion')
    await page.getByRole('link', { name: 'Cuenta corriente principal' }).click()
    await page.getByRole('link', { name: 'Cargar extracto' }).click()
    const d = (n: number) => fechaDemo(n).split('-').reverse().join('/')
    await page.getByLabel(/Elegir el archivo del extracto/).setInputFiles({
      name: 'extracto-noviembre.csv', mimeType: 'text/csv',
      buffer: Buffer.from(`Fecha;Descripción;Referencia;Valor\n${d(-20)};Transferencia recibida;TRF-88213;200.000,00\n${d(-2)};Cheque 0045;CH-45;-640.000,00\n${d(-1)};Consignación sin identificar;;75.000,00\n`),
    })
    await expect(page.getByLabel('Fecha', { exact: true })).toHaveValue('Fecha')
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await expect(page.getByRole('table', { name: 'Movimientos leídos' })).toContainText('Consignación sin identificar')
    await page.getByRole('button', { name: 'Importar el extracto' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Extracto importado' })).toBeVisible()

    await page.getByRole('link', { name: 'Conciliar', exact: true }).click()
    await page.getByLabel('Desde', { exact: true }).fill(fechaDemo(-40))
    await page.getByRole('button', { name: 'Conciliación automática' }).click()
    await expect(page.getByRole('status').filter({ hasText: '2 pareja(s) conciliadas' })).toBeVisible()
    await page.getByRole('button', { name: /^Crear recibo/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Recibo por identificar creado' })).toBeVisible()

    await page.getByRole('link', { name: 'Historial' }).click()
    await page.getByRole('button', { name: /^Deshacer/ }).first().click()
    await expect(page.getByRole('status').filter({ hasText: 'Conciliación deshecha' })).toBeVisible()

    await page.getByRole('link', { name: 'Informe' }).click()
    await expect(page.getByText('Saldo según el extracto')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Partidas en tránsito' })).toBeVisible()
  })

  test('cuentas por pagar: retenciones sugeridas, causar y certificado', async ({ page }) => {
    await abrir(page, 'cuentas-por-pagar')
    await page.getByRole('link', { name: 'Nueva factura' }).click()
    await elegirTercero(page, 'Proveedor', 'vigilancia', 'Vigilancia Andina')
    await page.getByLabel('Número de la factura').fill('1101')
    await page.getByLabel('Descripción', { exact: true }).fill('Vigilancia de diciembre')
    const cuenta = page.getByRole('combobox', { name: 'Cuenta de la línea 1' })
    await cuenta.fill('513505')
    await cuenta.press('Enter')
    await page.getByLabel('Base de la línea 1', { exact: true }).fill('4200000')
    await page.getByLabel('IVA de la línea 1', { exact: true }).fill('798000')
    await page.getByLabel('Retención en la fuente de la línea 1').selectOption({ label: 'Servicios generales (declarantes) (4 %)' })
    await expect(page.getByRole('list', { name: 'Retenciones sugeridas de la línea 1' })).toContainText('$ 168.000,00')
    await expect(page.getByRole('definition').filter({ hasText: '$ 4.830.000,00' })).toBeVisible()
    await page.getByRole('button', { name: 'Registrar la factura' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'neto a pagar $ 4.830.000,00' })).toBeVisible()
    await page.getByRole('button', { name: 'Causar la factura' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Factura causada' })).toBeVisible()

    await page.getByRole('link', { name: 'Cuentas por pagar' }).first().click()
    await page.getByRole('link', { name: 'Certificados de retención' }).click()
    await page.getByLabel('Desde').fill(`${fechaDemo().slice(0, 4)}-01-01`)
    await page.getByLabel('Hasta').fill(`${fechaDemo().slice(0, 4)}-12-31`)
    await elegirTercero(page, 'Proveedor', 'vigilancia', 'Vigilancia Andina')
    await expect(page.getByRole('table', { name: 'Retenciones certificadas' })).toBeVisible()
    await page.getByRole('button', { name: 'Enviar al correo del proveedor' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Certificado enviado' })).toBeVisible()
  })

  test('recibo aplicado a facturas de venta; bancos, cajas y cartera', async ({ page }) => {
    await abrir(page, 'recibos')
    await page.getByRole('link', { name: 'Nuevo recibo' }).click()
    await page.getByLabel('Valor recibido').fill('350000')
    await elegirTercero(page, 'Pagador (opcional)', 'pedro', 'Pedro Pérez')
    await page.getByLabel('Descripción').fill('Pago del alquiler del salón')
    await page.getByLabel('Aplicar a FV-120').fill('300000')
    await expect(page.getByText('queda sin aplicar $ 50.000,00')).toBeVisible()
    await page.getByRole('button', { name: 'Registrar el recibo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Recibo registrado por $ 350.000,00' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Aplicaciones del recibo' })).toContainText('FV-120')

    await page.goto(`/e/${PH}/tesoreria/cuentas`)
    await expect(page.getByRole('list', { name: 'Cuentas de tesorería' })).toContainText('Ahorros fondo de imprevistos')
    await expect(page.getByLabel('Saldo de Cuenta corriente principal')).toContainText('$')
    await page.goto(`/e/${PH}/tesoreria/cartera-clientes`)
    await expect(page.getByRole('table', { name: 'Cartera por edades' })).toContainText('Lucía Gómez')
  })
})

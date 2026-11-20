import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'

async function abrir(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/cartera/${ruta}`)
}

test.describe('cartera', () => {
  test('liquidar el mes: vista previa → confirmar → cuentas de cobro y envío', async ({ page }) => {
    await abrir(page, 'liquidacion')
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await expect(page.getByRole('list', { name: 'Totales por concepto' })).toContainText('ADM')
    await expect(page.getByRole('list', { name: 'Avisos de la liquidación' })).toContainText('referencia de pago')
    await page.getByRole('button', { name: /^Liquidar / }).click()
    await expect(page.getByRole('status').filter({ hasText: '40 cuentas de cobro' })).toBeVisible()
    await page.getByRole('button', { name: 'Enviar cuentas de cobro por correo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Se enviaron 38 cuentas de cobro' })).toBeVisible()
    await page.getByRole('button', { name: 'Ver la liquidación' }).click()
    await expect(page.getByRole('list', { name: 'Cuentas de cobro de la liquidación' })).toContainText('T1-101')
  })

  test('registrar un recaudo: imputación y anticipo', async ({ page }) => {
    await abrir(page, 'recaudos')
    await page.getByLabel('Unidad', { exact: true }).selectOption({ label: 'T1-101' })
    await expect(page.getByText('T1-101 debe')).toBeVisible()
    await page.getByLabel('Valor recibido').fill('2000000')
    await page.getByRole('button', { name: 'Registrar pago' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'como anticipo' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Pagos registrados' })).toContainText('Anticipo')

    // El resumen de la unidad se actualiza: ya no debe y le queda el anticipo.
    await expect(page.getByText(/T1-101 debe \$\s0,00 .* de anticipo/)).toBeVisible()
  })

  test('emitir un paz y salvo: el código se muestra una vez y se confirma que se guardó', async ({ page }) => {
    await abrir(page, 'certificados')
    await page.getByLabel('Unidad', { exact: true }).selectOption({ label: 'T1-101' })
    await expect(page.getByRole('button', { name: 'Emitir paz y salvo' })).toBeDisabled()
    await page.getByLabel('Unidad', { exact: true }).selectOption({ label: 'T1-104' })
    await expect(page.getByText('está al día')).toBeVisible()
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Emitir paz y salvo' }).click()
    expect((await descarga).suggestedFilename()).toBe('paz-y-salvo-T1-104.pdf')
    await expect(page.getByRole('status').filter({ hasText: 'Paz y salvo de T1-104 emitido' })).toBeVisible()
    await expect(page.getByText(/PYS-\d+-DEMO/)).toBeVisible()
    await page.getByRole('button', { name: 'Ya guardé el código y el PDF' }).click()
    await expect(page.getByRole('list', { name: 'Certificados emitidos' })).toContainText('Paz y salvo')
  })

  test('acuerdos: aprueba el de otra cuenta; el propio lo debe aprobar otra persona', async ({ page }) => {
    await abrir(page, 'acuerdos')
    const lista = page.getByRole('list', { name: 'Acuerdos de pago' })
    await lista.getByRole('button', { name: 'Aprobar el acuerdo de T1-201' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Acuerdo de T1-201 aprobado' })).toBeVisible()
    const propio = lista.getByRole('listitem').filter({ hasText: 'T2-301' })
    await expect(propio).toContainText('Lo propuso usted: lo aprueba otra cuenta')
    await expect(propio.getByRole('button', { name: /Aprobar/ })).toHaveCount(0)
    await expect(propio.getByRole('button', { name: 'Anular el acuerdo de T2-301' })).toBeVisible()
  })
})

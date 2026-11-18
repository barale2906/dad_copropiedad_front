import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'

async function abrir(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/contabilidad/${ruta}`)
}

/** Elige una cuenta escribiendo su código y Enter (combobox del editor). */
async function cuenta(page: Page, linea: number, codigo: string) {
  const campo = page.getByRole('combobox', { name: `Cuenta de la línea ${linea}` })
  await campo.fill(codigo)
  await campo.press('Enter')
}

test.describe('contabilidad', () => {
  test('crear, previsualizar, contabilizar y revertir un comprobante', async ({ page }) => {
    await abrir(page, 'comprobantes')
    await expect(page.getByRole('table', { name: 'Comprobantes' })).toContainText('Causación de la vigilancia del mes')
    await page.getByRole('link', { name: 'Nuevo comprobante' }).click()
    await page.getByLabel('Descripción').fill('Compra de papelería')
    await cuenta(page, 1, '513505')
    await page.getByLabel('Centro de costo de la línea 1').selectOption({ label: 'ADM · Administración' })
    await page.getByLabel('Débito de la línea 1').fill('50000')
    await cuenta(page, 2, '110505')
    await page.getByLabel('Crédito de la línea 2').fill('40000')
    await expect(page.getByRole('list', { name: 'Pendientes del comprobante' })).toContainText('no suman lo mismo')

    await page.getByRole('button', { name: 'Previsualizar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'no cuadra' })).toBeVisible()
    await page.getByLabel('Crédito de la línea 2').fill('')
    await page.getByLabel('Crédito de la línea 2').press('=')
    await expect(page.getByRole('status').filter({ hasText: 'Cuadra' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Previsualizar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Cuadra: el asiento suma $ 50.000,00' })).toBeVisible()

    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toBeVisible()
    await page.getByRole('button', { name: 'Contabilizar', exact: true }).click()
    await page.getByRole('dialog', { name: 'Contabilizar el comprobante' }).getByRole('button', { name: 'Contabilizar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Contabilizado como CC-2' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Líneas del comprobante' })).toContainText('513505 · Aseo y vigilancia')

    await page.getByRole('button', { name: 'Revertir' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Revertir el comprobante' })
    await dialogo.getByLabel('Motivo').fill('Se registró por error')
    await dialogo.getByRole('button', { name: 'Revertir' }).click()
    await expect(page.getByRole('heading', { name: 'CC-3' })).toBeVisible()
    await expect(page.getByText('Este comprobante revierte')).toBeVisible()
    await expect(page.getByText('Se registró por error')).toBeVisible()
  })

  test('cerrar un periodo y reabrir otro con la aprobación de otra cuenta', async ({ page }) => {
    await abrir(page, 'periodos')
    await page.getByRole('button', { name: /^Cerrar el periodo de / }).first().click()
    await page.getByRole('dialog', { name: /^Cerrar / }).getByRole('button', { name: 'Cerrar el periodo' }).click()
    await expect(page.getByRole('status').filter({ hasText: ': cerrado.' })).toBeVisible()

    await page.getByRole('button', { name: 'Aprobar la reapertura' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Reapertura aprobada' })).toBeVisible()

    await page.getByRole('button', { name: /^Solicitar reapertura de / }).first().click()
    const dialogo = page.getByRole('dialog', { name: /^Reabrir / })
    await dialogo.getByLabel('Motivo').fill('Falta la nota de la conciliación bancaria')
    await dialogo.getByRole('button', { name: 'Solicitar la reapertura' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'la aprueba otra persona' })).toBeVisible()
    await expect(page.getByText('La aprueba otra persona con permiso para hacerlo.')).toBeVisible()
  })

  test('crear una cuenta propia y un centro de costo', async ({ page }) => {
    await abrir(page, 'puc')
    await expect(page.getByRole('table', { name: 'Cuentas del plan' })).toContainText('Caja general')
    await page.getByRole('button', { name: 'Nueva cuenta' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nueva cuenta' })
    await dialogo.getByLabel('Código').fill('11100503')
    await expect(dialogo.getByText(/depende de 111005 · Moneda nacional/)).toBeVisible()
    await dialogo.getByLabel('Nombre').fill('Davivienda ahorros')
    await dialogo.getByRole('button', { name: 'Crear la cuenta' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Cuenta 11100503 creada.' })).toBeVisible()
    await page.getByLabel('Buscar cuenta').fill('davivienda')
    await expect(page.getByRole('table', { name: 'Cuentas del plan' })).toContainText('11100503')

    await page.getByRole('link', { name: 'Centros de costo' }).click()
    await page.getByLabel('Código del centro').fill('PRQ')
    await page.getByLabel('Nombre del centro').fill('Parqueaderos')
    await page.getByRole('button', { name: 'Agregar centro' }).click()
    await expect(page.getByRole('list', { name: 'Centros de costo' })).toContainText('PRQ · Parqueaderos')
  })
})

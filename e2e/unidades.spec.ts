import { expect, type Page, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

async function abrir(page: Page, accion: string) {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/unidades/${accion}`)
}

test.describe('unidades y residentes', () => {
  test('importa con errores, corrige la planilla y crea los bienes', async ({ page }) => {
    await abrir(page, 'importar')
    const campo = page.getByLabel('Planilla (CSV o XLSX)')
    await campo.setInputFiles({
      name: 'bienes.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('codigo,tipo,agrupacion,coeficiente,titular,documento\nT1-101,apartamento,T1,0.01,,\nT3-102,nave,T3,0.01,,\n'),
    })
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    const errores = page.getByRole('table', { name: /errores en la planilla/ })
    await expect(errores).toContainText('Ya existe un bien con ese código.')
    await expect(errores).toContainText('El tipo de bien no es válido.')
    await expect(page.getByRole('button', { name: 'Crear los bienes' })).toBeDisabled()

    await page.getByRole('button', { name: 'Volver a editar' }).click()
    await page.getByLabel('Planilla (CSV o XLSX)').setInputFiles({
      name: 'bienes.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('codigo,tipo,agrupacion,coeficiente,titular,documento\nT3-101,apartamento,T3,0.01,Ana Pérez,52000111\n'),
    })
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await expect(page.getByRole('table', { name: 'Bienes que se crearán' })).toContainText('T3-101')
    await page.getByRole('button', { name: 'Crear los bienes' }).click()
    await expect(page.getByText(/se crearon 1 bienes/)).toBeVisible()
  })

  test('corrige el cuadro borrador y lo activa', async ({ page }) => {
    await abrir(page, 'coeficientes')
    await page.getByRole('link', { name: 'Editar el cuadro 2' }).click()
    await expect(page.getByText('Sobra 0,0001')).toBeVisible()
    await page.getByRole('button', { name: 'Activar cuadro' }).click()
    await page.getByRole('dialog', { name: 'Activar el cuadro' }).getByRole('button', { name: 'Activar' }).click()
    await expect(page.getByRole('dialog', { name: 'Activar el cuadro' }).getByRole('alert')).toContainText('diferencia con 1')
    await page.getByRole('dialog', { name: 'Activar el cuadro' }).getByRole('button', { name: 'Cancelar' }).click()

    const campo = page.getByLabel('Coeficiente de T1-101')
    await campo.fill('0.025')
    await campo.blur()
    await expect(page.getByText('Suma exactamente 1')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'suma exactamente 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Activar cuadro' }).click()
    await page.getByRole('dialog', { name: 'Activar el cuadro' }).getByRole('button', { name: 'Activar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Cuadro 2 vigente' })).toBeVisible()
  })

  test('aprueba un cambio del censo y rechaza otro', async ({ page }) => {
    await abrir(page, 'cambios-censo')
    const propuestas = page.getByRole('list', { name: 'Propuestas pendientes' })
    await expect(propuestas.getByRole('listitem')).toHaveCount(2)
    await expect(propuestas).toContainText('Andrea Nueva')
    await page.getByRole('button', { name: 'Aprobar el cambio de T2-301' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'ya quedó en el censo' })).toBeVisible()
    await page.getByRole('button', { name: 'Rechazar el cambio de T1-102' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Rechazar la propuesta' })
    await dialogo.getByRole('textbox').fill('La placa no coincide con la tarjeta')
    await dialogo.getByRole('button', { name: 'Rechazar' }).click()
    await expect(page.getByText('No hay propuestas pendientes.')).toBeVisible()
  })

  test('transfiere un bien desde su ficha y valida los porcentajes', async ({ page }) => {
    await abrir(page, 'bienes')
    await page.getByRole('link', { name: /^T1-201/ }).click()
    await expect(page.getByRole('heading', { name: 'T1-201' })).toBeVisible()
    await page.getByRole('link', { name: 'Titulares' }).click()
    await page.getByRole('button', { name: 'Registrar transferencia' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Transferencia de T1-201' })
    await dialogo.getByLabel('Nombre completo').fill('Carmen Ruiz')
    await dialogo.getByLabel('Documento').fill('43111222')
    await dialogo.getByLabel('Porcentaje').fill('80')
    await dialogo.getByRole('button', { name: 'Registrar transferencia' }).click()
    await expect(dialogo.getByRole('alert')).toContainText('deben sumar 100 %')
    await dialogo.getByLabel('Porcentaje').fill('100')
    await dialogo.getByRole('button', { name: 'Registrar transferencia' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Transferencia de T1-201 registrada' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Titulares vigentes de T1-201' })).toContainText('Carmen Ruiz')
  })

  test('una placa repetida se avisa en el campo', async ({ page }) => {
    await abrir(page, 'censo')
    await page.getByRole('link', { name: 'Vehículos' }).click()
    await page.getByRole('button', { name: 'Registrar vehículo' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Registrar vehículo' })
    await dialogo.getByLabel(/Buscar bien/).fill('T1-102')
    await dialogo.getByRole('button', { name: 'T1-102' }).click()
    await dialogo.getByLabel('Placa').fill('abc-123')
    await dialogo.getByRole('button', { name: 'Registrar' }).click()
    await expect(dialogo.getByText('La placa ABC123 ya está registrada')).toBeVisible()
  })
})

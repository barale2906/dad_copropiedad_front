import { expect, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

test.describe('archivo de la entidad', () => {
  test('lista lo guardado y lo filtra por nombre y clasificación', async ({ page }) => {
    await entrar(page, 'uno')
    await esperarMaqueta(page)
    await page.goto(`${page.url()}/archivo/documentos`)
    const tabla = page.getByRole('table', { name: 'Archivos de la entidad' })
    await expect(tabla).toContainText('Contrato de vigilancia.pdf')
    await expect(tabla).toContainText('Incapacidad del jardinero.jpg')

    // En móvil los campos se colapsan tras el botón «Filtros».
    const alternar = page.getByRole('button', { name: /^Filtros/ })
    if (await alternar.isVisible()) await alternar.click()
    await page.getByLabel('Nombre', { exact: true }).fill('poliza')
    await expect(tabla).toContainText('Póliza de áreas comunes 2026.pdf')
    await expect(tabla).not.toContainText('Contrato de vigilancia.pdf')
    await page.getByRole('button', { name: /Nombre: poliza.*Quitar filtro/ }).click()

    await page.getByLabel('Clasificación del archivo').selectOption({ label: 'Sensible' })
    await expect(tabla).toContainText('Incapacidad del jardinero.jpg')
    await expect(tabla).not.toContainText('Póliza de áreas comunes 2026.pdf')
  })

  test('sube un documento con su clasificación y avisa si el tipo no se admite', async ({ page }) => {
    await entrar(page, 'uno')
    await esperarMaqueta(page)
    await page.goto(`${page.url()}/archivo/documentos`)
    await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible()

    await page.getByLabel('Clasificación', { exact: true }).selectOption({ label: 'Personal' })
    await expect(page.getByText('Tiene datos de una persona')).toBeVisible()
    const [selector] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Elegir archivos' }).click(),
    ])
    await selector.setFiles({ name: 'acta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo') })
    await expect(page.getByRole('status').filter({ hasText: 'Archivo guardado.' })).toBeVisible()
    const fila = page.getByRole('row').filter({ hasText: 'acta.pdf' })
    await expect(fila).toContainText('Personal')
    await expect(fila.getByRole('button', { name: 'Abrir acta.pdf' })).toBeVisible()

    const [otro] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Elegir archivos' }).click(),
    ])
    await otro.setFiles({ name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') })
    await expect(page.getByRole('alert')).toContainText('Tipo de archivo no admitido')
  })
})

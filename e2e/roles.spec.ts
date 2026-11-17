import { expect, type Page, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

async function abrirRoles(page: Page) {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/entidad/roles`)
  await expect(page.getByRole('heading', { name: 'Roles y permisos' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Roles de la entidad' })).toBeVisible()
}

test.describe('roles y permisos', () => {
  test('crea un rol, le da permisos y los guarda', async ({ page }) => {
    await abrirRoles(page)
    await page.getByRole('button', { name: 'Crear rol' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Crear rol' })
    await dialogo.getByLabel('Nombre del rol').fill('Vigilante de noche')
    await expect(dialogo.getByLabel('Código')).toHaveValue('vigilante_de_noche')
    await dialogo.getByRole('button', { name: 'Crear rol' }).click()

    await expect(page.getByRole('heading', { name: 'Permisos del rol' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Vigilante de noche' })).toBeVisible()
    await page.getByLabel('Buscar permiso').fill('ingresos')
    await page.getByLabel('Registrar ingresos y salidas').check()
    await expect(page.getByText('1 permisos agregados')).toBeVisible()
    await page.getByRole('button', { name: 'Guardar permisos' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Permisos guardados.' })).toBeVisible()

    await page.getByRole('link', { name: 'Todos los roles' }).click()
    const fila = page.getByRole('row').filter({ hasText: 'Vigilante de noche' })
    await expect(fila).toContainText('Propio')
    await expect(fila).toContainText('1')
  })

  test('un permiso que la cuenta no tiene no se puede otorgar', async ({ page }) => {
    await abrirRoles(page)
    await page.getByRole('link', { name: 'Editar permisos de Auxiliar de cartera' }).click()
    await page.getByLabel('Buscar permiso').fill('ajustes')
    await expect(page.getByLabel(/Hacer ajustes de cartera/)).toBeDisabled()
    await expect(page.getByText('no puede otorgarlo')).toBeVisible()
  })

  test('una plantilla del sistema se consulta y sirve de base para un rol propio', async ({ page }) => {
    await abrirRoles(page)
    await page.getByRole('link', { name: 'Ver permisos de Contador' }).click()
    await expect(page.getByText('Los roles del sistema no se editan.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar permisos' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Crear un rol a partir de este' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Crear rol' })
    await expect(dialogo.getByLabel('Partir de los permisos de')).toHaveValue(/.+/)
    await expect(dialogo.getByText(/Se omitirán \d+ permisos/)).toBeVisible()
  })
})

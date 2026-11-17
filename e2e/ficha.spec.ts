import { expect, type Page, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

async function abrir(page: Page, accion: string, usuario = 'uno') {
  await entrar(page, usuario)
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/entidad/${accion}`)
}

test.describe('ficha, suscripción y auditoría', () => {
  test('edita la ficha de la PH y el nombre nuevo llega a la barra', async ({ page }) => {
    await abrir(page, 'ficha')
    await expect(page.getByRole('heading', { name: 'Ficha', exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Advertencias' })).toContainText('revisor fiscal')
    await expect(page.getByText('Andrés Administrador')).toBeVisible()
    await page.getByRole('button', { name: 'Editar' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Editar la ficha' })
    await dialogo.getByLabel('Nombre', { exact: true }).fill('Conjunto Los Robles II')
    await dialogo.getByLabel('Teléfono').fill('601 444 1234')
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Ficha actualizada.' })).toBeVisible()
    await expect(page.getByText('601 444 1234', { exact: true })).toBeVisible()
    await expect(page.getByRole('banner')).toContainText('Conjunto Los Robles II')
  })

  test('agrega un punto de atención con su horario', async ({ page }) => {
    await abrir(page, 'ficha')
    await page.getByRole('button', { name: 'Agregar punto de atención' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Agregar punto de atención' })
    await dialogo.getByLabel('Tipo').selectOption({ label: 'Portería' })
    await dialogo.getByLabel('Nombre', { exact: true }).fill('Portería norte')
    await dialogo.getByRole('button', { name: 'Agregar franja' }).click()
    await dialogo.getByLabel('Hasta').first().fill('07:00')
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    await expect(dialogo.getByRole('alert')).toContainText('posterior a la de inicio')
    await dialogo.getByLabel('Hasta').first().fill('18:00')
    await dialogo.getByRole('button', { name: 'Guardar' }).click()
    const punto = page.getByRole('listitem').filter({ hasText: 'Portería norte' })
    await expect(punto).toContainText('Lun')
  })

  test('mi suscripción muestra el plan, el consumo y una factura vencida', async ({ page }) => {
    await abrir(page, 'suscripcion')
    await expect(page.getByRole('heading', { name: 'Mi suscripción' })).toBeVisible()
    await expect(page.getByText('Mensual')).toBeVisible()
    await expect(page.getByRole('table', { name: 'Productos contratados' })).toContainText('Asambleas virtuales')
    await expect(page.getByRole('table', { name: 'Facturas de la suscripción' })).toContainText('Vencida')
  })

  test('la auditoría pagina y filtra por acción', async ({ page }) => {
    await abrir(page, 'auditoria')
    const tabla = page.getByRole('table', { name: 'Eventos de la auditoría' })
    await expect(tabla).toBeVisible()
    await expect(page.getByRole('button', { name: /Cargar más/ })).toBeVisible()
    // En móvil los campos se colapsan tras el botón «Filtros».
    const alternar = page.getByRole('button', { name: /^Filtros/ })
    if (await alternar.isVisible()) await alternar.click()
    await page.getByLabel('Acción').fill('acceso.')
    await expect(page.getByRole('list', { name: 'Filtros aplicados' })).toContainText('acceso.')
    await expect(tabla).not.toContainText('roles.asignar')
    await expect(tabla).toContainText('acceso.visita.decidir')
  })
})

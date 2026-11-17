import { expect, type Page, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

async function abrirUsuarios(page: Page) {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/entidad/usuarios`)
  await expect(page.getByRole('heading', { name: 'Usuarios', exact: true })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Usuarios de la entidad' })).toBeVisible()
}

test.describe('usuarios de la entidad', () => {
  test('crea un usuario con su rol y aparece con la contraseña pendiente', async ({ page }) => {
    await abrirUsuarios(page)
    await page.getByRole('button', { name: 'Crear usuario' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Crear usuario' })
    await dialogo.getByLabel('Nombre completo').fill('Ana Pérez')
    await dialogo.getByLabel('Correo').fill('ana@correo.co')
    await dialogo.getByLabel('Rol').selectOption({ label: 'Contador' })
    await dialogo.getByRole('button', { name: 'Crear usuario' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'código para definir su contraseña' })).toBeVisible()
    const fila = page.getByRole('row').filter({ hasText: 'Ana Pérez' })
    await expect(fila).toContainText('Contador')
    await expect(fila).toContainText('Contraseña pendiente')
  })

  test('un correo con cuenta en otra entidad recibe el rol y un aviso', async ({ page }) => {
    await abrirUsuarios(page)
    await page.getByRole('button', { name: 'Crear usuario' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Crear usuario' })
    await dialogo.getByLabel('Nombre completo').fill('Luis Gómez')
    await dialogo.getByLabel('Correo').fill('luis@otra.dad')
    await dialogo.getByLabel('Rol').selectOption({ label: 'Portería' })
    await dialogo.getByRole('button', { name: 'Crear usuario' }).click()
    await expect(page.getByText('ya tenía cuenta en DAD')).toBeVisible()
  })

  test('busca, quita un rol y no deja la entidad sin administrador', async ({ page }) => {
    await abrirUsuarios(page)
    await page.getByLabel('Buscar').fill('laura')
    await expect(page.getByRole('row')).toHaveCount(2)
    await page.getByRole('button', { name: 'Gestionar a Laura Contadora' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Laura Contadora' })
    await dialogo.getByRole('button', { name: 'Quitar' }).click()
    await dialogo.getByRole('button', { name: 'Quitar rol' }).click()
    await expect(dialogo.getByText('No tiene roles vigentes')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Cerrar' }).click()

    await page.getByLabel('Buscar').fill('andrés')
    await page.getByRole('button', { name: 'Gestionar a Andrés Administrador' }).click()
    const admin = page.getByRole('dialog', { name: 'Andrés Administrador' })
    await admin.getByRole('button', { name: 'Quitar' }).click()
    await admin.getByRole('button', { name: 'Quitar rol' }).click()
    await expect(admin.getByRole('alert')).toContainText('sin administrador')
  })

  test('un rol derivado no se puede quitar y se reenvía el código a quien lo tiene pendiente', async ({ page }) => {
    await abrirUsuarios(page)
    await page.getByRole('button', { name: 'Gestionar a Marta Residente' }).click()
    const marta = page.getByRole('dialog', { name: 'Marta Residente' })
    await expect(marta.getByText('por ser residente')).toBeVisible()
    await expect(marta.getByRole('button', { name: 'Quitar' })).toHaveCount(0)
    await marta.getByRole('button', { name: 'Cerrar' }).click()

    await page.getByRole('button', { name: 'Gestionar a Pedro Portero' }).click()
    const pedro = page.getByRole('dialog', { name: 'Pedro Portero' })
    await pedro.getByRole('button', { name: 'Reenviar código' }).click()
    await expect(pedro.getByText('Le enviamos un código nuevo')).toBeVisible()
  })

  test('carga masiva: con errores no deja confirmar; corregida crea los usuarios', async ({ page }) => {
    await abrirUsuarios(page)
    await page.getByRole('button', { name: 'Carga masiva' }).click()
    const archivo = page.getByLabel('Planilla (CSV o XLSX)')
    await archivo.setInputFiles({
      name: 'usuarios.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('nombre,correo,rol\nAna,ana@x.co,contador\nBeto,beto@x.co,piloto\n'),
    })
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await expect(page.getByText('Fila 3: El rol «piloto» no existe')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear los usuarios' })).toBeDisabled()
    await page.getByRole('button', { name: 'Volver a editar' }).click()
    await page.getByLabel('Planilla (CSV o XLSX)').setInputFiles({
      name: 'usuarios.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('nombre,correo,rol\nAna,ana@x.co,contador\nBeto,beto@x.co,porteria\n'),
    })
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await page.getByRole('button', { name: 'Crear los usuarios' }).click()
    await expect(page.getByText('Se crearon o vincularon 2 usuarios')).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Beto' })).toContainText('Portería')
  })
})

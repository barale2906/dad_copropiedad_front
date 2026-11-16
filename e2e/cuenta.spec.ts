import { expect, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

test.describe('definir contraseña', () => {
  test('desde «olvidé mi contraseña» se define con el código del correo', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByRole('button', { name: '¿Olvidó su contraseña?' }).click()
    await page.getByLabel('Correo de la cuenta').fill('persona@demo.dad')
    await page.getByRole('button', { name: 'Enviar código' }).click()
    await page.getByRole('link', { name: 'Ya tengo el código' }).click()
    await expect(page.getByRole('heading', { name: 'Definir contraseña' })).toBeVisible()
    // El correo viaja en el estado del historial, no en la URL.
    await expect(page.getByLabel('Correo', { exact: true })).toHaveValue('persona@demo.dad')
    await expect(page).toHaveURL(/\/contrasena$/)
    await page.getByLabel('Código').fill('000000')
    await page.getByLabel('Contraseña nueva').fill('una-contrasena-segura')
    await page.getByLabel('Repita la contraseña').fill('una-contrasena-segura')
    await page.getByRole('button', { name: 'Definir contraseña' }).click()
    await expect(page.getByRole('alert')).toContainText('no es válido')
    await page.getByLabel('Código').fill('123456')
    await page.getByRole('button', { name: 'Definir contraseña' }).click()
    await expect(page.getByRole('heading', { name: 'Contraseña definida' })).toBeVisible()
    await page.getByRole('link', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/ingresar/)
  })

  test('un usuario nuevo llega desde el acceso y las contraseñas deben coincidir', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByRole('link', { name: /Es nuevo/ }).click()
    await expect(page.getByRole('heading', { name: 'Definir contraseña' })).toBeVisible()
    await page.getByLabel('Correo', { exact: true }).fill('nuevo@demo.dad')
    await page.getByLabel('Código').fill('123456')
    await page.getByLabel('Contraseña nueva').fill('una-contrasena-segura')
    await page.getByLabel('Repita la contraseña').fill('otra-distinta-segura')
    await page.getByRole('button', { name: 'Definir contraseña' }).click()
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible()
  })
})

test.describe('mi cuenta', () => {
  test('activa el segundo factor con el QR y el secreto', async ({ page }) => {
    await entrar(page, 'uno')
    await esperarMaqueta(page)
    await page.getByRole('link', { name: 'Mi cuenta' }).click()
    await expect(page.getByRole('heading', { name: 'Mi cuenta', level: 1 })).toBeVisible()
    const seccion = page.getByRole('region', { name: /Segundo factor/ })
    await seccion.getByRole('button', { name: 'Activar segundo factor' }).click()
    await expect(seccion.getByRole('img', { name: /Código QR/ })).toBeVisible()
    await expect(seccion.getByText('JBSWY3DPEHPK3PXP')).toBeVisible()
    await seccion.getByLabel('Código de la aplicación').fill('123456')
    await seccion.getByRole('button', { name: 'Confirmar' }).click()
    await expect(seccion.getByText('Activo', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Volver a la maqueta' }).click()
    await esperarMaqueta(page)
  })

  test('cerrar todas las sesiones lleva al acceso', async ({ page }) => {
    await entrar(page)
    await page.getByRole('link', { name: 'Mi cuenta' }).click()
    await page.getByRole('button', { name: 'Cerrar todas las sesiones' }).click()
    const dialogo = page.getByRole('dialog', { name: '¿Cerrar todas las sesiones?' })
    await expect(dialogo).toBeVisible()
    await dialogo.getByRole('button', { name: 'Cerrar todas' }).click()
    await expect(page).toHaveURL(/\/ingresar/)
  })
})

import { expect, type Page, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

async function abrir(page: Page, accion: string) {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/entidad/${accion}`)
}

test.describe('protección de datos y organizaciones', () => {
  test('publica una versión nueva de la política', async ({ page }) => {
    await abrir(page, 'proteccion-datos')
    await page.getByRole('link', { name: 'Política' }).click()
    await expect(page.getByRole('list', { name: 'Versiones de la política' })).toContainText('Versión 1')
    await page.getByRole('button', { name: 'Publicar versión nueva' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Publicar versión nueva' })
    await dialogo.getByRole('button', { name: 'Publicar' }).click()
    await expect(dialogo.getByText('Escriba el texto de la política o adjunte el PDF.')).toBeVisible()
    await dialogo.getByLabel('Texto de la política').fill('Nueva política de tratamiento.')
    await dialogo.getByRole('button', { name: 'Publicar' }).click()
    const versiones = page.getByRole('list', { name: 'Versiones de la política' })
    await expect(versiones.getByRole('listitem').first()).toContainText('Versión 2')
    await expect(versiones.getByRole('listitem').first()).toContainText('Vigente')
  })

  test('atiende una solicitud vencida: la tramita y la responde', async ({ page }) => {
    await abrir(page, 'proteccion-datos')
    const tabla = page.getByRole('table', { name: 'Solicitudes de los titulares' })
    await expect(tabla).toContainText('Vence hoy o venció')
    await page.getByLabel('Solo vencidas sin responder').check()
    await expect(tabla.getByRole('row')).toHaveCount(2)
    await page.getByRole('button', { name: 'Tramitar la solicitud de Marta Residente' }).click()
    await expect(tabla).toContainText('En trámite')
    await page.getByRole('button', { name: 'Responder la solicitud de Marta Residente' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Responder la solicitud' })
    await dialogo.getByLabel('Respuesta').fill('Le enviamos sus datos al correo.')
    await dialogo.getByRole('button', { name: 'Enviar respuesta' }).click()
    await expect(page.getByText('No hay solicitudes con esos filtros.')).toBeVisible()
  })

  test('registra una autorización de un titular', async ({ page }) => {
    await abrir(page, 'proteccion-datos')
    await page.getByRole('link', { name: 'Autorizaciones' }).click()
    await page.getByLabel('Titular').fill('pedro')
    await page.getByRole('button', { name: /Pedro Pérez/ }).click()
    await expect(page.getByText('aún no ha otorgado autorizaciones')).toBeVisible()
    await page.getByRole('button', { name: 'Registrar autorización' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Registrar autorización' })
    await dialogo.getByLabel(/Comunicaciones/).check()
    await dialogo.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Autorización registrada.' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Autorizaciones de Pedro Pérez' })).toContainText('Vigente')
  })

  test('vincula una organización nueva y asigna un rol a su personal', async ({ page }) => {
    await abrir(page, 'organizaciones')
    await expect(page.getByRole('table', { name: 'Contratos de servicio' })).toContainText('Seguridad y vigilancia')
    await page.getByRole('button', { name: 'Vincular organización' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Vincular organización' })
    await dialogo.getByLabel('NIT de la organización').fill('800.111.222-3')
    await dialogo.getByRole('button', { name: 'Buscar' }).click()
    await dialogo.getByRole('button', { name: 'Registrarla' }).click()
    await dialogo.getByLabel('Razón social').fill('Aseo Brillante S.A.S.')
    await dialogo.getByLabel('Aseo', { exact: true }).check()
    await dialogo.getByRole('button', { name: 'Registrar y continuar' }).click()
    await expect(dialogo.getByLabel('Servicio contratado')).toHaveValue('aseo')
    await dialogo.getByRole('button', { name: 'Vincular' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Se vinculó Aseo Brillante S.A.S.' })).toBeVisible()

    await page.getByRole('button', { name: 'Asignar personal de Aseo Brillante S.A.S.' }).click()
    const asignar = page.getByRole('dialog', { name: 'Asignar rol al personal' })
    await asignar.getByLabel('Usuario o correo de la cuenta').fill('carlos@seguridad.co')
    await asignar.getByRole('button', { name: 'Buscar' }).click()
    await expect(asignar.getByText('Carlos Vigilante')).toBeVisible()
    await asignar.getByLabel('Rol').selectOption({ label: 'Portería' })
    await asignar.getByRole('button', { name: 'Asignar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Carlos Vigilante recibió el rol' })).toBeVisible()
  })
})

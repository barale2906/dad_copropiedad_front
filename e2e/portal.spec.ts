import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'

/** Entra como propietario residente y abre una pantalla del portal. */
async function abrir(page: Page, accion: string, consulta = '') {
  await entrar(page, 'residente')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/mi/${accion}${consulta}`)
}

test.describe('portal del propietario y residente', () => {
  test('en móvil entra a «Mi hogar»; en escritorio, a la maqueta con su bien marcado', async ({ page, isMobile }) => {
    await entrar(page, 'residente')
    if (isMobile) {
      await expect(page.getByRole('heading', { name: 'Mi hogar', level: 1 })).toBeVisible()
      await expect(page.getByRole('list', { name: 'Resumen' })).toContainText('T1-101')
      await expect(page.getByRole('link', { name: /Mi saldo/ })).toContainText('En mora')
      await page.getByRole('link', { name: 'Ver la maqueta' }).click()
      await expect(page.getByRole('list', { name: 'Zonas de la maqueta' })).toBeVisible()
    } else {
      const torres = page.getByRole('list', { name: 'Zonas de la maqueta' }).getByRole('button', { name: /Torres/ })
      await expect(torres).toContainText('T1-101', { timeout: 20_000 })
    }
  })

  test('paz y salvo: con deuda muestra el saldo; sin deuda lo descarga', async ({ page }) => {
    await abrir(page, 'cartera')
    await expect(page.getByRole('list', { name: 'Bienes en cartera' })).toBeVisible()
    await page.getByRole('link', { name: /T1-101/ }).click()
    await expect(page.getByText('En mora', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Pedir paz y salvo' }).click()
    await expect(page.getByRole('alert')).toContainText('No se puede emitir el paz y salvo')
    await expect(page.getByRole('button', { name: /Descargar la cuenta de cobro/ })).toBeVisible()

    await page.goto(`/e/${PH}/mi/cartera/01930000-0000-7000-8000-000000007002`)
    await expect(page.getByText('Al día', { exact: true })).toBeVisible()
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Pedir paz y salvo' }).click()
    expect((await descarga).suggestedFilename()).toBe('paz-y-salvo-T1-102.pdf')
    await expect(page.getByRole('status').filter({ hasText: 'Código de verificación' })).toBeVisible()
  })

  test('pre-autoriza una visita y obtiene el QR para compartir', async ({ page }) => {
    await abrir(page, 'visitas')
    await page.getByRole('button', { name: 'Pre-autorizar una visita' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Pre-autorizar una visita' })
    await dialogo.getByLabel('Nombre del visitante').fill('Ana Amiga')
    await dialogo.getByLabel('Puede ingresar desde').fill('2030-01-10T15:00')
    await dialogo.getByLabel('Hasta').fill('2030-01-10T20:00')
    await dialogo.getByRole('button', { name: 'Generar QR' }).click()
    const qr = page.getByRole('dialog', { name: 'Comparta el código con su visita' })
    await expect(qr.getByRole('img', { name: /Ana Amiga/ })).toBeVisible()
    await expect(qr.getByRole('link', { name: 'Enviar por WhatsApp' })).toHaveAttribute('href', /wa\.me/)
  })

  test('responde visitas: si otro residente ya respondió, lo avisa', async ({ page }) => {
    await abrir(page, 'visitas')
    await page.getByRole('button', { name: 'Autorizar a Carlos Domicilio' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Carlos Domicilio: autorizada' })).toBeVisible()
    await page.getByRole('button', { name: 'Rechazar a María Visita' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Otro residente ya respondió' })).toBeVisible()
    await page.getByRole('link', { name: 'Paquetes' }).click()
    await expect(page.getByRole('list', { name: 'Paquetes por recoger' })).toContainText('Mercado Libre')
  })

  test('radica una PQRS y la ve en el seguimiento', async ({ page }) => {
    await abrir(page, 'pqrs')
    await page.getByRole('button', { name: 'Nueva solicitud' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nueva solicitud' })
    await dialogo.getByLabel('Asunto').fill('Puerta del parqueadero dañada')
    await dialogo.getByLabel('Descripción').fill('No cierra desde ayer.')
    await dialogo.getByRole('button', { name: 'Radicar' }).click()
    await expect(page.getByRole('heading', { name: /Solicitud PQRS-/ })).toBeVisible()
    await expect(page.getByText('Puerta del parqueadero dañada')).toBeVisible()
    await expect(page.getByText('Nota interna')).toHaveCount(0)
  })

  test('lee un comunicado y confirma «Enterado»; el aviso de no leídos baja', async ({ page }) => {
    await abrir(page, 'comunicados')
    const aviso = page.getByRole('link', { name: /Comunicados: 1 comunicado sin leer/ })
    await expect(aviso).toBeVisible()
    await page.getByRole('link', { name: 'Corte de agua el sábado' }).click()
    await expect(page.getByRole('heading', { name: 'Corte de agua el sábado' })).toBeVisible()
    await page.getByRole('button', { name: 'Enterado' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Usted confirmó que se enteró' })).toBeVisible()
    await expect(page.getByRole('link', { name: /comunicado sin leer/ })).toHaveCount(0)
  })

  test('propone un vehículo para su bien', async ({ page }) => {
    await abrir(page, 'bienes')
    await page.getByRole('link', { name: /T1-101/ }).click()
    await page.getByRole('button', { name: 'Reportar vehículo' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Reportar vehículo' })
    await dialogo.getByLabel('Placa').fill('jkl-321')
    await dialogo.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Propuesta enviada' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Propuestas enviadas' })).toContainText('Pendiente de aprobación')
  })
})

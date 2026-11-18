import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

/** Entra con una cuenta de una sola PH (o con `revisor`) y abre una pantalla de la administración. */
async function abrir(page: Page, ruta: string, usuario = 'uno') {
  await entrar(page, usuario)
  await expect(page).toHaveURL(usuario === 'uno' ? new RegExp(`/e/${PH}`) : /\/entidades$/)
  await page.goto(`/e/${PH}/administracion/${ruta}`)
}

test.describe('gestión administrativa', () => {
  test('el tablero resume PQRS y mantenimiento', async ({ page }) => {
    await abrir(page, 'tablero')
    const resumen = page.getByRole('list', { name: 'Resumen' })
    await expect(resumen.getByRole('link', { name: /PQRS vencidas/ })).toContainText('1')
    await expect(resumen.getByRole('link', { name: /Órdenes atrasadas/ })).toContainText('1')
    await expect(page.getByRole('list', { name: 'Alertas de mantenimiento' })).toContainText('Lavado de tanques')
    await resumen.getByRole('link', { name: /PQRS vencidas/ }).click()
    await expect(page.getByRole('list', { name: 'PQRS' }).getByRole('listitem')).toHaveCount(1)
  })

  test('atender una PQRS hasta resolverla, con una nota interna', async ({ page }) => {
    await abrir(page, 'tickets')
    const bandeja = page.getByRole('list', { name: 'PQRS' })
    await expect(bandeja.getByRole('listitem').first()).toContainText('Vencido')
    await bandeja.getByRole('link', { name: 'Ruido en el ascensor de la torre 2' }).click()

    await page.getByLabel('Respuesta al solicitante').fill('Revisar el contrato del técnico')
    await page.getByLabel('Nota interna (el solicitante no la ve)').check()
    await page.getByRole('button', { name: 'Guardar nota' }).click()
    await expect(page.getByRole('status')).toContainText('Nota interna guardada')
    await expect(page.getByRole('list', { name: 'Mensajes del ticket' }).getByRole('listitem').last()).toContainText('Nota interna')

    await page.getByRole('button', { name: 'Empezar a atender' }).click()
    await expect(page.getByText('En progreso', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Resolver' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Resolver' })
    await dialogo.getByRole('button', { name: 'Resolver' }).click()
    await expect(dialogo.getByRole('alert')).toContainText('respuesta al solicitante')
    await dialogo.getByLabel('Respuesta al solicitante').fill('El técnico ajustó el ascensor.')
    await dialogo.getByRole('button', { name: 'Resolver' }).click()
    await expect(page.getByRole('status')).toContainText('Ticket: resuelto')
    await expect(page.getByRole('list', { name: 'Mensajes del ticket' })).toContainText('El técnico ajustó el ascensor.')
  })

  test('redactar y publicar un comunicado a una torre', async ({ page }) => {
    await abrir(page, 'comunicados')
    await page.getByRole('link', { name: 'Nuevo comunicado' }).click()
    await page.getByLabel('Título').fill('Lavado de fachada')
    await page.getByLabel('Contenido').fill('El jueves se lava la fachada de la torre 1.')
    await page.getByLabel('Destinatarios').selectOption({ label: 'Torres o etapas' })
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByRole('alert')).toContainText('Elija al menos un destinatario')
    await page.getByLabel('Torre 1').check()
    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByRole('heading', { name: 'Lavado de fachada' })).toBeVisible()
    await expect(page.getByText('Borrador', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Publicar' }).click()
    await page.getByRole('dialog', { name: 'Publicar el comunicado' }).getByRole('button', { name: 'Enviar ahora' }).click()
    await expect(page.getByRole('status')).toContainText('Comunicado enviado')
    await expect(page.getByText('lo leyeron')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anular' })).toHaveCount(0)
  })

  test('responder por WhatsApp dentro de las 24 h; fuera de ellas no se puede', async ({ page }) => {
    await abrir(page, 'chat')
    const lista = page.getByRole('list', { name: 'Conversaciones' })
    await lista.getByRole('link', { name: '+57 300 555 0199' }).click()
    await expect(page.getByText(/ventana de 24 h se cerró/).first()).toBeVisible()
    await expect(page.getByLabel('Responder por WhatsApp')).toHaveCount(0)

    await page.getByRole('link', { name: 'Conversaciones' }).click()
    await lista.getByRole('link', { name: '+57 300 555 0101' }).click()
    await expect(page.getByText(/Quedan .* para responder/).first()).toBeVisible()
    await page.getByLabel('Responder por WhatsApp').fill('Sí, está habilitado hasta las 10 p. m.')
    await page.getByRole('button', { name: 'Enviar' }).click()
    await expect(page.getByRole('status')).toContainText('Mensaje enviado')
    await page.getByRole('button', { name: 'Cerrar la conversación' }).click()
    await expect(page.getByText('Conversación cerrada', { exact: true })).toBeVisible()
  })

  test('ejecutar una orden y verificarla con otra cuenta (cuatro ojos)', async ({ page }) => {
    await abrir(page, `mantenimiento/${vid(3601)}`)
    await page.getByRole('button', { name: 'Iniciar' }).click()
    await expect(page.getByRole('status')).toContainText('Orden en ejecución')
    await page.getByRole('button', { name: 'Registrar la ejecución' }).click()
    const ejecucion = page.getByRole('dialog', { name: 'Registrar la ejecución' })
    await ejecucion.getByLabel('Lubricar guías').check()
    await ejecucion.getByLabel('Probar frenos').check()
    await ejecucion.getByLabel('Observaciones').fill('Sin novedad.')
    await ejecucion.getByRole('button', { name: 'Marcar como ejecutada' }).click()
    await expect(page.getByRole('status')).toContainText('otra cuenta debe verificarla')
    await expect(page.getByText('Usted ejecutó esta orden: la verifica otra cuenta.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Verificar' })).toHaveCount(0)

    // La segunda cuenta verifica lo que ejecutó la primera (la orden ejecutada del demo).
    await page.getByRole('button', { name: 'Salir' }).click()
    await abrir(page, `mantenimiento/${vid(3602)}`, 'revisor')
    await page.getByRole('button', { name: 'Verificar' }).click()
    await page.getByRole('dialog', { name: 'Verificar la orden' }).getByRole('button', { name: 'Aprobar' }).click()
    await expect(page.getByRole('status')).toContainText('Orden verificada')
    await expect(page.getByText('Verificada', { exact: true }).first()).toBeVisible()
  })

  test('dar de baja un activo exige soporte', async ({ page }) => {
    await abrir(page, 'inventario')
    await page.getByRole('list', { name: 'Activos' }).getByRole('link', { name: 'Podadora' }).click()
    await page.getByRole('button', { name: 'Registrar movimiento' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Registrar movimiento' })
    await dialogo.getByLabel('Movimiento').selectOption({ label: 'Baja definitiva' })
    await expect(dialogo.getByText('La baja es definitiva')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Dar de baja' }).click()
    await expect(dialogo.getByRole('alert')).toContainText('La baja exige un soporte')
  })

  test('las citas con la administración usan la agenda', async ({ page }) => {
    await abrir(page, 'citas')
    await expect(page.getByRole('heading', { name: /Citas con la administración|Agendar/ })).toBeVisible()
    await expect(page.getByText('Citas con la administración').first()).toBeVisible()
  })
})

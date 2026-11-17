import { expect, type Page, test } from '@playwright/test'
import { elegirZona, entrar, esperarMaqueta } from './utilidades'

async function abrir(page: Page, accion: string, consulta = '') {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/zonas-comunes/${accion}${consulta}`)
}

test.describe('zonas comunes y reservas', () => {
  test('reserva la piscina desde la maqueta y queda confirmada', async ({ page }) => {
    await entrar(page, 'uno')
    await esperarMaqueta(page)
    await elegirZona(page, 'Piscina')
    const panel = page.getByRole('complementary', { name: 'Zona Piscina' })
    await panel.getByRole('link', { name: /^Reservar/ }).click()
    // Un solo recurso en la zona: se abre directo.
    await expect(page.getByRole('heading', { name: 'Reservar: Piscina' })).toBeVisible()
    await expect(page.getByText('Aforo: 25 personas')).toBeVisible()
    await expect(page.getByText('Reserva a nombre de: T1-101')).toBeVisible()
    const calendario = page.getByRole('region', { name: 'Elija la hora de inicio' })
    await calendario.getByRole('button').nth(1).click()
    await expect(page.getByText('Queda confirmada al enviarla.')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar reserva' }).click()
    await expect(page.getByRole('status')).toContainText('quedó confirmada')
    await page.getByRole('link', { name: 'Ver mis reservas' }).click()
    await expect(page.getByRole('table', { name: 'Mis reservas' })).toContainText('Piscina')
  })

  test('una zona sin recursos para reservar lo dice', async ({ page }) => {
    await abrir(page, 'reservar', '?zona=gimnasio')
    await expect(page.getByText('Esta copropiedad no tiene gimnasio para reservar.')).toBeVisible()
    await page.getByRole('button', { name: 'Ver todas las zonas' }).click()
    await expect(page.getByRole('list', { name: 'Zonas para reservar' })).toContainText('Salón social principal')
  })

  test('cancela una reserva propia', async ({ page }) => {
    await abrir(page, 'mis-reservas')
    const tabla = page.getByRole('table', { name: 'Mis reservas' })
    await tabla.getByRole('button', { name: /^Cancelar la reserva de Piscina/ }).first().click()
    const dialogo = page.getByRole('dialog', { name: 'Cancelar la reserva' })
    await dialogo.getByRole('textbox').fill('Tengo un viaje')
    await dialogo.getByRole('button', { name: 'Cancelar reserva' }).click()
    await expect(page.getByRole('status')).toContainText('Reserva cancelada')
  })

  test('la administración aprueba y rechaza, y registra el pago', async ({ page }) => {
    await abrir(page, 'aprobaciones')
    const tabla = page.getByRole('table', { name: 'Reservas por aprobar' })
    await expect(tabla.getByRole('row')).toHaveCount(3)
    await tabla.getByRole('button', { name: 'Aprobar la reserva de T1-102' }).click()
    await expect(page.getByRole('status')).toContainText('aprobada')
    await tabla.getByRole('button', { name: 'Rechazar la reserva de T1-201' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Rechazar la reserva' })
    await dialogo.getByRole('textbox').fill('Ya hay un evento ese día')
    await dialogo.getByRole('button', { name: 'Rechazar' }).click()
    await expect(page.getByText('No hay reservas por aprobar.')).toBeVisible()

    await page.getByRole('link', { name: /Pagos pendientes/ }).click()
    const pagos = page.getByRole('table', { name: 'Reservas con pago pendiente' })
    await pagos.getByRole('button', { name: 'Registrar pago de T1-102' }).click()
    await page.getByRole('dialog', { name: 'Registrar el pago' }).getByRole('button', { name: 'Pagó' }).click()
    await expect(page.getByRole('status')).toContainText('Pago registrado.')
  })

  test('portería entrega y recibe con novedad', async ({ page }) => {
    await abrir(page, 'entregas')
    const tabla = page.getByRole('table', { name: 'Reservas del día' })
    await tabla.getByRole('button', { name: /^Entregar Salón comunal/ }).click()
    await page.getByRole('dialog', { name: 'Entregar la zona' }).getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByRole('status')).toContainText('entregada')
    await tabla.getByRole('button', { name: /^Recibir Salón comunal/ }).click()
    const recibo = page.getByRole('dialog', { name: 'Recibir la zona' })
    await recibo.getByLabel('Novedad (si la hubo)').fill('Una silla rota')
    await recibo.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByRole('status')).toContainText('recibida con novedad')
    await expect(tabla).toContainText('Con novedad')
  })

  test('cambia el estado de un recurso y cancela sus reservas futuras', async ({ page }) => {
    await abrir(page, 'recursos')
    await page.getByRole('link', { name: 'Ver ficha de Salón social principal' }).click()
    await expect(page.getByRole('heading', { name: 'Salón social principal' })).toBeVisible()
    await page.getByRole('link', { name: 'Estado' }).click()
    await page.getByLabel('Estado', { exact: true }).selectOption({ label: 'En mantenimiento' })
    await expect(page.getByText('Al cerrarlo se cancelan sus reservas futuras')).toBeVisible()
    await page.getByRole('button', { name: 'Cambiar estado' }).click()
    await expect(page.getByRole('status')).toContainText('Se cancelaron')
  })

  test('ejecuta el sorteo y revela la semilla', async ({ page }) => {
    await abrir(page, 'sorteos')
    await page.getByRole('link', { name: 'Ver el sorteo Parqueaderos comunales 2027' }).click()
    await expect(page.getByText('Aún oculta')).toBeVisible()
    await page.getByRole('button', { name: 'Ejecutar el sorteo' }).click()
    await page.getByRole('dialog', { name: 'Ejecutar el sorteo' }).getByRole('button', { name: 'Ejecutar' }).click()
    await expect(page.getByRole('status')).toContainText('semilla quedó publicada')
    await expect(page.getByText('Aún oculta')).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Parqueaderos asignados' })).toContainText('C-01')
  })
})

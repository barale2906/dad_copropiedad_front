import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'

/** Entra como guarda de la portería y abre una pantalla del módulo. */
async function abrir(page: Page, accion: string) {
  await entrar(page, 'porteria')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/porteria/${accion}`)
}

/** Firma con el mouse dentro del lienzo. */
async function firmar(page: Page) {
  const lienzo = page.getByRole('img', { name: 'Firma de quien recibe' })
  const caja = await lienzo.boundingBox()
  if (!caja) throw new Error('El lienzo de la firma no está visible')
  await page.mouse.move(caja.x + 20, caja.y + 20)
  await page.mouse.down()
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2, { steps: 8 })
  await page.mouse.move(caja.x + caja.width - 20, caja.y + 30, { steps: 8 })
  await page.mouse.up()
}

test.describe('portería', () => {
  test('un equipo de portería abre el turno al entrar', async ({ page }) => {
    await abrir(page, 'turno')
    await page.getByLabel('Abrir el turno al entrar en este equipo').check()
    await page.getByRole('button', { name: 'Salir' }).click()
    await entrar(page, 'porteria')
    await expect(page.getByRole('heading', { name: 'Turno de portería' })).toBeVisible()
    await expect(page).toHaveURL(/\/porteria\/turno$/)
  })

  test('el guarda entra al turno: anunciar, llamar y dejar pasar', async ({ page }) => {
    await abrir(page, 'turno')
    const abiertas = page.getByRole('list', { name: 'Visitas abiertas' })
    await expect(page.getByRole('alert').filter({ hasText: 'que usted llame' })).toBeVisible()
    // Lo que exige llamar va primero.
    await expect(abiertas.getByRole('listitem').first()).toContainText('Técnico de internet')

    await page.getByRole('button', { name: 'Anunciar visita' }).click()
    const anunciar = page.getByRole('dialog', { name: 'Anunciar visita' })
    await anunciar.getByRole('button', { name: 'Anunciar' }).click()
    await expect(anunciar.getByText('Elija a qué bien va.')).toBeVisible()
    await anunciar.getByLabel(/Buscar apartamento o bien/).fill('T1-102')
    await anunciar.getByRole('button', { name: 'T1-102' }).click()
    await anunciar.getByLabel('Nombre del visitante').fill('Ana Prueba')
    await anunciar.getByRole('button', { name: 'Anunciar' }).click()
    await expect(page.getByRole('status')).toContainText('Visita de Ana Prueba anunciada')
    await expect(abiertas).toContainText('Ana Prueba')

    await abiertas.getByRole('link', { name: 'Llamar por Técnico de internet' }).click()
    await expect(page.getByRole('heading', { name: 'Técnico de internet' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Línea de tiempo de la visita' })).toContainText('a todos los residentes')
    await page.getByRole('button', { name: 'Ver teléfonos' }).click()
    await page.getByRole('dialog', { name: 'Consulta registrada en la auditoría' }).getByRole('button', { name: 'Ver de todos modos' }).click()
    await expect(page.getByRole('list', { name: 'Teléfonos para llamar' }).getByRole('link', { name: /310 555 0102/ })).toHaveAttribute('href', 'tel:3105550102')

    await page.getByRole('button', { name: 'Registrar llamada' }).click()
    const llamada = page.getByRole('dialog', { name: 'Registrar llamada' })
    await llamada.getByLabel('Autorizó').check()
    await llamada.getByLabel('Lucía Gómez').check()
    await llamada.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByRole('status')).toContainText('Llamada registrada: autorizó')
    await page.getByRole('button', { name: 'Dejar pasar' }).click()
    await expect(page.getByText('Adentro', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrar salida' })).toBeVisible()
  })

  test('ingreso con QR por el lector o el teclado', async ({ page }) => {
    await abrir(page, 'turno')
    await page.getByRole('button', { name: 'Ingreso con QR' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Ingreso con QR' })
    const campo = dialogo.getByLabel('Código QR')
    await campo.fill('no-es-un-codigo')
    await campo.press('Enter')
    await expect(dialogo.getByRole('alert')).toContainText('No puede pasar')
    await campo.fill('DAD1.01930000-0000-7000-8000-000000009403.firma')
    await campo.press('Enter')
    await expect(dialogo.getByRole('status')).toContainText('Puede pasar: Jardinero (ingreso 2 de 4)')
  })

  test('recibir un paquete y entregarlo con firma', async ({ page }) => {
    await abrir(page, 'turno')
    await page.getByRole('button', { name: 'Recibir paquete' }).click()
    const recibir = page.getByRole('dialog', { name: 'Recibir paquete' })
    await recibir.getByLabel(/Buscar apartamento o bien/).fill('T1-101')
    await recibir.getByRole('button', { name: 'T1-101' }).click()
    await recibir.getByLabel('Remitente (opcional)').fill('Librería')
    await recibir.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByRole('status')).toContainText('Paquete registrado')

    await page.getByRole('link', { name: /Entregar paquete/ }).click()
    const lista = page.getByRole('list', { name: 'Correspondencia' })
    await lista.getByRole('button', { name: 'Entregar Paquete de Librería de T1-101' }).click()
    const entregar = page.getByRole('dialog', { name: 'Entregar paquete' })
    await entregar.getByLabel(/Marta Residente/).check()
    await entregar.getByRole('button', { name: 'Entregar' }).click()
    await expect(entregar.getByRole('alert')).toContainText('Falta la firma')
    await firmar(page)
    await expect(entregar.getByText('Firma lista.')).toBeVisible()
    await entregar.getByRole('button', { name: 'Entregar' }).click()
    await expect(page.getByRole('status')).toContainText('Entregado a Marta Residente')
    await expect(lista).not.toContainText('Librería')
  })

  test('la minuta solo agrega novedades', async ({ page }) => {
    await abrir(page, 'minuta')
    await page.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Incidente' })
    await page.getByLabel('Qué pasó').fill('Puerta del sótano abierta')
    await page.getByRole('button', { name: 'Agregar a la minuta' }).click()
    await expect(page.getByRole('status')).toContainText('Incidente registrada en la minuta')
    const lista = page.getByRole('list', { name: 'Novedades de la minuta' })
    await expect(lista.getByRole('listitem').first()).toContainText('Puerta del sótano abierta')
    await expect(lista.getByRole('button')).toHaveCount(0)
  })

  test('credenciales: emitir un PIN que se muestra una vez', async ({ page }) => {
    await abrir(page, 'credenciales')
    await page.getByLabel('Buscar persona').fill('marta')
    await page.getByRole('button', { name: /Marta Residente/ }).click()
    const credenciales = page.getByRole('list', { name: 'Credenciales' })
    await expect(credenciales).toContainText('Tarjeta')
    await page.getByRole('button', { name: 'Emitir credencial' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Emitir credencial' })
    await dialogo.getByLabel('Tipo').selectOption({ label: 'PIN' })
    await dialogo.getByRole('button', { name: 'Emitir' }).click()
    await expect(page.getByText('482915')).toBeVisible()
    await expect(page.getByText('no se volverá a mostrar')).toBeVisible()
    await expect(credenciales.getByRole('listitem')).toHaveCount(3)
  })

  test('configuración: registrar un puente muestra su token una vez', async ({ page }) => {
    await abrir(page, 'configuracion')
    await expect(page.getByLabel('Días avisando un paquete sin recoger')).toHaveValue('5')
    await expect(page.getByText('$ 3.915,00')).toBeVisible()
    await page.getByRole('link', { name: 'Puntos y equipos' }).click()
    await page.getByLabel('Nombre del puente nuevo').fill('Puente rampa')
    await page.getByRole('button', { name: 'Registrar puente' }).click()
    await expect(page.getByText(/dadp_.*_secreto_de_maquina/)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Puentes' })).toContainText('Puente rampa')
  })
})

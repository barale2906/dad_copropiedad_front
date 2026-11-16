import { expect, test } from '@playwright/test'
import { elegirZona, entrar, esperarMaqueta } from './utilidades'

test.describe('acceso', () => {
  test('rutas protegidas redirigen al acceso y vuelven después de entrar', async ({ page }) => {
    await page.goto('/entidades')
    await expect(page).toHaveURL(/\/ingresar\?volver=/)
    await page.getByLabel('Usuario o correo').fill('admin')
    await page.getByLabel('Contraseña', { exact: true }).fill('demo')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/entidades$/)
  })

  test('segundo factor: rechaza un código errado y acepta el correcto', async ({ page }) => {
    await entrar(page, 'uno-2fa')
    await expect(page.getByRole('heading', { name: 'Segundo factor' })).toBeVisible()
    await page.getByLabel('Código').fill('000000')
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page.getByRole('alert')).toContainText('no es válido')
    await page.getByLabel('Código').fill('123456')
    await page.getByRole('button', { name: 'Verificar' }).click()
    await esperarMaqueta(page)
  })

  test('la sesión sobrevive a una recarga', async ({ page }) => {
    await entrar(page, 'uno')
    await esperarMaqueta(page)
    await page.reload()
    await esperarMaqueta(page)
  })

  test('cerrar sesión vuelve al acceso', async ({ page }) => {
    await entrar(page)
    await page.getByRole('button', { name: /Salir/ }).click()
    await expect(page).toHaveURL(/\/ingresar/)
  })
})

test.describe('selección de entidad', () => {
  test('con varias entidades se elige; con una se entra directo', async ({ page }) => {
    await entrar(page)
    await expect(page.getByRole('heading', { name: '¿Dónde va a trabajar hoy?' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Los Robles/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /DAD Servicios Contables/ })).toBeVisible()

    await page.getByRole('button', { name: /Salir/ }).click()
    await expect(page).toHaveURL(/\/ingresar/)
    await entrar(page, 'uno')
    await esperarMaqueta(page)
    await expect(page.getByText('Conjunto Residencial Los Robles')).toBeVisible()
  })

  test('una cuenta sin roles ve el aviso y puede salir', async ({ page }) => {
    await entrar(page, 'nuevo')
    await expect(page.getByRole('heading', { name: 'Su cuenta aún no tiene roles' })).toBeVisible()
    await expect(page.getByRole('list')).toHaveCount(0)
    await page.getByRole('button', { name: /Salir/ }).click()
    await expect(page).toHaveURL(/\/ingresar/)
  })

  test('una entidad en configuración se avisa en la barra superior', async ({ page }) => {
    await entrar(page)
    await page.getByRole('button', { name: /Torres del Parque/ }).click()
    await esperarMaqueta(page)
    await expect(page.getByRole('banner')).toContainText('aún está en configuración')
  })
})

test.describe('maqueta del conjunto (PH)', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, 'uno')
    await esperarMaqueta(page)
  })

  test('una zona abre su menú con las acciones del módulo', async ({ page }) => {
    await elegirZona(page, 'Salón social')
    const panel = page.getByRole('complementary', { name: 'Zona Salón social' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('link', { name: /Reservar/ })).toBeVisible()
    await expect(panel.getByRole('link', { name: /Tablero en vivo/ })).toBeVisible()
    await expect(page).toHaveURL(/zona=salon-social/)
  })

  test('las zonas sin módulo contratado se ven apagadas', async ({ page }) => {
    await elegirZona(page, 'Portería')
    const panel = page.getByRole('complementary', { name: 'Zona Portería' })
    await expect(panel).toContainText('Módulo no contratado')
    await expect(panel.getByRole('link')).toHaveCount(0)
  })

  test('el lobby abre el directorio, incluido con la entidad', async ({ page }) => {
    await elegirZona(page, 'Pantalla del lobby')
    const panel = page.getByRole('complementary', { name: 'Zona Pantalla del lobby' })
    await expect(panel.getByRole('link', { name: /Directorio/ }).first()).toBeVisible()
    await expect(panel.getByRole('link', { name: /Enlace para los grupos/ })).toBeVisible()
  })

  test('Escape cierra el panel', async ({ page }) => {
    await elegirZona(page, 'Torres')
    await expect(page.getByRole('complementary')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('complementary')).toHaveCount(0)
  })

  test('acción → módulo con la zona preseleccionada → volver a la misma zona', async ({ page }) => {
    await elegirZona(page, 'Piscina')
    await page.getByRole('link', { name: /Reservar/ }).click()
    await expect(page.getByRole('heading', { name: 'Reservar' })).toBeVisible()
    await expect(page.getByText('Zona preseleccionada')).toContainText('Piscina')
    await page.getByRole('link', { name: /Volver a la maqueta/ }).click()
    await expect(page.getByRole('complementary', { name: 'Zona Piscina' })).toBeVisible()
  })

  test('la vista de lista ofrece las mismas funciones y se recuerda', async ({ page }) => {
    await page.getByRole('button', { name: /Lista/ }).click()
    await expect(page.getByRole('heading', { name: '¿Qué necesita hacer?' })).toBeVisible()
    await page.getByPlaceholder(/Buscar/).fill('censo')
    await expect(page.getByRole('link', { name: 'Censo', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: '¿Qué necesita hacer?' })).toBeVisible()
  })
})

test.describe('maqueta de oficina (empresa)', () => {
  test('muestra la oficina y oculta lo que exige facturación electrónica', async ({ page }) => {
    await entrar(page, 'empresa')
    await esperarMaqueta(page)
    await expect(page.getByRole('listitem').filter({ hasText: 'Recepción' })).toBeVisible()
    await elegirZona(page, 'Contabilidad')
    await expect(page.getByRole('link', { name: /Comprobantes/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await elegirZona(page, 'Facturación')
    // Con solo `contabilidad` se factura, pero sin las acciones ante la DIAN.
    const panel = page.getByRole('complementary', { name: 'Zona Facturación' })
    await expect(panel.getByRole('link', { name: /Facturas de venta/ })).toBeVisible()
    await expect(panel.getByRole('link', { name: /Emitir ante la DIAN/ })).toHaveCount(0)
  })
})

test('sin WebGL se muestra la vista de lista automáticamente', async ({ browser }) => {
  const contexto = await browser.newContext()
  await contexto.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
      return tipo.startsWith('webgl') ? null : (original as (...a: unknown[]) => unknown).call(this, tipo, ...resto)
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  const page = await contexto.newPage()
  await entrar(page, 'uno')
  await expect(page.getByText('no puede mostrar la maqueta 3D')).toBeVisible()
  await expect(page.getByRole('heading', { name: '¿Qué necesita hacer?' })).toBeVisible()
  await contexto.close()
})

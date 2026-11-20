import { expect, type Page, test } from '@playwright/test'
import { elegirZona, entrar, esperarMaqueta } from './utilidades'

const GISLA = '01930000-0000-7000-8000-000000000005'
const ROBLES = '01930000-0000-7000-8000-000000000001'
const TORNILLO = '01930000-0000-7000-8000-000000000006'

/** Entra como equipo de la plataforma (con segundo factor) y abre una acción de la consola. */
async function abrir(page: Page, accion: string, usuario = 'plataforma') {
  await entrar(page, usuario)
  await expect(page).toHaveURL(new RegExp(`/e/${GISLA}`))
  await page.goto(`/e/${GISLA}/plataforma/${accion}`)
}

test.describe('consola de la plataforma', () => {
  test('el centro de operación aparece en la maqueta de la plataforma', async ({ page }) => {
    await entrar(page, 'plataforma')
    await esperarMaqueta(page)
    await elegirZona(page, 'Centro de operación')
    const panel = page.getByRole('complementary', { name: 'Zona Centro de operación' })
    await expect(panel.getByRole('link', { name: /Clientes/ })).toBeVisible()
    await expect(panel.getByRole('link', { name: /Moderación/ })).toBeVisible()
  })

  test('sin segundo factor la consola queda con candado y lleva a activarlo', async ({ page }) => {
    await abrir(page, 'clientes', 'operador')
    await expect(page.getByText('La consola de la plataforma exige el segundo factor')).toBeVisible()
    await page.getByRole('link', { name: 'Activar el segundo factor en Mi cuenta' }).click()
    await expect(page).toHaveURL(/\/cuenta#segundo-factor/)
  })

  test('da de alta una PH con su administrador nuevo y la activa', async ({ page }) => {
    await abrir(page, 'clientes')
    await expect(page.getByRole('link', { name: 'Conjunto Residencial Los Robles' })).toBeVisible()
    await page.getByRole('button', { name: 'Dar de alta' }).click()
    const alta = page.getByRole('dialog', { name: 'Dar de alta un cliente' })
    await alta.getByLabel('Nombre', { exact: true }).fill('Conjunto Los Pinos')
    await alta.getByRole('button', { name: 'Siguiente' }).click()
    await alta.getByRole('button', { name: 'Siguiente' }).click()
    await expect(alta.getByText('Escriba un correo válido')).toBeVisible()
    await alta.getByLabel('Nombre del administrador').fill('Ana Administradora')
    await alta.getByLabel('Correo del administrador').fill('ana@pinos.co')
    await alta.getByRole('button', { name: 'Siguiente' }).click()
    await expect(alta).toContainText('ana@pinos.co')
    await alta.getByRole('button', { name: 'Dar de alta' }).click()

    await expect(page.getByRole('heading', { name: 'Conjunto Los Pinos', level: 1 })).toBeVisible()
    await expect(page.getByText('En configuración', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Activar' }).click()
    await page.getByRole('dialog', { name: /Activar Conjunto Los Pinos/ }).getByRole('button', { name: 'Activar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'quedó activa' })).toBeVisible()
  })

  test('reactiva una empresa suspendida y la vuelve a suspender', async ({ page }) => {
    await abrir(page, `clientes/${TORNILLO}`)
    await expect(page.getByRole('heading', { name: 'Ferretería El Tornillo S.A.S.', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Activar' }).click()
    await page.getByRole('dialog', { name: /Activar/ }).getByRole('button', { name: 'Activar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'quedó activa' })).toBeVisible()
    await page.getByRole('button', { name: 'Suspender' }).click()
    const dialogo = page.getByRole('dialog', { name: /Suspender/ })
    await expect(dialogo).toContainText('solo podrán consultar')
    await dialogo.getByRole('button', { name: 'Suspender' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'quedó suspendida' })).toBeVisible()
  })

  test('filtra los clientes por estado en el backend; un id inexistente se explica', async ({ page }) => {
    await abrir(page, 'clientes')
    await expect(page.getByRole('link', { name: 'Conjunto Residencial Los Robles' })).toBeVisible()
    await page.getByLabel('Estado', { exact: true }).selectOption({ label: 'Suspendida' })
    await expect(page.getByRole('link', { name: 'Conjunto Residencial Los Robles' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Ferretería El Tornillo S.A.S.' })).toBeVisible()
    await page.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Propiedad horizontal' })
    await expect(page.getByText('Ningún cliente coincide con la búsqueda.')).toBeVisible()

    await page.goto(`/e/${GISLA}/plataforma/clientes/01930000-0000-7000-8000-000000099999`)
    await expect(page.getByText('Ese cliente no existe.')).toBeVisible()
  })

  test('los roles de plataforma de una cuenta: vigentes, historial, quitar y asignar', async ({ page }) => {
    await abrir(page, 'usuarios')
    await page.getByLabel('Usuario o correo de la cuenta').fill('julian')
    await page.getByRole('button', { name: 'Buscar cuenta' }).click()
    const vigentes = page.getByRole('list', { name: 'Roles de plataforma vigentes' })
    await expect(vigentes).toContainText('Soporte')
    await expect(page.getByText('Historial (1)')).toBeVisible()
    await vigentes.getByRole('button', { name: 'Quitar Soporte' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Rol de plataforma quitado.' })).toBeVisible()
    await expect(page.getByText('No tiene roles de plataforma vigentes.')).toBeVisible()
    await expect(page.getByText('Historial (2)')).toBeVisible()
    const roles = page.getByRole('region', { name: 'Roles de plataforma' })
    await roles.getByLabel('Rol de plataforma').selectOption({ label: 'Comercial' })
    await roles.getByRole('button', { name: 'Asignar', exact: true }).click()
    await expect(vigentes).toContainText('Comercial')
  })

  test('ver como soporte abre la entidad en solo lectura', async ({ page }) => {
    await abrir(page, `clientes/${ROBLES}`)
    await page.getByRole('button', { name: 'Ver como soporte' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Ver como soporte' })
    await dialogo.getByLabel('Motivo').fill('El administrador reporta un error en la cartera')
    await dialogo.getByRole('button', { name: 'Abrir en solo lectura' }).click()
    await expect(page).toHaveURL(new RegExp(`/e/${ROBLES}`))
    await expect(page.getByRole('status').filter({ hasText: 'Modo soporte · solo lectura' })).toBeVisible()
    await expect(page.getByRole('banner')).toContainText('Conjunto Residencial Los Robles')
  })

  test('moderación con cuatro ojos: lo propio lo modera otra cuenta', async ({ page }) => {
    await abrir(page, 'moderacion')
    await page.getByRole('button', { name: 'Aprobar Uniformes listos en una semana' }).click()
    await expect(page.getByRole('alert')).toContainText('debe moderarlo otra cuenta')
    await page.getByRole('button', { name: 'Aprobar Vestidos a la medida' }).click()
    await expect(page.getByRole('status')).toContainText('Aprobar: listo')
    await expect(page.getByRole('button', { name: 'Aprobar Vestidos a la medida' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Reseñas reportadas' }).click()
    await page.getByRole('button', { name: /^Ocultar/ }).click()
    const dialogo = page.getByRole('dialog', { name: /Ocultar/ })
    await dialogo.getByLabel('Motivo').fill('Lenguaje ofensivo')
    await dialogo.getByRole('button', { name: 'Ocultar' }).click()
    await expect(page.getByText('No hay nada por moderar en esta cola.')).toBeVisible()
  })

  test('envía una campaña a revisión desde la ficha del comercio', async ({ page }) => {
    await abrir(page, 'comercios')
    await page.getByRole('link', { name: 'Modistería Rosa' }).click()
    await expect(page.getByRole('heading', { name: 'Modistería Rosa', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Abrir la campaña Uniformes escolares' }).click()
    await expect(page.getByRole('heading', { name: 'Uniformes escolares', level: 3 })).toBeVisible()
    await page.getByRole('button', { name: 'Enviar a revisión' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'en revisión' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toHaveCount(0)
  })

  test('aprueba un corte y lo marca pagado con factura externa', async ({ page }) => {
    await abrir(page, 'cobros')
    await page.getByRole('button', { name: /^Abrir el corte/ }).first().click()
    const corte = page.getByRole('dialog', { name: /Corte de/ })
    await expect(corte).toContainText('Por revisar')
    await corte.getByRole('button', { name: 'Aprobar' }).click()
    await expect(corte).toContainText('Por facturar')
    await corte.getByRole('button', { name: 'Registrar factura externa' }).click()
    await corte.getByLabel('Número de la factura').fill('FE-901')
    await corte.getByRole('button', { name: /Confirmar: registrar factura externa/ }).click()
    await expect(corte).toContainText('FE-901')
    await corte.getByRole('button', { name: 'Registrar pago' }).click()
    await corte.getByRole('button', { name: /Confirmar: registrar pago/ }).click()
    await expect(corte).toContainText('Pagado')
  })

  test('el PUC pegado se revisa antes de cargarlo', async ({ page }) => {
    await abrir(page, 'normativa?vista=puc')
    const campo = page.getByLabel('Cuentas (CSV: código, nombre, naturaleza)')
    await campo.fill('110505,Caja general,debito\n11x,Mala,D')
    await expect(page.getByText('1 cuentas listas y 1 filas con errores')).toBeVisible()
    await expect(page.getByRole('button', { name: /Cargar 1 cuentas/ })).toBeDisabled()
    await campo.fill('110505,Caja general,debito\n2205,Proveedores,C')
    await page.getByRole('button', { name: 'Cargar 2 cuentas' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Se insertaron o actualizaron 2 cuentas' })).toBeVisible()
  })
})

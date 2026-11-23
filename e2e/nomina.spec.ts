import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'
const GISLA = '01930000-0000-7000-8000-000000000005'

/** Fecha en la zona de las entidades del demo, `dias` días después de hoy. */
const fechaDemo = (dias = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(Date.now() + dias * 86_400_000))

/**
 * Abre otra acción de la nómina sin recargar la página (recargar reinicia los datos del demo):
 * migas → sección → acción.
 */
async function irA(page: Page, accion: string) {
  await page.getByRole('navigation', { name: 'Ruta' }).getByRole('link', { name: 'Nómina' }).click()
  await page.getByRole('main').getByRole('link', { name: new RegExp(`^${accion}`) }).click()
}

async function abrir(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/nomina/${ruta}`)
}

test.describe('nómina', () => {
  test('alta de un empleado → novedad → liquidar → aprobar otro periodo → pagar → desprendible en «Mi nómina»', async ({ page }) => {
    await abrir(page, 'empleados')
    await expect(page.getByRole('table', { name: 'Empleados' })).toContainText('Andrés Administrador')
    await page.getByRole('link', { name: 'Nuevo empleado' }).click()

    // Persona
    await page.getByLabel('Código del empleado').fill('E-050')
    await page.getByLabel('Es una persona nueva').check()
    await page.getByLabel('Nombre completo').fill('Sofía Recepción')
    await page.getByLabel('Número de documento').fill('52999111')
    await page.getByRole('button', { name: 'Siguiente' }).click()
    // Contrato
    await page.getByLabel('Fecha de inicio').fill(fechaDemo(-5))
    await page.getByRole('button', { name: 'Siguiente' }).click()
    // Condiciones
    await page.getByLabel('Cargo').fill('Recepcionista')
    await page.getByLabel('Salario mensual').fill('1600000')
    await page.getByLabel('EPS', { exact: true }).selectOption({ label: 'EPS Sura (EPS010)' })
    await page.getByLabel('Banco').fill('Davivienda')
    await page.getByLabel('Número de la cuenta').fill('0099887766')
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await page.getByRole('button', { name: 'Crear el empleado' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Sofía Recepción quedó como empleado' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sofía Recepción', level: 1 })).toBeVisible()
    await expect(page.getByRole('list', { name: /Versiones del contrato/ })).toContainText('Recepcionista')

    // Novedad
    await irA(page, 'Novedades')
    await page.getByRole('button', { name: 'Registrar novedad' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Registrar novedad' })
    await dialogo.getByLabel('Empleado').selectOption({ label: 'E-050 · Sofía Recepción' })
    await dialogo.getByLabel('Tipo de novedad').selectOption({ label: 'Hora extra diurna' })
    await dialogo.getByLabel('Horas').fill('2')
    await dialogo.getByRole('button', { name: 'Registrar la novedad' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Novedad registrada' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Novedades' })).toContainText('Sofía Recepción')

    // El periodo en curso: lo liquida la cuenta de la sesión y queda pendiente de otra persona.
    await irA(page, 'Periodos y liquidación')
    const periodos = page.getByRole('table', { name: 'Periodos de nómina' })
    await periodos.getByRole('link').first().click()
    await page.getByRole('button', { name: 'Liquidar el periodo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Periodo liquidado: 5 empleados' })).toBeVisible()
    await expect(page.getByText('Pendiente de aprobación por otra persona')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aprobar la nómina' })).toHaveCount(0)

    // El del mes pasado lo liquidó otra cuenta: se aprueba, se paga y se envían los desprendibles.
    await page.getByRole('link', { name: 'Periodos', exact: true }).first().click()
    await periodos.getByRole('link').nth(1).click()
    await page.getByRole('button', { name: 'Aprobar la nómina' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Periodo aprobado' })).toBeVisible()
    await page.getByRole('button', { name: 'Registrar el pago' }).click()
    await page.getByRole('dialog', { name: 'Registrar el pago' }).getByRole('button', { name: 'Registrar el pago' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Periodo pagado' })).toBeVisible()
    await page.getByRole('button', { name: 'Enviar desprendibles por correo' }).click()
    await expect(page.getByRole('status').filter({ hasText: /Se enviaron \d+ desprendibles/ })).toBeVisible()

    // «Mi nómina»: el administrador también es empleado de la PH.
    await page.getByRole('link', { name: 'Mi cuenta' }).click()
    const mia = page.getByRole('region', { name: 'Mi nómina' })
    await expect(mia.getByRole('listitem')).toHaveCount(2)
    const descarga = page.waitForEvent('download')
    await mia.getByRole('button', { name: /^Desprendible/ }).first().click()
    expect((await descarga).suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('inicio con los contratos por vencer; prorrogar y terminar con la simulación', async ({ page }) => {
    await abrir(page, 'inicio')
    const porVencer = page.getByRole('list', { name: 'Contratos por vencer' })
    await expect(porVencer.getByRole('listitem')).toHaveCount(2)
    await expect(porVencer.getByRole('listitem').first()).toContainText('Vence en 20 días')

    await porVencer.getByRole('link', { name: 'E-002 · Marta Gómez' }).click()
    await expect(page.getByRole('heading', { name: 'Marta Gómez', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: 'Prorrogar' }).click()
    await page.getByRole('dialog', { name: 'Prorrogar el contrato' }).getByLabel('Nueva fecha de terminación').fill(fechaDemo(395))
    await page.getByRole('dialog', { name: 'Prorrogar el contrato' }).getByRole('button', { name: 'Prorrogar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Contrato prorrogado' })).toBeVisible()

    await irA(page, 'Inicio')
    await page.getByRole('list', { name: 'Contratos por vencer' }).getByRole('link', { name: 'E-004 · Lucía Vigilante' }).click()
    await page.getByRole('button', { name: 'Terminar el contrato' }).click()
    const terminar = page.getByRole('dialog', { name: 'Terminar el contrato' })
    await terminar.getByLabel('Motivo').selectOption({ label: 'Despido sin justa causa' })
    await terminar.getByRole('button', { name: 'Simular el costo' }).click()
    await expect(terminar.getByRole('list', { name: 'Liquidación del contrato' })).toContainText('Indemnización')
    await terminar.getByRole('button', { name: 'Registrar la terminación' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Liquide el periodo de esa fecha' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Terminar el contrato' })).toHaveCount(0)
  })

  test('el catálogo laboral de la consola de la plataforma', async ({ page }) => {
    await entrar(page, 'plataforma')
    await expect(page).toHaveURL(new RegExp(`/e/${GISLA}`))
    await page.goto(`/e/${GISLA}/plataforma/normativa?vista=laboral`)
    await expect(page.getByRole('table', { name: 'Parámetros laborales' })).toContainText('Salario mínimo')
    await page.getByRole('button', { name: 'Inactivar Positiva' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Positiva quedó inactiva' })).toBeVisible()
  })
})

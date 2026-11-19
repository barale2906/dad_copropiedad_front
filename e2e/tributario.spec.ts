import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'

async function abrir(page: Page, ruta: string, usuario = 'uno') {
  await entrar(page, usuario)
  await expect(page).toHaveURL(/\/e\/[^/]+$/)
  await page.goto(`${new URL(page.url()).pathname}/${ruta}`)
}

test.describe('tributario', () => {
  test('terceros: crear con su NIT y editar los datos fiscales', async ({ page }) => {
    await abrir(page, 'tributario/terceros')
    await page.getByRole('button', { name: 'Nuevo tercero' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nuevo tercero' })
    await dialogo.getByLabel('Documento', { exact: true }).fill('800197268')
    await expect(dialogo.getByText('Dígito de verificación: 4.')).toBeVisible()
    await dialogo.getByLabel('Razón social').fill('Jardines del Norte S.A.S.')
    await dialogo.getByRole('button', { name: 'Crear el tercero' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Jardines del Norte S.A.S.' })).toBeVisible()
    const tabla = page.getByRole('table', { name: 'Terceros' })
    await expect(tabla).toContainText('800.197.268-4')
    await tabla.getByRole('button', { name: 'Datos fiscales de Jardines del Norte S.A.S.' }).click()
    const edicion = page.getByRole('dialog', { name: /Datos fiscales de/ })
    await edicion.getByLabel('Régimen de IVA').selectOption({ label: 'Responsable de IVA' })
    await edicion.getByLabel('Correo de facturación').fill('fe@jardines.co')
    await edicion.getByRole('button', { name: 'Guardar los datos fiscales' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Datos fiscales de «Jardines del Norte S.A.S.» guardados' })).toBeVisible()
    await expect(tabla).toContainText('fe@jardines.co')
  })

  test('perfil: confirmar el borrador y crear una versión nueva', async ({ page }) => {
    await abrir(page, 'tributario/perfil')
    const versiones = page.getByRole('list', { name: 'Versiones del perfil' })
    await expect(versiones).toContainText('Vigente')
    await versiones.getByRole('button', { name: 'Confirmar la versión 2' }).click()
    await page.getByRole('dialog', { name: 'Confirmar la versión 2' }).getByRole('button', { name: 'Confirmar el perfil' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Versión 2 confirmada' })).toBeVisible()
    await page.getByRole('button', { name: 'Nueva versión' }).click()
    await page.getByLabel('Gran contribuyente', { exact: true }).check()
    await expect(page.getByRole('list', { name: 'Revise antes de guardar' })).toContainText('O-13')
    await page.getByLabel('O-13 Gran contribuyente').check()
    await page.getByRole('button', { name: 'Guardar en borrador' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Versión 3 guardada en borrador' })).toBeVisible()
  })

  test('la empresa sin perfil confirmado ve el aviso aquí y en contabilidad', async ({ page }) => {
    await abrir(page, 'tributario/perfil', 'empresa')
    await expect(page.getByText('No hay un perfil tributario confirmado', { exact: false })).toBeVisible()
    await page.goto(page.url().replace(/tributario\/perfil$/, 'contabilidad/inicio'))
    await expect(page.getByText('No hay un perfil tributario confirmado', { exact: false })).toBeVisible()
    await page.getByRole('link', { name: 'Ver el perfil tributario' }).click()
    await expect(page.getByRole('heading', { name: 'Perfil tributario', level: 1 })).toBeVisible()
  })

  test('resoluciones, impuestos con CSV y exógena con huella', async ({ page }) => {
    await abrir(page, 'tributario/resoluciones')
    await page.getByRole('button', { name: 'Nueva resolución' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nueva resolución de numeración' })
    await dialogo.getByLabel('Prefijo').fill('DS')
    await dialogo.getByLabel('Hasta el número').fill('500')
    await dialogo.getByLabel('Número de la resolución').fill('18764000000777')
    await dialogo.getByLabel('Vigente hasta').fill('2030-12-31')
    await dialogo.getByLabel('Clave técnica (opcional)').fill('clave-secreta')
    await dialogo.getByRole('button', { name: 'Registrar la resolución' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'con clave técnica' })).toBeVisible()
    await page.getByRole('button', { name: 'Activar la resolución 18764000000777' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Resolución DS activada' })).toBeVisible()

    await page.goto(page.url().replace(/resoluciones$/, 'impuestos'))
    await expect(page.getByRole('table', { name: 'Retenciones por concepto' })).toContainText('Servicios generales')
    await expect(page.getByText('Cuadra con el mayor')).toBeVisible()
    await page.getByRole('link', { name: 'ICA' }).click()
    await expect(page.getByRole('table', { name: 'ICA estimado' })).toContainText('11001')
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar CSV' }).click()
    expect((await descarga).suggestedFilename()).toMatch(/^ica-.*\.csv$/)

    await page.goto(page.url().replace(/impuestos.*$/, 'exogena'))
    await page.getByRole('button', { name: 'Generar el formato 1001' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Huella SHA-256' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Terceros con datos por corregir' })).toContainText('falta la dirección')
    const csv = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar el CSV' }).click()
    expect((await csv).suggestedFilename()).toBe(`exogena-1001-${Number(new Date().getFullYear()) - 1}-v1.csv`)
  })

  test('beneficiarios finales y crear un proveedor en línea desde una factura', async ({ page }) => {
    await abrir(page, 'tributario/beneficiarios')
    await page.getByRole('searchbox', { name: 'Persona', exact: true }).fill('pedro')
    await page.getByRole('button', { name: /Pedro Pérez/ }).first().click()
    await page.getByLabel('Participación (%)').fill('25')
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Pedro Pérez registrado como beneficiario final' })).toBeVisible()
    await page.getByRole('button', { name: 'Terminar la vigencia de Pedro Pérez' }).first().click()
    await page.getByRole('dialog', { name: 'Terminar la vigencia' }).getByRole('button', { name: 'Terminar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Vigencia terminada' })).toBeVisible()

    await page.goto(`/e/${PH}/tesoreria/cuentas-por-pagar/nueva`)
    await page.getByRole('button', { name: '¿No aparece? Crear proveedor' }).click()
    const crear = page.getByRole('dialog', { name: 'Crear proveedor' })
    await crear.getByLabel('Documento', { exact: true }).fill('901333444')
    await crear.getByLabel('Razón social').fill('Ascensores Andinos S.A.S.')
    await crear.getByRole('button', { name: 'Crear el tercero' }).click()
    await expect(page.getByText('Ascensores Andinos S.A.S.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cambiar proveedor' })).toBeVisible()
  })
})

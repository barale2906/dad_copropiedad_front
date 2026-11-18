import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'

async function abrir(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/contabilidad/${ruta}`)
}

/** Elige una cuenta escribiendo su código y Enter (combobox del editor). */
async function cuenta(page: Page, linea: number, codigo: string) {
  const campo = page.getByRole('combobox', { name: `Cuenta de la línea ${linea}` })
  await campo.fill(codigo)
  await campo.press('Enter')
}

test.describe('contabilidad', () => {
  test('crear, previsualizar, contabilizar y revertir un comprobante', async ({ page }) => {
    await abrir(page, 'comprobantes')
    await expect(page.getByRole('table', { name: 'Comprobantes' })).toContainText('Causación de la vigilancia del mes')
    await page.getByRole('link', { name: 'Nuevo comprobante' }).click()
    await page.getByLabel('Descripción').fill('Compra de papelería')
    await cuenta(page, 1, '513505')
    await page.getByLabel('Centro de costo de la línea 1').selectOption({ label: 'ADM · Administración' })
    await page.getByLabel('Débito de la línea 1').fill('50000')
    await cuenta(page, 2, '110505')
    await page.getByLabel('Crédito de la línea 2').fill('40000')
    await expect(page.getByRole('list', { name: 'Pendientes del comprobante' })).toContainText('no suman lo mismo')

    await page.getByRole('button', { name: 'Previsualizar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'no cuadra' })).toBeVisible()
    await page.getByLabel('Crédito de la línea 2').fill('')
    await page.getByLabel('Crédito de la línea 2').press('=')
    await expect(page.getByRole('status').filter({ hasText: 'Cuadra' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Previsualizar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Cuadra: el asiento suma $ 50.000,00' })).toBeVisible()

    await page.getByRole('button', { name: 'Guardar borrador' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toBeVisible()
    await page.getByRole('button', { name: 'Contabilizar', exact: true }).click()
    await page.getByRole('dialog', { name: 'Contabilizar el comprobante' }).getByRole('button', { name: 'Contabilizar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Contabilizado como CC-4' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Líneas del comprobante' })).toContainText('513505 · Aseo y vigilancia')

    await page.getByRole('button', { name: 'Revertir' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Revertir el comprobante' })
    await dialogo.getByLabel('Motivo').fill('Se registró por error')
    await dialogo.getByRole('button', { name: 'Revertir' }).click()
    await expect(page.getByRole('heading', { name: 'CC-5' })).toBeVisible()
    await expect(page.getByText('Este comprobante revierte')).toBeVisible()
    await expect(page.getByText('Se registró por error')).toBeVisible()
  })

  test('cerrar un periodo y reabrir otro con la aprobación de otra cuenta', async ({ page }) => {
    await abrir(page, 'periodos')
    await page.getByRole('button', { name: /^Cerrar el periodo de / }).first().click()
    await page.getByRole('dialog', { name: /^Cerrar / }).getByRole('button', { name: 'Cerrar el periodo' }).click()
    await expect(page.getByRole('status').filter({ hasText: ': cerrado.' })).toBeVisible()

    await page.getByRole('button', { name: 'Aprobar la reapertura' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Reapertura aprobada' })).toBeVisible()

    await page.getByRole('button', { name: /^Solicitar reapertura de / }).first().click()
    const dialogo = page.getByRole('dialog', { name: /^Reabrir / })
    await dialogo.getByLabel('Motivo').fill('Falta la nota de la conciliación bancaria')
    await dialogo.getByRole('button', { name: 'Solicitar la reapertura' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'la aprueba otra persona' })).toBeVisible()
    await expect(page.getByText('La aprueba otra persona con permiso para hacerlo.')).toBeVisible()
  })

  test('crear una cuenta propia y un centro de costo', async ({ page }) => {
    await abrir(page, 'puc')
    await expect(page.getByRole('table', { name: 'Cuentas del plan' })).toContainText('Caja general')
    await page.getByRole('button', { name: 'Nueva cuenta' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nueva cuenta' })
    await dialogo.getByLabel('Código').fill('11100503')
    await expect(dialogo.getByText(/depende de 111005 · Moneda nacional/)).toBeVisible()
    await dialogo.getByLabel('Nombre').fill('Davivienda ahorros')
    await dialogo.getByRole('button', { name: 'Crear la cuenta' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Cuenta 11100503 creada.' })).toBeVisible()
    await page.getByLabel('Buscar cuenta').fill('davivienda')
    await expect(page.getByRole('table', { name: 'Cuentas del plan' })).toContainText('11100503')

    await page.getByRole('link', { name: 'Centros de costo' }).click()
    await page.getByLabel('Código del centro').fill('PRQ')
    await page.getByLabel('Nombre del centro').fill('Parqueaderos')
    await page.getByRole('button', { name: 'Agregar centro' }).click()
    await expect(page.getByRole('list', { name: 'Centros de costo' })).toContainText('PRQ · Parqueaderos')
  })

  test('el inicio resume y los reportes se pliegan y exportan con huella', async ({ page }) => {
    await abrir(page, 'inicio')
    const resumen = page.getByRole('list', { name: 'Resumen contable' })
    await expect(resumen).toContainText('Comprobantes en borrador')
    await expect(resumen).toContainText('Grupo 2 (NIIF para pymes)')
    await page.getByRole('link', { name: 'Balance de prueba' }).click()
    const balance = page.getByRole('table', { name: 'Balance de prueba' })
    await expect(balance).toContainText('Cuotas de administración')
    await expect(page.getByText('Sumas iguales', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Plegar 4', exact: true }).click()
    await expect(balance).not.toContainText('Cuotas de administración')
    await page.getByRole('button', { name: 'Exportar CSV' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Huella SHA-256' })).toContainText('balance-prueba.csv')

    await page.getByRole('link', { name: 'Libro mayor' }).click()
    await page.getByRole('combobox', { name: 'Cuenta del mayor' }).fill('11')
    await page.getByRole('combobox', { name: 'Cuenta del mayor' }).press('Enter')
    await expect(page.getByRole('table', { name: 'Movimientos del mayor' })).toContainText('Saldos iniciales')

    await page.getByRole('link', { name: 'Estados financieros' }).click()
    await expect(page.getByRole('table', { name: 'Estado de resultados' })).toContainText('Excedente del ejercicio')
    await expect(page.getByRole('button', { name: 'Imprimir o guardar como PDF' })).toBeEnabled()
  })

  test('configuración: tipo de comprobante, nota y vista previa de una plantilla', async ({ page }) => {
    await abrir(page, 'configuracion?vista=tipos')
    await page.getByLabel('Código del tipo').fill('AJ')
    await page.getByLabel('Nombre del tipo').fill('Ajustes de fin de año')
    await page.getByRole('button', { name: 'Agregar tipo' }).click()
    await expect(page.getByRole('list', { name: 'Tipos de comprobante' })).toContainText('AJ · Ajustes de fin de año')

    await page.getByRole('link', { name: 'Notas' }).click()
    await page.getByLabel('Título de la nota').fill('Efectivo restringido')
    await page.getByLabel('Texto de la nota').fill('El fondo de imprevistos está en una cuenta separada.')
    await page.getByRole('button', { name: 'Guardar la nota' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Nota 2 guardada' })).toBeVisible()

    await page.getByRole('link', { name: 'Plantillas' }).click()
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await expect(page.getByRole('list', { name: 'Lo que haría la plantilla' })).toContainText('12 cuentas nuevas')
    await page.getByRole('button', { name: 'Aplicar la plantilla' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Plantilla aplicada' })).toBeVisible()
  })

  test('apertura: saldos desde CSV y cierre anual con vista previa', async ({ page }) => {
    await abrir(page, 'apertura')
    await page.getByLabel('Cargar desde CSV').setInputFiles({
      name: 'saldos.csv', mimeType: 'text/csv',
      buffer: Buffer.from('cuenta;debito;credito\n110505;250000;\n310505;;250000\nCaja;1;\n'),
    })
    await expect(page.getByRole('list', { name: 'Filas del CSV con errores' })).toContainText('Fila 4')
    await expect(page.getByRole('combobox', { name: 'Cuenta de la línea 2' })).toHaveValue(/310505/)
    await page.getByLabel('Fecha', { exact: true }).fill(new Date().toISOString().slice(0, 10))
    await page.getByRole('button', { name: 'Registrar los saldos iniciales' }).click()
    await page.getByRole('dialog', { name: 'Registrar los saldos iniciales' }).getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Saldos iniciales registrados como AP-2' })).toBeVisible()

    await page.getByRole('link', { name: 'Cierre anual' }).click()
    await page.getByLabel('Año que se cierra').selectOption(String(new Date().getFullYear()))
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await expect(page.getByText(/Excedente de \d{4}/)).toBeVisible()
    await page.getByRole('button', { name: 'Contabilizar el cierre' }).click()
    await expect(page.getByRole('status').filter({ hasText: /Cierre de \d{4} contabilizado como CI-1/ })).toBeVisible()
  })

  test('en la empresa, la sala de juntas muestra solo los estados financieros', async ({ page }) => {
    await entrar(page, 'empresa')
    await expect(page).toHaveURL(/\/e\/[^/]+$/)
    await page.goto(`${new URL(page.url()).pathname}/reportes/estados-financieros`)
    await expect(page.getByRole('heading', { name: 'Estados financieros', level: 1 })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Estado de situación financiera' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Reportes' })).toHaveCount(0)
  })
})


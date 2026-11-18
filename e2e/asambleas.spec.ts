import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

async function abrir(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(new RegExp(`/e/${PH}`))
  await page.goto(`/e/${PH}/asambleas/${ruta}`)
}

/** `YYYY-MM-DDT18:00` dentro de `dias` días, como lo pide un `datetime-local`. */
function enDias(dias: number) {
  const f = new Date(Date.now() + dias * 86_400_000)
  return `${f.toISOString().slice(0, 10)}T18:00`
}

test.describe('asambleas', () => {
  test('preparar y convocar una asamblea ordinaria', async ({ page }) => {
    await abrir(page, 'convocar')
    await page.getByLabel('Título').fill('Ordinaria de prueba')
    await page.getByLabel('Fecha y hora').fill(enDias(5))
    await expect(page.getByText(/al menos 15 días calendario/)).toBeVisible()
    await page.getByLabel('Fecha y hora').fill(enDias(30))
    await expect(page.getByText(/al menos 15 días calendario/)).toHaveCount(0)
    await page.getByLabel('Lugar').fill('Salón social')
    await page.getByRole('button', { name: 'Crear y seguir' }).click()

    await expect(page.getByRole('heading', { name: 'Preparar: Ordinaria de prueba' })).toBeVisible()
    await page.getByLabel('Punto nuevo').fill('Verificación del quórum')
    await page.getByRole('button', { name: 'Agregar punto' }).click()
    await expect(page.getByRole('list', { name: 'Orden del día' })).toContainText('Verificación del quórum')
    await page.getByLabel('Punto nuevo').fill('Aprobación del presupuesto')
    await page.getByRole('button', { name: 'Agregar punto' }).click()
    await page.getByRole('button', { name: 'Subir «Aprobación del presupuesto»' }).click()
    await expect(page.getByRole('list', { name: 'Orden del día' }).getByRole('listitem').first()).toContainText('Aprobación del presupuesto')

    await page.getByRole('navigation', { name: 'Pasos para convocar' }).getByRole('button', { name: /Convocatoria/ }).click()
    await page.getByRole('button', { name: 'Ver vista previa' }).click()
    await expect(page.getByText('el padrón queda fijo')).toBeVisible()
    await page.getByRole('button', { name: 'Convocar', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Convocada:' })).toContainText('40 bienes en el padrón')
    await expect(page.getByRole('list', { name: 'Constancias de envío' })).toBeVisible()
  })

  test('la mesa registra en un toque y exige el soporte de los poderes', async ({ page }) => {
    await abrir(page, `registro/${vid(4003)}`)
    await page.getByLabel('Buscar en el padrón').fill('T1-401')
    const coincidencias = page.getByRole('list', { name: 'Coincidencias en el padrón' })
    await coincidencias.getByRole('button', { name: /Registrar a Titular T1-401/ }).click()
    await expect(page.getByRole('status')).toContainText('Titular T1-401 registrado con 1 bien(es)')
    await expect(page.getByRole('list', { name: 'Asistentes' })).toContainText('Titular T1-401')
    await expect(page.getByRole('list', { name: 'Asistentes' })).toContainText('2,500000 %')

    await page.getByLabel('Buscar en el padrón').fill('T1-402')
    await coincidencias.getByRole('button', { name: 'Con poder para T1-402' }).click()
    const poder = page.getByRole('dialog', { name: 'Apoderado de T1-402' })
    await poder.getByLabel('Nombre del apoderado').fill('Ana Apoderada')
    await poder.getByLabel('Documento del apoderado').fill('1010')
    await poder.getByRole('button', { name: 'Registrar apoderado' }).click()
    await expect(poder.getByRole('alert')).toContainText('exige el soporte escrito')
    await poder.getByRole('button', { name: 'Cancelar' }).click()

    const asistentes = page.getByRole('list', { name: 'Asistentes' })
    await asistentes.getByRole('button', { name: 'Salida de Titular T1-101' }).click()
    await page.getByRole('dialog', { name: 'Salida de Titular T1-101' }).getByRole('button', { name: 'Registrar salida' }).click()
    await expect(page.getByRole('status')).toContainText('Salida de Titular T1-101 registrada')
    await asistentes.getByRole('button', { name: 'Reingreso de Titular T1-101' }).click()
    await expect(page.getByRole('status')).toContainText('volvió a la sala')
  })

  test('sin quórum no se instala; con quórum se conduce el orden del día', async ({ page }) => {
    await abrir(page, `en-vivo/${vid(4003)}`)
    await expect(page.getByRole('meter', { name: 'Quórum por coeficiente' })).toBeVisible()
    await expect(page.getByText('Falta quórum (más del 50 %)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Instalar la asamblea' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Convocar la segunda reunión' })).toBeVisible()

    await page.goto(`/e/${PH}/asambleas/en-vivo/${vid(4004)}`)
    await expect(page.getByText('Hay quórum', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Iniciar «Proposiciones»' }).click()
    await expect(page.getByRole('status').filter({ hasText: '«Proposiciones»: en curso' })).toBeVisible()
    await page.getByRole('button', { name: 'Suspender' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Asamblea suspendida' })).toBeVisible()
    await page.getByRole('button', { name: 'Reanudar' }).click()
    await page.getByRole('button', { name: 'Cerrar la asamblea' }).click()
    await page.getByRole('dialog', { name: 'Cerrar la asamblea' }).getByRole('button', { name: 'Cerrar la asamblea' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Asamblea cerrada' })).toBeVisible()
  })

  test('las reuniones se listan por estado con sus actas', async ({ page }) => {
    await abrir(page, 'reuniones')
    const lista = page.getByRole('list', { name: 'Reuniones' })
    await expect(lista.getByRole('listitem')).toHaveCount(6)
    await expect(page.getByRole('list', { name: 'Actas publicadas' })).toContainText('Asamblea ordinaria 2025')
    await lista.getByRole('link', { name: 'Asamblea extraordinaria: fachada' }).click()
    await expect(page.getByRole('link', { name: 'Constancias y morosos' })).toBeVisible()
    await page.getByRole('link', { name: 'Constancias y morosos' }).click()
    await expect(page.getByRole('list', { name: 'Constancias de envío' })).toContainText('Leído')
  })
})

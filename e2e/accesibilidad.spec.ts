import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { entrar, esperarMaqueta } from './utilidades'

// Sin animaciones: axe evalúa el estado final (las entradas con opacidad dan falsos positivos de contraste).
test.use({ contextOptions: { reducedMotion: 'reduce' } })

/** Sin violaciones graves de WCAG 2.1 AA (axe-core) en las pantallas principales. */
async function revisar(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // El lienzo 3D es decorativo (aria-hidden); su contenido accesible son las etiquetas HTML.
    .exclude('canvas')
    .analyze()
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    graves.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([])
}

test('acceso', async ({ page }) => {
  await page.goto('/ingresar')
  await revisar(page)
})

test('selector de entidad', async ({ page }) => {
  await entrar(page)
  await expect(page.getByRole('heading', { name: '¿Dónde va a trabajar hoy?' })).toBeVisible()
  await revisar(page)
})

test('cuenta sin roles', async ({ page }) => {
  await entrar(page, 'nuevo')
  await expect(page.getByRole('heading', { name: 'Su cuenta aún no tiene roles' })).toBeVisible()
  await revisar(page)
})

test('barra superior con aviso de estado', async ({ page }) => {
  await entrar(page)
  await page.getByRole('button', { name: /Torres del Parque/ }).click()
  await esperarMaqueta(page)
  await revisar(page)
})

test('maqueta con panel de zona', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.getByRole('listitem').filter({ hasText: 'Salón social' }).click()
  await expect(page.getByRole('complementary')).toBeVisible()
  await revisar(page)
})

test('vista de lista y marco de módulo', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.getByRole('button', { name: /Lista/ }).click()
  await revisar(page)
  await page.getByRole('link', { name: 'Reservar' }).click()
  await expect(page.getByRole('heading', { name: 'Reservar' })).toBeVisible()
  await revisar(page)
})

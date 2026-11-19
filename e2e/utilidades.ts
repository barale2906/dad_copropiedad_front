import { expect, type Page } from '@playwright/test'

/**
 * Inicia sesión en modo demo. El usuario decide el escenario (ver `src/mocks/demo.ts`):
 * `admin` → 3 entidades, `uno` → 1 PH, `empresa` → oficina, `2fa` → segundo factor.
 */
export async function entrar(page: Page, usuario = 'admin'): Promise<void> {
  await page.goto('/ingresar')
  await page.getByLabel('Usuario o correo').fill(usuario)
  await page.getByLabel('Contraseña', { exact: true }).fill('demo')
  await page.getByRole('button', { name: 'Entrar' }).click()
}

/** Espera a que la maqueta 3D esté dibujada (aparecen las etiquetas de las zonas). */
export async function esperarMaqueta(page: Page): Promise<void> {
  await expect(page.getByRole('list', { name: 'Zonas de la maqueta' })).toBeVisible()
  await expect(page.locator('.etiqueta').first()).toBeVisible({ timeout: 20_000 })
}

/** Elige una zona por su etiqueta (accesible también por teclado). */
export async function elegirZona(page: Page, nombre: string | RegExp): Promise<void> {
  await page.getByRole('listitem').filter({ hasText: nombre }).click()
}

/** Busca y elige un tercero en un `SelectorTercero` (cliente, proveedor, pagador…). */
export async function elegirTercero(page: Page, etiqueta: string, texto: string, nombre: string): Promise<void> {
  await page.getByRole('searchbox', { name: etiqueta, exact: true }).fill(texto)
  // Anclado al inicio: otros botones de la página pueden mencionar el mismo nombre.
  await page.getByRole('button', { name: new RegExp(`^${nombre}`) }).first().click()
}

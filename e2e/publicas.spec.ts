import { expect, test } from '@playwright/test'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
/** Enlaces del demo: el token va en el fragmento (acuerdo A1). */
const papeleta = (asistente: number) => `/papeleta/${PH}#t=demo-papeleta-${vid(asistente)}`

test.describe('páginas públicas (sin sesión)', () => {
  test('la papeleta vota una pregunta, confirma y borra el token de la barra', async ({ page }) => {
    await page.goto(papeleta(4409))
    await expect(page.getByRole('heading', { name: 'Asamblea ordinaria de mitad de año', level: 1 })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/papeleta/${PH}$`))
    const votar = page.getByRole('button', { name: 'Votar' })
    await expect(votar).toBeDisabled()
    await page.getByRole('radio', { name: 'Sí' }).check()
    await votar.click()
    await expect(page.getByRole('status').filter({ hasText: 'Su voto quedó registrado por' })).toBeVisible()
    await page.getByRole('button', { name: 'Listo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Ya votó todas las preguntas abiertas' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Preguntas que ya votó' })).toContainText('estados financieros')
  })

  test('quien ya votó lo ve; en la asamblea mixta el ausente registra su ingreso', async ({ page }) => {
    await page.goto(papeleta(4401))
    await expect(page.getByText('Ya votó todas las preguntas abiertas')).toBeVisible()
    await page.goto(papeleta(4303))
    await expect(page.getByRole('link', { name: /Entrar a la videollamada/ })).toHaveAttribute('href', /meet\.google\.com/)
    await page.getByRole('button', { name: 'Registrar mi ingreso' }).click()
    await expect(page.getByRole('button', { name: 'Salir de la asamblea' })).toBeVisible()
    await page.getByRole('button', { name: 'Salir de la asamblea' }).click()
    await page.getByRole('dialog', { name: '¿Salir de la asamblea?' }).getByRole('button', { name: 'Salir', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Sus votos se conservan' })).toBeVisible()
  })

  test('un enlace sin token o vencido lo dice claramente', async ({ page }) => {
    await page.goto(`/papeleta/${PH}`)
    await expect(page.getByRole('alert')).toHaveText('Este enlace ya no es válido.')
    await page.goto(`/directorio/${PH}#t=viejo`)
    await expect(page.getByRole('alert')).toHaveText('Este enlace ya no es válido.')
  })

  test('el directorio público busca y ofrece el chat de la administración', async ({ page }) => {
    await page.goto(`/directorio/${PH}#t=demo-directorio-7Q4K`)
    await expect(page.getByRole('heading', { name: 'Directorio de Conjunto Residencial Los Robles', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /Busco/ })).toHaveAttribute('href', /wa\.me/)
    await page.getByRole('searchbox', { name: '¿Qué necesita?' }).fill('modista')
    await expect(page.getByRole('heading', { name: 'Modistería Rosa' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toHaveCount(0)
  })

  test('la pantalla del lobby rota las piezas sin controles', async ({ page }) => {
    await page.goto(`/pantalla/${PH}#t=demo-pantalla-ROBLES`)
    const titulo = page.getByRole('heading', { level: 1 })
    await expect(titulo).toHaveText('10 % en arreglos de ropa')
    await expect(page.getByRole('button')).toHaveCount(0)
    // Rota sola cada 12 s.
    await expect(titulo).not.toHaveText('10 % en arreglos de ropa', { timeout: 20_000 })
  })

  test('el comercio redime un cupón y ve los errores claros', async ({ page }) => {
    await page.goto('/comercio#t=demo-cupones-ROSA')
    await page.getByLabel('Código del cupón').fill('rosa10')
    await page.getByRole('button', { name: 'Redimir' }).click()
    await expect(page.getByRole('status')).toContainText('«10 % en arreglos de ropa» quedó redimido')
    await page.getByLabel('Código del cupón').fill('NOEXISTE')
    await page.getByRole('button', { name: 'Redimir' }).click()
    await expect(page.getByRole('alert')).toContainText('Ese código no existe')
  })

  test('verifica un paz y salvo y avisa los códigos que no corresponden', async ({ page }) => {
    await page.goto(`/verificar/${PH}`)
    await page.getByLabel('Código de verificación').fill('PYS-7Q4K-2M9D')
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page.getByRole('status')).toContainText('Paz y salvo válido')
    await page.getByLabel('Código de verificación').fill('ABC-123')
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page.getByRole('status')).toContainText('no corresponde a ningún certificado')
  })
})

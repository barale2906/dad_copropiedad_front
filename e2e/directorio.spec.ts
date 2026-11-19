import { expect, type Page, test } from '@playwright/test'
import { entrar } from './utilidades'

const PH = '01930000-0000-7000-8000-000000000001'
const EMPRESA = '01930000-0000-7000-8000-000000000003'

/** Entra con el usuario y abre una acción del directorio de la entidad. */
async function abrir(page: Page, usuario: string, accion: string, entidad = PH) {
  await entrar(page, usuario)
  await expect(page).toHaveURL(/\/e\//)
  await page.goto(`/e/${entidad}/directorio/${accion}`)
}

test.describe('directorio y publicidad', () => {
  test('busca un comercio, abre su ficha y publica una reseña anónima', async ({ page }) => {
    await abrir(page, 'residente', 'inicio')
    await expect(page.getByRole('heading', { name: 'Destacadas' })).toBeVisible()
    await page.getByRole('searchbox', { name: '¿Qué necesita?' }).fill('modista')
    const resultados = page.getByRole('heading', { name: 'Comercios y servicios' })
    await expect(resultados).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Destacadas' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Modistería Rosa', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Modistería Rosa', level: 1 })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Calificación 4,5 de 5, 12 reseñas' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'WhatsApp de Modistería Rosa' })).toHaveAttribute('href', 'https://wa.me/573001234567')

    await page.getByRole('button', { name: 'Publicar reseña' }).click()
    await expect(page.getByText('Elija de 1 a 5 estrellas.')).toBeVisible()
    await page.getByLabel('5 estrellas: Excelente').check({ force: true })
    await page.getByLabel('Comentario (opcional)').fill('Arreglaron el vestido en un día.')
    await page.getByRole('button', { name: 'Publicar reseña' }).click()
    await expect(page.getByRole('status')).toContainText('Su reseña quedó publicada')
    const lista = page.getByRole('list', { name: 'Reseñas' })
    await expect(lista).toContainText('Su reseña')
    await expect(lista).toContainText('Arreglaron el vestido en un día.')
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible()

    await lista.getByRole('button', { name: /^Reportar/ }).first().click()
    const dialogo = page.getByRole('dialog', { name: 'Reportar reseña' })
    await dialogo.getByLabel('Motivo').fill('Lenguaje ofensivo')
    await dialogo.getByRole('button', { name: 'Reportar' }).click()
    await expect(page.getByRole('status')).toContainText('la moderación revisará la reseña')
  })

  test('la reseña ocultada por la moderación no se puede reemplazar', async ({ page }) => {
    await abrir(page, 'residente', 'inicio/01930000-0000-7000-8000-000000014003')
    await expect(page.getByRole('heading', { name: 'Plomería Express', level: 1 })).toBeVisible()
    await page.getByLabel('3 estrellas: Regular').check({ force: true })
    await page.getByRole('button', { name: 'Publicar reseña' }).click()
    await expect(page.getByRole('alert')).toContainText('La moderación ocultó su reseña anterior')
  })

  test('las ofertas piden autorización; con ella muestra el cupón', async ({ page }) => {
    await abrir(page, 'residente', 'ofertas')
    await expect(page.getByText('Para ver promociones y cupones')).toBeVisible()
    await expect(page.getByRole('heading', { name: '10 % en arreglos de ropa' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Acepto recibir ofertas' }).click()
    await expect(page.getByRole('heading', { name: '10 % en arreglos de ropa' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Agendar visita/ })).toHaveAttribute('href', 'https://lavadorasya.example.co/agendar')
    await page.getByRole('button', { name: 'Obtener cupón de 10 % en arreglos de ropa' }).click()
    await expect(page.getByText('ROSA10')).toBeVisible()
    await page.getByRole('button', { name: 'Dejar de recibir ofertas' }).click()
    await expect(page.getByRole('status')).toContainText('Ya no recibirá ofertas')
    await expect(page.getByRole('button', { name: 'Acepto recibir ofertas' })).toBeVisible()
  })

  test('«Busco …» comparte el contacto solo con el «Sí» explícito', async ({ page }) => {
    await abrir(page, 'residente', 'busco')
    await page.getByLabel('¿Qué busca?').fill('busco costurera')
    await page.getByRole('button', { name: 'Buscar proveedores' }).click()
    await expect(page.getByRole('heading', { name: 'Sugerencias en Costura y modistería' })).toBeVisible()
    const autorizar = page.getByRole('button', { name: 'Autorizar el contacto' })
    await expect(autorizar).toBeDisabled()
    await page.getByLabel(/Sí, autorizo que Modistería Rosa me contacten/).check()
    await autorizar.click()
    await expect(page.getByRole('status')).toContainText('Modistería Rosa recibirán su nombre y su celular')

    await page.getByLabel('¿Qué busca?').fill('qwerty')
    await page.getByRole('button', { name: 'Buscar proveedores' }).click()
    await expect(page.getByRole('alert')).toContainText('No entendimos qué busca')
  })

  test('el enlace para los grupos es estable; generar otro o revocar se confirma', async ({ page }) => {
    await abrir(page, 'uno', 'enlace')
    const actual = page.getByText(new RegExp(`/directorio/${PH}#t=demo-directorio-7Q4K`))
    await expect(actual).toBeVisible()
    await page.reload()
    await expect(actual).toBeVisible()

    await page.getByRole('button', { name: 'Generar otro' }).click()
    const generar = page.getByRole('dialog', { name: '¿Generar otro enlace?' })
    await expect(generar).toContainText('dejará de funcionar')
    await generar.getByRole('button', { name: 'Generar otro' }).click()
    await expect(page.getByRole('status')).toContainText('Enlace generado')
    await expect(actual).toHaveCount(0)
    await expect(page.getByText(new RegExp(`/directorio/${PH}#t=demo-directorio-`))).toBeVisible()

    await page.getByRole('button', { name: 'Revocar' }).click()
    await page.getByRole('dialog', { name: '¿Revocar el enlace?' }).getByRole('button', { name: 'Revocar enlace' }).click()
    await expect(page.getByRole('status')).toContainText('Enlace revocado')
    await expect(page.getByRole('button', { name: 'Generar enlace' })).toBeVisible()
  })

  test('en la empresa no ofrece las acciones propias de la PH ni reseñas', async ({ page }) => {
    await abrir(page, 'empresa', '', EMPRESA)
    const acciones = page.getByRole('main')
    await expect(acciones.getByRole('link', { name: /Ofertas/ })).toBeVisible()
    await expect(acciones.getByRole('link', { name: /Busco/ })).toHaveCount(0)
    await expect(acciones.getByRole('link', { name: /Enlace para los grupos/ })).toHaveCount(0)
    await acciones.getByRole('link', { name: /^Directorio Comercios/ }).click()
    await page.getByRole('link', { name: 'Café para Oficinas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Café para Oficinas', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reseñas de los vecinos' })).toHaveCount(0)
  })
})

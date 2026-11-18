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

test('página no encontrada', async ({ page }) => {
  await page.goto('/no/existe')
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible()
  await revisar(page)
})

test('pantalla de carga', async ({ page }) => {
  let liberar: () => void = () => {}
  const retenida = new Promise<void>((ok) => (liberar = ok))
  await page.route('**/assets/MaquetaView-*.js', async (ruta) => {
    await retenida
    await ruta.continue()
  })
  await entrar(page, 'uno')
  await expect(page.getByRole('status').filter({ hasText: 'Ensamblando módulos' })).toBeVisible()
  await revisar(page)
  liberar()
})

test('definir contraseña', async ({ page }) => {
  await page.goto('/contrasena')
  await expect(page.getByRole('heading', { name: 'Definir contraseña' })).toBeVisible()
  await revisar(page)
})

test('mi cuenta con el segundo factor en inscripción', async ({ page }) => {
  await entrar(page)
  await page.getByRole('link', { name: 'Mi cuenta' }).click()
  await page.getByRole('button', { name: 'Activar segundo factor' }).click()
  await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible()
  await revisar(page)
  await page.getByRole('button', { name: 'Cerrar todas las sesiones' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await revisar(page)
})

test('módulo no contratado', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/porteria`)
  await expect(page.getByText('no está contratado')).toBeVisible()
  await revisar(page)
})

test('usuarios de la entidad, crear y gestionar', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/entidad/usuarios`)
  await expect(page.getByRole('table', { name: 'Usuarios de la entidad' })).toBeVisible()
  await revisar(page)
  await page.getByRole('button', { name: 'Crear usuario' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await revisar(page)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Carga masiva' }).click()
  await revisar(page)
})

test('roles y matriz de permisos', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/entidad/roles`)
  await expect(page.getByRole('table', { name: 'Roles de la entidad' })).toBeVisible()
  await revisar(page)
  await page.getByRole('button', { name: 'Crear rol' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await revisar(page)
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Editar permisos de Auxiliar de cartera' }).click()
  await expect(page.getByRole('heading', { name: 'Permisos del rol' })).toBeVisible()
  await revisar(page)
})

test('ficha, suscripción y auditoría', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  const base = page.url()
  await page.goto(`${base}/entidad/ficha`)
  await expect(page.getByRole('heading', { name: 'Puntos de atención' }).or(page.getByText('Oficina de administración').first())).toBeVisible()
  await revisar(page)
  await page.getByRole('button', { name: 'Cambiar horario de Oficina de administración' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await revisar(page)
  await page.keyboard.press('Escape')
  await page.goto(`${base}/entidad/suscripcion`)
  await expect(page.getByRole('table', { name: 'Facturas de la suscripción' })).toBeVisible()
  await revisar(page)
  await page.goto(`${base}/entidad/auditoria`)
  await expect(page.getByRole('table', { name: 'Eventos de la auditoría' })).toBeVisible()
  await revisar(page)
})

test('archivo de la entidad', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  await page.goto(`${page.url()}/archivo/documentos`)
  await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible()
  await revisar(page)
})

test('protección de datos y organizaciones', async ({ page }) => {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  const base = page.url()
  await page.goto(`${base}/entidad/proteccion-datos`)
  await expect(page.getByRole('table', { name: 'Solicitudes de los titulares' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: 'Política' }).click()
  await expect(page.getByRole('list', { name: 'Versiones de la política' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: 'Autorizaciones' }).click()
  await page.getByLabel('Titular').fill('marta')
  await page.getByRole('button', { name: /Marta Residente/ }).click()
  await expect(page.getByRole('table', { name: 'Autorizaciones de Marta Residente' })).toBeVisible()
  await revisar(page)
  await page.goto(`${base}/entidad/organizaciones`)
  await expect(page.getByRole('table', { name: 'Contratos de servicio' })).toBeVisible()
  await revisar(page)
  await page.getByRole('button', { name: 'Vincular organización' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await revisar(page)
})

/** Revisa con axe cada pantalla de Zonas comunes (título de nivel 1 → sin «Cargando» → axe). */
async function revisarZonas(page: Page, pantallas: [string, string][]) {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  const base = `${page.url()}/zonas-comunes`
  for (const [ruta, titulo] of pantallas) {
    await page.goto(`${base}/${ruta}`)
    await expect(page.getByRole('heading', { name: titulo, exact: true, level: 1 })).toBeVisible()
    await expect(page.getByText('Cargando')).toHaveCount(0)
    await revisar(page)
  }
  return base
}

test('zonas comunes: residente', async ({ page }) => {
  await revisarZonas(page, [
    ['reservar', 'Reservar'],
    ['reservar?zona=piscina', 'Reservar: Piscina'],
    ['mis-reservas', 'Mis reservas'],
    ['disponibilidad', 'Disponibilidad'],
  ])
})

test('zonas comunes: administración', async ({ page }) => {
  await revisarZonas(page, [
    ['aprobaciones', 'Aprobar reservas'],
    ['entregas', 'Entregas y recibos'],
    ['restricciones', 'Restricciones'],
  ])
})

test('zonas comunes: recursos, parqueaderos y sorteos', async ({ page }) => {
  const base = await revisarZonas(page, [
    ['recursos', 'Recursos y reglas'],
    ['parqueaderos', 'Parqueaderos'],
    ['sorteos', 'Sorteos de parqueaderos'],
  ])
  await page.goto(`${base}/recursos`)
  await page.getByRole('link', { name: 'Ver ficha de Piscina' }).click()
  await page.getByRole('link', { name: 'Horario' }).click()
  await expect(page.getByRole('button', { name: 'Guardar horario' })).toBeVisible()
  await revisar(page)
})

/** Revisa con axe pantallas de Unidades (título de nivel 1 → sin «Cargando» → axe). */
async function revisarUnidades(page: Page, pantallas: [string, string][]) {
  await entrar(page, 'uno')
  await esperarMaqueta(page)
  const base = `${page.url()}/unidades`
  for (const [ruta, titulo] of pantallas) {
    await page.goto(`${base}/${ruta}`)
    await expect(page.getByRole('heading', { name: titulo, exact: true, level: 1 })).toBeVisible()
    await expect(page.getByText('Cargando')).toHaveCount(0)
    await revisar(page)
  }
  return base
}

test('unidades: bienes, propietarios y coeficientes', async ({ page }) => {
  const base = await revisarUnidades(page, [
    ['bienes', 'Bienes privados'],
    ['bienes/01930000-0000-7000-8000-000000007001', 'Bienes privados'],
    ['titulares?bien=01930000-0000-7000-8000-000000007001', 'Propietarios'],
    ['coeficientes', 'Coeficientes'],
  ])
  await page.goto(`${base}/coeficientes`)
  await page.getByRole('link', { name: 'Editar el cuadro 2' }).click()
  await expect(page.getByText('Sobra 0,0001')).toBeVisible()
  await revisar(page)
})

test('unidades: censo, cambios y personas', async ({ page }) => {
  await revisarUnidades(page, [
    ['censo', 'Censo'],
    ['censo?vista=alertas', 'Censo'],
    ['censo?vista=campanas', 'Censo'],
    ['cambios-censo', 'Aprobar cambios del censo'],
    ['personas', 'Personas'],
  ])
})

test('unidades: importar y libros', async ({ page }) => {
  await revisarUnidades(page, [
    ['importar', 'Importar planilla'],
    ['libros', 'Libros art. 51'],
  ])
})

test('portal del residente', async ({ page }) => {
  await entrar(page, 'residente')
  await expect(page).toHaveURL(/\/e\//)
  const PH = '01930000-0000-7000-8000-000000000001'
  const pantallas: [string, string][] = [
    ['inicio', 'Mi hogar'],
    ['bienes', 'Mis bienes'],
    ['cartera/01930000-0000-7000-8000-000000007001', 'Mi cartera: T1-101'],
    ['comunicados', 'Mis comunicados'],
    ['pqrs', 'Mis solicitudes'],
    ['visitas', 'Mis visitas y paquetes'],
    ['privacidad', 'Mis datos y privacidad'],
  ]
  for (const [ruta, titulo] of pantallas) {
    await page.goto(`/e/${PH}/mi/${ruta}`)
    await expect(page.getByRole('heading', { name: titulo, exact: true, level: 1 })).toBeVisible()
    await expect(page.getByText('Cargando')).toHaveCount(0)
    await revisar(page)
  }
})

/** Entra como guarda y abre una pantalla de la portería; devuelve la base `/e/<id>`. */
async function entrarAPorteria(page: Page, accion?: string) {
  await entrar(page, 'porteria')
  await expect(page).toHaveURL(/\/e\/[^/]+$/)
  const base = new URL(page.url()).pathname
  if (accion) await page.goto(`${base}/porteria/${accion}`)
  return base
}

test('portería: turno y detalle de visita', async ({ page }) => {
  await entrarAPorteria(page, 'turno')
  await expect(page.getByRole('list', { name: 'Visitas abiertas' })).toBeVisible()
  await revisar(page)
  await page.getByRole('button', { name: 'Anunciar visita' }).click()
  await expect(page.getByRole('dialog', { name: 'Anunciar visita' })).toBeVisible()
  await revisar(page)
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Llamar por Técnico de internet' }).click()
  await expect(page.getByRole('list', { name: 'Línea de tiempo de la visita' })).toBeVisible()
  await revisar(page)
})

test('portería: correspondencia y entrega con firma', async ({ page }) => {
  await entrarAPorteria(page, 'correspondencia')
  await expect(page.getByRole('list', { name: 'Correspondencia' })).toBeVisible()
  await revisar(page)
  await page.getByRole('button', { name: /^Entregar Paquete/ }).first().click()
  await expect(page.getByRole('img', { name: 'Firma de quien recibe' })).toBeVisible()
  await revisar(page)
})

test('portería: minuta, bitácora y credenciales', async ({ page }) => {
  const base = await entrarAPorteria(page)
  for (const [accion, lista] of [['minuta', 'Novedades de la minuta'], ['bitacora', 'Eventos de acceso']] as const) {
    await page.goto(`${base}/porteria/${accion}`)
    await expect(page.getByRole('list', { name: lista })).toBeVisible()
    await revisar(page)
  }
  await page.goto(`${base}/porteria/credenciales`)
  await page.getByLabel('Buscar persona').fill('marta')
  await page.getByRole('button', { name: /Marta Residente/ }).click()
  await expect(page.getByRole('list', { name: 'Credenciales' })).toBeVisible()
  await revisar(page)
})

test('portería: biometría y configuración', async ({ page }) => {
  const base = await entrarAPorteria(page)
  await page.goto(`${base}/porteria/biometria`)
  await page.getByLabel('Buscar persona').fill('marta')
  await page.getByRole('button', { name: /Marta Residente/ }).click()
  await expect(page.getByRole('button', { name: 'Registrar consentimiento' })).toBeVisible()
  await revisar(page)
  await page.goto(`${base}/porteria/configuracion`)
  await expect(page.getByLabel('Días avisando un paquete sin recoger')).toHaveValue('5')
  await revisar(page)
  await page.goto(`${base}/porteria/configuracion?vista=equipos`)
  await expect(page.getByRole('list', { name: 'Dispositivos' })).toBeVisible()
  await revisar(page)
})

/** Entra con la cuenta de una sola PH y abre una pantalla de la administración. */
async function entrarAAdministracion(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(/\/e\/[^/]+$/)
  await page.goto(`${new URL(page.url()).pathname}/administracion/${ruta}`)
}

test('administración: tablero, bandeja y detalle de PQRS', async ({ page }) => {
  await entrarAAdministracion(page, 'tablero')
  await expect(page.getByRole('list', { name: 'Alertas de mantenimiento' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: /PQRS pendientes/ }).click()
  await expect(page.getByRole('list', { name: 'PQRS' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: 'Ruido en el ascensor de la torre 2' }).click()
  await expect(page.getByRole('list', { name: 'Mensajes del ticket' })).toBeVisible()
  await revisar(page)
})

test('administración: configuración de PQRS y chat', async ({ page }) => {
  await entrarAAdministracion(page, 'tickets?vista=configuracion')
  await expect(page.getByRole('list', { name: 'Categorías de PQRS' })).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/tickets.*$/, 'chat'))
  await page.getByRole('link', { name: '+57 300 555 0101' }).click()
  await expect(page.getByRole('list', { name: 'Mensajes de la conversación' })).toBeVisible()
  await revisar(page)
})

test('administración: comunicados y preguntas frecuentes', async ({ page }) => {
  await entrarAAdministracion(page, 'comunicados/nuevo')
  await expect(page.getByLabel('Destinatarios')).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/comunicados.*$/, 'comunicados'))
  await page.getByRole('link', { name: 'Corte de agua el sábado' }).click()
  await expect(page.getByText('lo leyeron')).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/comunicados.*$/, 'preguntas'))
  await expect(page.getByRole('list', { name: 'Preguntas frecuentes' })).toBeVisible()
  await revisar(page)
})

test('administración: mantenimiento', async ({ page }) => {
  await entrarAAdministracion(page, 'mantenimiento')
  await expect(page.getByRole('list', { name: 'Órdenes de trabajo' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: 'Revisión de la motobomba' }).click()
  await expect(page.getByText('Usted ejecutó esta orden: la verifica otra cuenta.')).toBeVisible()
  await revisar(page)
  for (const vista of ['planes', 'obligaciones']) {
    await page.goto(page.url().replace(/mantenimiento.*$/, `mantenimiento?vista=${vista}`))
    await expect(page.getByRole('list', { name: vista === 'planes' ? 'Planes preventivos' : 'Obligaciones periódicas' })).toBeVisible()
    await revisar(page)
  }
})

test('administración: inventario y hoja de vida', async ({ page }) => {
  await entrarAAdministracion(page, 'inventario')
  await expect(page.getByRole('list', { name: 'Activos' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: 'Ascensor torre 1' }).click()
  await expect(page.getByRole('list', { name: 'Movimientos del activo' })).toBeVisible()
  await revisar(page)
})

/** Entra con la cuenta de una sola PH y abre una pantalla de las asambleas. */
async function entrarAAsambleas(page: Page, ruta: string) {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(/\/e\/[^/]+$/)
  await page.goto(`${new URL(page.url()).pathname}/asambleas/${ruta}`)
}
const reunionDemo = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

test('asambleas: reuniones, detalle y preparación', async ({ page }) => {
  await entrarAAsambleas(page, 'reuniones')
  await expect(page.getByRole('list', { name: 'Reuniones' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: 'Asamblea ordinaria de mitad de año' }).click()
  await expect(page.getByRole('list', { name: 'Orden del día' })).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/reuniones.*$/, `convocar/${reunionDemo(4001)}`))
  await expect(page.getByRole('navigation', { name: 'Pasos para convocar' })).toBeVisible()
  await revisar(page)
})

test('asambleas: mesa de registro y conducción', async ({ page }) => {
  await entrarAAsambleas(page, `registro/${reunionDemo(4003)}`)
  await expect(page.getByRole('list', { name: 'Asistentes' })).toBeVisible()
  await page.getByLabel('Buscar en el padrón').fill('T1-40')
  await expect(page.getByRole('list', { name: 'Coincidencias en el padrón' })).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/registro.*$/, `en-vivo/${reunionDemo(4004)}`))
  await expect(page.getByRole('meter', { name: 'Quórum por coeficiente' })).toBeVisible()
  await revisar(page)
})

test('asambleas: votaciones, voto presencial, resultados y proyección', async ({ page }) => {
  await entrarAAsambleas(page, `voto-presencial/${reunionDemo(4004)}`)
  await expect(page.getByRole('list', { name: 'Asistentes presentes' })).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/voto-presencial.*$/, `resultados/${reunionDemo(4004)}`))
  await expect(page.getByRole('list', { name: 'Resultados por opción' })).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/resultados.*$/, `proyeccion/${reunionDemo(4004)}`))
  await expect(page.getByRole('meter', { name: 'Quórum por coeficiente' })).toBeVisible()
  await revisar(page)
})

test('asambleas: acta y reportes', async ({ page }) => {
  await entrarAAsambleas(page, `acta/${reunionDemo(4007)}`)
  await expect(page.getByRole('table', { name: 'Asistentes del acta' })).toBeVisible()
  await revisar(page)
  await page.goto(page.url().replace(/acta.*$/, `reportes/${reunionDemo(4007)}`))
  await expect(page.getByRole('table', { name: 'Asistencia' })).toBeVisible()
  await revisar(page)
})

test('contabilidad: comprobantes, editor, plan de cuentas y periodos', async ({ page }) => {
  await entrar(page, 'uno')
  await expect(page).toHaveURL(/\/e\/[^/]+$/)
  const base = `${new URL(page.url()).pathname}/contabilidad`
  await page.goto(`${base}/comprobantes`)
  await expect(page.getByRole('table', { name: 'Comprobantes' })).toBeVisible()
  await revisar(page)
  await page.getByRole('link', { name: 'NC (borrador)' }).click()
  await expect(page.getByRole('list', { name: 'Líneas del comprobante' })).toBeVisible()
  await revisar(page)
  await page.goto(`${base}/puc`)
  await expect(page.getByRole('table', { name: 'Cuentas del plan' })).toBeVisible()
  await revisar(page)
  await page.goto(`${base}/periodos`)
  await expect(page.getByRole('list', { name: /^Periodos de / })).toBeVisible()
  await revisar(page)
})


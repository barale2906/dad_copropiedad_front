import { beforeEach, describe, expect, it } from 'vitest'
import { limpiar } from '@/api/tokens'
import { asignacionesDe, listarRoles, listarUsuarios } from '@/api/usuarios'
import * as clientes from '@/modulos/plataforma/api-clientes'
import * as cobros from '@/modulos/plataforma/api-cobros'
import * as normativa from '@/modulos/plataforma/api-normativa'
import * as publicidad from '@/modulos/plataforma/api-publicidad'
import { useClientes } from '@/modulos/plataforma/store'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const GISLA = id(5)
const ROBLES = id(1)
const TORNILLO = id(6)

beforeEach(async () => {
  limpiar(false)
  prepararConDemo()
  await useSesion().iniciar('plataforma', 'x')
  await useEntidad().entrar(GISLA)
})

describe('la cuenta de la plataforma', () => {
  it('entra a la entidad de la plataforma con sus permisos y el segundo factor', async () => {
    expect(useSesion().entidades.map((e) => e.tipo)).toEqual(['plataforma'])
    const perfil = await useCuenta().asegurar()
    expect(perfil.segundo_factor_activo).toBe(true)
    expect(useCuenta().permisosPlataforma.has('plataforma.soporte.ver')).toBe(true)
  })

  it('el operador sin segundo factor tiene los permisos pero no el factor', async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('operador', 'x')
    expect((await useCuenta().asegurar()).segundo_factor_activo).toBe(false)
  })
})

describe('clientes', () => {
  it('lista, busca por nombre o NIT y pagina por cursor', async () => {
    const todos = await clientes.listarEntidades(undefined)
    expect(todos.datos.map((e) => e.tipo)).toContain('plataforma')
    expect((await clientes.listarEntidades(undefined, 'robles')).datos).toHaveLength(1)
    expect((await clientes.listarEntidades(undefined, '901333')).datos[0]?.nombre).toContain('Tornillo')
  })

  it('alta de PH y de empresa con administrador nuevo; los dos administradores a la vez dan 422', async () => {
    const ph = await clientes.altaCopropiedad({ nombre: 'Conjunto Los Pinos', administrador: { nombre: 'Ana', correo: 'ana@pinos.co' } }, 'k1')
    expect(ph.nombre).toBe('Conjunto Los Pinos')
    const emp = await clientes.altaEmpresa({ nombre: 'Pinos S.A.S.', administrador_cuenta_id: id(801) }, 'k2')
    expect((await clientes.listarEntidades(undefined, 'pinos')).datos.map((e) => [e.id, e.tipo, e.estado])).toEqual([
      [ph.id, 'propiedad_horizontal', 'en_configuracion'],
      [emp.id, 'empresa', 'en_configuracion'],
    ])
    await expect(
      clientes.altaEmpresa({ nombre: 'Doble', administrador: { nombre: 'A', correo: 'a@a.co' }, administrador_cuenta_id: id(801) }, 'k3'),
    ).rejects.toMatchObject({ estado: 422 })
    await expect(clientes.altaEmpresa({ nombre: 'Sin admin' }, 'k4')).rejects.toMatchObject({ estado: 422 })
  })

  it('reactiva y vuelve a suspender una empresa; retirada no cambia más', async () => {
    expect(await clientes.cambiarEstado(TORNILLO, 'activa')).toBe('activa')
    expect(await clientes.cambiarEstado(TORNILLO, 'suspendida')).toBe('suspendida')
    expect(await clientes.cambiarEstado(TORNILLO, 'retirada')).toBe('retirada')
    await expect(clientes.cambiarEstado(TORNILLO, 'activa')).rejects.toMatchObject({ estado: 409 })
  })

  it('habilita y apaga un módulo; el store refleja los clientes', async () => {
    await clientes.habilitarModulo(id(4), 'contabilidad')
    const s = useClientes()
    await s.asegurar()
    expect(s.porId(id(4))?.modulos).toContain('contabilidad')
    expect((await clientes.terminarModulo(id(4), 'contabilidad')).terminados).toBe(1)
    await s.recargar()
    expect(s.porId(id(4))?.modulos).not.toContain('contabilidad')
    expect(s.nombre(id(4))).toBe('Comercial Andina S.A.S.')
    expect(s.nombre('nada')).toBe('Entidad sin nombre')
    s.actualizar({ ...s.porId(id(4))!, nombre: 'Andina' })
    expect(s.nombre(id(4))).toBe('Andina')
  })

  it('soporte: sin acceso no entra; con motivo entra en solo lectura', async () => {
    await expect(clientes.abrirSoporte(ROBLES, ' ')).rejects.toMatchObject({ estado: 422 })
    const acceso = await clientes.abrirSoporte(ROBLES, 'El administrador reporta un error en la cartera')
    expect(Date.parse(acceso.hasta)).toBeGreaterThan(Date.now())
    const sesion = useSesion()
    sesion.agregarSoporte({ entidad_id: ROBLES, nombre: 'Los Robles', nit: null, tipo: 'propiedad_horizontal', estado: 'activa', roles: [] })
    sesion.agregarSoporte({ entidad_id: ROBLES, nombre: 'Los Robles', nit: null, tipo: 'propiedad_horizontal', estado: 'activa', roles: [] })
    expect(sesion.entidades.filter((e) => e.entidad_id === ROBLES)).toHaveLength(1)
    const e = useEntidad()
    await e.entrar(ROBLES)
    expect(e.modoSoporte).toBe(true)
    expect(e.tienePermiso('bienes_privados.ver')).toBe(true)
    expect(e.tienePermiso('bienes_privados.editar')).toBe(false)
  })

  it('usuarios y roles de cualquier entidad por la ruta de la plataforma', async () => {
    const destino = { plataforma: ROBLES }
    const usuarios = await listarUsuarios(destino)
    expect(usuarios.datos.length).toBeGreaterThan(0)
    const roles = await listarRoles(destino)
    const contador = roles.find((r) => r.codigo === 'contador')!
    const cuenta = usuarios.datos[0]!.cuenta_id
    await (await import('@/api/usuarios')).asignarRol(ROBLES, cuenta, contador.id, 'k')
    expect((await asignacionesDe(destino, cuenta)).some((a) => a.rol_id === contador.id)).toBe(true)
  })
})

describe('cuentas y roles de la plataforma', () => {
  it('busca exacto, bloquea y desbloquea con motivo', async () => {
    expect(await clientes.buscarCuenta('nadie')).toBeNull()
    const c = (await clientes.buscarCuenta('pedro'))!
    expect(c.contrasena_pendiente).toBe(true)
    await clientes.bloquearCuenta(c.id)
    expect((await clientes.buscarCuenta('pedro'))?.estado).toBe('bloqueada')
    await expect(clientes.desbloquearCuenta(c.id, '')).rejects.toMatchObject({ estado: 422 })
    await clientes.desbloquearCuenta(c.id, 'Verificó su identidad')
    expect((await clientes.buscarCuenta('pedro.demo@x') ?? (await clientes.buscarCuenta('pedro')))?.estado).toBe('activa')
  })

  it('crea usuarios (o reutiliza la cuenta del correo), roles y asignaciones', async () => {
    const nuevo = await clientes.crearUsuarioPlataforma({ nombre: 'Sofía', correo: 'sofia@gisla.co', rol_plataforma_id: id(15002) }, 'k1')
    expect(nuevo).toMatchObject({ cuenta_nueva: true })
    expect(nuevo.asignacion_id).toBeTruthy()
    expect((await clientes.crearUsuarioPlataforma({ nombre: 'Andrés', correo: 'admin@demo.dad' }, 'k2')).cuenta_nueva).toBe(false)
    const rol = await clientes.crearRolPlataforma({ codigo: 'moderacion', nombre: 'Moderación', permisos: ['plataforma.publicidad.moderar'] }, 'k3')
    await expect(clientes.crearRolPlataforma({ codigo: 'moderacion', nombre: 'Otra', permisos: [] }, 'k4')).rejects.toMatchObject({ estado: 409 })
    expect((await clientes.permisosRolPlataforma(rol.id, [])).permisos).toEqual([])
    await expect(clientes.permisosRolPlataforma(id(15001), [])).rejects.toMatchObject({ estado: 409 })
    const asignacion = await clientes.asignarRolPlataforma(nuevo.cuenta_id, rol.id, 'k5')
    await clientes.quitarRolPlataforma(asignacion)
    const super_ = await clientes.asignarRolPlataforma(nuevo.cuenta_id, id(15001), 'k6')
    await expect(clientes.quitarRolPlataforma(super_)).rejects.toMatchObject({ estado: 409 })
    expect((await clientes.rolesPlataforma()).map((r) => r.codigo)).toContain('moderacion')
    await clientes.designarPropia(GISLA)
  })
})

describe('organizaciones, normativa y WhatsApp', () => {
  it('resuelve reclamaciones (rechazar exige motivo) y corrige fichas', async () => {
    const [r] = await normativa.reclamaciones()
    await expect(normativa.resolverReclamacion(r!.id, false, null)).rejects.toMatchObject({ estado: 422 })
    await normativa.resolverReclamacion(r!.id, true, null)
    expect((await normativa.reclamaciones()).find((x) => x.id === r!.id)?.estado).toBe('aprobada')
    await normativa.editarOrganizacion(r!.organizacion_id, { razon_social: 'Contables Unidos S.A.S.' })
    await normativa.agregarMiembro(r!.organizacion_id, id(802), 'gestor')
  })

  it('versiones de retenciones, UVT, IVA, ICA, exógena, tasas y PUC', async () => {
    const antes = await normativa.retenciones()
    await expect(
      normativa.crearConceptoRetencion({ codigo: 'servicios', impuesto: 'renta', nombre: 'S', base_minima_uvt: '2', tarifa: '6', fuente: 'x', vigente_desde: '2000-01-01' }, 'k'),
    ).rejects.toMatchObject({ estado: 409 })
    await normativa.crearConceptoRetencion({ codigo: 'honorarios', impuesto: 'renta', nombre: 'Honorarios', base_minima_uvt: '0', tarifa: '11', fuente: 'DUR', vigente_desde: '2026-01-01' }, 'k2')
    expect((await normativa.retenciones()).conceptos).toHaveLength(antes.conceptos.length + 1)
    expect((await normativa.guardarUvt(2030, '60000.00', 'Res. X')).anio).toBe(2030)
    await normativa.crearTarifaIva({ codigo: 'reducida', nombre: 'Reducida', tratamiento: 'gravado', tarifa: '5', fuente: 'ET', vigente_desde: '2026-01-01' }, 'k3')
    await normativa.crearTarifaIca({ municipio_dane: '05001', actividad: '6820', nombre: 'Inmuebles', tarifa_por_mil: '7', fuente: 'Acuerdo', vigente_desde: '2026-01-01' }, 'k4')
    const f = await normativa.crearFormatoExogena({ anio: 2025, codigo: '1001', nombre: 'Pagos', resolucion: 'R', cuantia_menor: '100000', campos: [] }, 'k5')
    expect(f.version).toBe(2)
    const cat = await normativa.catalogoTributario()
    expect([cat.iva.length, cat.ica.length, cat.formatos_exogena.length]).toEqual([3, 2, 2])
    await normativa.crearTasaReferencia({ vigente_desde: '2026-12-01', vigente_hasta: '2026-12-31', tasa_efectiva_anual: '23.9', resolucion: 'R', fuente: 'SFC' }, 'k6')
    expect((await normativa.tasasReferencia()).length).toBe(3)
    expect(await normativa.cargarPuc([{ codigo: '110505', nombre: 'Caja', naturaleza: 'debito' }])).toBe(1)
  })

  it('plantillas contables: solo el borrador cambia su contenido; se publica', async () => {
    const lista = await normativa.plantillasContables()
    const publicada = lista.find((p) => p.estado === 'publicada')!
    await expect(normativa.guardarContenidoPlantilla(publicada.id, {})).rejects.toMatchObject({ estado: 409 })
    const nueva = await normativa.crearPlantillaContable({ nombre: 'Comercio', tipo_empresa: 'comercio', contenido: {} }, 'k')
    await normativa.guardarContenidoPlantilla(nueva.id, {})
    await normativa.cambiarEstadoPlantilla(nueva.id, 'publicada')
    expect((await normativa.plantillaContable(nueva.id)).estado).toBe('publicada')
  })

  it('líneas y tarifas de WhatsApp', async () => {
    const l = await normativa.crearLineaWhatsapp({ phone_number_id: '1', numero_visible: '+57 1', nombre: 'Nueva' }, 'k')
    await normativa.actualizarLineaWhatsapp(l.id, { estado: 'pausada', limite_mps: 10, franquicia_servicio_mes: 500 })
    expect((await normativa.lineasWhatsapp()).find((x) => x.id === l.id)?.estado).toBe('pausada')
    await normativa.crearTarifaWhatsapp({ pais: 'CO', categoria: 'servicio', moneda: 'USD', valor: '0', vigente_desde: '2026-01-01' }, 'k2')
    expect((await normativa.tarifasWhatsapp()).length).toBe(3)
  })
})

describe('directorio y publicidad', () => {
  const ROSA = id(14001)

  it('comercios: alta, ficha (sin categorías restringidas), estado con motivo', async () => {
    const a = await publicidad.crearAnunciante({ nombre_comercial: 'Panadería Nueva', organizacion: { nit: '900222333', razon_social: 'Pan S.A.S.', naturaleza: 'juridica', tipos: ['anunciante'] } }, 'k')
    expect(a.estado).toBe('pendiente')
    await expect(publicidad.crearAnunciante({ nombre_comercial: 'Sin org' }, 'k2')).rejects.toMatchObject({ estado: 422 })
    await expect(publicidad.guardarFicha(a.id, { categorias: ['licores'], cobertura: 'nacional' })).rejects.toMatchObject({ estado: 422 })
    expect((await publicidad.guardarFicha(a.id, { categorias: ['panaderia'], cobertura: 'municipio', whatsapp: '573001' })).categorias).toEqual(['panaderia'])
    await expect(publicidad.cambiarEstadoAnunciante(a.id, 'rechazado', null)).rejects.toMatchObject({ estado: 422 })
    expect((await publicidad.cambiarEstadoAnunciante(a.id, 'verificado', null)).estado).toBe('verificado')
    expect((await publicidad.editarAnunciante(a.id, { nombre_comercial: 'Panadería Nueva 2' })).nombre_comercial).toBe('Panadería Nueva 2')
    expect((await publicidad.listarAnunciantes(undefined, { q: 'panad', estado: 'verificado' })).datos).toHaveLength(1)
    expect((await publicidad.anunciante(ROSA)).ficha?.categorias).toEqual(['costura'])
    await expect(publicidad.anunciante('nada')).rejects.toMatchObject({ estado: 404 })
    const cats = await publicidad.categoriasPlataforma()
    expect(cats.some((c) => c.restringida)).toBe(true)
    expect((await publicidad.guardarCategoria('zapateria', { nombre: 'Zapatería', padre: 'oficios' })).padre).toBe('oficios')
  })

  it('campañas: crear, piezas, ciclo y métricas; editar solo en borrador', async () => {
    const segmentacion = { entidades: [], tipos_entidad: [], radio_km: null, municipios: [], tipos: [], bienes_min: null, bienes_max: null, estratos: [] }
    const c = await publicidad.crearCampana(ROSA, { nombre: 'Navidad', objetivo: 'cupones', categoria: 'costura', inicio: '2026-12-01', fin: '2026-12-31', modelo: 'cpm', presupuesto_total: '300000', segmentacion }, 'k')
    await expect(publicidad.accionCampana(ROSA, c.id, 'enviar_a_revision')).rejects.toMatchObject({ estado: 422 })
    const x = await publicidad.crearCreativo(ROSA, c.id, { formato: 'banner', titulo: 'Arreglos navideños', texto: 'Texto' }, 'k2')
    expect(x.estado).toBe('pendiente')
    expect((await publicidad.editarCreativo(ROSA, c.id, x.id, { formato: 'banner', titulo: 'Otro', texto: 'T' })).titulo).toBe('Otro')
    expect((await publicidad.editarCampana(ROSA, c.id, { nombre: 'Navidad 2026', objetivo: 'cupones', categoria: 'costura', inicio: '2026-12-01', fin: '2026-12-31', modelo: 'cpm', presupuesto_total: '300000' })).nombre).toBe('Navidad 2026')
    expect((await publicidad.accionCampana(ROSA, c.id, 'enviar_a_revision')).estado).toBe('en_revision')
    await expect(publicidad.accionCampana(ROSA, c.id, 'pausar')).rejects.toMatchObject({ estado: 409 })
    const activa = (await publicidad.campanas(ROSA)).datos.find((y) => y.estado === 'activa')!
    expect((await publicidad.campana(ROSA, activa.id)).creativos.length).toBeGreaterThan(0)
    expect((await publicidad.metricasCampana(ROSA, activa.id)).dias).toHaveLength(3)
    await expect(publicidad.editarCampana(ROSA, activa.id, { nombre: 'X', objetivo: 'cupones', categoria: 'costura', inicio: '2026-12-01', fin: '2026-12-31', modelo: 'cpm', presupuesto_total: '1' })).rejects.toMatchObject({ estado: 409 })
    expect((await publicidad.accionCampana(ROSA, activa.id, 'pausar')).estado).toBe('pausada')
    expect((await publicidad.leads(ROSA)).datos).toHaveLength(1)
  })

  it('moderación con cuatro ojos: lo propio da 409, lo de otra cuenta se decide', async () => {
    const piezas = (await publicidad.creativosPendientes()).datos
    const propia = piezas.find((p) => p.titulo.startsWith('Uniformes'))!
    const ajena = piezas.find((p) => p.titulo.startsWith('Vestidos'))!
    await expect(publicidad.decidirCreativo(propia.id, true, null)).rejects.toMatchObject({ estado: 409, codigo: 'conflicto' })
    await expect(publicidad.decidirCreativo(ajena.id, false, null)).rejects.toMatchObject({ estado: 422 })
    expect((await publicidad.decidirCreativo(ajena.id, true, null)).estado).toBe('aprobado')
    const [campana] = (await publicidad.campanasEnRevision()).datos
    expect(campana?.conflicto_interes).toBe(true)
    expect((await publicidad.decidirCampana(campana!.id, true, null)).tarifa).toBe('12000.00')
    const [resena] = (await publicidad.resenasReportadas()).datos
    await expect(publicidad.moderarResena(resena!.resena_id, resena!.copropiedad_id, true, null)).rejects.toMatchObject({ estado: 422 })
    await publicidad.moderarResena(resena!.resena_id, resena!.copropiedad_id, true, 'Ofensiva')
    expect((await publicidad.resenasReportadas()).datos).toHaveLength(0)
    const [reporte] = (await publicidad.creativosReportados()).datos
    expect(await publicidad.atenderReportes(reporte!.creativo_id, false, null)).toBe(1)
  })

  it('enlace de cupones estable, exclusiones, tarifas, política, liquidaciones y pantallas', async () => {
    expect(await publicidad.enlaceCupones(ROSA)).toBe(await publicidad.enlaceCupones(ROSA))
    const nuevo = await publicidad.generarEnlaceCupones(ROSA)
    expect(nuevo).not.toBe('demo-cupones-ROSA')
    await publicidad.revocarEnlaceCupones(ROSA)
    expect(await publicidad.enlaceCupones(ROSA)).toBeNull()
    await expect(publicidad.excluir(ROBLES, '')).rejects.toMatchObject({ estado: 422 })
    await publicidad.excluir(ROBLES, 'Lo pidió el consejo')
    expect((await publicidad.exclusiones()).map((e) => e.entidad_id)).toContain(ROBLES)
    await publicidad.incluir(ROBLES)
    expect((await publicidad.exclusiones()).map((e) => e.entidad_id)).not.toContain(ROBLES)
    await publicidad.crearTarifaPublicidad({ modelo: 'por_lead', valor: '5000', vigente_desde: '2026-01-01' }, 'k')
    expect((await publicidad.tarifasPublicidad()).length).toBe(4)
    expect((await publicidad.publicarPolitica('Texto de la política nueva para todos', 'k2')).version).toBe(2)
    const [liq] = await publicidad.liquidarMes('2026-10-15', 'k3')
    expect((await publicidad.marcarLiquidacion(liq!.anunciante_id, '2026-10-15', 'facturada')).estado).toBe('facturada')
    expect((await publicidad.cortePorLiquidacion(liq!.id, 'k4')).liquidacion_id).toBe(liq!.id)
    expect(await publicidad.liquidaciones('2026-10-15')).toHaveLength(1)
    expect(await publicidad.tokenPantalla(ROBLES)).toBe('demo-pantalla-ROBLES')
    expect(await publicidad.generarPantalla(ROBLES, 'k5')).not.toBe('demo-pantalla-ROBLES')
  })
})

describe('consumo y cobros', () => {
  it('consumo por entidad y tipo', async () => {
    expect((await cobros.consumo('2026-11-01', '2026-11-30')).reduce((t, f) => t + f.cantidad, 0)).toBe(178)
  })

  it('productos con tarifa versionada', async () => {
    const p = await cobros.crearProducto({ codigo: 'whatsapp', nombre: 'WhatsApp', descripcion_factura: '{producto}' }, 'k')
    await expect(cobros.crearProducto({ codigo: 'whatsapp', nombre: 'Otro', descripcion_factura: 'x' }, 'k2')).rejects.toMatchObject({ estado: 409 })
    expect((await cobros.editarProducto(p.id, { codigo: 'otro', nombre: 'WhatsApp 2', descripcion_factura: '{producto}' })).codigo).toBe('whatsapp')
    await cobros.fijarTarifa(p.id, { modelo: 'por_consumo', valor: '50', metrica: 'whatsapp.mensajes', vigente_desde: '2026-12-01' }, 'k3')
    expect((await cobros.productos()).find((x) => x.id === p.id)?.tarifas).toHaveLength(1)
  })

  it('suscripciones: una vigente por entidad, líneas con precio pactado y terminación con motivo', async () => {
    await expect(cobros.crearSuscripcion({ entidad_id: ROBLES, inicio: '2026-01-01', correo_facturacion: 'a@a.co' }, 'k')).rejects.toMatchObject({ estado: 409 })
    const s = await cobros.crearSuscripcion({ entidad_id: id(3), ciclo_meses: 1, inicio: '2026-12-01', correo_facturacion: 'pagos@dad.co' }, 'k2')
    await expect(cobros.agregarLinea(s.id, { producto_id: id(15602), desde: '2026-12-01', precio_pactado: '1000' }, 'k3')).rejects.toMatchObject({ estado: 422 })
    const l = await cobros.agregarLinea(s.id, { producto_id: id(15602), desde: '2026-12-01', precio_pactado: '1000', motivo_precio: 'Aliado' }, 'k4')
    await cobros.terminarLinea(l.id, '2027-01-01')
    const detalle = await cobros.suscripcion(s.id)
    expect(detalle.lineas[0]?.hasta).toBe('2027-01-01')
    await expect(cobros.cambiarSuscripcion(s.id, { terminar_en: '2027-02-01' })).rejects.toMatchObject({ estado: 422 })
    expect((await cobros.cambiarSuscripcion(s.id, { terminar_en: '2027-02-01', motivo: 'Cierre' })).estado).toBe('terminada')
    expect((await cobros.suscripcion(id(15702))).modulos_sin_cobro).toEqual([])
    expect((await cobros.suscripciones()).length).toBe(3)
  })

  it('cortes: calcular, aprobar, facturar, pagar; descartar exige motivo; el estado se respeta', async () => {
    const c = await cobros.calcularCorte(id(15701), '2026-12-01', null, 'k')
    await expect(cobros.calcularCorte(id(15701), '2026-12-01', null, 'k2')).rejects.toMatchObject({ estado: 409 })
    await expect(cobros.facturarCorte(c.id, 'k3')).rejects.toMatchObject({ estado: 409 })
    expect((await cobros.aprobarCorte(c.id, 'k4')).estado).toBe('aprobado')
    expect((await cobros.facturaExterna(c.id, 'FE-77', '2026-12-02')).factura_externa).toBe('FE-77')
    expect((await cobros.pagarCorte(c.id, '2026-12-10', 'k5')).estado).toBe('pagado')
    const [borrador] = (await cobros.cortes(undefined, { estado: 'borrador', suscripcion: '' })).datos
    await expect(cobros.descartarCorte(borrador!.id, '')).rejects.toMatchObject({ estado: 422 })
    expect((await cobros.descartarCorte(borrador!.id, 'Duplicado')).estado).toBe('descartado')
    const [aprobado] = (await cobros.cortes(undefined, { estado: 'aprobado', suscripcion: id(15701) })).datos
    expect((await cobros.facturarCorte(aprobado!.id, 'k6')).factura_venta_id).toBeTruthy()
  })
})

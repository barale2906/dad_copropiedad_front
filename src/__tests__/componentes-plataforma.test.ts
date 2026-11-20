import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { siExiste } from '@/api/cliente'
import { enlacePublico } from '@/api/enlaces'
import { ErrorApi } from '@/api/errores'
import { SECCIONES } from '@/escena/mapa-modulos'
import { ZONAS } from '@/escena/plantillas/zonas'
import type { EstadoDetalleUsuario } from '@/formato/usuarios'
import DetalleUsuario from '@/hud/componentes/DetalleUsuario.vue'
import ColaModeracion from '@/modulos/plataforma/componentes/ColaModeracion.vue'
import EditorTablaNormativa from '@/modulos/plataforma/componentes/EditorTablaNormativa.vue'
import InsigniaVigencia from '@/modulos/plataforma/componentes/InsigniaVigencia.vue'
import FranjaSoporte from '@/pantallas/componentes/FranjaSoporte.vue'
import ModuloNoDisponible from '@/pantallas/componentes/ModuloNoDisponible.vue'
import PanelZona from '@/pantallas/componentes/PanelZona.vue'
import { useCuenta } from '@/stores/cuenta'
import { conCapacidades, ENTIDAD_PH, prepararConDemo } from './ayudantes'

const global = { stubs: { RouterLink: RouterLinkStub } }

describe('FranjaSoporte', () => {
  beforeEach(() => prepararConDemo())

  it('solo aparece en modo soporte y lo anuncia', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    expect(mount(FranjaSoporte).find('.franja-soporte').exists()).toBe(false)
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [], modo_soporte: true })
    const w = mount(FranjaSoporte)
    expect(w.get('[role="status"]').text()).toContain('Modo soporte · solo lectura')
  })
})

describe('candado por segundo factor', () => {
  beforeEach(() => prepararConDemo())

  it('ModuloNoDisponible lleva a activar el segundo factor', () => {
    const w = mount(ModuloNoDisponible, { props: { estado: 'sin_acceso', seccion: SECCIONES.plataforma!, segundoFactor: true }, global })
    expect(w.text()).toContain('exige el segundo factor')
    expect(w.getComponent(RouterLinkStub).props('to')).toEqual({ name: 'cuenta', hash: '#segundo-factor' })
    const sinRol = mount(ModuloNoDisponible, { props: { estado: 'sin_acceso', seccion: SECCIONES.plataforma! }, global })
    expect(sinRol.text()).toContain('Su rol no tiene permiso')
  })

  it('el panel del centro de operación explica el candado', () => {
    conCapacidades({ tipo: 'plataforma', modulos: [], permisos: [] }, { ...ENTIDAD_PH, tipo: 'plataforma' })
    useCuenta().perfil = { id: 'c', nombre: 'Ana', correo_verificado: true, segundo_factor_activo: false, es_superusuario: false, permisos_plataforma: ['plataforma.copropiedades.ver'] }
    const zona = ZONAS.plataforma.find((z) => z.id === 'centro-operacion')!
    const w = mount(PanelZona, { props: { zona }, global, attachTo: document.body })
    expect(w.text()).toContain('La consola exige el segundo factor')
    w.unmount()
  })
})

describe('ColaModeracion', () => {
  const elementos = [{ id: 'p1', titulo: 'Pieza uno', texto: 'Texto a revisar', detalles: ['Anuncio'], insignias: [{ texto: 'Promoción', tono: 'aviso' as const }] }]

  it('aprueba de una vez y rechaza pidiendo el motivo', async () => {
    const w = mount(ColaModeracion, { props: { elementos, textoAprobar: 'Mantener', textoRechazar: 'Ocultar' }, attachTo: document.body })
    expect(w.text()).toContain('Texto a revisar')
    expect(w.text()).toContain('Promoción')
    await w.findAll('button').find((b) => b.text().startsWith('Mantener'))!.trigger('click')
    expect(w.emitted('aprobar')?.[0]).toEqual(['p1'])
    await w.findAll('button').find((b) => b.text().startsWith('Ocultar'))!.trigger('click')
    const motivo = w.find('dialog textarea')
    await motivo.setValue('Lenguaje ofensivo')
    await w.find('dialog form').trigger('submit')
    expect(w.emitted('rechazar')?.[0]).toEqual(['p1', 'Lenguaje ofensivo'])
    w.unmount()
  })

  it('muestra el error del cuatro ojos', () => {
    const w = mount(ColaModeracion, { props: { elementos, error: 'Debe moderarlo otra cuenta.' } })
    expect(w.get('[role="alert"]').text()).toBe('Debe moderarlo otra cuenta.')
  })
})

describe('EditorTablaNormativa e InsigniaVigencia', () => {
  it('filtra por año y abre el formulario de una versión nueva', async () => {
    const w = mount(EditorTablaNormativa, {
      props: { titulo: 'Tasas', anios: [2025, 2026, 2026], anio: '' },
      slots: { default: '<p>tabla</p>', formulario: '<template #formulario="{ cerrar }"><button class="cerrar" @click="cerrar">listo</button></template>' },
    })
    expect(w.findAll('option').map((o) => o.text())).toEqual(['Todos los años', '2026', '2025'])
    expect(w.find('.cerrar').exists()).toBe(false)
    await w.findAll('button').find((b) => b.text().includes('Nueva versión'))!.trigger('click')
    await w.get('.cerrar').trigger('click')
    expect(w.find('.cerrar').exists()).toBe(false)
  })

  it('sin formulario ni varios años solo muestra la tabla', () => {
    const w = mount(EditorTablaNormativa, { props: { titulo: 'PUC', anios: [2026] }, slots: { default: '<p>tabla</p>' } })
    expect(w.find('select').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
  })

  it('la insignia dice si la versión está vigente y desde cuándo', () => {
    const w = mount(InsigniaVigencia, { props: { version: { vigente_desde: '2026-01-01', vigente_hasta: '2026-12-31' }, hoy: '2026-06-01' } })
    expect(w.text()).toContain('Vigente')
    expect(w.text()).toContain('hasta')
  })
})

describe('DetalleUsuario (solo presenta)', () => {
  const detalle = (extra: Partial<EstadoDetalleUsuario> = {}): EstadoDetalleUsuario => ({
    estado: 'listo', error: null, codigoEnviado: false, quitando: false, errorQuitar: null, reenviando: false, errorReenviar: null,
    asignaciones: [{ id: 'a1', rol: 'Contador', quitable: true, origen: 'manual' }, { id: 'a2', rol: 'Residente', quitable: false, origen: 'residencia' }],
    cargar: vi.fn().mockResolvedValue(undefined), quitar: vi.fn().mockResolvedValue(true), reenviar: vi.fn().mockResolvedValue(undefined), ...extra,
  })
  const usuario = { cuenta_id: 'c1', nombre: 'Laura', correo: 'laura@x.co', estado: 'activa' as const, contrasena_pendiente: true, roles: [] }

  it('quita un rol tras confirmar y reenvía el código', async () => {
    const d = detalle()
    const w = mount(DetalleUsuario, { props: { abierto: true, usuario, detalle: d, puedeAsignar: true }, attachTo: document.body })
    await w.findAll('button').find((b) => b.text() === 'Reenviar código')!.trigger('click')
    expect(d.reenviar).toHaveBeenCalled()
    expect(w.text()).toContain('se retira solo')
    await w.findAll('button').find((b) => b.text() === 'Quitar')!.trigger('click')
    await w.findAll('button').find((b) => b.text() === 'Quitar rol')!.trigger('click')
    expect(d.quitar).toHaveBeenCalledWith('a1')
    w.unmount()
  })

  it('muestra los estados de carga y error', async () => {
    const d = detalle({ estado: 'error', error: 'Sin red' })
    const w = mount(DetalleUsuario, { props: { abierto: true, usuario, detalle: d, puedeAsignar: false }, attachTo: document.body })
    expect(w.text()).toContain('Sin red')
    await w.findAll('button').find((b) => b.text().includes('Reintentar'))?.trigger('click')
    expect(d.cargar).toHaveBeenCalled()
    w.unmount()
  })
})

describe('ayudantes de la API', () => {
  it('siExiste vuelve null solo con 404', async () => {
    expect(await siExiste(Promise.resolve(1))).toBe(1)
    expect(await siExiste(Promise.reject(new ErrorApi(404, 'no_encontrado', 'x')))).toBeNull()
    await expect(siExiste(Promise.reject(new ErrorApi(500, 'interno', 'x')))).rejects.toMatchObject({ estado: 500 })
  })

  it('el enlace del comercio no lleva id', () => {
    expect(enlacePublico('comercio', null, 'tok', 'https://web.dad.co')).toBe('https://web.dad.co/comercio#t=tok')
  })
})

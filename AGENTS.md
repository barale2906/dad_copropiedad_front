# AGENTS.md — dad_copropiedad_front

**Fuente única de verdad** de las pautas de desarrollo de este repositorio, sin importar quién o qué
genere el código: personas, Claude Code, Cursor, VS Code (Copilot), opencode, Codex o la terminal.
Los demás archivos de reglas (`CLAUDE.md`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`,
`.claude/skills/*`) solo **remiten a este documento**; no duplican reglas.

Frontend web de **DAD Copropiedad** (DAD AI & SYSTEMS): administración de propiedad horizontal y
de empresas, multi-entidad. Consume el backend `dad_copropiedad_back` (Rust) por su contrato
OpenAPI. La navegación es una **maqueta 3D genérica** (conjunto para PH, oficina para empresas)
con estética de menú de videojuego futurista; los módulos de trabajo diario son vistas planas.

> ### Premisa de mantenimiento (obligatoria)
> Este documento se actualiza **en el mismo commit** cada vez que se incorpore o retire una
> tecnología, dependencia relevante, herramienta, patrón o convención. Como mínimo: §4
> Tecnologías, §14 Comandos y las convenciones afectadas. Un cambio que introduce tecnología sin
> actualizar este archivo **no está terminado**. Si una regla entra en conflicto con lo que pide
> una tarea, se señala el conflicto en lugar de ignorar la regla.

---

## 1. Principios de calidad

Todo código debe ser **profesional, limpio, reutilizable y escalable**.

| Principio | Qué significa aquí |
|---|---|
| Profesional | Tipado estricto de punta a punta (contrato → store → vista), errores manejados y mostrados al usuario, estados de carga, vacío y error en cada pantalla, accesible y responsive desde el primer commit. |
| Limpio | Nombres expresivos en español, funciones y componentes con **una responsabilidad**, sin código muerto ni comentarios obsoletos, sin `any`, ESLint y Prettier sin advertencias. Un componente que pasa de ~250 líneas de `<script>` o mezcla responsabilidades se divide. |
| Reutilizable | **Buscar lo existente antes de escribir** (§3). Lo visual va en `src/hud/`, la lógica sin estado en funciones puras, la lógica con estado en composables (`useX`) o stores. Nada se copia entre vistas: se extrae. |
| Escalable | Capas con dependencias en un solo sentido (§2); módulos aislados en `src/modulos/<seccion>/` y cargados en diferido; un solo mapa de navegación (`mapa-modulos.ts`); datos por contrato tipado; sin estado global fuera de Pinia. |
| Liviano | Presupuesto de peso verificado en cada build (§7). Toda dependencia nueva se justifica por su costo en KB. |
| Reproducible | Todo en Docker, versiones exactas, `package-lock.json` versionado, configuración por `config.json` en tiempo de ejecución. |
| Simple | La solución más simple que cumpla (YAGNI). Sin abstracciones, librerías ni capas "por si acaso". |

Principios de diseño:
- **SOLID adaptado a Vue:** componentes pequeños con una responsabilidad; props de entrada y
  eventos de salida (sin mutar props); depender de composables o stores, no de detalles.
- **DRY con la regla de tres:** a la segunda repetición se anota, a la tercera se extrae. No
  abstraer antes.
- **Composición antes que herencia o configuración gigante:** slots y composables en lugar de
  componentes con decenas de props booleanas.
- **Estados inválidos imposibles:** uniones discriminadas (`'cargando' | 'listo' | 'error'`) en
  lugar de varios booleanos sueltos; tipos del contrato en lugar de `string`.
- **Funciones puras para la lógica** (fáciles de probar) y componentes delgados que solo la usan.

## 2. Arquitectura

SPA con Vue 3. Capas y quién puede importar a quién (la flecha indica "puede usar"):

```
pantallas/ ─┐
modulos/  ──┼──► composables/ ──► stores/ ──► api/ ──► (backend)
            ├──► hud/  (componentes visuales, sin lógica de negocio) ──► formato/
            ├──► formato/ (funciones puras de formato)
            └──► escena/ (solo vía defineAsyncComponent o datos sin three.js)
app/ (arranque y router) ──► todo lo anterior
```

| Carpeta | Responsabilidad | No puede |
|---|---|---|
| `src/app/` | Arranque, router, guardas, `config.json` | Tener lógica de pantallas |
| `src/api/` | Cliente HTTP tipado, tokens, errores, tipos del contrato | Importar Vue, stores o vistas |
| `src/stores/` | Estado compartido (sesión, entidad activa, preferencias, cuenta) | Importar componentes |
| `src/composables/` | Lógica con estado que reutilizan los módulos (`useAccion`, `useListado`, `useRefresco`) y reglas puras comunes | Importar componentes |
| `src/formato/` | Funciones puras de formato y de tiempo: fechas en la zona de la entidad, horarios, franjas, montos y coeficientes | Importar Vue, stores, API o componentes |
| `src/hud/` | Sistema visual: tokens, estilos base, componentes `Hud*` | Llamar a la API o leer stores de negocio |
| `src/escena/` | Motor 3D, piezas, plantillas, calidad, `mapa-modulos.ts` | Importar stores, router o vistas (recibe todo por props/opciones) |
| `src/pantallas/` | Pantallas transversales y su navegación | Contener lógica de un módulo funcional |
| `src/modulos/<seccion>/` | Un módulo funcional (vistas, componentes, store y API propios) | Importar de otro módulo (lo compartido sube a `hud/`, `stores/` o `api/`) |
| `src/mocks/` | Backend simulado del modo demo y de las pruebas | Usarse fuera del modo demo o de las pruebas |

Reglas:
- **Nada fuera de `src/escena/` importa `three`.** Los componentes 3D se cargan con
  `defineAsyncComponent` para que three.js quede en su propio chunk. Los datos de zonas que
  necesitan las vistas viven en `escena/plantillas/zonas.ts`, sin three.js.
- **El 3D es solo navegación:** toda función debe poder alcanzarse sin la maqueta (menú alterno).
- Las rutas de los módulos se cargan en diferido (`component: () => import(...)`).

## 3. Flujo obligatorio para nueva funcionalidad

1. **Entender** el requisito: qué pantalla, qué endpoint del contrato, qué permisos y módulo.
   Si hay ambigüedad de negocio, preguntar.
2. **Buscar qué reutilizar antes de escribir código nuevo** (obligatorio). Revisar al menos el
   [inventario](#inventario-de-piezas-reutilizables) y buscar:
   `grep -rn "<concepto>" src` (y en `src/api/esquema.d.ts` el esquema o la ruta del backend).
   - Si existe algo que cumple: **usarlo**.
   - Si existe algo parecido: **extenderlo** sin romper a sus usuarios actuales (prop opcional,
     slot, variante, parámetro con valor por defecto) y ajustar sus pruebas.
   - Si se crea algo nuevo: ubicarlo en la capa correcta (§2) para que otros lo reutilicen.
   - En el resumen del cambio, **decir qué se reutilizó o extendió** y justificar lo nuevo.
3. **Diseñar**: tipos desde el contrato → función pura o composable → store si el estado se
   comparte → componentes → vista y ruta → entrada en `mapa-modulos.ts` si es navegable.
4. **Escribir las pruebas junto con el código** (§10).
5. **Documentar** (§12).
6. **Verificar**: `make verificar` y, si cambió una pantalla o un flujo, `make e2e`.
7. Cumplir la [definición de terminado](#13-definición-de-terminado).

### Inventario de piezas reutilizables

Se mantiene al día: quien crea una pieza reutilizable la agrega aquí.

| Necesito… | Usar | Dónde |
|---|---|---|
| Llamar a la API | `exigir(api().GET/POST(...))` (tipado, lanza `ErrorApi`) | `src/api/cliente.ts` |
| Reintentar un POST sin duplicar | `idempotencia()` → cabecera `Idempotency-Key` | `src/api/cliente.ts` |
| Tipos del backend | `Modulo`, `Permiso`, `EntidadDeLaCuenta`, `Capacidades`… | `src/api/tipos.ts` (alias de `esquema.d.ts`) |
| Mostrar un error | `mensajeDeError(e)` | `src/api/errores.ts` |
| Ejecutar una acción (idempotencia, errores por código, 429) | `useAccion((clave, …) => …, { alConflicto, alExito })`; `ejecutar()` → `{ ok, valor }` | `src/composables/useAccion.ts` |
| Botones por estado del recurso / cuatro ojos | `accionesPermitidas(estado, mapa)`, `puedeAprobar(autores, cuentaId)` | `src/composables/reglas.ts` |
| Fechas en la zona de la entidad | `fecha`, `fechaHora`, `hora`, `aUtc` (con `useEntidad().zonaHoraria`); fechas de calendario `YYYY-MM-DD`: `fechaCalendario`, `hoyEn(zona)`, `sumarDias`; `horaEn`, `diaSemana` | `src/formato/fechas.ts` |
| Montos, porcentajes, coeficientes, sumas | `moneda`, `porcentaje`, `coeficiente`, `sumar`, `restar`, `comparar`, `porcentajeDe`, `leerDecimal` | `src/formato/decimales.ts` |
| Generar UUID (también en HTTP) | `uuid()` | `src/api/uuid.ts` |
| Subir, abrir y descargar archivos | `subirArchivo`, `abrirArchivo` (enlace firmado justo antes), `descargar(api().GET(…, { parseAs: 'blob' }))` → nombre y `sha256`, `aBase64` | `src/api/archivos.ts` |
| Sesión, login, 2FA, cierre, definir contraseña | `useSesion()` (`definirContrasena`, `recuperarContrasena`) | `src/stores/sesion.ts` |
| Cuenta de la persona (perfil, 2FA, sesiones, dispositivos, permisos de plataforma) | `useCuenta()`: `asegurar`, `id`, `permisosPlataforma`, `segundoFactorActivo` | `src/stores/cuenta.ts` |
| Entidad activa, ¿es PH?, permisos, módulos, roles, modo soporte, zona horaria | `useEntidad()`: `esPH`, `modoSoporte`, `suspendida`, `soloVinculo`, `zonaHoraria`, `ficha`, `tieneModulo`, `tienePermiso`, `tieneRol`, `refrescar` | `src/stores/entidad.ts` |
| Preferencias del navegador | `usePreferencias()` (vista, calidad 3D, `turnoAlEntrar` en un equipo de portería) | `src/stores/preferencias.ts` |
| Bienes privados de la PH (propios, buscar por código, código por id en paralelo) | `useBienes()`: `asegurarPropios`, `buscar`, `resolver(ids)`, `codigo(id)`, `recordar` | `src/stores/bienes.ts` |
| Elegir un bien privado (propios y búsqueda con retardo) | `<SelectorBien v-model propios buscar codigo-elegido>` (alimentado por `useBienes`) | `src/hud/componentes/SelectorBien.vue` |
| Comunicados sin leer (aviso de la barra superior) | `useComunicadosPendientes()`: `cantidad`, `aplica()`, `actualizar()`; `<AvisoComunicados>` ya está en `BarraSuperior` | `src/stores/comunicados.ts`, `src/pantallas/componentes/AvisoComunicados.vue` |
| Tarjeta de resumen para tableros | `<TarjetaResumen titulo valor detalle tono a cargando>` (slot `icono`) | `src/hud/componentes/TarjetaResumen.vue` |
| Firma en pantalla (dedo, mouse o lápiz → PNG Base64) | `<CapturaFirma v-model etiqueta>` | `src/hud/componentes/CapturaFirma.vue` |
| Foto con la cámara (respaldo `<input capture>`) → Base64 | `<CapturaFoto v-model etiqueta>` | `src/hud/componentes/CapturaFoto.vue` |
| Leer un QR (lector físico/teclado y cámara con `BarcodeDetector`, sin librerías) | `<LectorQr etiqueta cargando @leido>` | `src/hud/componentes/LectorQr.vue` |
| Buscar y elegir una persona (búsqueda con retardo, genérico) | `<SelectorPersona buscar etiqueta @elegir>`; búsqueda en la PH: `buscarPersonas(copropiedadId, q, despues, limite)` | `src/hud/componentes/SelectorPersona.vue`, `src/api/personas.ts` |
| Textos del control de acceso y opciones de un selector | `TIPO_VISITA`, `TIPO_PAQUETE`, `opcionesDe(textos)` | `src/composables/textos-acceso.ts` |
| Hilo de mensajes (tickets, chat, reseñas) con notas internas marcadas | `<HiloMensajes mensajes etiqueta vacio>` (cada mensaje: `autor`, `hora` ya formateada, `propio`, `interno`) | `src/hud/componentes/HiloMensajes.vue` |
| Plazo con semáforo (vencido / por vencer / a tiempo) y ventana de 24 h de WhatsApp | `<SemaforoVencimiento vence-en vencido>`; `semaforoVencimiento`, `ventanaRestante`, `lapso` | `src/hud/componentes/SemaforoVencimiento.vue`, `src/formato/vencimiento.ts` |
| Audiencia de un mensaje masivo (todos, propietarios, residentes, torres, roles, bienes) | `<SelectorAudiencia v-model agrupaciones roles buscar-bien codigos error>` | `src/hud/componentes/SelectorAudiencia.vue` |
| Subir adjuntos de un formulario (con error legible) | `useAdjuntos(entidadId, clasificacion)` → `adjuntos`, `subiendo`, `error`, `subir`, `abrir`, `quitar`, `limpiar`, `ids()`; va con `<HudAdjuntos>` | `src/composables/useAdjuntos.ts` |
| Textos de PQRS compartidos | `TIPO_TICKET`, `PRIORIDAD_TICKET` | `src/composables/textos-gestion.ts` |
| QR para compartir (Web Share con imagen, WhatsApp de respaldo) | `<QrCompartir texto mensaje nombre-archivo>` | `src/hud/componentes/QrCompartir.vue` |
| Errores de una planilla importada | `<TablaErroresImportacion errores titulo>` | `src/hud/componentes/TablaErroresImportacion.vue` |
| Secciones, acciones y su estado (módulos «alguno de» / `requiereTodos`, módulo por acción, `soloPH`, acciones personales por `vinculo`) | `SECCIONES`, `estadoSeccion`, `estadoAccion`, `seccionContratada`, `accionesVisibles`, `TEXTO_ESTADO` | `src/escena/mapa-modulos.ts` |
| Zonas de la maqueta y rutas | `useNavegacion()`: `zonas`, `estadosZonas`, `secciones`, `rutaAccion`, `rutaMaqueta` | `src/pantallas/navegacion.ts` |
| Nombre del tipo y del estado de una entidad, aviso si no está activa | `TIPO_ENTIDAD`, `ESTADO_ENTIDAD`, `avisoDeEstado()` | `src/pantallas/textos-entidad.ts` |
| Icono de una sección | `ICONOS[slug]`; iconos sueltos: `~icons/tabler/<nombre>` | `src/pantallas/iconos.ts` |
| Panel de vidrio HUD | `<HudPanel etiqueta resaltado>` | `src/hud/componentes/HudPanel.vue` |
| Botón (o enlace con `a`) | `<HudBoton a variante tipo cargando bloque>` | `src/hud/componentes/HudBoton.vue` |
| Pantalla de carga | `<HudCarga mensaje>` (en `App.vue`, con `vigilarNavegacion(router)`) | `src/hud/componentes/HudCarga.vue`, `src/app/carga.ts` |
| Ilustraciones HUD (SVG, sin three.js) | `<IlustracionPerdido escenario>`, `<IlustracionConstruccion>` | `src/hud/ilustraciones/` |
| Página «no encontrado» | ruta `no-encontrado` (comodín); rutas de módulo inexistentes con `existeEnElMapa()` | `src/pantallas/NoEncontradoView.vue`, `src/app/router.ts` |
| Campo de formulario | `<HudCampo v-model etiqueta error ayuda multilinea al-salir>` (slots `antes`/`despues`) | `src/hud/componentes/HudCampo.vue` |
| Lista desplegable | `<HudSelector v-model etiqueta opciones vacio error>` | `src/hud/componentes/HudSelector.vue` |
| Fecha / fecha y hora | `<HudFecha v-model etiqueta con-hora minimo maximo>` (convertir con `aUtc`) | `src/hud/componentes/HudFecha.vue` |
| Refresco periódico (solo con la pestaña visible) | `useRefresco(fn, { cada, alVolver })` | `src/composables/useRefresco.ts` |
| Tiempo real (WebSocket con token en subprotocolo) | `conectarEnVivo(url, { alMensaje, alEstado })` → `cerrar()` | `src/api/en-vivo.ts` |
| Monto (mostrar / escribir) | `<HudMonto valor>`, `<HudCampoMonto v-model etiqueta>` (modelo = texto decimal) | `src/hud/componentes/` |
| Listado por cursor (cargar más, recarga, filtros con retardo) | `useListado((despues, filtros) => …, { filtros, retardo })` → `filas`, `estado`, `hayMas`, `cargarMas`, `recargar` | `src/composables/useListado.ts` |
| Tabla (tarjetas en móvil), orden y selección | `<HudTabla filas columnas clave titulo orden seleccionable v-model:seleccion>` (slots `celda-<clave>`) | `src/hud/componentes/HudTabla.vue` |
| Fin del listado | `<HudCargarMas hay-mas cargando infinito @cargar>` | `src/hud/componentes/HudCargarMas.vue` |
| Barra de filtros con chips | `<HudFiltros activos @quitar @limpiar>` (slot: campos) | `src/hud/componentes/HudFiltros.vue` |
| Estado de un recurso | `<HudInsignia tono>` (`exito`, `aviso`, `peligro`, `info`, `neutro`) | `src/hud/componentes/HudInsignia.vue` |
| Cargando / vacío / error | `<HudEstado estado mensaje referencia @reintentar>` (slot: acción del vacío) | `src/hud/componentes/HudEstado.vue` |
| Diálogo modal | `<HudDialogo v-model:abierto titulo>` (slot `acciones`) | `src/hud/componentes/HudDialogo.vue` |
| Adjuntos (subir, abrir, quitar) | `<HudAdjuntos adjuntos acepta subiendo solo-lectura @subir @abrir @quitar>` | `src/hud/componentes/HudAdjuntos.vue` |
| Vista previa → confirmar | `<FlujoDosPasos v-model:paso accion bloqueado @previsualizar @confirmar @reiniciar>` | `src/hud/componentes/FlujoDosPasos.vue` |
| Consulta sensible auditada | `<AvisoAuditado v-model:abierto que @confirmar>` | `src/hud/componentes/AvisoAuditado.vue` |
| Módulo no contratado / sin acceso / próximamente | `<ModuloNoDisponible estado seccion>` (contacto de `config.json`); `estadoAccion()` / `useNavegacion().estadoDeAccion()` | `src/pantallas/componentes/ModuloNoDisponible.vue` |
| Secreto que se muestra una vez | `<SecretoUnaVez valor etiqueta aviso>` | `src/hud/componentes/SecretoUnaVez.vue` |
| Código QR | `<HudCodigoQr texto descripcion>` | `src/hud/componentes/HudCodigoQr.vue` |
| Confirmar con motivo (anular, rechazar…) | `<ConfirmarConMotivo v-model:abierto titulo accion @confirmar>` | `src/hud/componentes/ConfirmarConMotivo.vue` |
| Barra superior de la entidad | `<BarraSuperior>` (slot para acciones) | `src/pantallas/componentes/BarraSuperior.vue` |
| Marco de módulo (menú lateral, migas, volver) | `ModuloView.vue` (base del marco de módulos) | `src/pantallas/ModuloView.vue` |
| Montar la vista real de una acción | registrar `'seccion/accion': () => import(…)` en `VISTAS_MODULOS` (sin registro: «en construcción»); el detalle llega en `route.params.id` | `src/app/vistas-modulos.ts`, `src/pantallas/vistas-modulo.ts` |
| Franjas para reservar (inicios posibles, duraciones, días, agrupar por día en la zona) | `iniciosPosibles`, `duraciones`, `textoDuracion`, `dias`, `porDia`, `sumarMinutos` | `src/formato/franjas.ts` |
| Calendario de franjas libres (elegir inicio o solo lectura) | `<CalendarioFranjas v-model dias franjas zona paso duracion solo-lectura>` | `src/hud/componentes/CalendarioFranjas.vue` |
| Pestañas por `?vista=` | `<HudPestanas pestanas etiqueta>` + `usePestana(PESTANAS)` | `src/hud/componentes/HudPestanas.vue`, `src/composables/usePestana.ts` |
| Horario semanal con excepciones (editar, validar, resumir) | `<EditorHorario v-model>`; `validarHorario`, `normalizarHorario`, `resumirHorario`, `DIAS` | `src/hud/componentes/EditorHorario.vue`, `src/formato/horario.ts` |
| Buscar una cuenta (usuario o correo exactos) / una persona de la PH | `<BuscarCuenta entidad-id @encontrada>`, `<BuscarPersona copropiedad-id @elegir>` (sobre `SelectorPersona`) | `src/modulos/entidad/componentes/` |
| Matriz de permisos de un rol (por módulo, búsqueda, «todos», no otorgables) | `<MatrizPermisos v-model grupos solo-lectura puede-otorgar>` con `agruparPermisos(catalogo, ambito)`, `etiquetaPermiso`, `diferencia`, `noOtorgables` | `src/modulos/entidad/componentes/MatrizPermisos.vue`, `src/modulos/entidad/permisos.ts` (subir a una capa compartida con el plan 15) |
| Lienzo 3D | `<EscenaCanvas plantilla perfil estados enfocada holgura>` (siempre asíncrono) | `src/escena/EscenaCanvas.vue` |
| Nivel de calidad 3D / movimiento reducido | `perfil()`, `soportaWebGL()`, `movimientoReducido()` | `src/escena/calidad.ts` |
| Piezas 3D | `Kit` (`caja`, `losa`, `cilindro_`, `cono_`) y `torre`, `edificio`, `arbol`, `carro`, `escritorio` | `src/escena/piezas.ts` |
| Fondo ambiental HUD | clase `.fondo-hud`; rótulos: `.rotulo`; texto oculto accesible: `.solo-lector` | `src/hud/estilos/base.css` |
| Transición entre vistas | `<Transition name="vista">` | `src/hud/estilos/base.css` |
| Datos de prueba / demo | `fetchDemo` (ficha, puntos de atención, suscripción y auditoría en `src/mocks/ficha.ts`; protección de datos, personas, organizaciones y cuentas en `src/mocks/proteccion.ts`: personas «Marta», «Pedro», «Lucía», cuenta `carlos`, NIT `900123456-8`; zonas comunes en `src/mocks/zonas-comunes.ts`; portal del residente en `src/mocks/mi.ts` (usuario `residente`: propietario y residente con autoservicio); gestión administrativa en `src/mocks/gestion.ts` (PQRS en varios estados, uno vencido y uno de convivencia; chat dentro y fuera de las 24 h; comunicados en cada estado; la orden «Revisión de la motobomba» la ejecutó el administrador: la verifica `revisor`); portería en `src/mocks/porteria.ts` (usuario `porteria`: control de acceso completo, sin `bienes_privados.ver` ni `personas.ver`; búsquedas `…/acceso/bienes` y `…/acceso/personas`; visitas en cada estado, «Técnico de internet» espera llamada, QR `DAD1.<id de Jardinero>.firma`, PIN demo `482915`; al residente le filtra visitas y paquetes de su bien); bienes, personas, coeficientes y censo en `src/mocks/unidades.ts` —fuente única de bienes y personas—: 2 torres × 20 bienes, `T1-101` propio, `T2-302` restringido) (usuarios `uno`, `empresa`, `2fa`, `residente` (portal), `porteria`, `revisor` (otra cuenta, para los cuatro ojos), `nuevo` sin roles, `sinverificar`; códigos `123456`; correos `@otra.dad` simulan una cuenta existente); un `Manejador` por área (`json`, `error`, `sinContenido`) | `src/mocks/demo.ts`, `src/mocks/http.ts`, `src/mocks/<area>.ts` |
| Preparar pruebas | `prepararConDemo()`, `conCapacidades()` (`modo_soporte` opcional), `conConfig()`, `conRespuesta(metodo, ruta, fn)`, `ENTIDAD_PH` | `src/__tests__/ayudantes.ts` |
| Pasos E2E | `entrar()`, `esperarMaqueta()`, `elegirZona()` | `e2e/utilidades.ts` |

## 4. Tecnologías

| Pieza | Tecnología (versión exacta en `package.json`) | Notas |
|---|---|---|
| Lenguaje | TypeScript 5.9 estricto (+ `noUncheckedIndexedAccess`) | TS 7 aún no es compatible con openapi-typescript |
| Framework | Vue 3.5, `<script setup lang="ts">`, Composition API | Sin Options API |
| Build | Vite 8 | `vue-tsc --build` antes de compilar |
| Enrutamiento | Vue Router 5, modo *history* | Rutas de módulos en diferido |
| Estado | Pinia 4 (stores de configuración: `defineStore('x', () => …)`) | |
| API | `openapi-fetch` + tipos de `openapi-typescript` | `src/api/esquema.d.ts` es **generado** |
| 3D | three.js 0.186 directo (sin TresJS) | Solo en `src/escena/` |
| Iconos | `unplugin-icons` + `@iconify-json/tabler` | Solo se empaqueta lo importado |
| Fuentes | `@fontsource-variable/inter`, `@fontsource/rajdhani` (latin) | Alojadas en el propio build |
| Decimales | `decimal.js-light` | Montos y coeficientes (texto decimal del backend) |
| Código QR | `qrcode-generator` (MIT, sin dependencias) | Solo en «Mi cuenta» (segundo factor), chunk diferido |
| Pruebas unitarias y de componentes | Vitest 5 + `@vue/test-utils` + jsdom, cobertura v8 | |
| Pruebas E2E | Playwright 1.56 (imagen Docker de la misma versión) | Chromium con SwiftShader para WebGL |
| Accesibilidad | `@axe-core/playwright` (WCAG 2.1 AA) | `playwright-core` fijado por `overrides` |
| Calidad | ESLint (vue + typescript-eslint), Prettier | |
| Contenedores | Docker: `node:24-alpine` (dev/build), `nginx:alpine` (preview), Playwright (e2e) | |
| UI de formularios | Componentes `Hud*` sobre controles nativos (`<select>`, `<input type=date>`, `<dialog>`) | PrimeVue **no** se incorpora: desde la v5 su licencia es comercial (ver reglas) |

Reglas de dependencias:
- **Solo software libre y gratuito** (MIT, Apache 2.0, BSD, ISC). Revisar la licencia de la
  versión exacta (`LICENSE` del paquete), no solo el campo `license`: si una versión nueva cambia
  a una licencia comercial o con clave, no se actualiza y se busca alternativa.
- Versiones **exactas** (`--save-exact`) con **al menos 2 semanas** de publicadas
  (`npm install --before=<fecha>`). Nunca rangos `^`/`~`.
- Antes de agregar una librería: ¿lo resuelve la plataforma, Vue o algo ya instalado? ¿Cuántos KB
  suma al bundle inicial? Se prefiere lo que permite importar solo lo usado.
- Si la imagen de Playwright cambia de versión, `@playwright/test` y el `overrides` cambian igual.

## 5. Convenciones de código

### Generales
- **Responder siempre en español** a quien trabaja en el repositorio: mensajes, avisos entre
  pasos, preguntas, resúmenes y cierres de tarea, sin excepción (también en sesiones largas).
- **Español** en nombres de archivos, variables, funciones, tipos, comentarios y textos (igual que
  el backend y su contrato). Términos técnicos sin traducción forzada (`store`, `props`, `slot`).
- Textos para el usuario: claros, en **usted**, sin jerga técnica; los errores dicen qué hacer.
- Archivos: componentes y vistas en `PascalCase.vue` (vistas con sufijo `View`), composables
  `useAlgo` en `camelCase.ts`, resto en `kebab-case.ts` o `camelCase.ts` según la carpeta.
- Alias `@/` → `src/`. Imports ordenados: librerías, `@/…`, relativos.
- Sin `any`, sin `// @ts-ignore`, sin `!` salvo que el invariante sea evidente y cercano.
  Prohibido desactivar reglas de lint para "hacer pasar".
- Exportaciones nombradas (salvo componentes `.vue`). Sin barriles `index.ts` que oculten
  dependencias.
- Fechas: el backend envía UTC; se muestran en la `zona_horaria` de la copropiedad, nunca la del
  navegador. Montos y coeficientes: texto decimal → `decimal.js-light`; **nunca `Number()` para
  calcular**.

### Componentes Vue
- `<script setup lang="ts">` siempre. Orden del bloque: imports → props/emits/model → stores y
  composables → estado → computados → funciones → ciclo de vida.
- Props tipadas con `defineProps<{…}>()` y `withDefaults`; eventos con
  `defineEmits<{ nombre: [args] }>()`; doble enlace con `defineModel`. **Nunca mutar props.**
- `computed` para derivar; `watch` solo para efectos (llamar a la API, sincronizar algo externo).
- Plantillas sin lógica: lo que no sea trivial va a un `computed` o una función.
- Todo listener o temporizador que se crea en `onMounted` se libera en `onBeforeUnmount`.
- Prohibido `v-html` con datos que no sean constantes del código.
- Cada pantalla que carga datos maneja **cargando, vacío y error** (con `mensajeDeError`).
- Estilos `scoped`; para estilizar hijos, `:deep()` acotado.

### Estado y datos
- Estado compartido entre pantallas → Pinia. Estado local → `ref` en el componente. Estado de un
  módulo → store dentro de `src/modulos/<seccion>/`.
- Llamadas al backend solo con `exigir(api()…)`; decidir por `error.codigo`, nunca por el texto.
- Tras un 403 `sin_permiso` o `modulo_no_habilitado`: `useEntidad().refrescar()`.
- POST que crean algo: una `idempotencia()` **por acción del usuario**, reutilizada al reintentar.
- Listados: paginación por cursor (`limite`, `despues`, `siguiente`), sin números de página.
- Permisos y módulos solo con `tieneModulo` / `tienePermiso` y el mapa de secciones; nunca deducir
  permisos de los nombres de los roles. El frontend **oculta**; el backend **decide**.

## 6. Navegación y módulos

- `src/escena/mapa-modulos.ts` es el **único** lugar que relaciona secciones, acciones, módulos
  contratables y permisos. La maqueta, el menú alterno y el menú lateral salen de ahí.
- Una zona sin módulo contratado se muestra **apagada** (no se oculta); sin permisos, "sin acceso".
- Ruta de un módulo: `/e/:entidadId/:seccion/:accion?/:id?` (`:id` = detalle de un recurso). Se conservan `?zona=` (bien común
  preseleccionado) y `?origen=` (zona a la que vuelve "Volver a la maqueta").
- La vista de cada acción se registra en `src/app/vistas-modulos.ts` (`seccion/accion` → import
  diferido); `ModuloView` la monta dentro del marco. `pantallas/` nunca importa `modulos/`.
- Pasos para un módulo nuevo: skill `.claude/skills/nuevo-modulo`, `docs/plan-frontend.md` y el
  plan del módulo en `docs/planes/`.

## 7. Maqueta 3D y rendimiento

Presupuesto (verificado por `scripts/presupuesto.mjs` en cada `npm run build`; el build falla si
se excede):

| Medida | Límite |
|---|---|
| JS inicial (login) | ≤ 120 KB gzip, sin three.js |
| Chunk del motor 3D (`EscenaCanvas`) | ≤ 220 KB gzip |
| JS propio de cada módulo (`src/modulos/<seccion>/`) | ≤ 90 KB gzip |

Reglas del motor:
- Render **bajo demanda**: no agregar bucles continuos; pedir cuadros con `solicitar()` solo
  mientras algo cambia. El holograma del login es la única animación continua (≤ 30 fps).
  Fuera del motor, las ilustraciones SVG (404, carga) animan solo `transform`/`opacity` en CSS y
  se detienen con `prefers-reduced-motion`.
- Reutilizar geometrías y materiales del `Kit`; **no crear materiales por malla**. Para un estado
  visual nuevo se agrega un rol o una paleta, no materiales sueltos.
- Sin sombras en tiempo real, sin postprocesado, sin texturas pesadas (las del kit se generan en
  un canvas pequeño). Modelos `.glb` solo en la fase opcional y con presupuesto propio.
- Selección por cajas (`Box3`) por zona, no por malla.
- Todo lo que se crea se libera en `destruir()` / `Kit.liberar()`.
- Respetar los niveles de `calidad.ts` (`baja` sin detalle) y `prefers-reduced-motion`.
- Tras cambiar la escena: `make e2e` y revisar en escritorio (1440×900) y en móvil (Pixel 7).

## 8. Estilos, sistema HUD y responsive

- Colores, tipografías, radios y tiempos **solo desde los tokens** (`src/hud/estilos/tokens.css`).
  Nada de colores sueltos en componentes. La identidad DAD se aplicará cambiando los tokens.
- Antes de crear un estilo, usar o extender un componente `Hud*` o una clase base.
- **Mobile first** y fluido: funciona desde **360 px** hasta pantallas grandes; `clamp()`, grid
  con `auto-fill/minmax`, `dvh` para alto completo. Sin desbordes horizontales.
- Objetivos táctiles de al menos 40×40 px; `font-size` ≥ 16 px en campos (evita el zoom de iOS).
- Puntos de corte de referencia: 720 px (barra compacta), 760 px (panel → hoja inferior),
  900 px (menú lateral → cajón).
- Animaciones solo con `transform`/`opacity` y con las variables de tiempo (que valen 0 con
  movimiento reducido).

## 9. Accesibilidad (WCAG 2.1 AA)

- HTML semántico (`button` para acciones, `a`/`RouterLink` para navegar, encabezados en orden,
  listas con `ul/li`, landmarks `main`/`nav`/`aside`).
- Todo control con nombre accesible que **contenga su texto visible**; iconos decorativos con
  `aria-hidden="true"`; botones solo de icono con texto `.solo-lector`.
- Contraste ≥ 4.5:1 en texto (los tokens de texto ya lo cumplen; no aclarar fondos sin verificar).
- Foco visible siempre; `Escape` cierra paneles; lo que está oculto fuera de pantalla no recibe
  foco (`visibility: hidden`).
- El lienzo 3D es `aria-hidden`: su equivalente accesible son las etiquetas HTML y el menú alterno.
- `e2e/accesibilidad.spec.ts` (axe) debe pasar sin violaciones graves; una pantalla nueva se
  agrega a esa prueba.

## 10. Pruebas

Toda funcionalidad nueva o modificada lleva pruebas, incluidos los casos de error.

| Nivel | Herramienta | Qué cubre | Dónde |
|---|---|---|---|
| Unitarias | Vitest | Funciones puras, stores, composables, cliente HTTP, mapa de módulos | `src/__tests__/*.test.ts` |
| Componentes | Vitest + Vue Test Utils | Renderizado según props y permisos, eventos, accesibilidad básica | `src/__tests__/<Componente>.test.ts` |
| E2E | Playwright | Flujos completos contra el build de producción (modo demo), escritorio y móvil | `e2e/*.spec.ts` |
| Accesibilidad | axe-core en Playwright | WCAG 2.1 AA en cada pantalla | `e2e/accesibilidad.spec.ts` |
| Peso | `scripts/presupuesto.mjs` | Presupuesto del §7 | En cada build |

Qué exige cada cambio:
- **Lógica nueva** (función, store, composable, regla de permisos): pruebas unitarias con éxito,
  error y bordes.
- **Componente nuevo o extendido**: prueba de componente (qué muestra según props/permisos, qué
  emite).
- **Pantalla o flujo nuevo**: escenario E2E y revisión de accesibilidad.
- **Bug corregido**: primero una prueba que lo reproduce, luego la corrección.

Cobertura mínima (falla `make verificar` si baja), sobre `src/api`, `src/stores`,
`mapa-modulos.ts` y `navegacion.ts`: líneas y sentencias 80 %, funciones 80 %, ramas 70 %. Al
crear un módulo, su lógica se agrega al `include` de cobertura en `vite.config.ts`.

Buenas prácticas:
- Nombres de prueba en español que describen el comportamiento («sin el módulo contratado no
  ofrece acciones»).
- Probar comportamiento visible, no detalles internos. En E2E, localizar por **rol y nombre
  accesible** (`getByRole`, `getByLabel`), nunca por clases CSS.
- Datos de prueba con el backend simulado (`fetchDemo` / `prepararConDemo`) o un transporte
  falso; nunca contra servidores reales. Cada prueba deja el estado limpio (`localStorage`,
  Pinia nueva).
- Sin esperas fijas (`waitForTimeout`) en E2E: esperar condiciones (`expect(...).toBeVisible()`).
- Una prueba inestable se arregla o se elimina; nunca se reintenta hasta que pase. Para detectar
  inestabilidad: `make e2e ARGS="--repeat-each=3"`. Proyectos: `escritorio` (1440×900), `movil`
  (Pixel 7) y `tableta` (768×1024 táctil, solo `e2e/porteria.spec.ts`). Playwright corre con 2 workers: la maqueta
  se dibuja por software y más navegadores en paralelo saturan la CPU.

## 11. Seguridad

- Token de acceso solo en memoria; el de renovación en `localStorage`. La renovación pasa por
  `renovar()` (una sola a la vez entre pestañas); no se llama al endpoint de renovación desde otro
  lugar.
- El cierre de sesión limpia primero en el navegador y luego revoca en el servidor.
- Nada secreto en `config.json` ni en el código: es público. Sin credenciales en commits.
- Prohibido `v-html` con datos externos; no construir URLs con datos sin validar (ej.: `volver`
  solo acepta rutas internas).
- No registrar en consola datos personales ni tokens.
- Enlaces de descarga firmados: pedirlos justo antes de abrirlos; no guardarlos.

## 12. Documentación

- TSDoc (`/** … */`) en todo lo exportado que no sea obvio: qué hace y por qué, no cómo.
- Comentarios solo para explicar decisiones no evidentes; sin código comentado.
- `README.md` si cambian comandos, despliegue o estructura; `docs/plan-frontend.md` y
  `docs/planes/` si cambia una decisión o se completa una fase; el inventario del §3 si se crea
  una pieza reutilizable.
- `docs/` es **local y no se versiona** (está en `.gitignore`): guías del backend, planes y
  solicitudes al backend. Lo que deba quedar en el repositorio va en `README.md` o `AGENTS.md`.

## 13. Definición de terminado

- [ ] Se revisó qué reutilizar (§3) y se respetan las capas (§2); el resumen dice qué se
      reutilizó o extendió.
- [ ] `make verificar` pasa (tipos, lint y pruebas con cobertura).
- [ ] Hay pruebas para lo nuevo o modificado (§10), incluidos casos de error.
- [ ] Si cambió una pantalla o un flujo: `make e2e` pasa (flujos y accesibilidad) en escritorio
      y en móvil.
- [ ] `make build` pasa (incluye el presupuesto de peso).
- [ ] Funciona desde 360 px, con teclado y sin WebGL (menú alterno).
- [ ] Documentación e inventario actualizados (§12); `AGENTS.md` si cambió tecnología o convención.

## 14. Comandos

| Acción | Comando |
|---|---|
| Ver todos | `make` |
| Primera vez | `make instalar` |
| Desarrollo (`:5173`) | `make dev` |
| Shell en el contenedor | `make sh` |
| Tipos del contrato | `make tipos-api` (lee `$(BACK_DIR)/apps/api/openapi.json`, omite los `operationId` repetidos del contrato y guarda su huella en `src/api/contrato.huella`; `make verificar` avisa si el backend cambió) |
| Verificación completa | `make verificar` |
| Pruebas unitarias / con cobertura | `make test` · `make cov` (informe en `coverage/`) |
| E2E + accesibilidad | `make e2e` · `make e2e ARGS="e2e/flujos.spec.ts --project movil"` |
| Build / paquete | `make build` · `make paquete VERSION=x.y.z` |
| Build final con Nginx (`:8088`) | `make preview` |
| Dependencia nueva | `make sh` → `npm install <pkg> --save-exact --before=<fecha>` |

## 15. Git

- Rama principal `main`; trabajo en `feature/<tema>`, `fix/<tema>`, `docs/<tema>`.
- Commits en español, en imperativo y con un solo propósito (`Agregar módulo de reservas`).
- Identidad del proyecto: `barale2906 <alexanderbarajas@gmail.com>` (configurada en el repo).
- No subir `node_modules/`, `dist/`, paquetes `.tar.gz`, `coverage/` ni informes de pruebas.

## 16. No hacer

- No instalar nada en el equipo: todo corre en Docker.
- No escribir código nuevo sin buscar antes qué reutilizar (§3).
- No duplicar código: extender o extraer.
- No importar `three` fuera de `src/escena/` ni cargar la escena de forma síncrona.
- No editar `src/api/esquema.d.ts` ni `src/api/contrato.huella` a mano.
- No usar `any`, `v-html` con datos externos ni `Number()` para montos.
- No usar colores o tamaños sueltos fuera de los tokens.
- No desactivar lints ni pruebas, ni bajar umbrales de cobertura o del presupuesto para que pase.
- No incorporar tecnología sin actualizar este documento.

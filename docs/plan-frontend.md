# Plan del frontend

Documento vivo. Parte del *Concepto de frontend: navegación por maqueta 3D* (v1.0, 14-nov-2026)
y de las decisiones de arranque.

## Requisitos

0. Estética de menú de videojuego futurista, con 3D interactivo y **liviano**.
1. Pantalla de acceso con diseño propio, no solo el formulario.
2. Al entrar se elige la entidad (PH o empresa); con una sola, entra directo.
3. Maqueta 3D de **conjunto** (PH) u **oficina** (empresa); cada zona abre su menú.
4. Menús interactivos y dinámicos que muestran lo que puede hacer cada módulo.
5. Completamente responsive.
6. Todo en Docker; el resultado son archivos estáticos para copiar a los servidores.

## Decisiones

| # | Decisión | Resultado |
|---|---|---|
| 1 | Zonas de módulos no contratados | **Apagadas** (gris, con candado y aviso «no contratado»), no ocultas |
| 2 | Móvil | **Maqueta simplificada** (calidad `baja`: sin detalle, densidad 1, sin antialias) con hoja inferior; la lista siempre está a un toque |
| 3 | Identidad visual DAD | Pendiente. Todo sale de los tokens de `src/hud/estilos/tokens.css` y de la paleta de `src/escena/piezas.ts` |
| 4 | Router | Modo *history* (URLs limpias) con el *fallback* de Nginx |
| 5 | Tipo de entidad | Lo entrega el backend: `InicioRespuesta.entidades[].tipo` y `GET /yo/entidades` (`propiedad_horizontal` / `empresa`) |
| 6 | Maqueta | **Genérica**: una plantilla fija por tipo, igual para todos los clientes. No pide nada al backend; por cliente solo cambia qué zonas se encienden |
| 7 | Motor 3D | **three.js directo** en lugar de TresJS: escena generada por código, menos capas y sin depender de la migración v4→v5 de TresJS |
| 8 | UI de módulos | PrimeVue en modo *unstyled* + tokens HUD; se incorpora en la fase 3 (zonas comunes) |
| 9 | Configuración | `config.json` en tiempo de ejecución: un solo build para todos los ambientes |
| 10 | Versiones | Exactas en `package.json` (sin `^`) y con al menos 2 semanas de publicadas |

## Cómo se mantiene liviano

| Medida | Estado |
|---|---|
| JS inicial (login) ≈ 57 KB gzip, sin three.js | ✔ |
| three.js + escena en un chunk diferido (≈ 145 KB gzip) | ✔ |
| Render **bajo demanda**: 0 fps con la escena quieta, pausa con KeepAlive o con la pestaña oculta | ✔ |
| 5 geometrías compartidas y materiales fijos por paleta; encender o apagar una zona es reasignar materiales | ✔ |
| Sin sombras ni postprocesado; brillo con emisivos y contornos | ✔ |
| Selección por rayo contra la caja de cada zona | ✔ |
| Calidad automática (`alta / media / baja / lista`) por núcleos, memoria y tipo de puntero | ✔ |
| Holograma del login solo en calidad alta o media, después del primer pintado, a ≤ 30 fps | ✔ |
| Sin WebGL o si falla el contexto → menú alterno automático | ✔ |
| `prefers-reduced-motion`: sin transiciones de cámara ni animaciones | ✔ |

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| 0. Prototipo técnico | Toolchain Docker, motor, maquetas genéricas, calidad, selección → panel → ruta | ✔ |
| 1. Base y sistema HUD | Tokens y componentes HUD, acceso con 2FA y recuperación, selector, sesión y renovación entre pestañas, marco de módulos | ✔ (base) |
| 2. Maquetas completas | Ajuste fino visual con la identidad DAD, pruebas en un Android de gama media-baja, preferencia de calidad en la UI | Pendiente |
| 3. Zonas comunes | Primer módulo real (reservas) con PrimeVue; plantilla para los demás | Pendiente |
| 4. Resto de módulos | Unidades, portería, asambleas (tablero en vivo por WebSocket), administración, cartera, contabilidad… | Pendiente |
| 5. Opcional | Modelos `.glb`, asamblea proyectada en 3D | — |

## Agregar una zona o un módulo

1. Sección y acciones: `src/escena/mapa-modulos.ts` (módulo contratable y permisos de cada acción).
2. Zona que la abre: `src/escena/plantillas/zonas.ts` (datos, sin three.js).
3. Geometría de la zona: `conjunto.ts` u `oficina.ts`, con piezas del kit (`piezas.ts`). Si falta,
   `armar()` falla al cargar.
4. Icono de la sección: `src/pantallas/iconos.ts`.
5. La vista real del módulo va en `src/modulos/<seccion>/`.

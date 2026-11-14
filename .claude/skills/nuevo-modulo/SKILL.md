---
name: nuevo-modulo
description: Pasos para construir un módulo funcional (zonas comunes, portería, asambleas, cartera, contabilidad…) dentro de src/modulos/ e integrarlo con la maqueta 3D, el menú alterno y el marco de módulos. Úsala al empezar cualquier módulo o una acción nueva de un módulo existente.
---

# Nuevo módulo funcional

Sigue primero la skill `nueva-funcionalidad` y `AGENTS.md` (§2, §6, §10). Esto agrega lo propio
de un módulo.

1. **Sección en el mapa.** Revisa si la sección ya existe en `src/escena/mapa-modulos.ts` (casi
   todas existen). Ajusta sus `acciones` (id, etiqueta, descripción y permisos reales del
   contrato) y su `modulo`. No dupliques secciones.
2. **Zona.** Si necesita una zona nueva en la maqueta: datos en
   `src/escena/plantillas/zonas.ts` y geometría con piezas del `Kit` en `conjunto.ts` u
   `oficina.ts` (mismo id). Icono en `src/pantallas/iconos.ts`.
3. **Estructura** en `src/modulos/<seccion>/`:
   - `api.ts`: funciones tipadas sobre `exigir(api()…)` (con `idempotencia()` en los POST);
   - `store.ts` solo si varias vistas comparten estado;
   - `vistas/<Accion>View.vue` y `componentes/`; lo que sirva a otros módulos sube a `src/hud/`.
   El módulo no importa de otros módulos.
4. **Ruta.** Las acciones se montan dentro del marco de `ModuloView.vue` (menú lateral, migas y
   «Volver a la maqueta»), cargadas en diferido. Respeta `?zona=` (preselección) y `?origen=`.
5. **Permisos.** Muestra u oculta con `useEntidad().tienePermiso/tieneModulo`; ante 403
   `sin_permiso`/`modulo_no_habilitado`, `useEntidad().refrescar()`.
6. **Demo.** Agrega a `src/mocks/demo.ts` las rutas que use el módulo, con el formato del
   contrato, para poder probarlo sin backend.
7. **Pruebas:** unitarias de `api.ts`/store, de componentes clave, escenario E2E del flujo
   principal (escritorio y móvil) y la pantalla en `e2e/accesibilidad.spec.ts`. Agrega la lógica
   del módulo al `include` de cobertura en `vite.config.ts`.
8. **Verificación:** `make verificar`, `make e2e`, `make build`. Actualiza el estado de la fase en
   `docs/plan-frontend.md` y el inventario de AGENTS.md §3 con las piezas reutilizables nuevas.

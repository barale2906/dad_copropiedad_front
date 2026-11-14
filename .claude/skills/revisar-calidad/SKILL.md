---
name: revisar-calidad
description: Revisión de un cambio de dad_copropiedad_front contra AGENTS.md antes de darlo por terminado o de hacer commit: reutilización, capas, pruebas, rendimiento, accesibilidad y responsive. Úsala al cerrar una tarea o cuando pidan revisar código del frontend.
---

# Revisión de calidad

Revisa el cambio (`git diff` y archivos nuevos) contra `AGENTS.md`. Reporta cada hallazgo con
archivo y línea, y corrige lo que esté dentro del alcance de la tarea.

1. **Reutilización (§3):** ¿hay código que repite algo del inventario o de otro archivo? ¿Se
   creó un componente o función que ya existía o que debió extender uno existente? ¿Lo nuevo
   reutilizable quedó en el inventario?
2. **Capas (§2):** imports prohibidos (`three` fuera de `src/escena/`, módulos que se importan
   entre sí, `hud/` llamando a la API, `api/` importando Vue).
3. **Limpieza (§1, §5):** responsabilidades mezcladas, componentes demasiado grandes, `any`,
   `!` dudosos, lógica en la plantilla, props mutadas, listeners sin liberar, código muerto,
   textos sin usted o con jerga.
4. **Datos (§5):** API solo con `exigir`, errores por `codigo`, `Number()` sobre montos, fechas en
   la zona del navegador, POST sin `idempotencia()`.
5. **Pruebas (§10):** cada lógica, componente y flujo nuevo tiene su prueba; hay casos de error;
   los E2E usan roles y no `waitForTimeout`.
6. **Rendimiento (§7):** imports pesados en el bundle inicial, materiales por malla, bucles de
   render continuos, dependencias nuevas sin justificar.
7. **UI (§8, §9):** colores o tamaños sueltos, desbordes en 360 px, objetivos táctiles chicos,
   nombres accesibles, foco, `Escape`, estados de cargando/vacío/error.
8. **Ejecuta** `make verificar`, `make build` y, si cambió una pantalla, `make e2e`. Informa el
   resultado real de cada comando.

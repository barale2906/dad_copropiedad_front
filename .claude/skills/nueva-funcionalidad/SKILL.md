---
name: nueva-funcionalidad
description: Procedimiento para diseñar e implementar cualquier funcionalidad o cambio de comportamiento en dad_copropiedad_front (componente, pantalla, store, composable, llamada a la API, ajuste de la maqueta) cumpliendo AGENTS.md. Úsala antes de escribir código.
---

# Nueva funcionalidad en dad_copropiedad_front

> **Responde siempre en español** (avisos, preguntas y resúmenes), según `AGENTS.md` §5.

`AGENTS.md` es la fuente única de verdad; esta skill solo ordena los pasos. Léelo primero.

1. **Requisito.** Resume qué se pide, qué endpoint del contrato usa (busca en
   `src/api/esquema.d.ts`), qué permisos (`Permiso`) y qué módulo (`Modulo`) lo habilitan. Si hay
   ambigüedad de negocio, pregunta.
2. **Reutilización (obligatorio).** Revisa el inventario de AGENTS.md §3 y busca:
   `grep -rn "<concepto>" src e2e`. Decide para cada pieza: usar tal cual, **extender** (prop
   opcional, slot, variante, parámetro por defecto, sin romper a los usuarios actuales) o crear
   nueva en la capa correcta (AGENTS.md §2). Anota qué reutilizas y por qué descartas lo demás.
3. **Diseño.** Tipos del contrato → función pura o composable → store solo si el estado se
   comparte → componentes `Hud*` → vista y ruta diferida → `mapa-modulos.ts` si es navegable.
   Estados de cargando, vacío y error; responsive desde 360 px; accesible.
4. **Pruebas** (AGENTS.md §10), junto con el código:
   - lógica → `src/__tests__/<tema>.test.ts` (éxito, error y bordes);
   - componente → prueba con Vue Test Utils (qué muestra según props/permisos, qué emite);
   - pantalla o flujo → escenario en `e2e/` y la pantalla en `e2e/accesibilidad.spec.ts`;
   - bug → primero la prueba que lo reproduce.
5. **Documentación:** TSDoc en lo exportado; inventario de AGENTS.md §3 si creaste algo
   reutilizable; `README.md`/`docs/plan-frontend.md` si cambian comandos o decisiones.
6. **Tecnología nueva:** versión exacta con ≥ 2 semanas (`npm install <pkg> --save-exact
   --before=<fecha>` dentro de `make sh`), justificada por su peso; actualiza AGENTS.md §4.
7. **Verificación:** `make verificar`; si cambió una pantalla o un flujo, `make e2e`; `make build`
   (presupuesto de peso).
8. **Cierre:** recorre la definición de terminado (AGENTS.md §13) e informa qué se reutilizó o
   extendió, qué pruebas se agregaron y cómo se verificó.

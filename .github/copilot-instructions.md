# Instrucciones para GitHub Copilot (VS Code)

Las pautas de este repositorio están en [`AGENTS.md`](../AGENTS.md), la **fuente única de verdad**.
Léelo y cúmplelo antes de proponer o generar código. Si hay conflicto, prevalece `AGENTS.md`.

Lo esencial:
- Código profesional, limpio, reutilizable y escalable (§1); capas con dependencias en un solo sentido (§2).
- **Antes de escribir algo nuevo, busca qué reutilizar o extender** en el inventario de §3 y con `grep -rn "<concepto>" src`.
- Toda funcionalidad lleva pruebas: unitarias y de componentes (Vitest), E2E y accesibilidad (Playwright) si cambia un flujo (§10).
- Vue 3 `<script setup lang="ts">`, TypeScript estricto sin `any`, nombres en español, API solo con `exigir(api()…)`.
- `three` solo dentro de `src/escena/` y cargado en diferido; presupuesto de peso en cada build (§7).
- Estilos solo con los tokens HUD; responsive desde 360 px; WCAG 2.1 AA (§8, §9).
- Todo corre en Docker (`make …`). Para terminar: `make verificar` (y `make e2e` si cambió una pantalla).

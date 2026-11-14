# Convenciones del frontend (obligatorias)

Las leen todas las herramientas (Claude Code vía `CLAUDE.md`, Cursor, Copilot…).

## Entorno
- **No se instala nada en el equipo.** Todo comando de Node corre en Docker: `make …` o
  `make sh`. Dependencias nuevas: `npm install <paquete> --save-exact` dentro del contenedor,
  con una versión que tenga al menos 2 semanas de publicada.
- Antes de terminar una tarea: `make verificar` (typecheck + lint + pruebas). Si toca la maqueta
  o el diseño, revise también `make preview` en escritorio y en móvil.

## Código
- Idioma: **español** en nombres, comentarios y textos (igual que el backend). Usted en los textos
  para el usuario.
- Vue 3 con `<script setup lang="ts">`, Pinia y TypeScript estricto. Alias `@/` → `src/`.
- `src/api/esquema.d.ts` es generado (`make tipos-api`): no se edita a mano. Use los alias de
  `src/api/tipos.ts` y llame a la API con `exigir(api().GET(...))`.
- Decida por `error.codigo`, nunca por el texto del mensaje. Montos y coeficientes son texto
  decimal: nunca `Number()` para calcular.
- Permisos y módulos se consultan en el store `entidad` (`tieneModulo`, `tienePermiso`); el
  frontend solo oculta, el backend decide.

## Maqueta 3D
- El 3D es solo navegación. **Toda función debe poder alcanzarse sin la maqueta** (menú alterno).
- `mapa-modulos.ts` es el único lugar donde se relacionan secciones, acciones, módulos y permisos.
- Nada fuera de `src/escena/` importa `three`; los componentes 3D se cargan con
  `defineAsyncComponent` para que three.js quede en su propio chunk.
- Reutilice las geometrías y materiales del `Kit`; no cree materiales por malla. Sin sombras ni
  postprocesado. El render es bajo demanda: no agregue bucles continuos.

## Estilo
- Colores, tipografías y tiempos solo desde los tokens (`src/hud/estilos/tokens.css`).
- Componentes base `Hud*` antes que estilos sueltos. Responsive desde 360 px; objetivos táctiles
  de al menos 40 px.
- Respete `prefers-reduced-motion` y el foco visible.

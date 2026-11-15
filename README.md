# dad_copropiedad_front

Frontend web de **DAD Copropiedad** (DAD AI & SYSTEMS). Consume el backend
[`dad_copropiedad_back`](../../Back/dad_copropiedad_back) (Rust).

La navegación es una **maqueta 3D genérica** con estética de menú de videojuego futurista: un
conjunto residencial para las propiedades horizontales y una oficina para las demás empresas.
Cada zona abre el menú de sus módulos. El 3D es solo la capa de navegación: los módulos de
trabajo diario son vistas planas y rápidas, y todo se puede usar sin la maqueta (vista de lista).

## Requisitos

Solo **Docker** con Compose y BuildKit. No se instala Node ni nada más en el equipo.

## Comandos

```bash
make            # lista los comandos
make instalar   # una vez: imagen de desarrollo + npm ci (en un volumen de Docker)
make dev        # http://localhost:5173 con recarga en caliente
make verificar  # tipos + lint + pruebas unitarias con cobertura, antes de terminar una tarea
make e2e        # pruebas E2E + accesibilidad (Playwright) en escritorio y móvil
make build      # ./dist: solo archivos estáticos (falla si se excede el presupuesto de peso)
make paquete    # dad-front-<versión>.tar.gz + .sha256 para los servidores
make preview    # sirve el build final con Nginx en http://localhost:8088
make tipos-api  # regenera src/api/esquema.d.ts desde el openapi.json del backend
make sh         # shell en el contenedor (p. ej. npm install <paquete> --save-exact)
```

`BACK_DIR` apunta al repositorio del backend (por defecto `../../Back/dad_copropiedad_back`).

## Modo demo

`public/config.json` trae `"modoDemo": true`: la app responde con datos simulados con el formato
del contrato (`src/mocks/demo.ts`). Cualquier usuario y contraseña entran:

| Usuario contiene | Resultado |
|---|---|
| (cualquiera) | 3 entidades → selector |
| `uno` | 1 PH → entra directo a la maqueta del conjunto |
| `empresa` | 1 empresa → maqueta de oficina |
| `2fa` | pide segundo factor (código `123456`) |

En el demo, el conjunto no tiene contratados `publicidad` ni `facturacion_electronica`, y la
empresa solo tiene `contabilidad`: así se ven las zonas apagadas.

## Despliegue (pruebas y producción)

1. `make paquete VERSION=x.y.z`.
2. Copiar y descomprimir el `.tar.gz` en el directorio público del dominio.
3. **Editar `config.json` en cada servidor** (no se recompila por ambiente). `apiUrl` es el
   origen del backend **sin** `/api/v1`; vacío si la API está en el mismo dominio:
   ```json
   { "apiUrl": "https://api.dominio.co", "modoDemo": false }
   ```
4. Nginx (HestiaCP): copiar las directivas de [`docker/nginx.conf`](docker/nginx.conf). Hacen
   falta el *fallback* a `index.html` (el router usa URLs limpias), la caché larga en
   `/assets/` y `no-store` en `config.json`.
5. En el backend, el origen exacto de la web debe estar en `CORS_ORIGENES`.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/app/` | arranque, router y guardas, `config.json` en tiempo de ejecución |
| `src/api/` | cliente tipado (openapi-fetch), tokens y renovación, errores; `esquema.d.ts` es **generado** |
| `src/stores/` | Pinia: sesión, entidad activa (capacidades), preferencias |
| `src/hud/` | sistema visual: tokens CSS, estilos base y componentes `Hud*` |
| `src/escena/` | motor 3D (three.js), kit de piezas, plantillas `conjunto`/`oficina`, calidad, **`mapa-modulos.ts`** |
| `src/pantallas/` | login, selector de entidad, maqueta, marco de módulos, menú alterno |
| `src/modulos/` | módulos funcionales (a partir de la fase 3) |
| `src/mocks/` | backend simulado del modo demo |
| `src/__tests__/` | pruebas unitarias y de componentes (Vitest) |
| `e2e/` | pruebas E2E y de accesibilidad (Playwright + axe) |
| `scripts/` | presupuesto de peso del build |
| `docker/` | Dockerfile multi-etapa y Nginx de referencia |
| `docs/` | **local, fuera de Git**: plan, guías del backend, planes por módulo y solicitudes al backend |

## Pautas de desarrollo

[`AGENTS.md`](AGENTS.md) es la fuente única de las pautas (calidad, reutilización, pruebas,
rendimiento, accesibilidad, definición de terminado). `CLAUDE.md`, `.cursor/rules/` y
`.github/copilot-instructions.md` remiten a él, y `.claude/skills/` trae los procedimientos
`nueva-funcionalidad`, `nuevo-modulo` y `revisar-calidad`.

Plan y decisiones: `docs/plan-frontend.md` y `docs/planes/` (carpeta local, no versionada).

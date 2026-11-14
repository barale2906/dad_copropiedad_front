# Frontend DAD Copropiedad — todo corre en Docker; `make` lista los comandos.
SHELL := /bin/bash
.DEFAULT_GOAL := ayuda

VERSION  ?= $(shell node -p "require('./package.json').version" 2>/dev/null || grep -m1 '"version"' package.json | cut -d'"' -f4)
BACK_DIR ?= ../../Back/dad_copropiedad_back
export BACK_DIR

RUN := docker compose run --rm --no-deps dev

.PHONY: ayuda imagen instalar dev sh tipos-api typecheck lint formato test verificar build paquete preview limpiar

ayuda: ## Lista los comandos
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-11s\033[0m %s\n", $$1, $$2}'

imagen: ## Construye la imagen de desarrollo
	docker compose build dev

instalar: imagen ## Instala dependencias exactas (npm ci) en el volumen
	$(RUN) npm ci --no-audit --no-fund

dev: ## Servidor de desarrollo en http://localhost:5173
	docker compose up dev

sh: ## Shell dentro del contenedor (p. ej. para npm install <paquete> --save-exact)
	$(RUN) sh

tipos-api: ## Regenera src/api/esquema.d.ts desde el openapi.json del backend
	$(RUN) npm run tipos-api

typecheck: ## Revisa tipos (vue-tsc)
	$(RUN) npm run typecheck

lint: ## ESLint
	$(RUN) npm run lint

formato: ## Prettier sobre src/
	$(RUN) npm run format

test: ## Pruebas unitarias (Vitest)
	$(RUN) npm test

verificar: ## typecheck + lint + test, antes de terminar una tarea
	$(RUN) sh -c 'npm run typecheck && npm run lint && npm test'

build: ## Genera ./dist (solo archivos estáticos)
	rm -rf dist
	DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile --target export \
		--build-arg VERSION=$(VERSION) --output type=local,dest=./dist .

paquete: build ## dist → dad-front-<versión>.tar.gz + .sha256 para los servidores
	tar -czf dad-front-$(VERSION).tar.gz -C dist .
	sha256sum dad-front-$(VERSION).tar.gz > dad-front-$(VERSION).tar.gz.sha256
	@echo "Listo: dad-front-$(VERSION).tar.gz (recuerde ajustar config.json en cada servidor)"

preview: ## Sirve el build de producción con Nginx en http://localhost:8088
	docker build -f docker/Dockerfile --target preview --build-arg VERSION=$(VERSION) -t dad-front-preview .
	docker run --rm -p 8088:80 dad-front-preview

limpiar: ## Borra dist y paquetes
	rm -rf dist dad-front-*.tar.gz dad-front-*.sha256

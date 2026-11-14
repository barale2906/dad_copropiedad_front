# syntax=docker/dockerfile:1
# Frontend DAD Copropiedad: todo el toolchain vive aquí, nada se instala en el equipo.
#
#   dev      → imagen para `docker compose` (Vite con HMR, el código se monta como volumen)
#   build    → compila la app (vue-tsc + vite build)
#   export   → solo `dist/`: `docker build --target export --output type=local,dest=./dist .`
#   preview  → Nginx sirviendo `dist/` igual que en los servidores (prueba del build final)

ARG NODE_IMAGE=node:24.22.3-alpine
ARG NGINX_IMAGE=nginx:1.29.3-alpine

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS dev
WORKDIR /app
# El volumen de node_modules hereda este dueño la primera vez que se crea, así el
# usuario `node` (uid 1000) puede instalar sin root.
RUN mkdir -p /app/node_modules /home/node/.npm && chown -R node:node /app /home/node/.npm
USER node
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM deps AS build
ARG VERSION=0.0.0-dev
ENV VITE_APP_VERSION=${VERSION}
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM scratch AS export
COPY --from=build /app/dist /

# ---------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS preview
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

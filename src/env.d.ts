/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Versión inyectada en el build (`make build VERSION=…`). */
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

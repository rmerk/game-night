/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  readonly VITE_INCLUDE_DEV_PAGES?: string;
  /** WebSocket base URL, e.g. `wss://api.example.com` — defaults to `ws://localhost:3001` in dev */
  readonly VITE_WS_BASE_URL?: string;
  /** HTTP API origin for room creation, e.g. `https://api.example.com` — defaults to `http://localhost:3001` in dev */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

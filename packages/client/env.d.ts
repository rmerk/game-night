/// <reference types="vite-plus/client" />

interface ImportMetaEnv {
  readonly VITE_INCLUDE_DEV_PAGES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

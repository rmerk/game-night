import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";

/** GitHub project Pages need a subpath base, e.g. `/repo-name/`. Set `GH_PAGES_BASE` at build time. */
function ghPagesBase(): string {
  const raw = process.env.GH_PAGES_BASE;
  if (raw == null || raw === "" || raw === "/") return "/";
  let b = raw.startsWith("/") ? raw : `/${raw}`;
  return b.endsWith("/") ? b : `${b}/`;
}

export default defineConfig({
  base: ghPagesBase(),
  lint: {
    plugins: ["typescript", "import", "vue"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: [vue(), UnoCSS()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

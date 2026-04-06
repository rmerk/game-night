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
  /** Bind IPv4 loopback so `http://localhost:5173` works when OS resolves localhost → 127.0.0.1 */
  server: {
    host: "127.0.0.1",
  },
  lint: {
    plugins: ["typescript", "import", "vue"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: [vue(), UnoCSS()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("livekit-client")) {
            return "livekit";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

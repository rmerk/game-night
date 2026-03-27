import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";

export default defineConfig({
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

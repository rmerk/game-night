import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*.{ts,tsx,js,jsx,vue,json,yaml,yml,css,html}": "vp check --fix",
  },
  lint: {
    plugins: ["typescript", "import"],
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
      style: "off",
      pedantic: "off",
      nursery: "off",
      restriction: "off",
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "typescript/no-explicit-any": "warn",
    },
    overrides: [
      {
        files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/*.test.vue"],
        rules: {
          "@typescript-eslint/no-unsafe-type-assertion": "off",
          "no-await-in-loop": "off",
        },
      },
      {
        files: ["packages/server/src/testing/**/*.ts"],
        rules: {
          "@typescript-eslint/no-unsafe-type-assertion": "off",
        },
      },
      {
        files: ["scripts/**/*.{js,mjs,cjs}"],
        rules: {
          "no-console": "off",
          "no-await-in-loop": "off",
        },
      },
    ],
    ignorePatterns: ["dist/", "node_modules/", "*.config.ts", "*.config.js"],
    options: {
      typeAware: true,
      typeCheck: true,
      maxWarnings: 0,
    },
  },
});

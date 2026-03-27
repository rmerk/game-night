import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
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
      "no-console": "warn",
      "typescript/no-explicit-any": "warn",
    },
    ignorePatterns: ["dist/", "node_modules/", "*.config.ts", "*.config.js"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});

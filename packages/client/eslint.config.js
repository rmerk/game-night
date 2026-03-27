import pluginVue from "eslint-plugin-vue";
import oxlint from "eslint-plugin-oxlint";
import tsParser from "@typescript-eslint/parser";

export default [
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  ...oxlint.configs["flat/recommended"],
];

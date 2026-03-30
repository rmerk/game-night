import { defineConfig, presetWind4, transformerVariantGroup, transformerDirectives } from "unocss";
import {
  themeColors,
  themeSpacing,
  themeRadius,
  themeShadows,
  themeShortcuts,
} from "./src/styles/design-tokens";

export default defineConfig({
  presets: [presetWind4()],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  theme: {
    colors: themeColors,
    spacing: themeSpacing,
    radius: themeRadius,
    shadow: themeShadows,
  },
  shortcuts: themeShortcuts,
});

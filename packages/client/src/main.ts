import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router";
import App from "./App.vue";
// oxlint-disable-next-line import/no-unassigned-import -- design system foundation styles
import "./styles/theme.css";
// oxlint-disable-next-line import/no-unassigned-import -- global typography defaults
import "./styles/base.css";
// oxlint-disable-next-line import/no-unassigned-import -- side-effect import required by UnoCSS
import "virtual:uno.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");

import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";

const devRoutes = import.meta.env.DEV
  ? [
      {
        path: "/dev/harness",
        name: "dev-harness",
        component: () => import("../components/dev/TestHarness.vue"),
      },
      {
        path: "/dev/theme",
        name: "dev-theme",
        component: () => import("../components/dev/ThemeShowcase.vue"),
      },
    ]
  : [];

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    ...devRoutes,
  ],
});

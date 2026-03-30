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
      {
        path: "/dev/tiles",
        name: "dev-tiles",
        component: () => import("../components/dev/TileShowcase.vue"),
      },
      {
        path: "/dev/rack",
        name: "dev-rack",
        component: () => import("../components/dev/RackShowcase.vue"),
      },
      {
        path: "/dev/table",
        name: "dev-table",
        component: () => import("../components/dev/GameTableShowcase.vue"),
      },
      {
        path: "/dev/discard",
        name: "dev-discard",
        component: () => import("../components/dev/DiscardShowcase.vue"),
      },
      {
        path: "/dev/call-buttons",
        name: "dev-call-buttons",
        component: () => import("../components/dev/CallButtonsShowcase.vue"),
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

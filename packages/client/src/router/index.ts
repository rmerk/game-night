import { createRouter, createWebHistory } from "vue-router";
import { devShowcaseRouteRecords } from "../dev-showcase-routes";
import { includeDevPages } from "../include-dev-pages";
import HomeView from "../views/HomeView.vue";
import RoomView from "../views/RoomView.vue";

const devRoutes = includeDevPages() ? devShowcaseRouteRecords() : [];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/room/:code",
      name: "room",
      component: RoomView,
    },
    ...devRoutes,
  ],
});

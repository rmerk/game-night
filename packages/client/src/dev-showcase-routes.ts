import type { RouteComponent, RouteRecordRaw } from "vue-router";

export type DevShowcaseDef = {
  path: string;
  name: string;
  label: string;
  blurb: string;
  component: RouteComponent;
};

export const devShowcaseDefs: DevShowcaseDef[] = [
  {
    path: "/dev/harness",
    name: "dev-harness",
    label: "Test harness",
    blurb: "Local engine loop — racks, draw, discard, wall.",
    component: () => import("./components/dev/TestHarness.vue"),
  },
  {
    path: "/dev/theme",
    name: "dev-theme",
    label: "Theme",
    blurb: "Design tokens and UI primitives.",
    component: () => import("./components/dev/ThemeShowcase.vue"),
  },
  {
    path: "/dev/tiles",
    name: "dev-tiles",
    label: "Tiles",
    blurb: "Tile faces and suits.",
    component: () => import("./components/dev/TileShowcase.vue"),
  },
  {
    path: "/dev/rack",
    name: "dev-rack",
    label: "Rack",
    blurb: "Player rack layout and drag-and-drop.",
    component: () => import("./components/dev/RackShowcase.vue"),
  },
  {
    path: "/dev/table",
    name: "dev-table",
    label: "Table",
    blurb: "Four-seat table layout.",
    component: () => import("./components/dev/GameTableShowcase.vue"),
  },
  {
    path: "/dev/game-status",
    name: "dev-game-status",
    label: "Game status",
    blurb: "Turn indicator, wall counter, and scoreboard states.",
    component: () => import("./components/dev/GameStatusShowcase.vue"),
  },
  {
    path: "/dev/discard",
    name: "dev-discard",
    label: "Discard pool",
    blurb: "Discard pool presentation.",
    component: () => import("./components/dev/DiscardShowcase.vue"),
  },
  {
    path: "/dev/call-buttons",
    name: "dev-call-buttons",
    label: "Call buttons",
    blurb: "Mahjong / pong / etc. actions.",
    component: () => import("./components/dev/CallButtonsShowcase.vue"),
  },
  {
    path: "/dev/mahjong-button",
    name: "dev-mahjong-button",
    label: "Mahjong button",
    blurb: "Persistent Mahjong CTA and invalid declaration feedback.",
    component: () => import("./components/dev/MahjongButtonShowcase.vue"),
  },
];

export function devShowcaseRouteRecords(): RouteRecordRaw[] {
  return devShowcaseDefs.map(({ path, name, component }) => ({
    path,
    name,
    component,
  }));
}

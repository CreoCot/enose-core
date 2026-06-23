import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("routes/sidebarpages.tsx", [route("/data", "routes/data.tsx")]),
] satisfies RouteConfig;

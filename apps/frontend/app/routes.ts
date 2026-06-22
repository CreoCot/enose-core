import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  layout("routes/sidebarpages.tsx", [
    index("routes/home.tsx"),
    route("/file", "routes/file.tsx"),
    route("/data", "routes/data.tsx"),
  ]),
] satisfies RouteConfig;

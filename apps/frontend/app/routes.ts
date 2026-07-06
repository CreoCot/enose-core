import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),

  layout("routes/sidebarpages.tsx", [
    route("entry/:fileId", "routes/file.tsx"),
    route("data", "routes/data.tsx"),
    route("profile", "routes/profile.tsx"),
  ]),
] satisfies RouteConfig;

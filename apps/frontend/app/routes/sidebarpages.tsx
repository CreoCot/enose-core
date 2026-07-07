import { Outlet, redirect, useLoaderData } from "react-router";
import ResponsiveSidebar from "../components/ResponsiveSidebar";
import api from "../axios";
import type { LoaderFunctionArgs } from "react-router";

export async function clientLoader() {
  try {
    const response = await api.get("/api/v1/auth/me");
    return { login: response.data.username };
  } catch (error) {
    throw redirect("/login");
  }
}
export function HydrateFallback() {
  return (
    <div className="flex w-full h-full min-h-screen">
      <ResponsiveSidebar login="Профиль" />
      <div className="w-full bg-grey-100 pb-5" />
    </div>
  );
}
export const sidebarpages = () => {
  const loaderData = useLoaderData();
  const { login } = loaderData;
  return (
    <div className="flex w-full h-full min-h-screen">
      <ResponsiveSidebar login={login} />
      <Outlet />
    </div>
  );
};

export default sidebarpages;
